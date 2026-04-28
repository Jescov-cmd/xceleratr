import { useEffect, useRef, useState } from 'react'
import './HotkeyCapture.css'

interface Props {
  value:    string                          // current Electron accelerator, '' = unbound
  onChange: (next: string) => void          // called with new accelerator string or ''
}

// Convert a KeyboardEvent into an Electron accelerator string ("CommandOrControl+Alt+X").
// Returns '' if only modifiers were pressed (capture should keep listening).
function eventToAccelerator(e: KeyboardEvent): string {
  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('CommandOrControl')
  if (e.altKey)   parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')

  let key = e.key
  if (['Control', 'Meta', 'Alt', 'Shift'].includes(key)) return ''  // modifiers alone

  // Map browser key names → Electron accelerator names
  if (key === ' ')           key = 'Space'
  else if (key === 'ArrowUp')    key = 'Up'
  else if (key === 'ArrowDown')  key = 'Down'
  else if (key === 'ArrowLeft')  key = 'Left'
  else if (key === 'ArrowRight') key = 'Right'
  else if (key === 'Escape')     key = 'Esc'
  else if (key === 'Enter')      key = 'Return'
  else if (key === 'Tab')        return ''  // refuse Tab — too easy to clash with focus
  else if (key.length === 1)     key = key.toUpperCase()
  // F-keys, Home/End/PageUp/PageDown, etc. pass through verbatim — Electron accepts them.

  parts.push(key)
  return parts.join('+')
}

// Pretty display: "CommandOrControl+Alt+X" → "Ctrl + Alt + X"
function prettify(accel: string, isMac: boolean): string {
  if (!accel) return ''
  return accel
    .split('+')
    .map(p => p === 'CommandOrControl' ? (isMac ? 'Cmd' : 'Ctrl') : p)
    .join(' + ')
}

export default function HotkeyCapture({ value, onChange }: Props) {
  const [recording, setRecording] = useState(false)
  const recordingRef = useRef(recording)
  recordingRef.current = recording
  const isMac = window.api?.platform === 'darwin'

  useEffect(() => {
    if (!recording) return
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      // Esc cancels recording
      if (e.key === 'Escape') { setRecording(false); return }
      const accel = eventToAccelerator(e)
      if (!accel) return  // wait for a real key
      onChange(accel)
      setRecording(false)
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [recording, onChange])

  return (
    <div className="hotkey-capture">
      {recording ? (
        <span className="hotkey-recording">Press a key combination… (Esc to cancel)</span>
      ) : (
        <span className="hotkey-display">{value ? prettify(value, isMac) : <em className="hotkey-empty">Not set</em>}</span>
      )}
      <div className="hotkey-actions">
        <button
          className="hotkey-btn"
          onClick={() => setRecording(r => !r)}
        >
          {recording ? 'Cancel' : value ? 'Change' : 'Set'}
        </button>
        {value && !recording && (
          <button className="hotkey-btn hotkey-btn-clear" onClick={() => onChange('')}>
            Clear
          </button>
        )}
      </div>
    </div>
  )
}
