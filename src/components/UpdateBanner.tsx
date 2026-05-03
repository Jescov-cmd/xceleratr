import { useEffect, useState } from 'react'
import GlassIcon from './GlassIcon'
import './UpdateBanner.css'

interface Status {
  state:   'idle' | 'available' | 'downloading' | 'ready' | 'error'
  info?:   { version?: string; releaseDate?: string }
  percent?: number
}

export default function UpdateBanner() {
  const [status, setStatus] = useState<Status>({ state: 'idle' })
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!window.api?.getUpdateStatus) return
    window.api.getUpdateStatus().then(s => setStatus(s as Status)).catch(() => {})
    const unsub = window.api.onUpdateStatus?.(s => setStatus(s as Status))
    return unsub
  }, [])

  if (dismissed) return null
  if (status.state === 'idle' || status.state === 'error') return null

  const v = status.info?.version ? `v${status.info.version}` : 'A new version'

  return (
    <div className={`update-banner update-banner-${status.state}`}>
      <div className="update-banner-text">
        {status.state === 'available'   && <>{v} is available — downloading…</>}
        {status.state === 'downloading' && <>Downloading {v}{typeof status.percent === 'number' ? ` (${status.percent}%)` : '…'}</>}
        {status.state === 'ready'       && <>{v} is ready to install — restart to apply.</>}
      </div>
      <div className="update-banner-actions">
        {status.state === 'ready' && (
          <button
            className="update-banner-btn update-banner-btn-primary"
            onClick={() => window.api?.installUpdateNow?.()}
          >
            Restart &amp; install
          </button>
        )}
        <button
          className="update-banner-btn"
          onClick={() => setDismissed(true)}
          title="Dismiss"
          aria-label="Dismiss"
        >
          <GlassIcon name="dismiss" size={14} />
        </button>
      </div>
    </div>
  )
}
