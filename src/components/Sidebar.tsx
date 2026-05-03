import { Page } from '../App'
import MouseIcon from './MouseIcon'
import GlassIcon, { GlassIconName } from './GlassIcon'
import './Sidebar.css'

interface Props {
  page: Page
  setPage: (p: Page) => void
}

const NAV: { id: Page; label: string; icon: GlassIconName }[] = [
  { id: 'home',         label: 'Home',       icon: 'home' },
  { id: 'curves',       label: 'Curves',     icon: 'curves' },
  { id: 'profiles',     label: 'Profiles',   icon: 'profiles' },
  { id: 'compare',      label: 'Compare',    icon: 'compare' },
  { id: 'hotkeys',      label: 'Hotkeys',    icon: 'hotkeys' },
  { id: 'calibration',  label: 'Calibrate',  icon: 'calibrate' },
  { id: 'preferences',  label: 'Preferences', icon: 'preferences' },
  { id: 'changelog',    label: "What's New", icon: 'changelog' },
]

export default function Sidebar({ page, setPage }: Props) {
  return (
    <nav className="sidebar">
      <div className="sidebar-brand">
        <MouseIcon size={36} strokeWidth={1.7} className="sidebar-brand-icon" />
      </div>

      <div className="nav-items">
        {NAV.map((n) => (
          <button
            key={n.id}
            className={`nav-item ${page === n.id ? 'nav-active' : ''}`}
            onClick={() => setPage(n.id)}
          >
            <GlassIcon name={n.icon} size={20} />
            <span>{n.label}</span>
          </button>
        ))}
      </div>

      <div className="sidebar-bottom">
        <button
          className="sidebar-support"
          onClick={() => window.api?.openSupportEmail?.()}
          title="Email feedback or report a bug"
        >
          <GlassIcon name="support" size={14} />
          <span>Support</span>
        </button>
        <div className="sidebar-version">v1.4.0</div>
      </div>
    </nav>
  )
}
