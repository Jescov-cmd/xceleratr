import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from 'electron'
import path from 'path'
import { execFileSync } from 'child_process'
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
  enhancePointerPrecision: boolean
  pollingRate: number
  theme: 'light' | 'dark' | 'high-contrast'
  startOnBoot: boolean
  profileName: string
}

const DEFAULTS: Settings = {
  sensitivity: 10,
  sensitivityEnabled: true,
  yxRatio: 1.0,
  yxRatioEnabled: true,
  curveType: 'default',
  customCurvePoints: [{ x: 0, y: 1 }, { x: 0.35, y: 1.3 }, { x: 0.7, y: 1.9 }, { x: 1, y: 2.8 }],
  curveAcceleration: 100,
  accelerationEnabled: true,
  curveThreshold: 50,
  curveExponent: 1.5,
  enhancePointerPrecision: false,
  pollingRate: 1000,
  theme: 'dark',
  startOnBoot: false,
  profileName: 'Default',
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

function regRead(name: string): string {
  try {
    const out = execFileSync('reg.exe', ['query', 'HKCU\\Control Panel\\Mouse', '/v', name],
      { encoding: 'utf8', windowsHide: true }).trim()
    const m = out.match(/REG_SZ\s+(\S+)/)
    return m ? m[1].trim() : ''
  } catch { return '' }
}

function captureOriginals() {
  if (origMouse) return
  origMouse = {
    sensitivity: regRead('MouseSensitivity'),
    speed:       regRead('MouseSpeed'),
    thresh1:     regRead('MouseThreshold1'),
    thresh2:     regRead('MouseThreshold2'),
  }
  if (isDev) console.log('[xceleratr] captured originals:', origMouse)
}

function restoreOriginals() {
  if (!origMouse) return
  if (origMouse.sensitivity) { regWrite('MouseSensitivity', origMouse.sensitivity); apiSetSpeed(parseInt(origMouse.sensitivity) || 10) }
  if (origMouse.speed)       regWrite('MouseSpeed',      origMouse.speed)
  if (origMouse.thresh1)     regWrite('MouseThreshold1', origMouse.thresh1)
  if (origMouse.thresh2)     regWrite('MouseThreshold2', origMouse.thresh2)
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

let hookWorker:      Worker | null = null
let hookWorkerTimer: ReturnType<typeof setTimeout> | null = null

function stopHookWorker() {
  if (hookWorkerTimer) { clearTimeout(hookWorkerTimer); hookWorkerTimer = null }
  if (!hookWorker) return
  const w = hookWorker
  hookWorker = null  // clear before postMessage so the stale guard catches any in-flight 'ready'
  w.postMessage({ type: 'stop' })
  // terminate() is NOT used here — it kills koffi mid-native-call (PeekMsg) and causes a fatal crash
}

function startHookWorker(curve: {
  curveType: CurveType; customCurvePoints: CurvePoint[]
  curveAcceleration: number; accelerationEnabled: boolean
  curveThreshold: number; curveExponent: number; pollingRate: number; yxRatio: number
}) {
  stopHookWorker()
  if (!IS_WIN) return

  // Debounce: if startHookWorker is called multiple times rapidly, only the last call
  // creates a worker. This prevents "hook worker ready" logging multiple times.
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
      } else if (msg.type === 'debug' && isDev) {
        console.log('[xceleratr] hook fired — speed:', msg.speed, 'mult:', msg.mult, 'SendInput sent:', msg.sent)
      } else if (msg.type === 'error' && isDev) {
        console.error('[xceleratr] hook callback error:', msg.msg)
      }
    })
    worker.on('error', (e) => {
      if (isDev) console.error('[xceleratr] hook worker fatal:', e)
    })
  }, 80)
}

// ── Window ────────────────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null
let tray:       Tray        | null = null
let isQuitting = false

function createWindow() {
  const icoPath = path.join(__dirname, '../public/icon.ico')
  mainWindow = new BrowserWindow({
    width: 860, height: 600, minWidth: 700, minHeight: 480,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    show: !startedAtBoot,
    icon: fs.existsSync(icoPath) ? icoPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
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

function createTray() {
  try {
    const pngPath = path.join(__dirname, '../public/tray.png')
    const icoPath = path.join(__dirname, '../public/icon.ico')
    const iconFile = IS_MAC && fs.existsSync(pngPath) ? pngPath
      : fs.existsSync(icoPath) ? icoPath
      : pngPath
    const icon = fs.existsSync(iconFile)
      ? nativeImage.createFromPath(iconFile).resize({ width: 16, height: 16 })
      : nativeImage.createEmpty()

    tray = new Tray(icon)
    tray.setToolTip('Xceleratr')
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Show Xceleratr', click: () => { mainWindow?.show(); mainWindow?.focus() } },
      { type: 'separator' },
      { label: 'Quit Xceleratr', click: () => { isQuitting = true; app.quit() } },
    ]))
    tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus() })
  } catch (e) {
    if (isDev) console.error('[xceleratr] tray creation failed:', e)
  }
}

app.whenReady().then(() => {
  app.setName('Xceleratr')
  if (IS_WIN) app.setAppUserModelId('com.xceleratr.app')
  initWinAPIs()
  createWindow()
  createTray()
  // Apply saved settings immediately so the hook is active from launch
  const s = loadSettings()
  try {
    if (IS_WIN) applyWin(s)
    if (IS_MAC) applyMac(s)
  } catch (e) {
    if (isDev) console.error('[xceleratr] initial apply failed:', e)
  }
})

// On Mac, clicking the dock icon re-shows the window
app.on('activate', () => {
  if (mainWindow) { mainWindow.show(); mainWindow.focus() }
  else createWindow()
})

app.on('window-all-closed', () => { /* stay in tray — quit via tray menu only */ })
app.on('before-quit', () => { isQuitting = true })
app.on('will-quit', () => {
  stopHookWorker()
  if (IS_WIN) restoreOriginals()
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
      { windowsHide: true })
  } catch { /* no-op */ }
}

function applyWin(s: {
  sensitivity: number; sensitivityEnabled: boolean; yxRatio: number; yxRatioEnabled: boolean
  curveType: CurveType; customCurvePoints: CurvePoint[]
  curveAcceleration: number; accelerationEnabled: boolean
  curveThreshold: number; curveExponent: number; enhancePointerPrecision: boolean
  pollingRate: number
}) {
  captureOriginals()   // save before first write

  // ── Sensitivity ──
  if (s.sensitivityEnabled) {
    const regVal = String(Math.max(1, Math.min(20, s.sensitivity)))
    regWrite('MouseSensitivity', regVal)
    apiSetSpeed(parseInt(regVal))
  } else {
    if (origMouse?.sensitivity) {
      regWrite('MouseSensitivity', origMouse.sensitivity)
      apiSetSpeed(parseInt(origMouse.sensitivity) || 10)
    }
  }

  // ── Acceleration ──
  const effectiveRatio = s.yxRatioEnabled ? s.yxRatio : 1.0
  const useHook = (s.accelerationEnabled && s.curveType !== 'default') || Math.abs(effectiveRatio - 1) > 0.02
  // 'custom' with no points = treat as default
  const useEPP  = s.enhancePointerPrecision && !useHook

  let mouseSpeed: number, thr1: number, thr2: number
  if (useEPP) {
    // Windows built-in EPP — doubles acceleration past 2nd threshold
    mouseSpeed = 2; thr1 = 6; thr2 = 10
  } else {
    // Flat — hook (if active) handles all acceleration in software
    mouseSpeed = 0; thr1 = 0; thr2 = 0
  }

  if (s.accelerationEnabled) {
    regWrite('MouseSpeed',      String(mouseSpeed))
    regWrite('MouseThreshold1', String(thr1))
    regWrite('MouseThreshold2', String(thr2))
  } else {
    // Acceleration off: explicitly clear all Windows acceleration
    regWrite('MouseSpeed',      '0')
    regWrite('MouseThreshold1', '0')
    regWrite('MouseThreshold2', '0')
  }

  // ── Hook worker ──
  if (useHook) {
    startHookWorker({
      curveType:           s.curveType,
      customCurvePoints:   s.customCurvePoints,
      curveAcceleration:   s.curveAcceleration,
      accelerationEnabled: s.accelerationEnabled,
      curveThreshold:      s.curveThreshold,
      curveExponent:       s.curveExponent,
      pollingRate:         s.pollingRate,
      yxRatio:             effectiveRatio,
    })
  } else {
    stopHookWorker()
  }
}

function applyMac(s: { sensitivity: number; sensitivityEnabled: boolean; accelerationEnabled: boolean; yxRatio: number }) {
  try {
    if (!s.accelerationEnabled) {
      execFileSync('defaults', ['write', '-g', 'com.apple.mouse.scaling', '-1'], { stdio: 'ignore' })
    } else if (s.sensitivityEnabled) {
      // Piecewise linear: sensitivity 10 = macOS default (0.6875), 1 = 0.1, 20 = 3.0
      const scale = s.sensitivity <= 10
        ? 0.1 + (s.sensitivity - 1) * ((0.6875 - 0.1) / 9)
        : 0.6875 + (s.sensitivity - 10) * ((3.0 - 0.6875) / 10)
      execFileSync('defaults', ['write', '-g', 'com.apple.mouse.scaling', scale.toFixed(4)], { stdio: 'ignore' })
    }
  } catch { /* no-op */ }
}

ipcMain.handle('mouse-apply', (_e, s: {
  sensitivity: number; sensitivityEnabled: boolean; yxRatio: number; yxRatioEnabled: boolean
  curveType: CurveType; customCurvePoints: CurvePoint[]
  curveAcceleration: number; accelerationEnabled: boolean
  curveThreshold: number; curveExponent: number; enhancePointerPrecision: boolean
  pollingRate: number
}) => {
  if (IS_WIN) applyWin(s)
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
      { encoding: 'utf8', windowsHide: true }).trim()
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
        { windowsHide: true })
    } else {
      execFileSync('reg.exe', ['delete', WIN_RUN, '/v', APP_NAME, '/f'], { windowsHide: true })
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
