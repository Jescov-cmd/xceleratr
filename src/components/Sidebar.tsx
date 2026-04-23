import { Page } from '../App'
import mouseIcon from '../assets/mouse.png'
import './Sidebar.css'

interface Props {
  page: Page
  setPage: (p: Page) => void
}

const NAV: { id: Page; label: string; icon: React.ReactNode }[] = [
  {
    id: 'home', label: 'Home',
    icon: (
      <svg viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 1.5L1 7.5h1.5v7H6v-4h4v4h3.5v-7H15L8 1.5z"/>
      </svg>
    ),
  },
  {
    id: 'settings', label: 'Settings',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <line x1="1" y1="4" x2="15" y2="4"/>
        <circle cx="5" cy="4" r="1.8" fill="currentColor" stroke="none"/>
        <line x1="1" y1="8" x2="15" y2="8"/>
        <circle cx="11" cy="8" r="1.8" fill="currentColor" stroke="none"/>
        <line x1="1" y1="12" x2="15" y2="12"/>
        <circle cx="6" cy="12" r="1.8" fill="currentColor" stroke="none"/>
      </svg>
    ),
  },
  {
    id: 'profiles', label: 'Profiles',
    icon: (
      <svg viewBox="0 0 16 16" fill="currentColor">
        <rect x="1.5" y="10.5" width="13" height="2" rx="1"/>
        <rect x="1.5" y="7" width="13" height="2" rx="1" opacity=".65"/>
        <rect x="1.5" y="3.5" width="13" height="2" rx="1" opacity=".35"/>
      </svg>
    ),
  },
  {
    id: 'startup', label: 'Startup',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <line x1="8" y1="2" x2="8" y2="5.5"/>
        <path d="M5.2 4.7A5.5 5.5 0 1 0 10.8 4.7"/>
      </svg>
    ),
  },
]

export default function Sidebar({ page, setPage }: Props) {
  return (
    <nav className="sidebar">
      <div className="sidebar-brand">
        <img src={mouseIcon} alt="" className="sidebar-brand-img" />
      </div>

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

      <div className="sidebar-version">v1.1.1</div>
    </nav>
  )
}
