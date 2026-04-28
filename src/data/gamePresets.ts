import { MouseSettings, DEFAULT_CUSTOM_POINTS } from '../types'

export interface GamePreset {
  id:    string
  name:  string
  blurb: string  // one-line "what's this for"
  settings: MouseSettings
}

// All presets share a baseline config that's overridden field-by-field.
const BASE: MouseSettings = {
  yxRatio: 1, yxRatioEnabled: true,
  curveType: 'default', customCurvePoints: DEFAULT_CUSTOM_POINTS,
  curveAcceleration: 100, accelerationEnabled: true,
  curveThreshold: 50, curveExponent: 1.5,
  perAxisEnabled: false,
  curveTypeY: 'default', customCurvePointsY: DEFAULT_CUSTOM_POINTS,
  curveAccelerationY: 100, curveThresholdY: 50, curveExponentY: 1.5,
  curveSmoothing: 0,
  enhancePointerPrecision: false, pollingRate: 1000,
}

export const GAME_PRESETS: GamePreset[] = [
  {
    id: 'fps-pure',
    name: 'FPS Pure',
    blurb: 'No acceleration. What most pros run.',
    settings: { ...BASE, curveType: 'default', accelerationEnabled: false, pollingRate: 1000 },
  },
  {
    id: 'fps-subtle',
    name: 'FPS Subtle',
    blurb: 'Tiny boost only on big flicks — 1-to-1 below the threshold.',
    settings: { ...BASE, curveType: 'natural', curveAcceleration: 60, curveThreshold: 60, pollingRate: 1000 },
  },
  {
    id: 'tracking',
    name: 'Tracking',
    blurb: 'Even, gentle ramp — built for aim-tracking heroes.',
    settings: { ...BASE, curveType: 'linear', curveAcceleration: 50, pollingRate: 1000 },
  },
  {
    id: 'flick',
    name: 'Flick Boost',
    blurb: 'Snappy — slow movements stay precise, fast flicks fly.',
    settings: { ...BASE, curveType: 'power', curveAcceleration: 120, curveExponent: 2.0, pollingRate: 1000 },
  },
  {
    id: 'productivity',
    name: 'Productivity',
    blurb: 'Generous acceleration for desktop, RTS, MMO.',
    settings: { ...BASE, curveType: 'linear', curveAcceleration: 150, pollingRate: 1000 },
  },
  {
    id: 'smooth',
    name: 'Smooth Accel',
    blurb: 'S-curve — eases in and out. Forgiving for new accel users.',
    settings: { ...BASE, curveType: 'sigmoid', curveAcceleration: 80, curveThreshold: 50, curveSmoothing: 25, pollingRate: 1000 },
  },
  {
    id: 'classic-windows',
    name: 'Classic Windows',
    blurb: 'Two-step Windows-style accel with smoothing so steps feel natural.',
    settings: { ...BASE, curveType: 'classic', curveAcceleration: 100, curveThreshold: 50, curveSmoothing: 40, pollingRate: 1000 },
  },
]
