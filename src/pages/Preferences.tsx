import { useState, useEffect } from 'react'
import { AppSettings } from '../types'
import './Page.css'
import './Settings.css'

interface Props {
  settings: AppSettings
  updateSettings: (patch: Partial<AppSettings>) => void
}

export default function Preferences({ settings, updateSettings }: Props) {
  const [startOnBoot, setStartOnBoot] = useState(settings.startOnBoot)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const isMac = window.api?.platform === 'darwin'

  useEffect(() => {
    window.api?.getStartup().then(r => setStartOnBoot(r.enabled)).catch(() => {})
  }, [])

  const setTheme = async (t: 'light' | 'dark' | 'high-contrast') => {
    updateSettings({ theme: t })
    try { await window.api?.saveSettings?.({ theme: t } as Record<string, unknown>) } catch { /* no-op */ }
  }

  const handleSaveStartup = async () => {
    setStatus('saving')
    try {
      await window.api.setStartup(startOnBoot)
      await window.api.saveSettings({ startOnBoot } as Record<string, unknown>)
      updateSettings({ startOnBoot })
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 2000)
    } catch {
      setStatus('error')
      setTimeout(() => setStatus('idle'), 2000)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Preferences</h1>
        <p className="page-sub">App appearance and launch behavior</p>
      </div>

      {/* Theme */}
      <section className="section">
        <div className="section-title">Theme</div>
        <div className="field">
          <div className="theme-picker">
            {(['light', 'dark', 'high-contrast'] as const).map(t => (
              <button
                key={t}
                className={`theme-btn ${settings.theme === t ? 'theme-btn-active' : ''}`}
                onClick={() => setTheme(t)}
              >
                <div className={`theme-swatch swatch-${t === 'high-contrast' ? 'hc' : t}`} />
                <span>{t === 'high-contrast' ? 'High Contrast' : t.charAt(0).toUpperCase() + t.slice(1)}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Startup */}
      <section className="section">
        <div className="section-title">Launch on Login</div>
        <div className="field">
          <div className="field-header">
            <label className="field-label">Start Xceleratr on {isMac ? 'Mac' : 'Windows'} login</label>
            <button
              role="switch"
              aria-checked={startOnBoot}
              className={`toggle ${startOnBoot ? 'toggle-on' : 'toggle-off'}`}
              onClick={() => setStartOnBoot(v => !v)}
            >
              <span className="toggle-thumb" />
            </button>
          </div>
          <div className="field-hint">
            {isMac
              ? 'Adds a LaunchAgent so Xceleratr runs every time you log in.'
              : 'Adds a Windows Registry Run entry so Xceleratr runs every time you log in.'}
            {' '}Your last saved settings apply automatically at startup.
          </div>
        </div>

        <div className="save-row">
          <button className="save-btn" onClick={handleSaveStartup} disabled={status === 'saving'}>
            {status === 'saving' && 'Saving…'}
            {status === 'saved'  && 'Saved'}
            {status === 'error'  && 'Error — try again'}
            {status === 'idle'   && 'Save startup setting'}
          </button>
          {status === 'saved' && <span className="save-status ok">{startOnBoot ? 'Startup enabled' : 'Startup disabled'}</span>}
          {status === 'error' && <span className="save-status err">Failed.</span>}
        </div>
      </section>
    </div>
  )
}
