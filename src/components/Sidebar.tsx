import { Page } from '../App'
import MouseIcon from './MouseIcon'
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
    id: 'curves', label: 'Curves',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1.5 13.5C4.5 13.5 6 10 8 7.5S12.5 3 14.5 2.5"/>
        <line x1="1.5" y1="13.5" x2="14.5" y2="13.5" opacity="0.4"/>
        <line x1="1.5" y1="13.5" x2="1.5" y2="2.5" opacity="0.4"/>
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
    id: 'compare', label: 'Compare',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 2v12M13 2v12"/>
        <path d="M3 5l3 3-3 3M13 5l-3 3 3 3"/>
      </svg>
    ),
  },
  {
    id: 'hotkeys', label: 'Hotkeys',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1.5" y="4" width="13" height="9" rx="1.5"/>
        <path d="M4 7h.01M7 7h.01M10 7h.01M13 7h.01M5.5 10.5h5"/>
      </svg>
    ),
  },
  {
    id: 'calibration', label: 'Calibrate',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M2 11h12M4 11v-2M7 11v-3M10 11v-2M13 11v-2.5"/>
        <path d="M2 13.5h12"/>
      </svg>
    ),
  },
  {
    id: 'preferences', label: 'Preferences',
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
    id: 'changelog', label: "What's New",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 2h7l3 3v9H3z"/>
        <path d="M5.5 6.5h5M5.5 9h5M5.5 11.5h3"/>
      </svg>
    ),
  },
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
            <span className="nav-icon">{n.icon}</span>
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
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1.5" y="3.5" width="13" height="9" rx="1.5"/>
            <path d="M2 4.5l6 4.5 6-4.5"/>
          </svg>
          <span>Support</span>
        </button>
        <div className="sidebar-version">v1.3.1</div>
      </div>
    </nav>
  )
}
