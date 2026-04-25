import { useEffect, useRef, useState } from 'react'
import { AppSettings } from '../types'
import CurveGraph from '../components/CurveGraph'
import './Page.css'

interface Props {
  settings: AppSettings
}

const CURVE_LABELS: Record<string, string> = {
  default: 'Default', linear: 'Linear', natural: 'Natural', power: 'Power',
  sigmoid: 'Sigmoid', bounce: 'Bounce', classic: 'Classic', jump: 'Jump',
}

export default function Home({ settings }: Props) {
  const [liveX, setLiveX] = useState(0)
  const targetXRef = useRef(0)

  useEffect(() => {
    let currentX = 0
    let lastSent = -1
    let animId: number

    const animate = () => {
      targetXRef.current *= 0.93           // decay target when no input
      currentX += (targetXRef.current - currentX) * 0.25  // smooth follow
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

  const effectiveRatio = settings.yxRatioEnabled ? (settings.yxRatio ?? 1) : 1
  const ratioLabel = !settings.yxRatioEnabled
    ? 'Off'
    : Math.abs(effectiveRatio - 1) < 0.02
      ? '1.00'
      : effectiveRatio.toFixed(2)

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Home</h1>
        <p className="page-sub">Current settings overview</p>
      </div>

      <div className="card-grid">
        <div className="stat-card">
          <div className="stat-label">Speed</div>
          <div className="stat-value">
            <span className="val-off">OS Default</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Curve</div>
          <div className="stat-value" style={{ fontSize: 14 }}>
            {CURVE_LABELS[settings.curveType] ?? settings.curveType}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Acceleration</div>
          <div className={`stat-value ${settings.accelerationEnabled ? 'val-on' : 'val-off'}`}>
            {settings.accelerationEnabled
              ? <>{settings.curveAcceleration}<span className="stat-unit">%</span></>
              : 'Off'}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">V/H Ratio</div>
          <div className={`stat-value ${!settings.yxRatioEnabled ? 'val-off' : ''}`}>
            {ratioLabel}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Polling Rate</div>
          <div className="stat-value" style={{ fontSize: 14 }}>
            {settings.pollingRate >= 1000
              ? <>{settings.pollingRate / 1000}<span className="stat-unit">K Hz</span></>
              : <>{settings.pollingRate}<span className="stat-unit"> Hz</span></>}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Precision (EPP)</div>
          <div className={`stat-value ${settings.enhancePointerPrecision ? 'val-on' : 'val-off'}`}>
            {settings.enhancePointerPrecision ? 'On' : 'Off'}
          </div>
        </div>
      </div>

      <CurveGraph
        settings={{ ...settings, yxRatio: effectiveRatio }}
        height={190}
        liveX={liveX}
      />
    </div>
  )
}
