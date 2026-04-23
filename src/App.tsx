import { useEffect, useRef, useState } from 'react'
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
  const contentRef = useRef<HTMLElement>(null)

  useEffect(() => {
    window.api?.getSettings().then(s => {
      setSettings({ ...DEFAULT_SETTINGS, ...s })
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [])

  const updateSettings = (patch: Partial<AppSettings>) =>
    setSettings(prev => ({ ...prev, ...patch }))

  // Scroll to top synchronously before the new page mounts — prevents ghost image
  // from the previous page's scroll position showing through the transparent window
  const switchPage = (p: Page) => {
    contentRef.current?.scrollTo(0, 0)
    setPage(p)
  }

  if (!loaded) return null

  return (
    <div className={`app theme-${settings.theme}`}>
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
