import { AppSettings } from '../types'
import UserMenu from './UserMenu'
import GlassIcon from './GlassIcon'
import './TitleBar.css'

interface Props {
  settings: AppSettings
  updateSettings: (patch: Partial<AppSettings>) => void
}

export default function TitleBar({ settings, updateSettings }: Props) {
  return (
    <div className="titlebar" data-drag="true">
      <div className="titlebar-brand">
        <span className="titlebar-name">Xceleratr</span>
      </div>
      <div className="titlebar-controls">
        <button
          className="titlebar-premium"
          title="Premium — coming soon"
          aria-disabled="true"
          onClick={(e) => e.preventDefault()}
        >
          <GlassIcon name="buy" size={18} />
          <span className="premium-label">Premium</span>
          <span className="premium-soon">Soon</span>
        </button>
        <UserMenu settings={settings} updateSettings={updateSettings} />
        <button className="ctrl-btn ctrl-min" onClick={() => window.api?.minimize()} title="Minimize">
          <GlassIcon name="minimize" size={14} />
        </button>
        <button className="ctrl-btn ctrl-close" onClick={() => window.api?.close()} title="Minimize to tray">
          <GlassIcon name="close" size={12} />
        </button>
      </div>
    </div>
  )
}
