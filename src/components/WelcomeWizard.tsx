import { useState } from 'react'
import { AppSettings, CurveType, DEFAULT_CUSTOM_POINTS } from '../types'
import MouseIcon from './MouseIcon'
import './WelcomeWizard.css'

interface Props {
  onFinish: (patch: Partial<AppSettings>) => void
  onSkip:   () => void
}

const POLLING_RATES = [125, 250, 500, 1000, 2000, 4000, 8000]

interface Archetype {
  id:        string
  name:      string
  blurb:     string
  curveType: CurveType
  acc: number; thresh: number
}
const ARCHETYPES: Archetype[] = [
  { id: 'pure',    name: 'No acceleration', blurb: 'Raw 1:1. What most FPS pros use. You can always add a curve later.', curveType: 'default',  acc: 100, thresh: 50 },
  { id: 'subtle',  name: 'Subtle boost',    blurb: 'Mostly 1:1, with a gentle nudge on faster movements.',                curveType: 'natural',  acc: 60,  thresh: 60 },
  { id: 'snappy',  name: 'Snappy flicks',   blurb: 'Slow movements stay precise; fast flicks fly.',                       curveType: 'power',    acc: 120, thresh: 50 },
  { id: 'smooth',  name: 'Smooth ramp',     blurb: 'Gradual S-shaped acceleration. Forgiving, no sudden jumps.',          curveType: 'sigmoid',  acc: 80,  thresh: 50 },
]

export default function WelcomeWizard({ onFinish, onSkip }: Props) {
  const [step, setStep] = useState(0)
  const [pollingRate, setPollingRate] = useState(1000)
  const [archetype, setArchetype]     = useState<string>('pure')

  const next = () => setStep(s => s + 1)
  const back = () => setStep(s => Math.max(0, s - 1))

  const finish = () => {
    const a = ARCHETYPES.find(x => x.id === archetype) ?? ARCHETYPES[0]
    onFinish({
      onboardingComplete: true,
      pollingRate,
      curveType:         a.curveType,
      curveAcceleration: a.acc,
      curveThreshold:    a.thresh,
      accelerationEnabled: a.curveType !== 'default',
      customCurvePoints: DEFAULT_CUSTOM_POINTS,
    })
  }

  return (
    <div className="ww-overlay">
      <div className="ww-modal">
        <div className="ww-progress">
          {[0, 1, 2].map(i => (
            <span key={i} className={`ww-dot ${i === step ? 'ww-dot-active' : ''} ${i < step ? 'ww-dot-done' : ''}`} />
          ))}
        </div>

        {step === 0 && (
          <>
            <h2 className="ww-title">Welcome to Xceleratr</h2>
            <p className="ww-sub">A custom mouse acceleration utility. Three quick questions and you're set.</p>
            <div className="ww-illustration" aria-hidden>
              <MouseIcon size={68} strokeWidth={1.4} />
            </div>
            <div className="ww-actions ww-actions-end">
              <button className="ww-btn ww-btn-link" onClick={onSkip}>Skip — I'll set it up later</button>
              <button className="ww-btn ww-btn-primary" onClick={next}>Get started</button>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h2 className="ww-title">What's your mouse polling rate?</h2>
            <p className="ww-sub">
              The frequency your mouse reports its position. Most modern gaming mice are 1000Hz.
              Look it up in your mouse software if you're not sure — or pick 1000 as a safe default.
            </p>
            <div className="ww-grid">
              {POLLING_RATES.map(hz => (
                <button
                  key={hz}
                  className={`ww-card ${pollingRate === hz ? 'ww-card-active' : ''}`}
                  onClick={() => setPollingRate(hz)}
                >
                  <div className="ww-card-name">{hz >= 1000 ? `${hz / 1000}K` : hz} Hz</div>
                  {hz === 1000 && <div className="ww-card-blurb">Default</div>}
                  {hz === 8000 && <div className="ww-card-blurb">Esports tier</div>}
                </button>
              ))}
            </div>
            <div className="ww-actions">
              <button className="ww-btn" onClick={back}>Back</button>
              <button className="ww-btn ww-btn-primary" onClick={next}>Next</button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="ww-title">Pick a starting feel</h2>
            <p className="ww-sub">
              You can always change this in Settings — these are starting points, not commitments.
            </p>
            <div className="ww-arch-list">
              {ARCHETYPES.map(a => (
                <button
                  key={a.id}
                  className={`ww-arch ${archetype === a.id ? 'ww-arch-active' : ''}`}
                  onClick={() => setArchetype(a.id)}
                >
                  <div className="ww-arch-name">{a.name}</div>
                  <div className="ww-arch-blurb">{a.blurb}</div>
                </button>
              ))}
            </div>
            <div className="ww-actions">
              <button className="ww-btn" onClick={back}>Back</button>
              <button className="ww-btn ww-btn-primary" onClick={finish}>Finish</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
