import { useState, useEffect, useRef } from 'react'
import { AppSettings, CurvePoint, CurveType, DEFAULT_CUSTOM_POINTS, MouseProfile, MouseSettings } from '../types'
import { GAME_PRESETS } from '../data/gamePresets'
import GlassIcon from '../components/GlassIcon'
import './Page.css'
import './Profiles.css'

// Validation helpers for decodeProfile — share codes come from arbitrary users
// so anything could be in there. Without these, malformed inputs become NaN
// multipliers downstream, which freezes the cursor.
const VALID_CURVE_TYPES: readonly CurveType[] =
  ['default', 'linear', 'natural', 'power', 'sigmoid', 'bounce', 'classic', 'jump', 'custom']

function clampNum(v: unknown, min: number, max: number, fallback: number): number {
  const n = Number(v)
  if (!isFinite(n)) return fallback
  return Math.max(min, Math.min(max, n))
}
function asCurveType(v: unknown): CurveType {
  return (VALID_CURVE_TYPES as readonly string[]).includes(v as string) ? (v as CurveType) : 'default'
}
function asPoints(v: unknown): CurvePoint[] {
  if (!Array.isArray(v)) return DEFAULT_CUSTOM_POINTS
  const cleaned = v
    .filter(p => p && typeof p === 'object' && isFinite(Number((p as any).x)) && isFinite(Number((p as any).y)))
    .map(p => ({
      x: clampNum((p as any).x, 0, 1, 0),
      y: clampNum((p as any).y, 0.1, 6, 1),
    }))
  return cleaned.length >= 2 ? cleaned : DEFAULT_CUSTOM_POINTS
}

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
    yxRatio: s.yxRatio ?? 1, yxRatioEnabled: s.yxRatioEnabled ?? true,
    curveType: s.curveType,
    customCurvePoints: s.customCurvePoints ?? DEFAULT_CUSTOM_POINTS,
    curveAcceleration: s.curveAcceleration, accelerationEnabled: s.accelerationEnabled,
    curveThreshold: s.curveThreshold, curveExponent: s.curveExponent,
    perAxisEnabled: s.perAxisEnabled ?? false,
    curveTypeY: s.curveTypeY ?? 'default',
    customCurvePointsY: s.customCurvePointsY ?? DEFAULT_CUSTOM_POINTS,
    curveAccelerationY: s.curveAccelerationY ?? 100,
    curveThresholdY:    s.curveThresholdY    ?? 50,
    curveExponentY:     s.curveExponentY     ?? 1.5,
    curveSmoothing:     s.curveSmoothing     ?? 0,
    enhancePointerPrecision: s.enhancePointerPrecision, pollingRate: s.pollingRate,
  }
}

function encodeProfile(name: string, s: MouseSettings, sharedBy?: string): string {
  // sharedBy travels with the share code so the recipient knows who made it.
  // Optional — older codes pre-1.3.x don't include it; decoder treats it as
  // "Unknown".
  const payload: Record<string, unknown> = { v: 1, name, ...s }
  if (sharedBy && sharedBy.trim().length > 0) payload.sharedBy = sharedBy.trim().slice(0, 60)
  return 'XC1:' + btoa(JSON.stringify(payload))
}

function decodeProfile(code: string): { name: string; sharedBy?: string; settings: MouseSettings } | null {
  try {
    const b64 = code.trim().startsWith('XC1:') ? code.trim().slice(4) : code.trim()
    const p = JSON.parse(atob(b64))
    if (!p.v) return null
    // Strict per-field validation. Untrusted input — string "abc" sneaking into
    // a numeric field used to silently propagate as NaN through the multiplier
    // and freeze the cursor when the profile was applied.
    const name = typeof p.name === 'string' && p.name.length <= 60
      ? p.name : 'Imported'
    const sharedBy = typeof p.sharedBy === 'string' && p.sharedBy.trim().length > 0
      ? p.sharedBy.trim().slice(0, 60)
      : undefined
    return {
      name,
      sharedBy,
      settings: {
        yxRatio:                 clampNum(p.yxRatio, 0.1, 5, 1),
        yxRatioEnabled:          p.yxRatioEnabled !== false,
        curveType:               asCurveType(p.curveType),
        customCurvePoints:       asPoints(p.customCurvePoints),
        curveAcceleration:       clampNum(p.curveAcceleration, 0, 500, 100),
        accelerationEnabled:     p.accelerationEnabled !== false,
        curveThreshold:          clampNum(p.curveThreshold, 0, 100, 50),
        curveExponent:           clampNum(p.curveExponent, 0.1, 5, 1.5),
        // Per-axis defaults applied when older XC1: codes are missing them
        perAxisEnabled:          !!p.perAxisEnabled,
        curveTypeY:              asCurveType(p.curveTypeY),
        customCurvePointsY:      asPoints(p.customCurvePointsY),
        curveAccelerationY:      clampNum(p.curveAccelerationY, 0, 500, 100),
        curveThresholdY:         clampNum(p.curveThresholdY, 0, 100, 50),
        curveExponentY:          clampNum(p.curveExponentY, 0.1, 5, 1.5),
        curveSmoothing:          clampNum(p.curveSmoothing, 0, 100, 0),
        enhancePointerPrecision: !!p.enhancePointerPrecision,
        pollingRate:             clampNum(p.pollingRate, 100, 8000, 1000),
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

  async function applyPreset(presetId: string) {
    const preset = GAME_PRESETS.find(p => p.id === presetId)
    if (!preset) return
    try {
      await window.api.saveSettings(preset.settings as unknown as Record<string, unknown>)
      await window.api.applyMouse(preset.settings)
      updateSettings(preset.settings)
      setActiveProfileId(`preset:${preset.id}`)
      showToast(`Applied preset: ${preset.name}`)
    } catch { showToast('Failed to apply preset') }
  }

  async function persistProfile(updated: MouseProfile) {
    await window.api.profilesSave(updated)
    setProfiles(prev => prev.map(p => p.id === updated.id ? updated : p))
    try { await window.api?.refreshTray?.() } catch { /* no-op */ }
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
    // Stamp the current user's name into the code so the recipient sees who
    // shared it. Empty userName → encoded as anonymous (decoder shows "Unknown").
    navigator.clipboard.writeText(encodeProfile(profile.name, profile.settings, settings.userName))
      .then(() => showToast('Share code copied'))
  }

  // Decode the pasted code on every keystroke so we can preview who shared it
  // before the user commits to the import. Falls back to null on invalid input.
  const importPreview = importCode.trim() ? decodeProfile(importCode) : null

  async function handleImport() {
    setImportError('')
    const result = decodeProfile(importCode)
    if (!result) { setImportError('Invalid share code — paste a code starting with XC1:'); return }
    const target = profiles.find(p => p.id === importSlot)
    if (!target) return
    try {
      await persistProfile({ ...target, name: result.name, settings: result.settings, savedAt: new Date().toISOString() })
      setImportCode('')
      const fromLabel = result.sharedBy ? ` (from ${result.sharedBy})` : ''
      showToast(`Imported "${result.name}"${fromLabel} → ${target.name}`)
    } catch {
      setImportError('Import failed — try again')
    }
  }

  function summaryLine(s: MouseSettings) {
    const parts = [`${s.curveType.charAt(0).toUpperCase()}${s.curveType.slice(1)}`]
    if (Math.abs((s.yxRatio ?? 1) - 1) > 0.02) parts.push(`V/H ${(s.yxRatio ?? 1).toFixed(2)}`)
    parts.push(`${s.pollingRate}Hz`)
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

      <section className="section" style={{ marginBottom: 28 }}>
        <div className="section-title">Built-in Presets</div>
        <p className="field-hint" style={{ marginBottom: 10 }}>
          Starting points tuned for different play styles. Click to apply — save to a slot below if you want to keep it.
        </p>
        <div className="preset-grid">
          {GAME_PRESETS.map(p => (
            <button
              key={p.id}
              className={`preset-card ${activeProfileId === `preset:${p.id}` ? 'preset-card-active' : ''}`}
              onClick={() => applyPreset(p.id)}
            >
              <div className="preset-name">{p.name}</div>
              <div className="preset-blurb">{p.blurb}</div>
            </button>
          ))}
        </div>
      </section>

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
              <button
                className="profile-save-btn"
                onClick={e => { e.stopPropagation(); saveToSlot(profile) }}
                title={profile.settings ? 'Overwrite with current settings' : 'Save current settings here'}
                aria-label="Save current settings to this slot"
              >
                <GlassIcon name="save" size={13} />
              </button>
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
          {importPreview && !importError && (
            <p className="import-preview">
              <strong>{importPreview.name}</strong>
              {importPreview.sharedBy
                ? <> · shared by <strong>{importPreview.sharedBy}</strong></>
                : <> · sharer unknown</>}
            </p>
          )}
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
