import { useState, useEffect } from 'react'
import { AppSettings } from '../types'
import './Page.css'

interface Props {
  settings: AppSettings
  updateSettings: (patch: Partial<AppSettings>) => void
}

export default function Startup({ settings, updateSettings }: Props) {
  const [startOnBoot, setStartOnBoot] = useState(settings.startOnBoot)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const isMac = window.api?.platform === 'darwin'

  useEffect(() => {
    window.api?.getStartup().then((r) => setStartOnBoot(r.enabled)).catch(() => {})
  }, [])

  const handleSave = async () => {
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
        <h1 className="page-title">Startup</h1>
        <p className="page-sub">Control how Xceleratr launches at login</p>
      </div>

      <section className="section">
        <div className="section-title">Boot Behavior</div>

        <div className="field">
          <div className="field-header">
            <label className="field-label">Launch on {isMac ? 'Mac' : 'Windows'} startup</label>
            <button
              role="switch"
              aria-checked={startOnBoot}
              className={`toggle ${startOnBoot ? 'toggle-on' : 'toggle-off'}`}
              onClick={() => setStartOnBoot((v) => !v)}
            >
              <span className="toggle-thumb" />
            </button>
          </div>
          <div className="field-hint">
            {isMac
              ? 'Registers Xceleratr as a Login Item so it launches automatically when you log in.'
              : 'Registers Xceleratr in the Windows Registry Run key so it starts automatically when you log in.'}
          </div>
        </div>

        <div className="info-box">
          <div className="info-title">How it works</div>
          <ul className="info-list">
            {isMac ? (
              <>
                <li>Adds a LaunchAgent to <code>~/Library/LaunchAgents/</code></li>
                <li>Xceleratr will launch in the background on every login</li>
                <li>Your last saved mouse settings are applied automatically</li>
                <li>Toggle this off to remove the LaunchAgent</li>
              </>
            ) : (
              <>
                <li>Adds an entry to <code>HKCU\Software\Microsoft\Windows\CurrentVersion\Run</code></li>
                <li>Xceleratr will launch minimized in the background on every Windows login</li>
                <li>Your last saved mouse settings are applied automatically at startup</li>
                <li>Toggle this off to remove the registry entry</li>
              </>
            )}
          </ul>
        </div>
      </section>

      <div className="save-row">
        <button className="save-btn" onClick={handleSave} disabled={status === 'saving'}>
          {status === 'saving' && 'Saving…'}
          {status === 'saved' && 'Saved'}
          {status === 'error' && 'Error — try again'}
          {status === 'idle' && 'Save Startup Settings'}
        </button>
        {status === 'saved' && <span className="save-status ok">{startOnBoot ? 'Startup enabled' : 'Startup disabled'}</span>}
        {status === 'error' && <span className="save-status err">Failed to update startup settings.</span>}
      </div>
    </div>
  )
}
