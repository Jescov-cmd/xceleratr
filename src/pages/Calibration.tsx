import { useEffect, useState } from 'react'
import './Page.css'
import './Calibration.css'

type Stage = 'intro' | 'measuring' | 'distance' | 'result'

function classifyDPI(cpi: number): { label: string; note: string } {
  if (cpi < 600)   return { label: 'Very low', note: 'Common for "low-sens" pros — needs lots of arm movement.' }
  if (cpi < 1200)  return { label: 'Low',      note: 'Classic FPS sensitivity. Plenty of room for thumb / wrist aiming.' }
  if (cpi < 2400)  return { label: 'Medium',   note: 'Most popular range — balanced, works for most games.' }
  if (cpi < 4800)  return { label: 'High',     note: 'Snappy. Good for tracking heroes, RTS, productivity.' }
  return            { label: 'Very high', note: 'Extreme sensitivity. Often combined with a software multiplier under 1.0×.' }
}

function recommendedThreshold(cpi: number): number {
  // Higher CPI → lower threshold (user reaches the same on-screen speed with less physical movement).
  // Values clamp to the slider range 5–95.
  if (cpi < 800)   return 70
  if (cpi < 1600)  return 55
  if (cpi < 2400)  return 45
  if (cpi < 4000)  return 35
  return 25
}

// Need a sensible minimum or the user can produce CPI=0 by typing inches before
// moving. 50px is small enough not to gatekeep legitimately tiny test strokes.
const MIN_MEASURE_PIXELS = 50

export default function Calibration() {
  const [stage, setStage] = useState<Stage>('intro')
  const [pixels, setPixels] = useState(0)
  const [inches, setInches] = useState('')
  const [cpi, setCpi]       = useState<number | null>(null)

  // Accumulate cursor pixel travel only while in 'measuring' stage.
  // Note: pointermove only fires while the cursor is over the Xceleratr window;
  // we tell the user to drag inside the window for that reason.
  useEffect(() => {
    if (stage !== 'measuring') return
    const onMove = (e: PointerEvent) => {
      const dx = e.movementX, dy = e.movementY
      // Discard absurd jumps (window switch, RDP reconnect, etc.)
      if (Math.abs(dx) > 200 || Math.abs(dy) > 200) return
      setPixels(p => p + Math.sqrt(dx * dx + dy * dy))
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [stage])

  const start = () => {
    setPixels(0); setInches(''); setCpi(null)
    setStage('measuring')
  }

  const stop = () => {
    if (pixels < MIN_MEASURE_PIXELS) return
    setStage('distance')
  }

  const compute = () => {
    const n = parseFloat(inches)
    if (isNaN(n) || n <= 0) return
    setCpi(Math.round(pixels / n))
    setStage('result')
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">DPI Calibration</h1>
        <p className="page-sub">Measure your mouse's real-world counts-per-inch</p>
      </div>

      {stage === 'intro' && (
        <section className="cal-card">
          <h2 className="cal-step">Before you start</h2>
          <ol className="cal-list">
            <li>Open Settings and set <strong>Curve Type</strong> to <em>Default</em> and turn <strong>EPP off</strong>. The test must run with no acceleration so the math is honest.</li>
            <li>Find a hard surface and a ruler. You'll be moving your mouse a measured distance.</li>
            <li>Move with the cursor <strong>inside this Xceleratr window</strong> — the measurement only counts pixels traveled over this window.</li>
          </ol>
          <button className="cal-btn cal-btn-primary" onClick={start}>I'm ready — start measuring</button>
        </section>
      )}

      {stage === 'measuring' && (
        <section className="cal-card cal-active">
          <h2 className="cal-step">Move your mouse a known distance</h2>
          <p className="cal-hint">
            Move your mouse <strong>any distance you can measure</strong> on your desk —
            4 inches and 10 cm both work. Drag with the cursor over this window;
            steady stroke, no lift mid-way.
          </p>
          <div className="cal-pixels">
            <span className="cal-pixels-label">Cursor travel</span>
            <span className="cal-pixels-value">{Math.round(pixels)} px</span>
          </div>
          <div className="cal-actions">
            <button className="cal-btn" onClick={() => setStage('intro')}>Cancel</button>
            <button
              className="cal-btn cal-btn-primary"
              onClick={stop}
              disabled={pixels < MIN_MEASURE_PIXELS}
              title={pixels < MIN_MEASURE_PIXELS ? `Move at least ${MIN_MEASURE_PIXELS}px first` : ''}
            >
              Stop &amp; continue
            </button>
          </div>
        </section>
      )}

      {stage === 'distance' && (
        <section className="cal-card">
          <h2 className="cal-step">How far did you actually move?</h2>
          <p className="cal-hint">
            Enter the physical distance you covered, in inches.
            (1 inch = 2.54 cm. 4 cm = 1.575 in. 10 cm = 3.937 in.)
          </p>
          <div className="cal-input-row">
            <input
              type="number"
              step="0.1"
              min="0.1"
              autoFocus
              value={inches}
              onChange={e => setInches(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') compute() }}
              placeholder="e.g. 4"
              className="cal-input"
            />
            <span className="cal-input-suffix">inches</span>
          </div>
          <div className="cal-actions">
            <button className="cal-btn" onClick={() => setStage('measuring')}>Back</button>
            <button className="cal-btn cal-btn-primary" onClick={compute} disabled={!inches}>
              Calculate
            </button>
          </div>
        </section>
      )}

      {stage === 'result' && cpi !== null && (() => {
        const cls = classifyDPI(cpi)
        const thr = recommendedThreshold(cpi)
        return (
          <section className="cal-card">
            <h2 className="cal-step">Result</h2>
            <div className="cal-result">
              <div className="cal-result-cpi">{cpi.toLocaleString()}</div>
              <div className="cal-result-unit">CPI / DPI</div>
            </div>
            <div className="cal-class">
              <span className={`cal-tag cal-tag-${cls.label.toLowerCase().replace(/\s+/g, '-')}`}>{cls.label}</span>
              <span className="cal-class-note">{cls.note}</span>
            </div>
            <div className="cal-rec">
              <strong>Suggested curve threshold:</strong> ~{thr}%.
              At your CPI, this is roughly where most users feel the curve "kicks in" without it triggering on small precision movements.
            </div>
            <div className="cal-actions">
              <button className="cal-btn" onClick={() => setStage('intro')}>Run again</button>
            </div>
          </section>
        )
      })()}
    </div>
  )
}
