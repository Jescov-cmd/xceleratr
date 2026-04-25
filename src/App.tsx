import { useEffect, useMemo, useRef, useState } from 'react'
import Sidebar from './components/Sidebar'
import TitleBar from './components/TitleBar'
import Home from './pages/Home'
import Settings from './pages/Settings'
import Startup from './pages/Startup'
import Profiles from './pages/Profiles'
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
  enhancePointerPrecision: false,
  pollingRate: 1000,
  theme: 'dark',
  startOnBoot: false,
  profileName: 'Default',
}

export type Page = 'home' | 'settings' | 'profiles' | 'startup'

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

  return (
    <div className={`app theme-${settings.theme}`} style={accentStyle}>
      <TitleBar />
      <div className="layout">
        <Sidebar page={page} setPage={switchPage} />
        <main className="content" ref={contentRef}>
          {page === 'home'     && <Home     settings={settings} />}
          {page === 'settings' && <Settings settings={settings} updateSettings={updateSettings} />}
          {page === 'profiles' && (
            <Profiles
              settings={settings}
              updateSettings={updateSettings}
              activeProfileId={activeProfileId}
              setActiveProfileId={setActiveProfileId}
            />
          )}
          {page === 'startup'  && <Startup  settings={settings} updateSettings={updateSettings} />}
        </main>
      </div>
    </div>
  )
}
