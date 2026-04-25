import { useState, useRef, useEffect } from 'react'
import { AppSettings, CurvePoint, CurveType, DEFAULT_CUSTOM_POINTS } from '../types'
import CurveGraph, { getCurveY } from '../components/CurveGraph'
import CustomCurveEditor from '../components/CustomCurveEditor'
import './Page.css'
import './Settings.css'

interface Props {
  settings: AppSettings
  updateSettings: (patch: Partial<AppSettings>) => void
}

const CURVES: { id: CurveType; label: string }[] = [
  { id: 'default', label: 'Default' },
  { id: 'linear',  label: 'Linear'  },
  { id: 'natural', label: 'Natural' },
  { id: 'power',   label: 'Power'   },
  { id: 'sigmoid', label: 'Sigmoid' },
  { id: 'bounce',  label: 'Bounce'  },
  { id: 'classic', label: 'Classic' },
  { id: 'jump',    label: 'Jump'    },
  { id: 'custom',  label: 'Custom'  },
]

const POLLING_RATES = [125, 250, 500, 1000, 2000, 4000, 8000]

function showStrength(c: CurveType) { return c !== 'default' && c !== 'power' && c !== 'custom' }
function showThresh(c: CurveType)   { return ['natural', 'sigmoid', 'classic', 'jump'].includes(c) }
function showExp(c: CurveType)      { return c === 'power' }
function needsAccelToggle(c: CurveType) { return c !== 'default' }

export default function Settings({ settings, updateSettings }: Props) {
  const [local, setLocal]         = useState<AppSettings>({ ...settings })
  const [saving, setSaving]       = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [isDirty, setIsDirty]     = useState(false)
  const [liveX, setLiveX]         = useState(0)
  const localRef    = useRef(local)
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const targetXRef  = useRef(0)

  useEffect(() => {
    let currentX = 0
    let lastSent = -1
    let animId: number

    const animate = () => {
      targetXRef.current *= 0.93
      currentX += (targetXRef.current - currentX) * 0.25
      const x = Math.max(0, Math.min(1, currentX))
      if (Math.abs(x - lastSent) > 0.0008) { lastSent = x; setLiveX(x) }
      animId = requestAnimationFrame(animate)
    }
    animId = requestAnimationFrame(animate)

    const onSpeed = (rawX: number) => {
      if (rawX > targetXRef.current) targetXRef.current = rawX
    }
    const hookUnsub = window.api?.onLiveSpeed?.(onSpeed)

    let prevT = 0
    const onMove = (e: PointerEvent) => {
      const now = performance.now()
      const dt = now - prevT; prevT = now
      const dx = e.movementX, dy = e.movementY
      if (Math.abs(dx) > 100 || Math.abs(dy) > 100) return
      if (dt <= 0 || dt >= 200) return
      const rawX = Math.min(1, Math.sqrt(dx * dx + dy * dy) / (dt * 5))
      if (rawX > targetXRef.current) targetXRef.current = rawX
    }
    window.addEventListener('pointermove', onMove)

    return () => {
      cancelAnimationFrame(animId)
      hookUnsub?.()
      window.removeEventListener('pointermove', onMove)
    }
  }, [])

  localRef.current = local

  const patch = (p: Partial<AppSettings>) => {
    const next = { ...localRef.current, ...p }
    localRef.current = next
    setLocal(next)
    setIsDirty(true)
  }

  const handleSave = async () => {
    const s = localRef.current
    setSaving('saving')
    try {
      await window.api.saveSettings(s as unknown as Record<string, unknown>)
      await window.api.applyMouse({
        yxRatio:                 s.yxRatioEnabled ? (s.yxRatio ?? 1) : 1,
        yxRatioEnabled:          s.yxRatioEnabled,
        curveType:               s.curveType,
        customCurvePoints:       s.customCurvePoints ?? DEFAULT_CUSTOM_POINTS,
        curveAcceleration:       s.curveAcceleration,
        accelerationEnabled:     s.accelerationEnabled,
        curveThreshold:          s.curveThreshold,
        curveExponent:           s.curveExponent,
        enhancePointerPrecision: s.enhancePointerPrecision,
        pollingRate:             s.pollingRate,
      })
      updateSettings(s)
      setIsDirty(false)
      setSaving('saved')
      if (statusTimer.current) clearTimeout(statusTimer.current)
      statusTimer.current = setTimeout(() => setSaving('idle'), 2000)
    } catch {
      setSaving('error')
      if (statusTimer.current) clearTimeout(statusTimer.current)
      statusTimer.current = setTimeout(() => setSaving('idle'), 2500)
    }
  }

  const graphSettings = {
    ...local,
    yxRatio: local.yxRatioEnabled ? (local.yxRatio ?? 1) : 1,
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-sub">Adjust curve and sensitivity — graph updates live</p>
      </div>

      {/* Curve type */}
      <section className="section">
        <div className="section-title">Curve Type</div>
        <div className="curve-picker">
          {CURVES.map(c => (
            <button
              key={c.id}
              className={`curve-btn ${local.curveType === c.id ? 'curve-btn-active' : ''} ${c.id === 'custom' ? 'curve-btn-custom' : ''}`}
              onClick={() => patch({ curveType: c.id })}
            >
              <CurveIcon type={c.id} customPts={local.customCurvePoints ?? DEFAULT_CUSTOM_POINTS} />
              {c.label}
            </button>
          ))}
        </div>
      </section>

      {/* Custom curve editor — shown only when Custom is selected */}
      {local.curveType === 'custom' && (
        <CustomCurveEditor
          points={local.customCurvePoints ?? DEFAULT_CUSTOM_POINTS}
          onChange={(pts: CurvePoint[]) => patch({ customCurvePoints: pts })}
        />
      )}

      {/* Live graph preview — hidden for custom (editor IS the graph) */}
      {local.curveType !== 'custom' && (
        <CurveGraph settings={graphSettings} height={200} liveX={liveX} />
      )}

      <p className="epp-warning">
        ⚠ Disable Windows Enhanced Pointer Precision for optimal experience
      </p>

      {/* Parameters */}
      <section className="section">
        <div className="section-title">Parameters</div>

        <SliderField
          label="Vertical / Horizontal Ratio"
          hint="Scales vertical movement relative to horizontal. 1.00 = equal axes. 0.75 = vertical 25% slower. Toggle off to disable."
          min={0.5} max={2.0} step={0.05}
          value={local.yxRatio ?? 1}
          enabled={local.yxRatioEnabled ?? true}
          onToggle={v => patch({ yxRatioEnabled: v })}
          onChange={v => patch({ yxRatio: v })}
        />

        {needsAccelToggle(local.curveType) && !showStrength(local.curveType) && local.curveType !== 'custom' && (
          <div className="field">
            <div className="field-header">
              <label className="field-label">Acceleration</label>
              <Toggle
                checked={local.accelerationEnabled}
                onChange={v => patch({ accelerationEnabled: v })}
              />
            </div>
            <div className="field-hint">Toggle off to disable the curve and use flat pointer movement.</div>
          </div>
        )}

        {local.curveType === 'custom' && (
          <div className="field">
            <div className="field-header">
              <label className="field-label">Custom Curve</label>
              <Toggle
                checked={local.accelerationEnabled}
                onChange={v => patch({ accelerationEnabled: v })}
              />
            </div>
            <div className="field-hint">Toggle off to bypass the custom curve and use flat movement.</div>
          </div>
        )}

        {showStrength(local.curveType) && (
          <SliderField
            label="Acceleration Strength"
            hint="How much the multiplier rises at high speed. 100% = standard, 200% = extreme. Toggle off to disable the curve entirely."
            min={0} max={200} step={1}
            value={local.curveAcceleration}
            enabled={local.accelerationEnabled}
            onToggle={v => patch({ accelerationEnabled: v })}
            onChange={v => patch({ curveAcceleration: v })}
            suffix="%"
          />
        )}

        {showThresh(local.curveType) && (
          <SliderField
            label={local.curveType === 'jump' ? 'Jump Threshold' : 'Speed Threshold'}
            hint={
              local.curveType === 'jump'
                ? 'Input speed at which sensitivity jumps. Shown as dashed line on graph.'
                : 'Speed at which acceleration kicks in. Shown as dashed line on graph.'
            }
            min={5} max={95} step={1}
            value={local.curveThreshold}
            onChange={v => patch({ curveThreshold: v })}
            suffix="%"
          />
        )}

        {showExp(local.curveType) && (
          <SliderField
            label="Curve Exponent"
            hint="Steepness of the power curve. Higher = more dramatic boost at fast movement."
            min={0.3} max={3.0} step={0.1}
            value={local.curveExponent}
            enabled={local.accelerationEnabled}
            onToggle={v => patch({ accelerationEnabled: v })}
            onChange={v => patch({ curveExponent: v })}
          />
        )}

        <div className="field">
          <div className="field-header">
            <label className="field-label">Enhance Pointer Precision (EPP)</label>
            <Toggle
              checked={local.enhancePointerPrecision}
              onChange={v => patch({ enhancePointerPrecision: v })}
            />
          </div>
          <div className="field-hint">
            Windows built-in EPP (MouseSpeed=2). Most competitive users keep this off.
            Has no effect when a custom curve is active.
          </div>
        </div>
      </section>

      {/* Polling rate */}
      <section className="section">
        <div className="section-title">Mouse Polling Rate</div>
        <div className="field">
          <div className="field-hint" style={{ marginBottom: 10 }}>
            Set to your mouse's actual polling rate. Calibrates when "full speed" is reached.
          </div>
          <div className="curve-picker">
            {POLLING_RATES.map(hz => (
              <button
                key={hz}
                className={`curve-btn ${local.pollingRate === hz ? 'curve-btn-active' : ''}`}
                onClick={() => patch({ pollingRate: hz })}
              >
                {hz >= 1000 ? `${hz / 1000}K` : hz}
              </button>
            ))}
          </div>
          <div className="field-hint" style={{ marginTop: 8 }}>
            Selected: <strong>{local.pollingRate} Hz</strong>
          </div>
        </div>
      </section>

      {/* Appearance */}
      <section className="section">
        <div className="section-title">Appearance</div>
        <div className="field">
          <div className="field-header">
            <label className="field-label">Theme</label>
          </div>
          <div className="theme-picker">
            {(['light', 'dark', 'high-contrast'] as const).map(t => (
              <button
                key={t}
                className={`theme-btn ${local.theme === t ? 'theme-btn-active' : ''}`}
                onClick={() => patch({ theme: t })}
              >
                <div className={`theme-swatch swatch-${t === 'high-contrast' ? 'hc' : t}`} />
                <span>{t === 'high-contrast' ? 'High Contrast' : t.charAt(0).toUpperCase() + t.slice(1)}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Save row */}
      <div className="save-row">
        <button
          className={`save-btn ${isDirty ? 'save-btn-dirty' : ''}`}
          onClick={handleSave}
          disabled={saving === 'saving'}
        >
          {saving === 'saving' && 'Saving…'}
          {saving === 'saved'  && '✓ Saved'}
          {saving === 'error'  && 'Error — try again'}
          {saving === 'idle'   && 'Save to Cursor'}
        </button>
        {isDirty && saving === 'idle' && (
          <span className="save-dirty-label">Unsaved changes</span>
        )}
        {saving === 'saved' && <span className="save-status ok">Settings applied</span>}
        {saving === 'error' && <span className="save-status err">Failed — try as Administrator</span>}
      </div>
    </div>
  )
}

// ── Reusable slider ───────────────────────────────────────────────────────────

interface SliderFieldProps {
  label: string; hint: string
  min: number; max: number; step: number; value: number
  onChange: (v: number) => void
  suffix?: string; enabled?: boolean; onToggle?: (v: boolean) => void
}

function SliderField({ label, hint, min, max, step, value, onChange, suffix = '', enabled = true, onToggle }: SliderFieldProps) {
  const pct     = ((value - min) / (max - min)) * 100
  const display = step < 1 ? value.toFixed(2) : String(value)

  return (
    <div className={`field ${!enabled ? 'field-disabled' : ''}`}>
      <div className="field-header">
        <label className="field-label">{label}</label>
        <div className="field-header-right">
          {onToggle && <Toggle checked={enabled} onChange={onToggle} />}
          <div className="field-value-badge" style={{ opacity: enabled ? 1 : 0.35 }}>{display}{suffix}</div>
        </div>
      </div>
      <div className="slider-wrap">
        <span className="slider-tick">{step < 1 ? min.toFixed(1) : min}</span>
        <div className="slider-track">
          <div className="slider-fill" style={{ width: `${pct}%`, opacity: enabled ? 1 : 0.3 }} />
          <input
            type="range" min={min} max={max} step={step} value={value}
            onChange={e => enabled && onChange(Number(e.target.value))}
            className="slider"
            style={{ opacity: enabled ? 1 : 0.35, cursor: enabled ? 'pointer' : 'not-allowed' }}
          />
        </div>
        <span className="slider-tick">{step < 1 ? max.toFixed(1) : max}</span>
      </div>
      <div className="field-hint">{hint}</div>
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch" aria-checked={checked}
      className={`toggle ${checked ? 'toggle-on' : 'toggle-off'}`}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-thumb" />
    </button>
  )
}

function CurveIcon({ type, customPts }: { type: CurveType; customPts?: CurvePoint[] }) {
  const W = 28, H = 15
  const yMin = 0.88, yRange = 1.28
  const d = Array.from({ length: 26 }, (_, i) => {
    const x = i / 25
    const y = getCurveY(type, x, 100, 50, 1.5, customPts)
    const px = (x * W).toFixed(1)
    const py = (H - Math.max(0, Math.min(1, (y - yMin) / yRange)) * H).toFixed(1)
    return `${i === 0 ? 'M' : 'L'}${px},${py}`
  }).join(' ')
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', flexShrink: 0 }}>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
