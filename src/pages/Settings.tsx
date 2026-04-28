import { useState, useRef, useEffect } from 'react'
import { AppSettings, CurvePoint, CurveType, DEFAULT_CUSTOM_POINTS } from '../types'
import CurveGraph, { getCurveY } from '../components/CurveGraph'
import CustomCurveEditor from '../components/CustomCurveEditor'
import Tooltip from '../components/Tooltip'
import './Page.css'
import './Settings.css'

interface Props {
  settings: AppSettings
  updateSettings: (patch: Partial<AppSettings>) => void
}

const CURVES: { id: CurveType; label: string; sub: string }[] = [
  { id: 'default', label: 'Default', sub: 'Off — flat'    },
  { id: 'linear',  label: 'Linear',  sub: 'Steady'        },
  { id: 'natural', label: 'Natural', sub: 'Smooth ramp'   },
  { id: 'power',   label: 'Power',   sub: 'Snappy fast'   },
  { id: 'sigmoid', label: 'Sigmoid', sub: 'S-curve'       },
  { id: 'bounce',  label: 'Bounce',  sub: 'Playful'       },
  { id: 'classic', label: 'Classic', sub: 'Stepped'       },
  { id: 'jump',    label: 'Jump',    sub: 'Hard step'     },
  { id: 'custom',  label: 'Custom',  sub: 'Draw your own' },
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
  const [editingAxis, setEditingAxis] = useState<'x' | 'y'>('x')
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

  // When per-axis is on, axis-scoped fields route through the editing axis.
  // When off, they always write to the X (single-curve) fields — legacy behavior.
  const isYAxis = local.perAxisEnabled && editingAxis === 'y'

  // Active-axis read helpers
  const activeCurveType         = isYAxis ? local.curveTypeY         : local.curveType
  const activeCustomPoints      = isYAxis ? local.customCurvePointsY : local.customCurvePoints
  const activeAcceleration      = isYAxis ? local.curveAccelerationY : local.curveAcceleration
  const activeThreshold         = isYAxis ? local.curveThresholdY    : local.curveThreshold
  const activeExponent          = isYAxis ? local.curveExponentY     : local.curveExponent

  // Active-axis write helpers
  const patchActiveCurveType = (v: CurveType) =>
    patch(isYAxis ? { curveTypeY: v } : { curveType: v })
  const patchActiveCustomPoints = (v: CurvePoint[]) =>
    patch(isYAxis ? { customCurvePointsY: v } : { customCurvePoints: v })
  const patchActiveAcceleration = (v: number) =>
    patch(isYAxis ? { curveAccelerationY: v } : { curveAcceleration: v })
  const patchActiveThreshold = (v: number) =>
    patch(isYAxis ? { curveThresholdY: v } : { curveThreshold: v })
  const patchActiveExponent = (v: number) =>
    patch(isYAxis ? { curveExponentY: v } : { curveExponent: v })

  const handleSave = async () => {
    const s = localRef.current
    setSaving('saving')
    try {
      // Save only the curve-related fields this page is responsible for.
      // Other pages (Preferences, Hotkeys, Profile menu) save their own
      // concerns — sending the full local state would clobber any changes
      // the user made elsewhere since this page was opened (e.g. theme).
      const curvePatch = {
        yxRatio:                 s.yxRatio,
        yxRatioEnabled:          s.yxRatioEnabled,
        curveType:               s.curveType,
        customCurvePoints:       s.customCurvePoints ?? DEFAULT_CUSTOM_POINTS,
        curveAcceleration:       s.curveAcceleration,
        accelerationEnabled:     s.accelerationEnabled,
        curveThreshold:          s.curveThreshold,
        curveExponent:           s.curveExponent,
        perAxisEnabled:          s.perAxisEnabled ?? false,
        curveTypeY:              s.curveTypeY ?? 'default',
        customCurvePointsY:      s.customCurvePointsY ?? DEFAULT_CUSTOM_POINTS,
        curveAccelerationY:      s.curveAccelerationY ?? 100,
        curveThresholdY:         s.curveThresholdY    ?? 50,
        curveExponentY:          s.curveExponentY     ?? 1.5,
        curveSmoothing:          s.curveSmoothing     ?? 0,
        enhancePointerPrecision: s.enhancePointerPrecision,
        pollingRate:             s.pollingRate,
      }
      await window.api.saveSettings(curvePatch as Record<string, unknown>)
      await window.api.applyMouse({
        ...curvePatch,
        yxRatio: s.yxRatioEnabled ? (s.yxRatio ?? 1) : 1,
      })
      updateSettings(curvePatch)
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
    // When showing the active axis on the graph, the graph reads `curveType` etc.
    // Substitute Y fields when editing Y so the live preview reflects the user's edits.
    curveType:         activeCurveType,
    customCurvePoints: activeCustomPoints,
    curveAcceleration: activeAcceleration,
    curveThreshold:    activeThreshold,
    curveExponent:     activeExponent,
    yxRatio:           local.yxRatioEnabled ? (local.yxRatio ?? 1) : 1,
  }

  // Inactive-axis curve, only used when perAxisEnabled — drawn in gray on the graph
  const inactiveCurve = local.perAxisEnabled ? {
    curveType:         isYAxis ? local.curveType         : local.curveTypeY,
    customCurvePoints: isYAxis ? local.customCurvePoints : local.customCurvePointsY,
    curveAcceleration: isYAxis ? local.curveAcceleration : local.curveAccelerationY,
    curveThreshold:    isYAxis ? local.curveThreshold    : local.curveThresholdY,
    curveExponent:     isYAxis ? local.curveExponent     : local.curveExponentY,
  } : null

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Curves</h1>
        <p className="page-sub">Shape how your mouse accelerates — graph updates live</p>
      </div>

      {/* Per-axis curves master toggle + X/Y switcher */}
      <section className="section">
        <div className="field">
          <div className="field-header">
            <label className="field-label">Per-axis curves</label>
            <Toggle
              checked={local.perAxisEnabled}
              onChange={v => patch({ perAxisEnabled: v })}
            />
          </div>
          <div className="field-hint">
            Shape horizontal and vertical movement with separate curves. When off,
            both axes share one curve and the V/H Ratio scales the vertical output.
          </div>
        </div>

        {local.perAxisEnabled && (
          <div className="axis-tabs">
            <button
              className={`axis-tab ${editingAxis === 'x' ? 'axis-tab-active' : ''}`}
              onClick={() => setEditingAxis('x')}
            >
              X axis (horizontal)
            </button>
            <button
              className={`axis-tab ${editingAxis === 'y' ? 'axis-tab-active' : ''}`}
              onClick={() => setEditingAxis('y')}
            >
              Y axis (vertical)
            </button>
          </div>
        )}
      </section>

      {/* Curve type — applies to active axis when per-axis is on */}
      <section className="section">
        <div className="section-title">
          Curve Type
          {local.perAxisEnabled && <span className="axis-tag"> · {editingAxis.toUpperCase()} axis</span>}
        </div>
        <div className="curve-picker">
          {CURVES.map(c => (
            <button
              key={c.id}
              className={`curve-btn ${activeCurveType === c.id ? 'curve-btn-active' : ''} ${c.id === 'custom' ? 'curve-btn-custom' : ''}`}
              onClick={() => patchActiveCurveType(c.id)}
            >
              <CurveIcon type={c.id} customPts={activeCustomPoints ?? DEFAULT_CUSTOM_POINTS} />
              <span className="curve-btn-label">{c.label}</span>
              <span className="curve-btn-sub">{c.sub}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Custom curve editor — shown only when Custom is selected on the active axis */}
      {activeCurveType === 'custom' && (
        <CustomCurveEditor
          points={activeCustomPoints ?? DEFAULT_CUSTOM_POINTS}
          onChange={(pts: CurvePoint[]) => patchActiveCustomPoints(pts)}
        />
      )}

      {/* Live graph preview — hidden for custom (editor IS the graph) */}
      {activeCurveType !== 'custom' && (
        <CurveGraph
          settings={graphSettings}
          height={200}
          liveX={liveX}
          inactiveCurve={inactiveCurve}
          activeAxis={local.perAxisEnabled ? editingAxis : undefined}
        />
      )}

      <p className="epp-warning">
        ⚠ Disable Windows Enhanced Pointer Precision for optimal experience
      </p>

      {/* Parameters */}
      <section className="section">
        <div className="section-title">
          Parameters
          {local.perAxisEnabled && <span className="axis-tag"> · {editingAxis.toUpperCase()} axis</span>}
        </div>

        {/* V/H Ratio is hidden when per-axis is on — independent curves replace it */}
        {!local.perAxisEnabled && (
          <SliderField
            label="Vertical / Horizontal Ratio"
            hint="Scales vertical movement relative to horizontal. 1.00 = equal axes. 0.75 = vertical 25% slower. Toggle off to disable."
            min={0.5} max={2.0} step={0.05}
            value={local.yxRatio ?? 1}
            enabled={local.yxRatioEnabled ?? true}
            onToggle={v => patch({ yxRatioEnabled: v })}
            onChange={v => patch({ yxRatio: v })}
          />
        )}

        {needsAccelToggle(activeCurveType) && !showStrength(activeCurveType) && activeCurveType !== 'custom' && (
          <div className="field">
            <div className="field-header">
              <label className="field-label">Acceleration</label>
              <Toggle
                checked={local.accelerationEnabled}
                onChange={v => patch({ accelerationEnabled: v })}
              />
            </div>
            <div className="field-hint">Master switch — turns the curve(s) off entirely and uses flat pointer movement.</div>
          </div>
        )}

        {activeCurveType === 'custom' && (
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

        {showStrength(activeCurveType) && (
          <SliderField
            label="Acceleration Strength"
            hint="How much the multiplier rises at high speed. 100% = standard, 200% = extreme. Toggle off to disable the curve entirely."
            min={0} max={200} step={1}
            value={activeAcceleration}
            enabled={local.accelerationEnabled}
            onToggle={v => patch({ accelerationEnabled: v })}
            onChange={v => patchActiveAcceleration(v)}
            suffix="%"
          />
        )}

        {showThresh(activeCurveType) && (
          <SliderField
            label={activeCurveType === 'jump' ? 'Jump Threshold' : 'Speed Threshold'}
            tooltip={
              activeCurveType === 'jump'
                ? 'How fast you have to move before the multiplier jumps to its high value. Below this speed, no acceleration. Above it, full acceleration.'
                : 'How quickly acceleration ramps up. Lower values mean even slow movements get accelerated; higher values mean only fast flicks get the boost.'
            }
            hint={
              activeCurveType === 'jump'
                ? 'Input speed at which sensitivity jumps. Shown as dashed line on graph.'
                : 'Speed at which acceleration kicks in. Shown as dashed line on graph.'
            }
            min={5} max={95} step={1}
            value={activeThreshold}
            onChange={v => patchActiveThreshold(v)}
            suffix="%"
          />
        )}

        {showExp(activeCurveType) && (
          <SliderField
            label="Curve Exponent"
            tooltip="Mathematical steepness of the curve. 1.0 = straight diagonal, 2.0 = quadratic (slow start, very fast end), 0.5 = the opposite (fast start, slow end at high speeds)."
            hint="Steepness of the power curve. Higher = more dramatic boost at fast movement."
            min={0.3} max={3.0} step={0.1}
            value={activeExponent}
            enabled={local.accelerationEnabled}
            onToggle={v => patch({ accelerationEnabled: v })}
            onChange={v => patchActiveExponent(v)}
          />
        )}

        <SliderField
          label="Curve Smoothing"
          tooltip="Softens transitions in the multiplier so step-like curves (Classic, Jump) don't feel abrupt. 0 = no smoothing (instant). Higher values average across recent movement, trading response speed for smoother feel."
          hint="Smooths the curve's effect over time. 0 = off. Useful for Classic / Jump curves to make the steps feel less sudden."
          min={0} max={100} step={1}
          value={local.curveSmoothing ?? 0}
          onChange={v => patch({ curveSmoothing: v })}
          suffix="%"
        />

        <div className="field">
          <div className="field-header">
            <label className="field-label">
              Enhance Pointer Precision (EPP)
              <Tooltip text="Windows' built-in mouse acceleration. It's the system-level acceleration most pros disable. Xceleratr's curves replace it — keep this off unless you specifically want Windows acceleration on top." />
            </label>
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
  tooltip?: string
}

function SliderField({ label, hint, min, max, step, value, onChange, suffix = '', enabled = true, onToggle, tooltip }: SliderFieldProps) {
  const pct     = ((value - min) / (max - min)) * 100
  const display = step < 1 ? value.toFixed(2) : String(value)

  return (
    <div className={`field ${!enabled ? 'field-disabled' : ''}`}>
      <div className="field-header">
        <label className="field-label">
          {label}
          {tooltip && <Tooltip text={tooltip} />}
        </label>
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
