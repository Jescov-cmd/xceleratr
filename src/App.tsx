import { useEffect, useMemo, useRef, useState } from 'react'
import Sidebar from './components/Sidebar'
import TitleBar from './components/TitleBar'
import UpdateBanner from './components/UpdateBanner'
import WelcomeWizard from './components/WelcomeWizard'
import Home from './pages/Home'
import Settings from './pages/Settings'
import Preferences from './pages/Preferences'
import Hotkeys from './pages/Hotkeys'
import Compare from './pages/Compare'
import Profiles from './pages/Profiles'
import Calibration from './pages/Calibration'
import Changelog from './pages/Changelog'
import { AppSettings, DEFAULT_CUSTOM_POINTS } from './types'
import './App.css'

const DEFAULT_SETTINGS: AppSettings = {
  sensitivity: 10,
  sensitivityEnabled: true,
  yxRatio: 1.0,
  yxRatioEnabled: true,
  curveType: 'default',
  customCurvePoints: DEFAULT_CUSTOM_POINTS,
  curveAcceleration: 100,
  accelerationEnabled: true,
  curveThreshold: 50,
  curveExponent: 1.5,
  perAxisEnabled: false,
  curveTypeY: 'default',
  customCurvePointsY: DEFAULT_CUSTOM_POINTS,
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

export type Page = 'home' | 'curves' | 'profiles' | 'compare' | 'hotkeys' | 'calibration' | 'preferences' | 'changelog'

export default function App() {
  const [page, setPage]                   = useState<Page>('home')
  const [settings, setSettings]           = useState<AppSettings>(DEFAULT_SETTINGS)
  const [loaded, setLoaded]               = useState(false)
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null)
  const [accentHex, setAccentHex]         = useState<string | null>(null)
  const contentRef = useRef<HTMLElement>(null)

  useEffect(() => {
    window.api?.getSettings().then(s => {
      setSettings({ ...DEFAULT_SETTINGS, ...s })
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [])

  // Push from main: hotkey toggled accel, or another async source mutated settings
  useEffect(() => {
    if (!window.api?.onSettingsChanged) return
    return window.api.onSettingsChanged((next) => {
      setSettings(prev => ({ ...prev, ...(next as Partial<AppSettings>) }))
    })
  }, [])

  // Fetch Windows accent color and subscribe to changes
  useEffect(() => {
    if (!window.api?.getAccentColor) return
    window.api.getAccentColor().then(setAccentHex)
    const unsub = window.api.onAccentColorChanged(setAccentHex)
    return unsub
  }, [])

  // Derive CSS custom property overrides from accent hex + current theme.
  // Applied as inline style on .app — inline styles beat any class rule.
  const accentStyle = useMemo((): React.CSSProperties => {
    if (!accentHex || settings.theme === 'high-contrast') return {}
    const r = parseInt(accentHex.slice(0, 2), 16)
    const g = parseInt(accentHex.slice(2, 4), 16)
    const b = parseInt(accentHex.slice(4, 6), 16)
    if (isNaN(r) || isNaN(g) || isNaN(b)) return {}
    const isDark = settings.theme === 'dark'
    // Blend 45% toward white for the light text variant used in dark mode
    const lr = Math.round(r + (255 - r) * 0.45)
    const lg = Math.round(g + (255 - g) * 0.45)
    const lb = Math.round(b + (255 - b) * 0.45)
    return {
      '--accent':        `rgb(${r},${g},${b})`,
      '--active-bg':     isDark ? `rgba(${r},${g},${b},0.18)` : `rgba(${r},${g},${b},0.10)`,
      '--active-text':   isDark ? `rgb(${lr},${lg},${lb})` : `rgb(${r},${g},${b})`,
      '--active-border': `rgb(${r},${g},${b})`,
      '--input-focus':   `rgb(${r},${g},${b})`,
      '--track-fill':    `rgb(${r},${g},${b})`,
      '--thumb':         `rgb(${r},${g},${b})`,
    } as React.CSSProperties
  }, [accentHex, settings.theme])

  const updateSettings = (patch: Partial<AppSettings>) =>
    setSettings(prev => ({ ...prev, ...patch }))

  const switchPage = (p: Page) => {
    contentRef.current?.scrollTo(0, 0)
    setPage(p)
  }

  if (!loaded) return null

  const finishOnboarding = async (patch: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...patch }))
    try {
      await window.api?.saveSettings?.(patch as Record<string, unknown>)
      // Apply the curve right away so the user feels their pick immediately
      const next = { ...settings, ...patch }
      await window.api?.applyMouse?.({
        yxRatio: next.yxRatioEnabled ? (next.yxRatio ?? 1) : 1,
        yxRatioEnabled: next.yxRatioEnabled,
        curveType: next.curveType,
        customCurvePoints: next.customCurvePoints ?? DEFAULT_CUSTOM_POINTS,
        curveAcceleration: next.curveAcceleration,
        accelerationEnabled: next.accelerationEnabled,
        curveThreshold: next.curveThreshold,
        curveExponent: next.curveExponent,
        perAxisEnabled: next.perAxisEnabled ?? false,
        curveTypeY: next.curveTypeY ?? 'default',
        customCurvePointsY: next.customCurvePointsY ?? DEFAULT_CUSTOM_POINTS,
        curveAccelerationY: next.curveAccelerationY ?? 100,
        curveThresholdY:    next.curveThresholdY    ?? 50,
        curveExponentY:     next.curveExponentY     ?? 1.5,
        curveSmoothing:     next.curveSmoothing     ?? 0,
        enhancePointerPrecision: next.enhancePointerPrecision,
        pollingRate: next.pollingRate,
      })
    } catch { /* no-op */ }
  }

  const skipOnboarding = async () => {
    const patch: Partial<AppSettings> = { onboardingComplete: true }
    setSettings(prev => ({ ...prev, ...patch }))
    try { await window.api?.saveSettings?.(patch as Record<string, unknown>) } catch { /* no-op */ }
  }

  return (
    <div className={`app theme-${settings.theme}`} style={accentStyle}>
      {!settings.onboardingComplete && (
        <WelcomeWizard onFinish={finishOnboarding} onSkip={skipOnboarding} />
      )}
      <TitleBar settings={settings} updateSettings={updateSettings} />
      <UpdateBanner />
      <div className="layout">
        <Sidebar page={page} setPage={switchPage} />
        <main className="content" ref={contentRef}>
          {page === 'home'     && <Home     settings={settings} />}
          {page === 'curves'   && <Settings settings={settings} updateSettings={updateSettings} />}
          {page === 'profiles' && (
            <Profiles
              settings={settings}
              updateSettings={updateSettings}
              activeProfileId={activeProfileId}
              setActiveProfileId={setActiveProfileId}
            />
          )}
          {page === 'compare'     && <Compare     settings={settings} updateSettings={updateSettings} />}
          {page === 'hotkeys'     && <Hotkeys     settings={settings} updateSettings={updateSettings} />}
          {page === 'calibration' && <Calibration />}
          {page === 'preferences' && <Preferences settings={settings} updateSettings={updateSettings} />}
          {page === 'changelog'   && <Changelog />}
        </main>
      </div>
    </div>
  )
}
