import { useEffect, useState } from 'react'
import { AppSettings, MouseProfile } from '../types'
import './Page.css'
import './Compare.css'

interface Props {
  settings: AppSettings
  updateSettings: (patch: Partial<AppSettings>) => void
}

async function persistAB(patch: { abSlotA?: string; abSlotB?: string }) {
  try { await window.api?.saveSettings?.(patch as Record<string, unknown>) } catch { /* no-op */ }
}

function curveSummary(s: NonNullable<MouseProfile['settings']>): string {
  const cap = s.curveType.charAt(0).toUpperCase() + s.curveType.slice(1)
  return `${cap} · ${s.pollingRate}Hz`
}

export default function Compare({ settings, updateSettings }: Props) {
  const [profiles, setProfiles] = useState<MouseProfile[]>([])

  useEffect(() => {
    window.api?.profilesList?.().then(setProfiles).catch(() => {})
  }, [])

  const filled = profiles.filter(p => p.settings)
  const profileA = profiles.find(p => p.id === settings.abSlotA) ?? null
  const profileB = profiles.find(p => p.id === settings.abSlotB) ?? null
  const isMac = window.api?.platform === 'darwin'
  const hotkey = settings.hotkeyABCompare
  const hotkeyDisplay = hotkey
    ? hotkey.replace('CommandOrControl', isMac ? 'Cmd' : 'Ctrl').replace(/\+/g, ' + ')
    : null

  const setSlot = (slot: 'abSlotA' | 'abSlotB', id: string) => {
    updateSettings({ [slot]: id })
    persistAB({ [slot]: id })
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Compare Profiles</h1>
        <p className="page-sub">Try two profiles side-by-side and pick the one that feels right</p>
      </div>

      <div className="info-box compare-howto">
        <div className="info-title">How this works</div>
        <ol className="info-list compare-steps">
          <li>Pick two saved profiles below — these become "Profile 1" and "Profile 2".</li>
          <li>Open <strong>Hotkeys</strong> in the sidebar and set a binding for "A/B compare" (e.g. <kbd className="kbd">Ctrl + Alt + C</kbd>).</li>
          <li>While playing or working, press that hotkey to switch instantly between the two. The one you keep liking better is your answer.</li>
        </ol>
      </div>

      {filled.length < 2 && (
        <div className="compare-warn">
          You need at least <strong>two saved profiles</strong> before you can compare. Head to the <em>Profiles</em> page first to save a couple.
        </div>
      )}

      <section className="section">
        <div className="section-title">Pick the two profiles to compare</div>
        <div className="compare-pair">
          <CompareSlot
            slotLabel="Profile 1"
            color="A"
            profiles={filled}
            selectedId={settings.abSlotA}
            onChange={id => setSlot('abSlotA', id)}
            selectedProfile={profileA}
          />
          <div className="compare-vs">vs</div>
          <CompareSlot
            slotLabel="Profile 2"
            color="B"
            profiles={filled}
            selectedId={settings.abSlotB}
            onChange={id => setSlot('abSlotB', id)}
            selectedProfile={profileB}
          />
        </div>
      </section>

      <section className="section">
        <div className="section-title">Hotkey</div>
        {hotkeyDisplay ? (
          <div className="compare-hotkey-set">
            Press <kbd className="kbd">{hotkeyDisplay}</kbd> to switch.
            <span className="compare-hotkey-link">Change in <em>Hotkeys</em> page.</span>
          </div>
        ) : (
          <div className="compare-hotkey-missing">
            ⚠ No hotkey set yet — go to the <strong>Hotkeys</strong> page and set "A/B compare" before this can work.
          </div>
        )}
      </section>
    </div>
  )
}

interface SlotProps {
  slotLabel: string
  color: 'A' | 'B'
  profiles: MouseProfile[]
  selectedId: string
  onChange: (id: string) => void
  selectedProfile: MouseProfile | null
}

function CompareSlot({ slotLabel, color, profiles, selectedId, onChange, selectedProfile }: SlotProps) {
  return (
    <div className={`compare-slot compare-slot-${color.toLowerCase()}`}>
      <div className="compare-slot-tag">{slotLabel}</div>
      <select
        className="compare-slot-select"
        value={selectedId ?? ''}
        onChange={e => onChange(e.target.value)}
      >
        <option value="">— pick a profile —</option>
        {profiles.map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      {selectedProfile?.settings ? (
        <div className="compare-slot-summary">{curveSummary(selectedProfile.settings)}</div>
      ) : (
        <div className="compare-slot-empty">Nothing selected yet</div>
      )}
    </div>
  )
}
