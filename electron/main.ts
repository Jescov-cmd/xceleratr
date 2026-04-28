import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, systemPreferences, nativeTheme, screen, shell, globalShortcut } from 'electron'
import path from 'path'
import { execFileSync, execFile } from 'child_process'
import { Worker } from 'worker_threads'
import fs from 'fs'
import os from 'os'

const isDev        = process.env.NODE_ENV === 'development' || !app.isPackaged
const IS_WIN       = process.platform === 'win32'
const IS_MAC       = process.platform === 'darwin'
const startedAtBoot = process.argv.includes('--startup')

// Suppress Chromium GPU shader disk-cache errors (harmless, just noisy in dev)
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache')

// ── Settings store ───────────────────────────────────────────────────────────

type CurveType = 'default' | 'linear' | 'natural' | 'power' | 'sigmoid' | 'bounce' | 'classic' | 'jump' | 'custom'
interface CurvePoint { x: number; y: number }

interface Settings {
  sensitivity: number
  sensitivityEnabled: boolean
  yxRatio: number
  yxRatioEnabled: boolean
  curveType: CurveType
  customCurvePoints: CurvePoint[]
  curveAcceleration: number
  accelerationEnabled: boolean
  curveThreshold: number
  curveExponent: number
  perAxisEnabled: boolean
  curveTypeY: CurveType
  customCurvePointsY: CurvePoint[]
  curveAccelerationY: number
  curveThresholdY: number
  curveExponentY: number
  enhancePointerPrecision: boolean
  pollingRate: number
  curveSmoothing: number
  theme: 'light' | 'dark' | 'high-contrast'
  startOnBoot: boolean
  profileName: string
  userName: string
  userEmail: string
  userPhone: string
  userAvatar: string
  hotkeyEnabled: boolean
  hotkeyAccelToggle: string
  hotkeyCycleProfile: string
  hotkeyABCompare: string
  abSlotA?: string  // profile id for A
  abSlotB?: string  // profile id for B
  onboardingComplete: boolean
}

const DEFAULT_PTS = [{ x: 0, y: 1 }, { x: 0.35, y: 1.3 }, { x: 0.7, y: 1.9 }, { x: 1, y: 2.8 }]

const DEFAULTS: Settings = {
  sensitivity: 10,
  sensitivityEnabled: true,
  yxRatio: 1.0,
  yxRatioEnabled: true,
  curveType: 'default',
  customCurvePoints: DEFAULT_PTS,
  curveAcceleration: 100,
  accelerationEnabled: true,
  curveThreshold: 50,
  curveExponent: 1.5,
  perAxisEnabled: false,
  curveTypeY: 'default',
  customCurvePointsY: DEFAULT_PTS,
  curveAccelerationY: 100,
  curveThresholdY: 50,
  curveExponentY: 1.5,
  enhancePointerPrecision: false,
  pollingRate: 1000,
  curveSmoothing: 0,
  theme: 'dark',
  startOnBoot: false,
  profileName: 'Default',
  userName: '',
  userEmail: '',
  userPhone: '',
  userAvatar: '',
  hotkeyEnabled: true,
  hotkeyAccelToggle:  'CommandOrControl+Alt+X',
  hotkeyCycleProfile: '',
  hotkeyABCompare:    '',
  abSlotA: '',
  abSlotB: '',
  onboardingComplete: false,
}

function settingsPath() { return path.join(app.getPath('userData'), 'settings.json') }
function loadSettings(): Settings {
  try {
    const raw = JSON.parse(fs.readFileSync(settingsPath(), 'utf-8'))
    // Migrate: if old H/V percentage format exists, convert average to single 1-20 sensitivity
    if (raw.sensitivityX !== undefined || raw.sensitivityY !== undefined) {
      const avgPct = ((raw.sensitivityX ?? 100) + (raw.sensitivityY ?? 100)) / 2
      raw.sensitivity = Math.max(1, Math.min(20, Math.round(avgPct / 10)))
      delete raw.sensitivityX
      delete raw.sensitivityY
    }
    // Migration: existence of settings.json means the user has used the app
    // before — don't re-onboard them through the welcome wizard introduced
    // in 1.3.0. Only show wizard on truly fresh installs (where this catch
    // block runs and returns DEFAULTS with onboardingComplete=false).
    if (raw.onboardingComplete === undefined) raw.onboardingComplete = true
    return { ...DEFAULTS, ...raw }
  } catch { return { ...DEFAULTS } }
}
function persistSettings(patch: Partial<Settings>): Settings {
  const updated = { ...loadSettings(), ...patch }
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true })
  fs.writeFileSync(settingsPath(), JSON.stringify(updated, null, 2), 'utf-8')
  return updated
}

// ── Original mouse settings (restored on quit) ───────────────────────────────

interface OrigMouse { sensitivity: string; speed: string; thresh1: string; thresh2: string }
let origMouse: OrigMouse | null = null   // set once before first write

function regReadAsync(name: string): Promise<string> {
  return new Promise(resolve => {
    execFile('reg.exe', ['query', 'HKCU\\Control Panel\\Mouse', '/v', name],
      { encoding: 'utf8', windowsHide: true }, (err, stdout) => {
        if (err) return resolve('')
        const m = String(stdout).trim().match(/REG_SZ\s+(\S+)/)
        resolve(m ? m[1].trim() : '')
      })
  })
}

let captureOriginalsPromise: Promise<void> | null = null
function captureOriginalsAsync(): Promise<void> {
  if (origMouse) return Promise.resolve()
  if (captureOriginalsPromise) return captureOriginalsPromise
  // Parallel reads — ~50ms total instead of 200-400ms sequential
  captureOriginalsPromise = Promise.all([
    regReadAsync('MouseSensitivity'),
    regReadAsync('MouseSpeed'),
    regReadAsync('MouseThreshold1'),
    regReadAsync('MouseThreshold2'),
  ]).then(([sensitivity, speed, thresh1, thresh2]) => {
    origMouse = { sensitivity, speed, thresh1, thresh2 }
    if (isDev) console.log('[xceleratr] captured originals:', origMouse)
  })
  return captureOriginalsPromise
}

function restoreOriginals() {
  if (!origMouse) return
  if (origMouse.speed)   regWrite('MouseSpeed',      origMouse.speed)
  if (origMouse.thresh1) regWrite('MouseThreshold1', origMouse.thresh1)
  if (origMouse.thresh2) regWrite('MouseThreshold2', origMouse.thresh2)
  if (isDev) console.log('[xceleratr] restored originals')
}

// ── Win32 SPI (speed only — acceleration is handled by the hook worker) ──────

type SpiFn = (a: number, b: number, c: number, d: number) => boolean
let SpiSpeed: SpiFn | null = null

const SPI_SETMOUSESPEED = 0x71
const SPIF_BOTH         = 0x03

function initWinAPIs() {
  if (!IS_WIN) return
  try {
    const koffi = require('koffi')  // eslint-disable-line @typescript-eslint/no-var-requires
    SpiSpeed = koffi.load('user32.dll').func('bool SystemParametersInfoW(uint32, uint32, intptr_t, uint32)')
    if (isDev) console.log('[xceleratr] SpiSpeed loaded')
  } catch (e) {
    console.error('[xceleratr] koffi load failed:', e)
  }
}

function apiSetSpeed(speed: number) {
  try { SpiSpeed?.(SPI_SETMOUSESPEED, 0, speed, SPIF_BOTH) } catch { /* no-op */ }
}

// ── Hook worker (WH_MOUSE_LL lives in its own thread / message pump) ──────────

type HookCurve = {
  curveType: CurveType; customCurvePoints: CurvePoint[]
  curveAcceleration: number; accelerationEnabled: boolean
  curveThreshold: number; curveExponent: number; pollingRate: number; yxRatio: number
  perAxisEnabled: boolean
  curveTypeY: CurveType; customCurvePointsY: CurvePoint[]
  curveAccelerationY: number; curveThresholdY: number; curveExponentY: number
  curveSmoothing: number
}

let hookWorker:      Worker | null = null
let hookWorkerTimer: ReturnType<typeof setTimeout> | null = null
let lastCurve:       HookCurve | null = null

function stopHookWorker() {
  if (hookWorkerTimer) { clearTimeout(hookWorkerTimer); hookWorkerTimer = null }
  if (!hookWorker) return
  const w = hookWorker
  hookWorker = null  // clear before postMessage so the stale guard catches any in-flight 'ready'
  w.postMessage({ type: 'stop' })
  // terminate() is NOT used here — it kills koffi mid-native-call (PeekMsg) and causes a fatal crash
}

function startHookWorker(curve: HookCurve) {
  if (!IS_WIN) return
  lastCurve = curve

  // If worker is already running, just send updated settings — no restart needed.
  // This eliminates the cursor-lag gap that occurred when stop+restart happened on every apply.
  if (hookWorker) {
    if (hookWorkerTimer) { clearTimeout(hookWorkerTimer); hookWorkerTimer = null }
    hookWorker.postMessage({ type: 'apply', curve })
    return
  }

  // No worker running — create one (debounced to coalesce rapid calls).
  // 20ms is enough to merge a burst of mouse-apply IPCs without adding noticeable
  // boot latency. Was 80ms — that contributed ~60ms of perceived startup lag.
  if (hookWorkerTimer) { clearTimeout(hookWorkerTimer); hookWorkerTimer = null }
  hookWorkerTimer = setTimeout(() => {
    hookWorkerTimer = null
    const workerPath = path.join(__dirname, 'mouseHookWorker.js')
    if (!fs.existsSync(workerPath)) {
      if (isDev) console.warn('[xceleratr] mouseHookWorker.js not found at', workerPath)
      return
    }

    const worker = new Worker(workerPath)
    hookWorker = worker

    worker.on('message', (msg) => {
      if (worker !== hookWorker) return  // stale handler — a newer worker replaced this one
      if (msg.type === 'ready') {
        worker.postMessage({ type: 'apply', curve })
        if (isDev) console.log('[xceleratr] hook worker ready')
      } else if (msg.type === 'speed') {
        if (isDev && !(worker as any)._speedLogged) { (worker as any)._speedLogged = true; console.log('[xceleratr] first speed msg, x:', msg.x.toFixed(3)) }
        mainWindow?.webContents.send('live-speed', msg.x)
      } else if (msg.type === 'error' && isDev) {
        console.error('[xceleratr] hook callback error:', msg.msg)
      }
    })
    worker.on('error', (e) => {
      if (isDev) console.error('[xceleratr] hook worker fatal:', e)
    })
    worker.on('exit', (code) => {
      if (worker !== hookWorker) return  // intentional stop already cleared hookWorker
      hookWorker = null
      // Unexpected exit (e.g. antivirus kill, crash) — restart automatically
      if (code !== 0 && lastCurve) {
        if (isDev) console.warn('[xceleratr] hook worker exited unexpectedly (code', code, '), restarting…')
        setTimeout(() => { if (lastCurve) startHookWorker(lastCurve) }, 1000)
      }
    })
  }, 20)
}

// ── Icon loader ───────────────────────────────────────────────────────────────
// nativeImage.createFromPath() cannot read from inside an asar archive.
// fs.readFileSync() is asar-aware in Electron, so we load the raw bytes first.

function loadNativeImage(relPath: string): Electron.NativeImage {
  try {
    const p = path.join(__dirname, relPath)
    if (fs.existsSync(p)) return nativeImage.createFromBuffer(fs.readFileSync(p))
  } catch { /* no-op */ }
  return nativeImage.createEmpty()
}

// ── Cursor-position polling (live-speed broadcast) ────────────────────────────
// screen.getCursorScreenPoint() is a main-process OS call that works system-wide
// on both Windows and macOS regardless of which window is focused.
// This is the primary speed source; the hook worker is supplementary on Windows.

let _pollLastPos  = { x: 0, y: 0 }
let _pollLastTime = 0
let _pollTimer:   ReturnType<typeof setInterval> | null = null

function startCursorPolling() {
  if (_pollTimer) return
  _pollLastTime = 0  // reset so first sample seeds without computing a delta
  _pollTimer = setInterval(() => {
    if (!mainWindow?.webContents) return
    const now = Date.now()
    let pos: { x: number; y: number }
    try { pos = screen.getCursorScreenPoint() } catch { return }
    const prevPos  = _pollLastPos
    const prevTime = _pollLastTime
    _pollLastPos  = pos
    _pollLastTime = now
    if (prevTime === 0) return                    // first sample: just seed
    const dt = now - prevTime
    if (dt <= 0 || dt >= 200) return
    const dx = pos.x - prevPos.x
    const dy = pos.y - prevPos.y
    if (dx === 0 && dy === 0) return              // no movement: let renderer decay to 0
    if (Math.abs(dx) > 500 || Math.abs(dy) > 500) return  // teleport / RDP reconnect
    const pxPerMs   = Math.sqrt(dx * dx + dy * dy) / dt
    const normalizedX = Math.min(1, pxPerMs / 5)  // 5 px/ms ≈ 5000 px/s = normalizedX 1.0
    mainWindow.webContents.send('live-speed', normalizedX)
  }, 16)  // ~60 fps
}

function stopCursorPolling() {
  if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null }
}

// ── Global hotkeys ────────────────────────────────────────────────────────────
// Multiple configurable actions. Each can be bound to a custom Electron accelerator,
// or set to '' to disable that action.

type HotkeyAction = 'accelToggle' | 'cycleProfile' | 'abCompare'
const HOTKEY_FIELD: Record<HotkeyAction, keyof Settings> = {
  accelToggle:  'hotkeyAccelToggle',
  cycleProfile: 'hotkeyCycleProfile',
  abCompare:    'hotkeyABCompare',
}

const registeredAccelerators = new Map<HotkeyAction, string>()

// Tracks which profile the cycle hotkey last applied so consecutive presses cycle forward
let _cycleIndex = -1
// In-memory toast helper — uses Electron Notification API where supported
function showToast(title: string, body: string) {
  try {
    const { Notification } = require('electron')
    if (Notification.isSupported()) new Notification({ title, body, silent: true }).show()
  } catch { /* no-op */ }
}

function applyAfterHotkey(next: Settings) {
  if (IS_WIN) applyWin(next).catch(e => { if (isDev) console.error('[xceleratr] hotkey apply failed:', e) })
  if (IS_MAC) { try { applyMac(next) } catch { /* no-op */ } }
  mainWindow?.webContents.send('settings-changed', next)
  try { tray?.setToolTip(`Xceleratr — accel ${next.accelerationEnabled ? 'ON' : 'OFF'}`) } catch { /* no-op */ }
}

function handleAccelToggle() {
  const cur = loadSettings()
  const next = persistSettings({ accelerationEnabled: !cur.accelerationEnabled })
  applyAfterHotkey(next)
  showToast('Xceleratr', `Acceleration ${next.accelerationEnabled ? 'ON' : 'OFF'}`)
}

function handleCycleProfile() {
  const profiles = loadProfileData().filter((p: any) => p && p.settings)
  if (profiles.length === 0) { showToast('Xceleratr', 'No saved profiles to cycle'); return }
  _cycleIndex = (_cycleIndex + 1) % profiles.length
  const profile = profiles[_cycleIndex]
  const s = profile.settings
  const cur = loadSettings()
  const next = persistSettings({ ...s, theme: cur.theme, startOnBoot: cur.startOnBoot })
  applyAfterHotkey(next)
  showToast('Xceleratr', `Profile: ${profile.name ?? 'Untitled'}`)
}

function handleABCompare() {
  const cur = loadSettings()
  const profiles = loadProfileData()
  const aId = cur.abSlotA, bId = cur.abSlotB
  if (!aId || !bId) {
    showToast('Xceleratr', 'A/B compare: pick two profiles in the Compare page first')
    return
  }
  // Toggle: if any setting differs from A → switch to A; otherwise → switch to B
  const a = profiles.find((p: any) => p.id === aId)?.settings
  const b = profiles.find((p: any) => p.id === bId)?.settings
  if (!a || !b) { showToast('Xceleratr', 'A/B compare: one of the slots is empty'); return }
  // Decide which to apply by comparing curveType (good-enough heuristic)
  const target = (cur.curveType === a.curveType && cur.curveAcceleration === a.curveAcceleration) ? b : a
  const next = persistSettings({ ...target, theme: cur.theme, startOnBoot: cur.startOnBoot })
  applyAfterHotkey(next)
  showToast('Xceleratr', `A/B → ${target === a ? 'A' : 'B'}`)
}

const ACTION_HANDLER: Record<HotkeyAction, () => void> = {
  accelToggle:  handleAccelToggle,
  cycleProfile: handleCycleProfile,
  abCompare:    handleABCompare,
}

function unregisterAllHotkeys() {
  for (const [, accel] of registeredAccelerators) {
    try { globalShortcut.unregister(accel) } catch { /* no-op */ }
  }
  registeredAccelerators.clear()
}

function registerHotkeys() {
  unregisterAllHotkeys()
  const s = loadSettings()
  if (s.hotkeyEnabled === false) return  // master toggle off
  const actions: HotkeyAction[] = ['accelToggle', 'cycleProfile', 'abCompare']
  for (const action of actions) {
    const accel = String(s[HOTKEY_FIELD[action]] || '').trim()
    if (!accel) continue
    try {
      const ok = globalShortcut.register(accel, ACTION_HANDLER[action])
      if (ok) registeredAccelerators.set(action, accel)
      else if (isDev) console.warn(`[xceleratr] hotkey "${accel}" for ${action} failed to register (conflict?)`)
    } catch (e) {
      if (isDev) console.error(`[xceleratr] register ${action} failed:`, e)
    }
  }
}

// Backward-compat shim — older renderer code may call registerHotkey/unregisterHotkey by name
function registerHotkey() { registerHotkeys() }
function unregisterHotkey() { unregisterAllHotkeys() }

// ── Window ────────────────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null
let tray:       Tray        | null = null
let isQuitting = false

function createWindow() {
  const icon = loadNativeImage(IS_MAC ? '../dist/tray.png' : '../dist/icon.ico')
  mainWindow = new BrowserWindow({
    width: 860, height: 600, minWidth: 700, minHeight: 480,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    show: !startedAtBoot,
    icon: icon.isEmpty() ? undefined : icon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,  // keep RAF running at full speed when window loses focus
    },
    title: 'Xceleratr',
  })

  mainWindow.on('close', (e) => {
    if (!isQuitting) { e.preventDefault(); mainWindow?.hide() }
  })

  if (isDev) {
    const tryLoad = () => {
      mainWindow!.loadURL('http://localhost:5173').catch(() => setTimeout(tryLoad, 500))
    }
    tryLoad()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

function rebuildTrayMenu() {
  if (!tray) return
  const profiles = loadProfileData().filter((p: any) => p && p.settings)
  const items: Electron.MenuItemConstructorOptions[] = [
    { label: 'Show Xceleratr', click: () => { mainWindow?.show(); mainWindow?.focus() } },
  ]
  if (profiles.length > 0) {
    items.push({ type: 'separator' })
    items.push({ label: 'Apply profile', enabled: false })
    for (const p of profiles) {
      items.push({
        label: `   ${p.name}`,
        click: () => {
          const cur = loadSettings()
          const next = persistSettings({ ...p.settings, theme: cur.theme, startOnBoot: cur.startOnBoot })
          applyAfterHotkey(next)
          showToast('Xceleratr', `Profile: ${p.name ?? 'Untitled'}`)
        },
      })
    }
  }
  items.push({ type: 'separator' })
  items.push({ label: 'Quit Xceleratr', click: () => { isQuitting = true; app.quit() } })
  tray.setContextMenu(Menu.buildFromTemplate(items))
}

function createTray() {
  try {
    const raw = loadNativeImage('../dist/tray.png')
    const icon = raw.isEmpty() ? raw : raw.resize({ width: 16, height: 16 })

    tray = new Tray(icon)
    tray.setToolTip('Xceleratr')
    rebuildTrayMenu()
    tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus() })
  } catch (e) {
    if (isDev) console.error('[xceleratr] tray creation failed:', e)
  }
}

// Renderer can ask main to rebuild the tray menu (after save/delete profile)
ipcMain.handle('tray-refresh', () => { rebuildTrayMenu(); return { ok: true } })

// ── Single instance lock (production only — dev restarts break the lock) ─────
if (!isDev && !app.requestSingleInstanceLock()) { app.quit(); process.exit(0) }
if (!isDev) app.on('second-instance', () => { if (mainWindow) { mainWindow.show(); mainWindow.focus() } })

app.whenReady().then(() => {
  app.setName('Xceleratr')
  if (IS_WIN) app.setAppUserModelId('com.xceleratr.app')
  initWinAPIs()
  createWindow()
  createTray()
  startCursorPolling()
  // Defer mouse-settings apply by one tick so the window/tray paint first.
  // captureOriginals + hook-worker spawn happen async, off the boot critical path.
  // Eliminates the visible UI freeze that previously happened during startup.
  setImmediate(() => {
    const s = loadSettings()
    if (IS_WIN) applyWin(s).catch(e => { if (isDev) console.error('[xceleratr] initial apply failed:', e) })
    if (IS_MAC) {
      try { applyMac(s) } catch (e) { if (isDev) console.error('[xceleratr] initial mac apply failed:', e) }
    }
    if (s.hotkeyEnabled !== false) registerHotkeys()
    // Defer the updater 8s past boot. require('electron-updater') is a heavy
    // synchronous module load (~500-2000ms on a cold-start packaged build) that
    // would otherwise block the event loop and stall the hook-worker spawn timer
    // — which manifests as the cursor curve "not kicking in for several seconds."
    // The user doesn't need an update banner in the first few seconds anyway.
    setTimeout(initAutoUpdater, 8000)
  })
})

// On Mac, clicking the dock icon re-shows the window
app.on('activate', () => {
  if (mainWindow) { mainWindow.show(); mainWindow.focus() }
  else createWindow()
})

app.on('window-all-closed', () => { /* stay in tray — quit via tray menu only */ })
app.on('before-quit', () => { isQuitting = true })

let _cleanupDone = false
app.on('will-quit', (e) => {
  if (_cleanupDone) return
  _cleanupDone = true
  e.preventDefault()           // pause Electron's quit so we can finish cleanup

  tray?.destroy(); tray = null  // must destroy tray or it keeps the process alive
  stopCursorPolling()
  unregisterAllHotkeys()
  try { globalShortcut.unregisterAll() } catch { /* no-op */ }
  if (IS_WIN) restoreOriginals() // sync — registry fully restored before worker exits
  stopHookWorker()               // tell hook worker to stop (it unregisters the hook)

  // Force-kill after 300 ms — koffi native refs in the worker thread can otherwise
  // prevent Node.js from exiting even after app.quit() completes.
  setTimeout(() => process.exit(0), 300)
})

// ── Window controls ───────────────────────────────────────────────────────────

ipcMain.on('window-minimize', () => mainWindow?.minimize())
ipcMain.on('window-close',    () => mainWindow?.hide())   // X = hide to tray

// ── Settings IPC ──────────────────────────────────────────────────────────────

ipcMain.handle('settings-get', () => loadSettings())
ipcMain.handle('settings-save', (_e, patch: Partial<Settings>) => {
  persistSettings(patch); return { ok: true }
})

// ── Mouse apply ───────────────────────────────────────────────────────────────

function regWrite(name: string, value: string) {
  try {
    execFileSync('reg.exe', ['add', 'HKCU\\Control Panel\\Mouse', '/v', name, '/t', 'REG_SZ', '/d', value, '/f'],
      { windowsHide: true, stdio: 'pipe' })
  } catch { /* no-op */ }
}

function regWriteAsync(name: string, value: string) {
  execFile('reg.exe', ['add', 'HKCU\\Control Panel\\Mouse', '/v', name, '/t', 'REG_SZ', '/d', value, '/f'],
    { windowsHide: true }, () => {})
}

async function applyWin(s: {
  yxRatio: number; yxRatioEnabled: boolean
  curveType: CurveType; customCurvePoints: CurvePoint[]
  curveAcceleration: number; accelerationEnabled: boolean
  curveThreshold: number; curveExponent: number; enhancePointerPrecision: boolean
  pollingRate: number
  perAxisEnabled?: boolean
  curveTypeY?: CurveType; customCurvePointsY?: CurvePoint[]
  curveAccelerationY?: number; curveThresholdY?: number; curveExponentY?: number
  curveSmoothing?: number
}) {
  await captureOriginalsAsync()   // must complete before any regWrite

  // ── Acceleration / EPP ──
  const effectiveRatio = s.yxRatioEnabled ? s.yxRatio : 1.0
  const perAxis = !!s.perAxisEnabled
  const yShapesActive = perAxis && s.accelerationEnabled && s.curveTypeY !== 'default'
  const xShapesActive = s.accelerationEnabled && s.curveType !== 'default'
  const useHook = xShapesActive || yShapesActive || (!perAxis && Math.abs(effectiveRatio - 1) > 0.02)
  const useEPP  = s.enhancePointerPrecision && !useHook

  let mouseSpeed: number, thr1: number, thr2: number
  if (useEPP) {
    mouseSpeed = 2; thr1 = 6; thr2 = 10
  } else {
    mouseSpeed = 0; thr1 = 0; thr2 = 0
  }

  // Async writes — non-blocking so UI and cursor don't stall on apply
  if (s.accelerationEnabled) {
    regWriteAsync('MouseSpeed',      String(mouseSpeed))
    regWriteAsync('MouseThreshold1', String(thr1))
    regWriteAsync('MouseThreshold2', String(thr2))
  } else {
    regWriteAsync('MouseSpeed',      '0')
    regWriteAsync('MouseThreshold1', '0')
    regWriteAsync('MouseThreshold2', '0')
  }

  // ── Hook worker ──
  // Always keep the worker alive — it broadcasts live-speed data for the graph
  // even when the curve is 'default' and no movement modification is needed.
  // The worker callback handles passthrough cleanly when mult ≈ 1 and ratio ≈ 1.
  startHookWorker({
    curveType:           s.curveType,
    customCurvePoints:   s.customCurvePoints,
    curveAcceleration:   s.curveAcceleration,
    accelerationEnabled: s.accelerationEnabled,
    curveThreshold:      s.curveThreshold,
    curveExponent:       s.curveExponent,
    pollingRate:         s.pollingRate,
    yxRatio:             effectiveRatio,
    perAxisEnabled:      perAxis,
    curveTypeY:          s.curveTypeY          ?? 'default',
    customCurvePointsY:  s.customCurvePointsY  ?? [],
    curveAccelerationY:  s.curveAccelerationY  ?? 100,
    curveThresholdY:     s.curveThresholdY     ?? 50,
    curveExponentY:      s.curveExponentY      ?? 1.5,
    curveSmoothing:      s.curveSmoothing      ?? 0,
  })
}

function applyMac(s: { accelerationEnabled: boolean }) {
  try {
    if (!s.accelerationEnabled) {
      execFileSync('defaults', ['write', '-g', 'com.apple.mouse.scaling', '-1'], { stdio: 'ignore' })
    }
    // Pointer speed is OS-controlled; only disable system acceleration when requested
  } catch { /* no-op */ }
}

ipcMain.handle('mouse-apply', async (_e, s: {
  yxRatio: number; yxRatioEnabled: boolean
  curveType: CurveType; customCurvePoints: CurvePoint[]
  curveAcceleration: number; accelerationEnabled: boolean
  curveThreshold: number; curveExponent: number; enhancePointerPrecision: boolean
  pollingRate: number
  perAxisEnabled?: boolean
  curveTypeY?: CurveType; customCurvePointsY?: CurvePoint[]
  curveAccelerationY?: number; curveThresholdY?: number; curveExponentY?: number
  curveSmoothing?: number
}) => {
  if (IS_WIN) await applyWin(s)
  if (IS_MAC) applyMac(s)
  return { ok: true }
})


// ── Startup ───────────────────────────────────────────────────────────────────

const APP_NAME  = 'Xceleratr'
const WIN_RUN   = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'
const MAC_PLIST = path.join(os.homedir(), 'Library/LaunchAgents/com.xceleratr.app.plist')

function getStartupWin(): boolean {
  try {
    const out = execFileSync('reg.exe', ['query', WIN_RUN, '/v', APP_NAME],
      { encoding: 'utf8', windowsHide: true, stdio: 'pipe' }).trim()
    return out.includes(APP_NAME)
  } catch { return false }
}
function setStartupWin(enable: boolean) {
  try {
    if (enable) {
      // Quote the exe path (may contain spaces) and add --startup so the app
      // knows to start silently in the tray rather than showing the window
      const startupCmd = `"${process.execPath}" --startup`
      execFileSync('reg.exe', ['add', WIN_RUN, '/v', APP_NAME, '/t', 'REG_SZ', '/d', startupCmd, '/f'],
        { windowsHide: true, stdio: 'pipe' })
    } else {
      execFileSync('reg.exe', ['delete', WIN_RUN, '/v', APP_NAME, '/f'], { windowsHide: true, stdio: 'pipe' })
    }
  } catch { /* no-op */ }
}

function getStartupMac(): boolean { return fs.existsSync(MAC_PLIST) }
function setStartupMac(enable: boolean) {
  if (enable) {
    const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.xceleratr.app</string>
  <key>ProgramArguments</key><array><string>${process.execPath}</string></array>
  <key>RunAtLoad</key><true/><key>KeepAlive</key><false/>
</dict>
</plist>`
    fs.mkdirSync(path.dirname(MAC_PLIST), { recursive: true })
    fs.writeFileSync(MAC_PLIST, plist, 'utf-8')
    try { execFileSync('launchctl', ['load', MAC_PLIST], { stdio: 'ignore' }) } catch {}
  } else {
    try { execFileSync('launchctl', ['unload', MAC_PLIST], { stdio: 'ignore' }) } catch {}
    try { fs.unlinkSync(MAC_PLIST) } catch {}
  }
}

ipcMain.handle('startup-get', () => {
  if (IS_WIN) return { enabled: getStartupWin() }
  if (IS_MAC) return { enabled: getStartupMac() }
  return { enabled: false }
})

ipcMain.handle('startup-set', (_e, enable: boolean) => {
  if (IS_WIN) setStartupWin(enable)
  if (IS_MAC) setStartupMac(enable)
  return { ok: true }
})

// ── Profiles ──────────────────────────────────────────────────────────────────

const PROFILE_SLOTS = ['default', 'custom-1', 'custom-2', 'custom-3', 'custom-4', 'custom-5']
const SLOT_NAMES: Record<string, string> = {
  'default': 'Default',
  'custom-1': 'Slot 1', 'custom-2': 'Slot 2', 'custom-3': 'Slot 3',
  'custom-4': 'Slot 4', 'custom-5': 'Slot 5',
}

function profilesPath() { return path.join(app.getPath('userData'), 'profiles.json') }
function loadProfileData(): any[] {
  try {
    const d = JSON.parse(fs.readFileSync(profilesPath(), 'utf-8'))
    return Array.isArray(d.profiles) ? d.profiles : []
  } catch { return [] }
}
function saveProfileData(profiles: any[]) {
  fs.mkdirSync(path.dirname(profilesPath()), { recursive: true })
  fs.writeFileSync(profilesPath(), JSON.stringify({ profiles }, null, 2), 'utf-8')
}

ipcMain.handle('profiles-list', () => {
  const saved = loadProfileData()
  return PROFILE_SLOTS.map(id => {
    const found = saved.find((p: any) => p.id === id)
    return found ?? { id, name: SLOT_NAMES[id] ?? id, savedAt: null, settings: null }
  })
})

ipcMain.handle('profiles-save', (_e, profile: any) => {
  const profiles = loadProfileData()
  const idx = profiles.findIndex((p: any) => p.id === profile.id)
  if (idx >= 0) { profiles[idx] = profile } else { profiles.push(profile) }
  saveProfileData(profiles)
  return { ok: true }
})

ipcMain.handle('profiles-delete', (_e, id: string) => {
  if (id === 'default') return { ok: false }
  const profiles = loadProfileData().filter((p: any) => p.id !== id)
  saveProfileData(profiles)
  return { ok: true }
})

// ── Accent color ──────────────────────────────────────────────────────────────

ipcMain.handle('accent-color-get', () => {
  if (!IS_WIN && !IS_MAC) return null
  try {
    const c = systemPreferences.getAccentColor()
    if (isDev) console.log('[xceleratr] accent color raw:', c)
    return c || null
  } catch { return null }
})

// accent-color-changed fires on both Windows and macOS (Electron 25+)
;(systemPreferences as any).on('accent-color-changed', (_event: any, newColor: string) => {
  mainWindow?.webContents.send('accent-color-changed', newColor || null)
})

// macOS fires color-changed when the user switches accent color in System Preferences
if (IS_MAC) {
  (systemPreferences as any).on('color-changed', () => {
    try { mainWindow?.webContents.send('accent-color-changed', systemPreferences.getAccentColor() || null) } catch { /* no-op */ }
  })
}

nativeTheme.on('updated', () => {
  if (!IS_WIN && !IS_MAC) return
  try { mainWindow?.webContents.send('accent-color-changed', systemPreferences.getAccentColor() || null) } catch { /* no-op */ }
})

// ── Support email ─────────────────────────────────────────────────────────────
// Renderer can't openExternal directly under contextIsolation; this hops through main.

ipcMain.handle('support-email-open', () => {
  const url = 'mailto:customersupport80@gmail.com?subject=Xceleratr%20Feedback'
  shell.openExternal(url).catch(() => { /* no default mail client — silent */ })
  return { ok: true }
})

// ── Hotkey IPC ────────────────────────────────────────────────────────────────

ipcMain.handle('hotkey-set-enabled', (_e, enabled: boolean) => {
  persistSettings({ hotkeyEnabled: enabled })
  if (enabled) registerHotkeys()
  else         unregisterAllHotkeys()
  return { ok: true, registered: registeredAccelerators.size > 0 }
})

ipcMain.handle('hotkey-bind', (_e, action: HotkeyAction, accelerator: string) => {
  if (!HOTKEY_FIELD[action]) return { ok: false, reason: 'unknown-action' }
  const field = HOTKEY_FIELD[action]
  persistSettings({ [field]: accelerator } as Partial<Settings>)
  registerHotkeys()
  const registered = registeredAccelerators.get(action) === accelerator
  return { ok: true, registered }
})

ipcMain.handle('hotkey-get-status', () => {
  const s = loadSettings()
  return {
    enabled:    s.hotkeyEnabled !== false,
    bindings: {
      accelToggle:  s.hotkeyAccelToggle  ?? '',
      cycleProfile: s.hotkeyCycleProfile ?? '',
      abCompare:    s.hotkeyABCompare    ?? '',
    },
    registered: Array.from(registeredAccelerators.keys()),
  }
})

// ── Auto-updater ──────────────────────────────────────────────────────────────
// Checks GitHub Releases for newer versions. Silent-fails if the repo isn't
// published yet — no errors shown to users. Once a GitHub release is published,
// every previously-installed copy of the app will see update notifications.

let updateState: 'idle' | 'available' | 'downloading' | 'ready' | 'error' = 'idle'
let updateInfo:  { version?: string; releaseDate?: string } = {}

function initAutoUpdater() {
  if (isDev) return  // electron-updater can't update an unpacked dev build
  // Lazy require so the dev path doesn't pull electron-updater into memory
  let autoUpdater: any
  try {
    autoUpdater = require('electron-updater').autoUpdater
  } catch (e) {
    if (isDev) console.error('[xceleratr] electron-updater not installed:', e)
    return
  }

  autoUpdater.autoDownload          = true
  autoUpdater.autoInstallOnAppQuit  = true

  autoUpdater.on('update-available', (info: any) => {
    updateState = 'available'
    updateInfo  = { version: info?.version, releaseDate: info?.releaseDate }
    mainWindow?.webContents.send('update-status', { state: updateState, info: updateInfo })
  })
  autoUpdater.on('download-progress', (p: any) => {
    updateState = 'downloading'
    mainWindow?.webContents.send('update-status', {
      state: updateState, info: updateInfo, percent: Math.round(p?.percent ?? 0),
    })
  })
  autoUpdater.on('update-downloaded', (info: any) => {
    updateState = 'ready'
    updateInfo  = { version: info?.version, releaseDate: info?.releaseDate }
    mainWindow?.webContents.send('update-status', { state: updateState, info: updateInfo })
  })
  autoUpdater.on('error', (err: any) => {
    // Silent in production — most "errors" here are "no GitHub release found yet"
    if (isDev) console.warn('[xceleratr] update check error:', err?.message ?? err)
    updateState = 'error'
  })

  // initAutoUpdater itself is already deferred 8s past boot, so the first
  // network check can fire promptly afterward.
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => { /* silent */ })
  }, 1000)

  // Re-check every 6 hours while the app is open
  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => { /* silent */ })
  }, 6 * 60 * 60 * 1000)

  // Renderer can ask main to install now (after seeing the banner)
  ipcMain.handle('update-install-now', () => {
    if (updateState !== 'ready') return { ok: false, reason: 'not-ready' }
    try { autoUpdater.quitAndInstall() } catch (e) {
      if (isDev) console.error('[xceleratr] quitAndInstall failed:', e)
      return { ok: false, reason: 'install-failed' }
    }
    return { ok: true }
  })
}

ipcMain.handle('update-get-status', () => ({ state: updateState, info: updateInfo }))
