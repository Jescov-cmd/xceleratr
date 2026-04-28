import { useState, useEffect } from 'react'
import { AppSettings, HotkeyAction } from '../types'
import HotkeyCapture from '../components/HotkeyCapture'
import './Page.css'

interface Props {
  settings: AppSettings
  updateSettings: (patch: Partial<AppSettings>) => void
}

export default function Hotkeys({ settings, updateSettings }: Props) {
  const [hotkeyEnabled, setHotkeyEnabled] = useState(settings.hotkeyEnabled !== false)
  const [bindings, setBindings] = useState({
    accelToggle:  settings.hotkeyAccelToggle  ?? 'CommandOrControl+Alt+X',
    cycleProfile: settings.hotkeyCycleProfile ?? '',
    abCompare:    settings.hotkeyABCompare    ?? '',
  })
  const isMac = window.api?.platform === 'darwin'

  useEffect(() => {
    window.api?.getHotkeyStatus?.().then(s => {
      setHotkeyEnabled(s.enabled)
      setBindings(s.bindings)
    }).catch(() => {})
  }, [])

  const toggleHotkey = async (next: boolean) => {
    setHotkeyEnabled(next)
    try {
      await window.api?.setHotkeyEnabled?.(next)
      updateSettings({ hotkeyEnabled: next })
    } catch { /* no-op */ }
  }

  const rebind = async (action: HotkeyAction, accelerator: string) => {
    setBindings(prev => ({ ...prev, [action]: accelerator }))
    try {
      await window.api?.hotkeyBind?.(action, accelerator)
      const fieldMap = {
        accelToggle:  'hotkeyAccelToggle' as const,
        cycleProfile: 'hotkeyCycleProfile' as const,
        abCompare:    'hotkeyABCompare' as const,
      }
      updateSettings({ [fieldMap[action]]: accelerator } as Partial<AppSettings>)
    } catch { /* no-op */ }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Hotkeys</h1>
        <p className="page-sub">Keyboard shortcuts that work anywhere — even mid-game</p>
      </div>

      <section className="section">
        <div className="field">
          <div className="field-header">
            <label className="field-label">Enable hotkeys</label>
            <button
              role="switch"
              aria-checked={hotkeyEnabled}
              className={`toggle ${hotkeyEnabled ? 'toggle-on' : 'toggle-off'}`}
              onClick={() => toggleHotkey(!hotkeyEnabled)}
            >
              <span className="toggle-thumb" />
            </button>
          </div>
          <div className="field-hint">
            Master switch — turn off if any of your hotkeys conflict with another app.
          </div>
        </div>
      </section>

      {hotkeyEnabled && (
        <section className="section">
          <div className="section-title">Bindings</div>

          <div className="field">
            <div className="field-header">
              <label className="field-label">Toggle acceleration on/off</label>
            </div>
            <div className="field-hint">
              Default <kbd className="kbd">{isMac ? 'Cmd' : 'Ctrl'}+Alt+X</kbd>. Press anywhere to quickly turn the curve off, then back on.
            </div>
            <HotkeyCapture
              value={bindings.accelToggle}
              onChange={(v: string) => rebind('accelToggle', v)}
            />
          </div>

          <div className="field">
            <div className="field-header">
              <label className="field-label">Cycle through saved profiles</label>
            </div>
            <div className="field-hint">
              Optional. Each press loads the next saved profile from the Profiles page.
            </div>
            <HotkeyCapture
              value={bindings.cycleProfile}
              onChange={(v: string) => rebind('cycleProfile', v)}
            />
          </div>

          <div className="field">
            <div className="field-header">
              <label className="field-label">A/B compare</label>
            </div>
            <div className="field-hint">
              Optional. Swap between the two profiles you've picked in the Compare page.
            </div>
            <HotkeyCapture
              value={bindings.abCompare}
              onChange={(v: string) => rebind('abCompare', v)}
            />
          </div>
        </section>
      )}

      <div className="info-box">
        <div className="info-title">How to record a hotkey</div>
        <ul className="info-list">
          <li>Click <strong>Set</strong> (or <strong>Change</strong>) next to the action you want.</li>
          <li>Press the key combination you want — for example, <kbd className="kbd">Ctrl + Alt + 1</kbd>.</li>
          <li>Hit <kbd className="kbd">Esc</kbd> if you want to cancel without changing anything.</li>
          <li>If a binding conflicts with Windows or another app, it just won't work — try a different combo.</li>
        </ul>
      </div>
    </div>
  )
}
