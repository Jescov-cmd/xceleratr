/**
 * Worker thread: runs the WH_MOUSE_LL hook in its own message pump loop.
 *
 * Why a worker thread?  koffi synchronous callbacks only fire during a koffi
 * native call.  In the main process, Electron's message loop (Chromium) drives
 * PeekMessage — those calls never go through koffi, so the registered callback
 * is never invoked.  Here in the worker we drive our own PeekMessage pump via
 * setImmediate, so every pump tick is a koffi native call during which
 * Windows can deliver the hook.
 */

import { parentPort } from 'worker_threads'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const koffi   = require('koffi')
const user32  = koffi.load('user32.dll')
const kernel32 = koffi.load('kernel32.dll')

// Boost this thread to THREAD_PRIORITY_HIGHEST (2). Every mouse event in the
// system synchronously waits on this thread while our hook runs — if we get
// starved during boot/game-launch CPU storms, the whole cursor stutters.
try {
  const SetThreadPriority = kernel32.func('bool SetThreadPriority(void* hThread, int32 nPriority)')
  const GetCurrentThread  = kernel32.func('void* GetCurrentThread()')
  SetThreadPriority(GetCurrentThread(), 2)
} catch { /* non-fatal — default priority still works, just jitter-prone under load */ }

// ── Types ─────────────────────────────────────────────────────────────────────

type CurveType = 'default' | 'linear' | 'natural' | 'power' | 'sigmoid' | 'bounce' | 'classic' | 'jump' | 'custom'

interface CurvePoint { x: number; y: number }

interface CurveSettings {
  curveType: CurveType
  customCurvePoints: CurvePoint[]
  curveAcceleration: number
  accelerationEnabled: boolean
  curveThreshold: number
  curveExponent: number
  pollingRate: number
  yxRatio: number
  // Per-axis: when true, Y axis uses its own independent curve and yxRatio is ignored
  perAxisEnabled: boolean
  curveTypeY: CurveType
  customCurvePointsY: CurvePoint[]
  curveAccelerationY: number
  curveThresholdY: number
  curveExponentY: number
  curveSmoothing: number
}

let curve: CurveSettings = {
  curveType: 'default', customCurvePoints: [],
  curveAcceleration: 100, accelerationEnabled: true,
  curveThreshold: 50, curveExponent: 1.5, pollingRate: 1000, yxRatio: 1.0,
  perAxisEnabled: false,
  curveTypeY: 'default', customCurvePointsY: [],
  curveAccelerationY: 100, curveThresholdY: 50, curveExponentY: 1.5,
  curveSmoothing: 0,
}

// Smoothing + sub-pixel remainder state — persists across hook callbacks.
// smoothDx/Dy: low-pass filtered output delta so curveSmoothing actually filters
// felt cursor motion (the old behavior smoothed the multiplier, which was a no-op
// in practice because multipliers are typically steady).
// remX/remY: fractional pixel remainder so slow precise moves with sub-1.0
// multipliers don't get quantized to zero. Whole pixels emit; the leftover
// fraction carries to the next event.
let smoothDx = 0, smoothDy = 0
let remX = 0,    remY = 0
let lastEventTime = 0
let _loggedFirstMult = false

// Cached on apply — recomputing `5 * (1000 / pollingRate)` per mouse event was
// pure overhead in the 1000Hz hot path.
let _displayMax = 5

// ── Monotone cubic spline (Fritsch-Carlson) ───────────────────────────────────

function monoSpline(pts: CurvePoint[], x: number): number {
  const n = pts.length
  if (n === 0) return 1
  if (n === 1) return pts[0].y
  if (x <= pts[0].x) return pts[0].y
  if (x >= pts[n - 1].x) return pts[n - 1].y
  let k = 0
  while (k < n - 2 && x > pts[k + 1].x) k++
  const x0 = pts[k].x, y0 = pts[k].y, x1 = pts[k + 1].x, y1 = pts[k + 1].y
  const h = x1 - x0
  if (h < 1e-10) return y0
  const d = (y1 - y0) / h
  let m0 = k === 0 ? d : 0.5 * ((pts[k].y - pts[k - 1].y) / (pts[k].x - pts[k - 1].x) + d)
  let m1 = k === n - 2 ? d : 0.5 * (d + (pts[k + 2].y - pts[k + 1].y) / (pts[k + 2].x - pts[k + 1].x))
  if (Math.abs(d) < 1e-10) { m0 = m1 = 0 } else {
    const a = m0 / d, b = m1 / d, tau = a * a + b * b
    if (tau > 9) { const s = 3 / Math.sqrt(tau); m0 = s * a * d; m1 = s * b * d }
  }
  const t = (x - x0) / h, t2 = t * t, t3 = t2 * t
  return (2*t3 - 3*t2 + 1)*y0 + (t3 - 2*t2 + t)*h*m0 + (-2*t3 + 3*t2)*y1 + (t3 - t2)*h*m1
}

// ── Curve math ────────────────────────────────────────────────────────────────

interface AxisParams {
  type:         CurveType
  customPoints: CurvePoint[]
  acceleration: number
  threshold:    number
  exponent:     number
}

function multiplierFor(speed: number, p: AxisParams): number {
  if (!curve.accelerationEnabled || p.type === 'default') return 1
  // Curve domain matches the live-dot's display scale (5 px/event at 1000Hz =
  // ~5000 px/s, a fast normal flick). Was 60 here vs 5 in displayMax — the dot
  // would visually saturate the right side of the graph while the engine was
  // only evaluating the leftmost ~8% of the curve, so set curves felt nothing
  // like the graph showed.
  const x = speed >= _displayMax ? 1 : speed / _displayMax
  const a = p.acceleration / 100
  const t = Math.max(0.05, p.threshold / 100)
  switch (p.type) {
    case 'custom': {
      const pts = p.customPoints
      return pts && pts.length >= 2 ? monoSpline(pts, x) : 1
    }
    case 'linear':   return 1 + a * x
    case 'natural':  return 1 + a * (1 - Math.exp(-(5 / t) * x))
    case 'power':    return 1 + a * Math.pow(x, Math.max(0.3, p.exponent))
    case 'sigmoid': {
      const k = 10 + a * 10
      const s = (v: number) => 1 / (1 + Math.exp(-k * (v - t)))
      return 1 + a * (s(x) - s(0)) / (Math.abs(s(1) - s(0)) + 0.001)
    }
    case 'bounce':   return 1 + a * (1 - Math.exp(-4 * x) * Math.cos(1.5 * Math.PI * x))
    case 'classic':  return x < t * 0.5 ? 1 : x < t ? 1 + a * 0.5 : 1 + a
    case 'jump':     return x < t ? 1 : 1 + a
    default:         return 1
  }
}

function paramsX(): AxisParams {
  return {
    type: curve.curveType, customPoints: curve.customCurvePoints,
    acceleration: curve.curveAcceleration, threshold: curve.curveThreshold, exponent: curve.curveExponent,
  }
}

function paramsY(): AxisParams {
  return {
    type: curve.curveTypeY, customPoints: curve.customCurvePointsY,
    acceleration: curve.curveAccelerationY, threshold: curve.curveThresholdY, exponent: curve.curveExponentY,
  }
}

// ── Win32 struct / function definitions ──────────────────────────────────────

const POINT_S = koffi.struct('POINT_S', { x: 'int32', y: 'int32' })

const MSLLHOOKSTRUCT_T = koffi.struct('MSLLHOOKSTRUCT', {
  pt:          POINT_S,
  mouseData:   'uint32',
  flags:       'uint32',
  time:        'uint32',
  dwExtraInfo: 'uintptr_t',
})

const MOUSEINPUT_S = koffi.struct('MOUSEINPUT_S', {
  dx:          'int32',
  dy:          'int32',
  mouseData:   'uint32',
  dwFlags:     'uint32',
  time:        'uint32',
  dwExtraInfo: 'uintptr_t',
})
const KEYBDINPUT_S = koffi.struct('KEYBDINPUT_S', {
  wVk:         'uint16',
  wScan:       'uint16',
  dwFlags:     'uint32',
  time:        'uint32',
  dwExtraInfo: 'uintptr_t',
})
const INPUT_T = koffi.struct('INPUT_T', {
  type: 'uint32',
  u:    koffi.union('INPUT_UNION', { mi: MOUSEINPUT_S, ki: KEYBDINPUT_S }),
})

const MSG_S = koffi.struct('MSG_S', {
  hwnd:     'void*',
  message:  'uint32',
  wParam:   'uintptr_t',
  lParam:   'intptr_t',
  time:     'uint32',
  pt:       POINT_S,
  lPrivate: 'uint32',
})

// koffi's string-based func() parser does not support callback-pointer params
// (e.g. "HookProto *lpfn"). Use void* and pass the koffi.register() result directly.
const HookProto    = koffi.proto('intptr_t __stdcall HookProto(int32 nCode, uintptr_t wParam, void *lParam)')
const SetHookEx    = user32.func('void* SetWindowsHookExW(int32 idHook, void* lpfn, void* hmod, uint32 dwThreadId)')
const CallNextHook = user32.func('intptr_t CallNextHookEx(void* hhk, int32 nCode, uintptr_t wParam, void *lParam)')
const UnhookHook   = user32.func('bool UnhookWindowsHookEx(void* hhk)')
const SendInput    = user32.func('uint32 SendInput(uint32 cInputs, INPUT_T *pInputs, int32 cbSize)')
const PeekMsg      = user32.func('bool PeekMessageW(MSG_S *lpMsg, void* hWnd, uint32 wMsgFilterMin, uint32 wMsgFilterMax, uint32 wRemoveMsg)')
const GetSysMetric = user32.func('int32 GetSystemMetrics(int32 nIndex)')
const TranslateMsg = user32.func('bool TranslateMessage(MSG_S *lpMsg)')
const DispatchMsg  = user32.func('intptr_t DispatchMessageW(MSG_S *lpMsg)')

const INPUT_SIZE = koffi.sizeof(INPUT_T)

// ── Hook state ────────────────────────────────────────────────────────────────

let hookHandle: any = null

// Injection ring buffer — shaped deltas queued by the hook callback, injected
// by the pump loop AFTER the callback has returned (see comment at the queue
// site for why SendInput must never run inside the callback). Fixed-size
// typed arrays: no allocation in the hot path.
const INJ_MAX = 64
const injDx = new Int32Array(INJ_MAX)
const injDy = new Int32Array(INJ_MAX)
let injHead = 0, injTail = 0, injCount = 0

// prevX/prevY tracks the last known absolute cursor position so we can compute
// the per-event relative delta. Initialised to -1 to detect the very first event.
let prevX = -1, prevY = -1

// Screen bounds cached in install() — avoids 4 FFI calls per mouse event.
// Used to clamp prevX/prevY at edges so tracking doesn't drift off-screen.
let screenVx = 0, screenVy = 0, screenVw = 1920, screenVh = 1080

const hookCb = koffi.register((nCode: number, wParam: number | bigint, lParam: number | bigint) => {
  try {
    if (nCode < 0) return CallNextHook(null, nCode, wParam, lParam)
    if (Number(wParam) !== 0x200 /* WM_MOUSEMOVE */) return CallNextHook(null, nCode, wParam, lParam)

    const ms = koffi.decode(lParam, MSLLHOOKSTRUCT_T)
    // LLMHF_INJECTED (0x01) | LLMHF_LOWER_IL_INJECTED (0x02) — skip all injected events
    if (ms.flags & 0x03) return CallNextHook(null, nCode, wParam, lParam)

    const x = ms.pt.x, y = ms.pt.y

    // First event after install — just seed prevX/prevY and pass through
    if (prevX === -1) { prevX = x; prevY = y; return CallNextHook(null, nCode, wParam, lParam) }

    // Guard against absurdly large single-event deltas (e.g. device switch, RDP reconnect).
    // If the jump exceeds 200px in one event, treat it as a warp and re-seed without modifying.
    const rawDx = x - prevX, rawDy = y - prevY
    if (Math.abs(rawDx) > 200 || Math.abs(rawDy) > 200) {
      prevX = x; prevY = y
      return CallNextHook(null, nCode, wParam, lParam)
    }

    const dx = rawDx, dy = rawDy
    // Squared-distance gate first — avoids Math.sqrt for the (extremely common)
    // tiny / zero-motion events. We only need true speed past this gate.
    const speedSq = dx * dx + dy * dy

    // Fast path: zero-motion event. CallNextHook through cleanly with no math,
    // no SendInput, no IPC — these account for a large fraction of WH_MOUSE_LL
    // wakeups during normal use and used to do a full speed-broadcast cycle.
    if (speedSq === 0) {
      prevX = x; prevY = y
      return CallNextHook(null, nCode, wParam, lParam)
    }

    const speed = Math.sqrt(speedSq)

    // Per-axis: each axis uses its own |delta| as input speed and its own curve.
    // Single-curve mode: total speed drives one shared multiplier, then yxRatio
    // scales Y independently (legacy behavior, preserved for non-power-users).
    let multX: number, multY: number
    if (curve.perAxisEnabled) {
      multX = multiplierFor(Math.abs(dx), paramsX())
      multY = multiplierFor(Math.abs(dy), paramsY())
    } else {
      const m = multiplierFor(speed, paramsX())
      multX = m
      multY = m * curve.yxRatio
    }

    const now = Date.now()

    // Once per install, log the first non-trivial multiplier so we can verify
    // the curve is actually being applied to cursor movement (vs just driving
    // the live dot, which can be powered by cursor polling alone).
    if (!_loggedFirstMult && Math.abs(multX - 1) > 0.05) {
      _loggedFirstMult = true
      parentPort?.postMessage({ type: 'first-mult', dx, dy, multX, multY, speed })
    }

    // If a meaningful gap separates events, treat this as a fresh stroke and
    // reset the smoothing/remainder state so the cursor doesn't lurch from
    // wherever the EMA was idling.
    if (now - lastEventTime > 60) {
      smoothDx = 0; smoothDy = 0
      remX = 0;    remY = 0
    }
    lastEventTime = now

    // Output-delta smoothing: low-pass filter the produced delta. Unlike the
    // old multiplier-smoothing this is something the user actually feels —
    // smoothing=100 visibly damps jitter; smoothing=0 is pass-through.
    const sm = Math.max(0, Math.min(100, curve.curveSmoothing)) / 100
    const alpha = 1 - sm * 0.85   // sm=0 → 1.0 (instant); sm=1 → 0.15 (heavy)
    const desiredDx = dx * multX
    const desiredDy = dy * multY
    smoothDx = sm > 0 ? smoothDx * (1 - alpha) + desiredDx * alpha : desiredDx
    smoothDy = sm > 0 ? smoothDy * (1 - alpha) + desiredDy * alpha : desiredDy

    // Pass through cleanly when there's nothing to do — checked AFTER smoothing
    // state update so a steady-state mult≈1 doesn't leave smoothDx/y stale.
    if (speed < 0.5 || (Math.abs(multX - 1) < 0.02 && Math.abs(multY - 1) < 0.02 && sm === 0)) {
      prevX = x; prevY = y
      return CallNextHook(null, nCode, wParam, lParam)
    }

    // Sub-pixel remainder: accumulate the fractional part across events so slow
    // moves with sub-1.0 effective deltas still emit pixels at the right rate
    // instead of rounding to zero or always-1.
    const totalDx = smoothDx + remX
    const totalDy = smoothDy + remY
    const newDx = Math.trunc(totalDx)
    const newDy = Math.trunc(totalDy)
    remX = totalDx - newDx
    remY = totalDy - newDy

    if (newDx === 0 && newDy === 0) {
      // Smoothed/scaled below one pixel this event. Block the original (return 1)
      // and emit nothing — letting CallNextHook through would short-circuit the
      // smoothing/remainder math by delivering the raw OS delta on top of our
      // accumulated fraction. Track prevX/prevY normally so the next event's
      // dx represents this event's physical movement only.
      prevX = x; prevY = y
      return 1
    }

    // Injection backlog guard: if SendInput in the pump is wedged (another
    // process's LL hook not responding), eating events would freeze the cursor
    // entirely. Degrade gracefully instead — pass raw events through (curve
    // momentarily off) until the queue drains.
    if (injCount >= INJ_MAX) {
      prevX = x; prevY = y
      return CallNextHook(null, nCode, wParam, lParam)
    }

    // Update cursor tracking, clamped to screen bounds so edge events don't desync prevX/prevY
    prevX = Math.max(screenVx, Math.min(screenVx + screenVw - 1, prevX + newDx))
    prevY = Math.max(screenVy, Math.min(screenVy + screenVh - 1, prevY + newDy))

    // Queue the shaped delta; the pump injects it right after we return.
    // NEVER call SendInput from inside this callback: the whole system mouse
    // chain is blocked while we run, and SendInput itself synchronously walks
    // every other LL mouse hook in the system. If any of them is slow (common
    // during boot CPU storms), a nested call here makes US the slow hook for
    // every event — felt as system-wide cursor jitter. Two engines doing this
    // to each other can mutually deadlock their hook threads permanently.
    injDx[injTail] = newDx
    injDy[injTail] = newDy
    injTail = (injTail + 1) % INJ_MAX
    injCount++

    return 1  // block original event — our injected relative event carries the curve-adjusted movement
  } catch(e) {
    parentPort?.postMessage({ type: 'error', msg: String(e) })
    return CallNextHook(null, nCode, wParam, lParam)
  }
}, koffi.pointer(HookProto))

function diagnostic() {
  parentPort?.postMessage({
    type: 'install',
    ok: !!hookHandle,
    curveType: curve.curveType,
    accelEnabled: curve.accelerationEnabled,
    accel: curve.curveAcceleration,
    threshold: curve.curveThreshold,
    exponent: curve.curveExponent,
    smoothing: curve.curveSmoothing,
    pollingRate: curve.pollingRate,
    perAxis: curve.perAxisEnabled,
  })
}

// Hot-reload the curve without unhooking — settings changes (slider drag, profile
// swap, hotkey toggle) used to call install() which unhooks + re-hooks. That gap
// causes a visible cursor stutter every time the user touches anything. Now we
// keep the hook live and only reset stroke-state so the new curve doesn't carry
// stale EMA / remainder values from the previous one.
function applyConfigHot() {
  _displayMax = 5 * (1000 / curve.pollingRate)
  smoothDx = 0; smoothDy = 0
  remX = 0;    remY = 0
  lastEventTime = 0
  _loggedFirstMult = false
}

function install() {
  if (hookHandle) { UnhookHook(hookHandle); hookHandle = null }
  screenVx = GetSysMetric(76); screenVy = GetSysMetric(77)
  screenVw = GetSysMetric(78); screenVh = GetSysMetric(79)
  prevX = -1; prevY = -1
  applyConfigHot()
  hookHandle = SetHookEx(14 /* WH_MOUSE_LL */, hookCb, null, 0)
  diagnostic()
}

function uninstall() {
  if (hookHandle) { UnhookHook(hookHandle); hookHandle = null }
}

// ── Message pump ──────────────────────────────────────────────────────────────
// PeekMessage is a koffi native call — the WH_MOUSE_LL hook fires during it,
// allowing koffi synchronous callbacks to invoke our JS code.

const winMsg: any = {}
let running = true

function pump() {
  if (!running) return
  try {
    while (PeekMsg(winMsg, null, 0, 0, 1 /* PM_REMOVE */)) {
      TranslateMsg(winMsg)
      DispatchMsg(winMsg)
    }
    // Drain queued injections — outside the hook callback, so a slow foreign
    // hook stalls only this loop iteration, never the system mouse chain.
    while (injCount > 0) {
      const dx = injDx[injHead], dy = injDy[injHead]
      injHead = (injHead + 1) % INJ_MAX
      injCount--
      SendInput(1, [{ type: 0, u: { mi: {
        dx, dy, mouseData: 0, dwFlags: 0x0001, time: 0, dwExtraInfo: 0,
      } } }], INPUT_SIZE)
    }
  } catch { /* no-op */ }
  setImmediate(pump)  // yield so parentPort messages can be received
}

// ── IPC from main process ─────────────────────────────────────────────────────

parentPort?.on('message', (data: { type: string; curve?: CurveSettings }) => {
  if (data.type === 'apply' && data.curve) {
    curve = data.curve
    if (!hookHandle) {
      install()      // first time — actual SetWindowsHookEx call
    } else {
      applyConfigHot()  // hot reload — keep the hook live, just refresh state
      diagnostic()
    }
  } else if (data.type === 'stop') {
    running = false
    uninstall()
    process.exit(0)  // safe — main thread always calls restoreOriginals() before sending 'stop'
  }
})

pump()
parentPort?.postMessage({ type: 'ready' })
