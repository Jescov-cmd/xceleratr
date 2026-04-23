import { Page } from '../App'
import './Sidebar.css'

interface Props {
  page: Page
  setPage: (p: Page) => void
}

const NAV: { id: Page; label: string; icon: string }[] = [
  { id: 'home',     label: 'Home',     icon: '⌂' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
  { id: 'profiles', label: 'Profiles', icon: '◈' },
  { id: 'startup',  label: 'Startup',  icon: '⏻' },
]

export default function Sidebar({ page, setPage }: Props) {
  return (
    <nav className="sidebar">
      <div className="nav-items">
        {NAV.map((n) => (
          <button
            key={n.id}
            className={`nav-item ${page === n.id ? 'nav-active' : ''}`}
            onClick={() => setPage(n.id)}
          >
            <span className="nav-icon">{n.icon}</span>
            <span>{n.label}</span>
          </button>
        ))}
      </div>
      <div className="sidebar-version">v1.0.0</div>
    </nav>
  )
}
