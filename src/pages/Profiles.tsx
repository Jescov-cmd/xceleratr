import { useState, useEffect, useRef } from 'react'
import { AppSettings, DEFAULT_CUSTOM_POINTS, MouseProfile, MouseSettings } from '../types'
import './Page.css'
import './Profiles.css'

interface Props {
  settings: AppSettings
  updateSettings: (patch: Partial<AppSettings>) => void
  activeProfileId: string | null
  setActiveProfileId: (id: string) => void
}

const SLOT_NAMES: Record<string, string> = {
  'default': 'Default',
  'custom-1': 'Slot 1', 'custom-2': 'Slot 2', 'custom-3': 'Slot 3',
  'custom-4': 'Slot 4', 'custom-5': 'Slot 5',
}

function toMouseSettings(s: AppSettings): MouseSettings {
  return {
    sensitivity: s.sensitivity, sensitivityEnabled: s.sensitivityEnabled,
    yxRatio: s.yxRatio ?? 1, yxRatioEnabled: s.yxRatioEnabled ?? true,
    curveType: s.curveType,
    customCurvePoints: s.customCurvePoints ?? DEFAULT_CUSTOM_POINTS,
    curveAcceleration: s.curveAcceleration, accelerationEnabled: s.accelerationEnabled,
    curveThreshold: s.curveThreshold, curveExponent: s.curveExponent,
    enhancePointerPrecision: s.enhancePointerPrecision, pollingRate: s.pollingRate,
  }
}

function encodeProfile(name: string, s: MouseSettings): string {
  return 'XC1:' + btoa(JSON.stringify({ v: 1, name, ...s }))
}

function decodeProfile(code: string): { name: string; settings: MouseSettings } | null {
  try {
    const b64 = code.trim().startsWith('XC1:') ? code.trim().slice(4) : code.trim()
    const p = JSON.parse(atob(b64))
    if (!p.v || typeof p.sensitivity !== 'number') return null
    return {
      name: typeof p.name === 'string' ? p.name : 'Imported',
      settings: {
        sensitivity: p.sensitivity ?? 10, sensitivityEnabled: p.sensitivityEnabled ?? true,
        yxRatio: p.yxRatio ?? 1, yxRatioEnabled: p.yxRatioEnabled ?? true,
        curveType: p.curveType ?? 'default',
        customCurvePoints: Array.isArray(p.customCurvePoints) ? p.customCurvePoints : DEFAULT_CUSTOM_POINTS,
        curveAcceleration: p.curveAcceleration ?? 100, accelerationEnabled: p.accelerationEnabled ?? true,
        curveThreshold: p.curveThreshold ?? 50, curveExponent: p.curveExponent ?? 1.5,
        enhancePointerPrecision: p.enhancePointerPrecision ?? false, pollingRate: p.pollingRate ?? 1000,
      },
    }
  } catch { return null }
}

interface CtxState { profile: MouseProfile; x: number; y: number }

export default function Profiles({ settings, updateSettings, activeProfileId, setActiveProfileId }: Props) {
  const [profiles, setProfiles]   = useState<MouseProfile[]>([])
  const [ctx, setCtx]             = useState<CtxState | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameVal, setRenameVal] = useState('')
  const [importCode, setImportCode] = useState('')
  const [importError, setImportError] = useState('')
  const [importSlot, setImportSlot]   = useState('custom-1')
  const [toast, setToast]         = useState('')
  const renameRef  = useRef<HTMLInputElement>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    window.api.profilesList().then(setProfiles).catch(() => {})
    return () => { if (toastTimer.current) clearTimeout(toastTimer.current) }
  }, [])

  useEffect(() => {
    if (!ctx) return
    const close = () => setCtx(null)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [ctx])

  useEffect(() => {
    if (renamingId && renameRef.current) renameRef.current.focus()
  }, [renamingId])

  function showToast(msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = setTimeout(() => { setToast(''); toastTimer.current = null }, 2200)
  }

  async function applyProfile(profile: MouseProfile) {
    if (!profile.settings) return
    const s = profile.settings
    const effective: typeof s = {
      ...s,
      yxRatio: s.yxRatioEnabled ? (s.yxRatio ?? 1) : 1,
      customCurvePoints: s.customCurvePoints ?? DEFAULT_CUSTOM_POINTS,
    }
    try {
      await window.api.saveSettings(effective as unknown as Record<string, unknown>)
      await window.api.applyMouse(effective)
      updateSettings(effective)
      setActiveProfileId(profile.id)
      showToast(`Applied: ${profile.name}`)
    } catch { showToast('Failed to apply') }
  }

  async function persistProfile(updated: MouseProfile) {
    await window.api.profilesSave(updated)
    setProfiles(prev => prev.map(p => p.id === updated.id ? updated : p))
  }

  async function saveToSlot(profile: MouseProfile) {
    await persistProfile({
      ...profile,
      settings: toMouseSettings(settings),
      savedAt: new Date().toISOString(),
    })
    showToast(`Saved to "${profile.name}"`)
  }

  async function clearSlot(profile: MouseProfile) {
    await persistProfile({ ...profile, settings: null, savedAt: null })
    showToast('Slot cleared')
  }

  async function commitRename(id: string, val: string) {
    const profile = profiles.find(p => p.id === id)
    if (!profile) return
    await persistProfile({ ...profile, name: val.trim() || SLOT_NAMES[id] || 'Slot' })
    setRenamingId(null)
  }

  function copyCode(profile: MouseProfile) {
    if (!profile.settings) return
    navigator.clipboard.writeText(encodeProfile(profile.name, profile.settings))
      .then(() => showToast('Share code copied'))
  }

  function handleImport() {
    setImportError('')
    const result = decodeProfile(importCode)
    if (!result) { setImportError('Invalid share code — paste a code starting with XC1:'); return }
    const target = profiles.find(p => p.id === importSlot)
    if (!target) return
    persistProfile({ ...target, name: result.name, settings: result.settings, savedAt: new Date().toISOString() })
    setImportCode('')
    showToast(`Imported "${result.name}" → ${target.name}`)
  }

  function summaryLine(s: MouseSettings) {
    const parts = [`${s.curveType.charAt(0).toUpperCase()}${s.curveType.slice(1)}`, `Sens ${s.sensitivity}/20`]
    if (Math.abs((s.yxRatio ?? 1) - 1) > 0.02) parts.push(`V/H ${s.yxRatio.toFixed(2)}`)
    return parts.join(' · ')
  }

  function fmtDate(iso: string | null) {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Profiles</h1>
        <p className="page-sub">Click to apply · Right-click to save, rename, or share</p>
      </div>

      <div className="profile-grid">
        {profiles.map(profile => (
          <div
            key={profile.id}
            className={[
              'profile-card',
              profile.settings ? 'profile-filled' : 'profile-empty',
              activeProfileId === profile.id ? 'profile-active' : '',
            ].filter(Boolean).join(' ')}
            onClick={() => { if (!renamingId && profile.settings) applyProfile(profile) }}
            onContextMenu={e => { e.preventDefault(); setCtx({ profile, x: e.clientX, y: e.clientY }) }}
          >
            <div className="profile-head">
              {activeProfileId === profile.id && <span className="profile-dot" />}
              {renamingId === profile.id ? (
                <input
                  ref={renameRef}
                  className="profile-rename"
                  value={renameVal}
                  onChange={e => setRenameVal(e.target.value)}
                  onBlur={() => commitRename(profile.id, renameVal)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitRename(profile.id, renameVal)
                    if (e.key === 'Escape') setRenamingId(null)
                    e.stopPropagation()
                  }}
                  onClick={e => e.stopPropagation()}
                  maxLength={24}
                />
              ) : (
                <span className="profile-name">{profile.name}</span>
              )}
              {profile.id === 'default' && <span className="profile-badge">DEFAULT</span>}
            </div>

            {profile.settings ? (
              <div className="profile-meta">
                <span className="profile-summary">{summaryLine(profile.settings)}</span>
                {profile.savedAt && <span className="profile-date">{fmtDate(profile.savedAt)}</span>}
              </div>
            ) : (
              <span className="profile-hint">Right-click to save here</span>
            )}
          </div>
        ))}
      </div>

      {/* Right-click context menu */}
      {ctx && (
        <div
          className="ctx-menu"
          style={{ top: ctx.y, left: ctx.x }}
          onMouseDown={e => e.stopPropagation()}
        >
          {ctx.profile.settings && (
            <button className="ctx-item" onClick={() => { applyProfile(ctx.profile); setCtx(null) }}>
              Apply Profile
            </button>
          )}
          <button className="ctx-item" onClick={() => { saveToSlot(ctx.profile); setCtx(null) }}>
            Save Current Settings Here
          </button>
          {ctx.profile.settings && (
            <button className="ctx-item" onClick={() => { copyCode(ctx.profile); setCtx(null) }}>
              Copy Share Code
            </button>
          )}
          <button className="ctx-item" onClick={() => {
            setRenamingId(ctx.profile.id)
            setRenameVal(ctx.profile.name)
            setCtx(null)
          }}>
            Rename
          </button>
          {ctx.profile.id !== 'default' && ctx.profile.settings && (
            <>
              <div className="ctx-sep" />
              <button className="ctx-item ctx-danger" onClick={() => { clearSlot(ctx.profile); setCtx(null) }}>
                Clear Slot
              </button>
            </>
          )}
        </div>
      )}

      {/* Import section */}
      <section className="section" style={{ marginTop: 28 }}>
        <div className="section-title">Import Profile</div>
        <div className="field">
          <p className="field-hint" style={{ marginBottom: 10 }}>
            Paste a share code from another user to load their settings into any slot.
          </p>
          <textarea
            className="import-area"
            value={importCode}
            onChange={e => { setImportCode(e.target.value); setImportError('') }}
            placeholder="Paste XC1:… share code here"
            rows={3}
          />
          {importError && <p className="import-err">{importError}</p>}
          <div className="import-row">
            <div className="import-slot-wrap">
              <span className="import-slot-label">Import into:</span>
              <select
                className="import-slot-select"
                value={importSlot}
                onChange={e => setImportSlot(e.target.value)}
              >
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.settings ? ' ●' : ''}
                  </option>
                ))}
              </select>
            </div>
            <button className="save-btn" onClick={handleImport} disabled={!importCode.trim()}>
              Import
            </button>
          </div>
        </div>
      </section>

      {toast && <div className="profile-toast">{toast}</div>}
    </div>
  )
}
