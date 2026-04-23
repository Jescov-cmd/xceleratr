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

export type MouseSettings = Pick<AppSettings,
  'sensitivity' | 'sensitivityEnabled' | 'yxRatio' | 'yxRatioEnabled' |
  'curveType' | 'customCurvePoints' |
  'curveAcceleration' | 'accelerationEnabled' |
  'curveThreshold' | 'curveExponent' | 'enhancePointerPrecision' | 'pollingRate'
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
    }
  }
}
