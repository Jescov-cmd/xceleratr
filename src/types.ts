export type CurveType = 'default' | 'linear' | 'natural' | 'power' | 'sigmoid' | 'bounce' | 'classic' | 'jump' | 'custom'

export interface CurvePoint { x: number; y: number }

export const DEFAULT_CUSTOM_POINTS: CurvePoint[] = [
  { x: 0, y: 1.0 }, { x: 0.35, y: 1.3 }, { x: 0.7, y: 1.9 }, { x: 1.0, y: 2.8 },
]

export interface AppSettings {
  sensitivity: number
  sensitivityEnabled: boolean
  yxRatio: number
  yxRatioEnabled: boolean
  // X-axis curve (also used as the single-curve when perAxisEnabled is false)
  curveType: CurveType
  customCurvePoints: CurvePoint[]
  curveAcceleration: number
  accelerationEnabled: boolean
  curveThreshold: number
  curveExponent: number
  // Per-axis curves: when on, Y axis uses its own independent curve; yxRatio is ignored
  perAxisEnabled: boolean
  curveTypeY: CurveType
  customCurvePointsY: CurvePoint[]
  curveAccelerationY: number
  curveThresholdY: number
  curveExponentY: number
  enhancePointerPrecision: boolean
  pollingRate: number
  curveSmoothing: number  // 0–100. EMA applied to the multiplier — softens step-curve transitions.
  theme: 'light' | 'dark' | 'high-contrast'
  startOnBoot: boolean
  profileName: string
  // Local user profile — purely cosmetic, stored on-device only, never transmitted
  userName: string
  userEmail: string
  userPhone: string
  userAvatar: string  // data URL (data:image/...;base64,...) or '' for default
  // Hotkey settings — empty string disables a binding
  hotkeyEnabled: boolean  // master toggle (off → none of the hotkeys are active)
  hotkeyAccelToggle: string   // default "CommandOrControl+Alt+X"
  hotkeyCycleProfile: string  // default "" (off)
  hotkeyABCompare: string     // default "" (off)
  // A/B compare: which two profile slots are paired for the hotkey swap
  abSlotA: string
  abSlotB: string
  // First-run welcome wizard — true once user finishes or skips it
  onboardingComplete: boolean
}

export type HotkeyAction = 'accelToggle' | 'cycleProfile' | 'abCompare'

export type MouseSettings = Pick<AppSettings,
  'yxRatio' | 'yxRatioEnabled' |
  'curveType' | 'customCurvePoints' |
  'curveAcceleration' | 'accelerationEnabled' |
  'curveThreshold' | 'curveExponent' |
  'perAxisEnabled' | 'curveTypeY' | 'customCurvePointsY' |
  'curveAccelerationY' | 'curveThresholdY' | 'curveExponentY' |
  'enhancePointerPrecision' | 'pollingRate' | 'curveSmoothing'
>

export interface MouseProfile {
  id: string
  name: string
  savedAt: string | null
  settings: MouseSettings | null
}

declare global {
  interface Window {
    api: {
      minimize: () => void
      close: () => void
      platform: string
      getSettings: () => Promise<AppSettings>
      saveSettings: (s: Partial<AppSettings>) => Promise<{ ok: boolean }>
      applyMouse: (s: MouseSettings) => Promise<{ ok: boolean }>
      getStartup: () => Promise<{ enabled: boolean }>
      setStartup: (enable: boolean) => Promise<{ ok: boolean }>
      profilesList:  () => Promise<MouseProfile[]>
      profilesSave:  (p: MouseProfile) => Promise<{ ok: boolean }>
      profilesDelete:(id: string) => Promise<{ ok: boolean }>
      onLiveSpeed: (cb: (x: number) => void) => () => void
      getAccentColor: () => Promise<string | null>
      onAccentColorChanged: (cb: (color: string | null) => void) => () => void
      openSupportEmail: () => Promise<{ ok: boolean }>

      setHotkeyEnabled: (enabled: boolean) => Promise<{ ok: boolean; registered: boolean }>
      getHotkeyStatus:  () => Promise<{
        enabled: boolean
        bindings: { accelToggle: string; cycleProfile: string; abCompare: string }
        registered: HotkeyAction[]
      }>
      hotkeyBind: (action: HotkeyAction, accelerator: string) => Promise<{ ok: boolean; registered: boolean; reason?: string }>
      refreshTray: () => Promise<{ ok: boolean }>
      onSettingsChanged: (cb: (settings: Record<string, unknown>) => void) => () => void

      getUpdateStatus:  () => Promise<{ state: string; info: { version?: string; releaseDate?: string } }>
      installUpdateNow: () => Promise<{ ok: boolean; reason?: string }>
      onUpdateStatus:   (cb: (status: { state: string; info?: { version?: string; releaseDate?: string }; percent?: number }) => void) => () => void
    }
  }
}
