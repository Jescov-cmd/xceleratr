import { useMemo } from 'react'
import { AppSettings, CurvePoint, CurveType } from '../types'
import './CurveGraph.css'

interface Props {
  settings: Pick<AppSettings, 'sensitivity' | 'yxRatio' | 'curveType' | 'customCurvePoints' | 'curveAcceleration' | 'curveThreshold' | 'curveExponent'>
  height?: number
}

// ── Monotone cubic spline (Fritsch-Carlson) ───────────────────────────────────
export function monoSpline(pts: CurvePoint[], x: number): number {
  const n = pts.length
  if (n === 0) return 1
  if (n === 1) return pts[0].y
  if (x <= pts[0].x) return pts[0].y
  if (x >= pts[n - 1].x) return pts[n - 1].y
  let k = 0
  while (k < n - 2 && x > pts[k + 1].x) k++
  const x0 = pts[k].x, y0 = pts[k].y, x1 = pts[k + 1].x, y1 = pts[k + 1].y
  const h = x1 - x0
  if (h < 1e-10) return y0
  const d = (y1 - y0) / h
  let m0 = k === 0 ? d : 0.5 * ((pts[k].y - pts[k-1].y) / (pts[k].x - pts[k-1].x) + d)
  let m1 = k === n - 2 ? d : 0.5 * (d + (pts[k+2].y - pts[k+1].y) / (pts[k+2].x - pts[k+1].x))
  if (Math.abs(d) < 1e-10) { m0 = m1 = 0 } else {
    const a = m0 / d, b = m1 / d, tau = a * a + b * b
    if (tau > 9) { const s = 3 / Math.sqrt(tau); m0 = s * a * d; m1 = s * b * d }
  }
  const t = (x - x0) / h, t2 = t * t, t3 = t2 * t
  return (2*t3 - 3*t2 + 1)*y0 + (t3 - 2*t2 + t)*h*m0 + (-2*t3 + 3*t2)*y1 + (t3 - t2)*h*m1
}

// x = 0..1 (input speed), returns output multiplier
export function getCurveY(type: CurveType, x: number, accel: number, thresh: number, exp: number, customPts?: CurvePoint[]): number {
  const a = accel / 100
  const t = Math.max(0.05, thresh / 100)

  switch (type) {
    case 'custom':
      return customPts && customPts.length >= 2 ? monoSpline(customPts, x) : 1

    case 'default':
      // Flat horizontal line — no acceleration whatsoever
      return 1

    case 'linear':
      // True straight diagonal — sensitivity increases linearly with speed
      return 1 + a * x

    case 'natural': {
      // Smooth exponential rise — starts at 1, asymptotes toward 1+a
      const k = 5 / t
      return 1 + a * (1 - Math.exp(-k * x))
    }

    case 'power': {
      // Steep power curve — low speed barely changes, high speed amplified
      const e = Math.max(0.3, exp)
      return 1 + a * Math.pow(x, e)
    }

    case 'sigmoid': {
      // S-curve — slow acceleration → fast middle → plateau
      const k = 10 + a * 10
      const s = (v: number) => 1 / (1 + Math.exp(-k * (v - t)))
      const s0 = s(0), s1 = s(1)
      return 1 + a * (s(x) - s0) / (Math.abs(s1 - s0) + 0.001)
    }

    case 'bounce': {
      // Damped oscillation — slight undershoot then settles at 1+a
      return 1 + a * (1 - Math.exp(-4 * x) * Math.cos(1.5 * Math.PI * x))
    }

    case 'classic': {
      // Windows-style stepped acceleration at two thresholds
      if (x < t * 0.5) return 1
      if (x < t)       return 1 + a * 0.5
      return 1 + a
    }

    case 'jump':
      // Hard step — flat then instant jump at threshold
      return x < t ? 1 : 1 + a

    default:
      return 1
  }
}

export const CURVE_LABELS: Record<CurveType, string> = {
  default:  'Default — flat, no acceleration',
  linear:   'Linear — straight diagonal acceleration',
  natural:  'Natural — smooth exponential rise',
  power:    'Power — steep gain at high speed',
  sigmoid:  'Sigmoid — S-curve soft acceleration',
  bounce:   'Bounce — oscillating damped curve',
  classic:  'Classic — stepped Windows acceleration',
  jump:     'Jump — hard step at threshold',
  custom:   'Custom — user-defined curve',
}

export default function CurveGraph({ settings, height = 200 }: Props) {
  const { curveType, customCurvePoints, curveAcceleration, curveThreshold, curveExponent, sensitivity, yxRatio } = settings
  const ratio = yxRatio ?? 1
  const showRatio = Math.abs(ratio - 1) > 0.02

  const W = 420
  const H = height
  const PAD = { top: 16, right: 20, bottom: 38, left: 50 }
  const gw = W - PAD.left - PAD.right
  const gh = H - PAD.top - PAD.bottom

  const points = useMemo(() => (
    Array.from({ length: 150 }, (_, i) => {
      const x = i / 149
      return { x, y: getCurveY(curveType, x, curveAcceleration, curveThreshold, curveExponent, customCurvePoints) }
    })
  ), [curveType, customCurvePoints, curveAcceleration, curveThreshold, curveExponent])

  const vPoints = useMemo(() => (
    showRatio ? points.map(p => ({ x: p.x, y: p.y * ratio })) : null
  ), [points, ratio, showRatio])

  const maxY = Math.max(
    ...points.map(p => p.y),
    ...(vPoints?.map(p => p.y) ?? []),
    1.1,
  ) * 1.08

  const sx = (x: number) => PAD.left + x * gw
  const sy = (y: number) => PAD.top + gh - (Math.min(y, maxY) / maxY) * gh

  const pathD = points.map((p, i) =>
    `${i === 0 ? 'M' : 'L'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`
  ).join(' ')
  const fillD = `${pathD} L${sx(1).toFixed(1)},${sy(0).toFixed(1)} L${sx(0).toFixed(1)},${sy(0).toFixed(1)} Z`

  const vPathD = vPoints ? vPoints.map((p, i) =>
    `${i === 0 ? 'M' : 'L'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`
  ).join(' ') : null

  const gridXVals = [0.25, 0.5, 0.75, 1]
  const gridYPcts = [0.25, 0.5, 0.75, 1]

  const showThresh = ['natural', 'sigmoid', 'classic', 'jump'].includes(curveType)

  // Legend right-edge x positions
  const lgX = PAD.left + gw - 4

  return (
    <div className="cg-wrap">
      <div className="cg-label-row">
        <span className="cg-title">{CURVE_LABELS[curveType]}</span>
        <span className="cg-sens-badge">Sens: {sensitivity}/20</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="cg-svg">
        {/* Grid verticals */}
        {gridXVals.map(v => (
          <line key={`gx${v}`} x1={sx(v)} y1={PAD.top} x2={sx(v)} y2={PAD.top + gh} className="cg-grid" />
        ))}
        {/* Grid horizontals */}
        {gridYPcts.map(v => (
          <line key={`gy${v}`} x1={PAD.left} y1={sy(v * maxY)} x2={PAD.left + gw} y2={sy(v * maxY)} className="cg-grid" />
        ))}

        {/* Axes */}
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + gh} className="cg-axis" />
        <line x1={PAD.left} y1={PAD.top + gh} x2={PAD.left + gw} y2={PAD.top + gh} className="cg-axis" />

        {/* Threshold dashed line */}
        {showThresh && (
          <line x1={sx(curveThreshold / 100)} y1={PAD.top} x2={sx(curveThreshold / 100)} y2={PAD.top + gh}
            className="cg-threshold" strokeDasharray="4 3" />
        )}

        {/* Vertical (V) fill + line — drawn under H so H is on top */}
        {vPathD && (
          <>
            <path d={`${vPathD} L${sx(1).toFixed(1)},${sy(0).toFixed(1)} L${sx(0).toFixed(1)},${sy(0).toFixed(1)} Z`} className="cg-fill-v" />
            <path d={vPathD} className="cg-line-v" strokeDasharray="6 3" />
          </>
        )}

        {/* Horizontal (H) fill + line */}
        <path d={fillD} className="cg-fill" />
        <path d={pathD} className="cg-line" />

        {/* Y-axis tick labels */}
        {gridYPcts.map(v => (
          <text key={`yl${v}`} x={PAD.left - 6} y={sy(v * maxY) + 4} className="cg-tick" textAnchor="end">
            {(v * maxY).toFixed(1)}x
          </text>
        ))}

        {/* X-axis tick labels */}
        {(['Low', 'Mid', 'High'] as const).map((label, i) => (
          <text key={label} x={sx((i + 1) / 4)} y={PAD.top + gh + 14} className="cg-tick" textAnchor="middle">
            {label}
          </text>
        ))}

        {/* Axis titles */}
        <text x={PAD.left + gw / 2} y={H - 4} className="cg-axis-title" textAnchor="middle">Input Speed</text>
        <text x={11} y={PAD.top + gh / 2} className="cg-axis-title" textAnchor="middle"
          transform={`rotate(-90, 11, ${PAD.top + gh / 2})`}>Output</text>

        {/* V/H ratio legend */}
        {showRatio && (
          <g>
            <line x1={lgX - 62} y1={PAD.top + 7} x2={lgX - 50} y2={PAD.top + 7} className="cg-line" />
            <text x={lgX - 47} y={PAD.top + 11} className="cg-legend">H</text>
            <line x1={lgX - 28} y1={PAD.top + 7} x2={lgX - 16} y2={PAD.top + 7} className="cg-line-v" strokeDasharray="4 2" />
            <text x={lgX - 13} y={PAD.top + 11} className="cg-legend">V {ratio.toFixed(2)}×</text>
          </g>
        )}
      </svg>
    </div>
  )
}
