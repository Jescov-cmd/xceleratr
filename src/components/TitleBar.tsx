import { AppSettings } from '../types'
import UserMenu from './UserMenu'
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
        <UserMenu settings={settings} updateSettings={updateSettings} />
        <button className="ctrl-btn ctrl-min" onClick={() => window.api?.minimize()} title="Minimize">
          &#x2014;
        </button>
        <button className="ctrl-btn ctrl-close" onClick={() => window.api?.close()} title="Minimize to tray">
          &#x2715;
        </button>
      </div>
    </div>
  )
}
