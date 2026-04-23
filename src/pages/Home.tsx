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
          <div className="stat-label">Sensitivity</div>
          <div className="stat-value">
            {settings.sensitivityEnabled
              ? <>{settings.sensitivity}<span className="stat-unit">/20</span></>
              : <span className="val-off">OS Default</span>}
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
      />
    </div>
  )
}
