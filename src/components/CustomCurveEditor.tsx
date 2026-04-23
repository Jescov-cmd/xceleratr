import { useState, useRef, useEffect } from 'react'
import { CurvePoint, DEFAULT_CUSTOM_POINTS } from '../types'
import { monoSpline } from './CurveGraph'
import './CustomCurveEditor.css'

interface Props {
  points: CurvePoint[]
  onChange: (pts: CurvePoint[]) => void
}

const W = 420, H = 230
const PAD = { top: 20, right: 20, bottom: 38, left: 50 }
const GW = W - PAD.left - PAD.right
const GH = H - PAD.top - PAD.bottom
const DOT_R = 8
const MIN_POINTS = 2

function sorted(pts: CurvePoint[]) {
  return [...pts].sort((a, b) => a.x - b.x)
}

function clampX(x: number) { return Math.max(0, Math.min(1, x)) }
function clampY(y: number) { return Math.max(0.1, Math.min(6, y)) }

export default function CustomCurveEditor({ points, onChange }: Props) {
  const svgRef      = useRef<SVGSVGElement>(null)
  const [drag, setDrag]       = useState<number | null>(null)
  const [hover, setHover]     = useState<number | null>(null)
  const [editPts, setEditPts] = useState<CurvePoint[]>(() => sorted(points))

  // Sync from parent when not dragging
  useEffect(() => {
    if (drag === null) setEditPts(sorted(points))
  }, [points, drag])

  const maxY = Math.max(...editPts.map(p => p.y), 2.5) * 1.12

  const sx = (x: number) => PAD.left + clampX(x) * GW
  const sy = (y: number) => PAD.top + GH - (Math.min(y, maxY) / maxY) * GH

  function toSVGCoords(e: React.PointerEvent | React.MouseEvent): { x: number; y: number } {
    const svg = svgRef.current!
    const pt  = svg.createSVGPoint()
    pt.x = e.clientX; pt.y = e.clientY
    const sp = pt.matrixTransform(svg.getScreenCTM()!.inverse())
    return {
      x: clampX((sp.x - PAD.left) / GW),
      y: clampY(maxY * (1 - (sp.y - PAD.top) / GH)),
    }
  }

  function handleDotDown(e: React.PointerEvent<SVGCircleElement>, idx: number) {
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag(idx)
  }

  function handleDotMove(e: React.PointerEvent<SVGCircleElement>, idx: number) {
    if (drag !== idx) return
    const { x, y } = toSVGCoords(e)
    const next = editPts.map((p, i) => i === idx ? { x, y } : p)
    setEditPts(next)
    onChange(next)  // live preview (unsorted ok — hook sorts before use)
  }

  function handleDotUp(e: React.PointerEvent<SVGCircleElement>) {
    e.currentTarget.releasePointerCapture(e.pointerId)
    if (drag !== null) {
      const final = sorted(editPts)
      setEditPts(final)
      onChange(final)
      setDrag(null)
    }
  }

  function handleSvgClick(e: React.MouseEvent<SVGSVGElement>) {
    if (drag !== null) return
    if ((e.target as SVGElement).closest('circle')) return
    const { x, y } = toSVGCoords(e)
    // Add on the current curve at this x (preserves existing shape)
    const curveY = editPts.length >= 2 ? monoSpline(sorted(editPts), x) : y
    const next = sorted([...editPts, { x, y: clampY(curveY) }])
    setEditPts(next)
    onChange(next)
  }

  function handleDotRightClick(e: React.MouseEvent<SVGCircleElement>, idx: number) {
    e.preventDefault()
    e.stopPropagation()
    if (editPts.length <= MIN_POINTS) return
    const next = editPts.filter((_, i) => i !== idx)
    setEditPts(next)
    onChange(next)
  }

  // Build display curve through editPts
  const curvePts = Array.from({ length: 150 }, (_, i) => {
    const x = i / 149
    return { x, y: editPts.length >= 2 ? monoSpline(sorted(editPts), x) : editPts[0]?.y ?? 1 }
  })

  const pathD = curvePts.map((p, i) =>
    `${i === 0 ? 'M' : 'L'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`
  ).join(' ')
  const fillD = `${pathD} L${sx(1).toFixed(1)},${sy(0)} L${sx(0).toFixed(1)},${sy(0)} Z`

  const gridXVals = [0.25, 0.5, 0.75, 1]
  const gridYPcts = [0.25, 0.5, 0.75, 1]

  return (
    <div className="cce-wrap">
      <div className="cce-header">
        <span className="cce-title">Custom Curve Editor</span>
        <span className="cce-hint">Click empty area to add · Right-click dot to remove · Drag to adjust</span>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="cce-svg"
        onClick={handleSvgClick}
      >
        {/* Grid */}
        {gridXVals.map(v => (
          <line key={`gx${v}`} x1={sx(v)} y1={PAD.top} x2={sx(v)} y2={PAD.top + GH} className="cg-grid" />
        ))}
        {gridYPcts.map(v => (
          <line key={`gy${v}`} x1={PAD.left} y1={sy(v * maxY)} x2={PAD.left + GW} y2={sy(v * maxY)} className="cg-grid" />
        ))}

        {/* Axes */}
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + GH} className="cg-axis" />
        <line x1={PAD.left} y1={PAD.top + GH} x2={PAD.left + GW} y2={PAD.top + GH} className="cg-axis" />

        {/* y=1 baseline */}
        {sy(1) > PAD.top && sy(1) < PAD.top + GH && (
          <line x1={PAD.left} y1={sy(1)} x2={PAD.left + GW} y2={sy(1)}
            className="cce-baseline" strokeDasharray="4 3" />
        )}

        {/* Fill + curve */}
        <path d={fillD} className="cg-fill" />
        <path d={pathD} className="cg-line" />

        {/* Y ticks */}
        {gridYPcts.map(v => (
          <text key={`yl${v}`} x={PAD.left - 6} y={sy(v * maxY) + 4} className="cg-tick" textAnchor="end">
            {(v * maxY).toFixed(1)}x
          </text>
        ))}

        {/* X ticks */}
        {(['Low', 'Mid', 'High'] as const).map((label, i) => (
          <text key={label} x={sx((i + 1) / 4)} y={PAD.top + GH + 14} className="cg-tick" textAnchor="middle">
            {label}
          </text>
        ))}

        {/* Axis titles */}
        <text x={PAD.left + GW / 2} y={H - 4} className="cg-axis-title" textAnchor="middle">Input Speed</text>
        <text x={11} y={PAD.top + GH / 2} className="cg-axis-title" textAnchor="middle"
          transform={`rotate(-90, 11, ${PAD.top + GH / 2})`}>Output</text>

        {/* Control dots */}
        {editPts.map((pt, i) => (
          <circle
            key={i}
            cx={sx(pt.x)} cy={sy(pt.y)}
            r={drag === i ? DOT_R + 3 : hover === i ? DOT_R + 1.5 : DOT_R}
            className={`cce-dot${drag === i ? ' cce-dot-active' : ''}`}
            onPointerDown={e => handleDotDown(e, i)}
            onPointerMove={e => handleDotMove(e, i)}
            onPointerUp={handleDotUp}
            onPointerCancel={handleDotUp}
            onContextMenu={e => handleDotRightClick(e, i)}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => { if (drag === null) setHover(null) }}
            style={{ cursor: drag === i ? 'grabbing' : 'grab' }}
          />
        ))}
      </svg>

      <div className="cce-footer">
        <span className="cce-count">{editPts.length} point{editPts.length !== 1 ? 's' : ''}</span>
        <button
          className="cce-reset"
          onClick={() => onChange(sorted(DEFAULT_CUSTOM_POINTS))}
        >
          Reset to default
        </button>
      </div>
    </div>
  )
}
