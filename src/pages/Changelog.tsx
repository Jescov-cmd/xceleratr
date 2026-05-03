import './Page.css'
import './Changelog.css'

interface Release {
  version: string
  date:    string
  tag?:    'current' | 'major'
  changes: { type: 'added' | 'fixed' | 'changed' | 'removed'; text: string }[]
}

// Newest first. Add a new entry at the top each release.
const RELEASES: Release[] = [
  {
    version: '1.4.0',
    date:    '2026-05-02',
    tag:     'current',
    changes: [
      { type: 'added',   text: 'Local username — required field shown when sharing profiles. Auto-generated as Xcel-###### if you leave it blank, with inappropriate names blocked and a clear inline warning.' },
      { type: 'added',   text: 'Shared profiles now show who made them. Paste a share code and you\'ll see "shared by [Username]" before importing, and the import toast confirms the source.' },
      { type: 'added',   text: 'One-click save on every profile card — a small save icon button overwrites the slot with your current settings instead of needing right-click → menu.' },
      { type: 'added',   text: 'Every interactive button now glows in your system accent color on hover (close stays Windows-red, Premium stays gold by design).' },
      { type: 'added',   text: 'New unified icon set across the entire app: sidebar nav, support, warnings, save, info, help, dismiss, and inline buttons all share the same coolicons-based style.' },
      { type: 'changed', text: 'New brand mark — the hexagon is gone. The mouse silhouette replaces it everywhere: sidebar, taskbar, system tray, alt-tab, installer, .exe icon, and welcome wizard.' },
      { type: 'changed', text: 'Visual polish pass — gradient surfaces on the sidebar / title bar, soft shadows + inset highlights on cards, accent gradient hairline under page headers, modern variable-axis font on the title bar.' },
      { type: 'changed', text: 'Premium button restyled as a small pill with yellow theme, gentle hover halo, and a subtle "Soon" chip.' },
      { type: 'fixed',   text: 'Curves now actually shape cursor movement — the engine was evaluating the curve at ~8% of its domain regardless of what the graph showed. Same setting now feels noticeably more aggressive (because it always should have).' },
      { type: 'fixed',   text: 'Curve smoothing slider works as advertised. Previously smoothed the multiplier (a no-op in practice); now smooths the output delta with sub-pixel remainder accumulation, so 0–100% gives a real range from instant to buttery-laggy.' },
      { type: 'fixed',   text: 'Live speed dot tracks reliably even if the hook hiccups or the cursor leaves the window — three-source fallback keeps it alive.' },
      { type: 'fixed',   text: 'Importing a profile share code with malformed values can no longer freeze the cursor (NaN was leaking through the multiplier).' },
      { type: 'fixed',   text: 'Mac: toggling acceleration off and back on now restores the OS default mouse scaling instead of leaving it stuck at -1.' },
      { type: 'fixed',   text: 'Mac autostart now launches silently into the menu bar instead of popping the window open at every login.' },
      { type: 'fixed',   text: 'Hotkey capture refuses bare keys without modifiers — they were silently rejected by the OS, so the UI used to show "set" but the binding did nothing.' },
      { type: 'fixed',   text: 'Calibration page: prevents you from computing CPI from no movement; instructions corrected (drag inside this window, not Notepad).' },
      { type: 'fixed',   text: 'Tiny black corner at the bottom of the rounded window is gone.' },
      { type: 'fixed',   text: 'Icon swap workflow finally sticks — `npm run icons` now updates both source and runtime locations so changes show up immediately instead of clinging to the previous build\'s images.' },
      { type: 'removed', text: 'Speed histogram backdrop on the curve graph (the faint vertical bars that filled in as you moved). The graph reads cleaner without them.' },
    ],
  },
  {
    version: '1.3.1',
    date:    '2026-04-28',
    changes: [
      { type: 'changed', text: 'New hexagonal app icon — replaces the old icon everywhere: title bar, sidebar, welcome screen, taskbar, system tray, installer, and the .exe itself.' },
      { type: 'changed', text: 'Sidebar reorganized for clarity — eight tabs now: Home, Curves, Profiles, Compare, Hotkeys, Calibrate, Preferences, What\'s New.' },
      { type: 'changed', text: 'Compare page rewritten — A and B are now framed as "Profile 1" and "Profile 2" with a numbered "How this works" guide. Selected profiles show as colored cards with a clear hotkey status.' },
      { type: 'changed', text: 'Hotkeys moved to their own dedicated page — pulled out of the old Startup page so they\'re easier to find.' },
      { type: 'changed', text: 'Theme picker moved to the Preferences page (alongside the start-on-login toggle).' },
      { type: 'changed', text: 'In-app brand icon is theme-aware: white in dark theme, black in light theme, max-contrast in high-contrast theme.' },
      { type: 'fixed',   text: 'Existing users no longer get the welcome wizard after upgrading from older versions — the wizard only shows on fresh installs.' },
      { type: 'fixed',   text: 'Saving on the Curves page no longer overwrites theme changes you made on Preferences. Each page now only saves what it owns.' },
      { type: 'fixed',   text: 'A/B hotkey toast now correctly points to the Compare page (was pointing at the old Profiles location).' },
    ],
  },
  {
    version: '1.3.0',
    date:    '2026-04-27',
    changes: [
      { type: 'added',   text: 'Per-axis curves — shape horizontal and vertical movement with completely independent curves. Toggle in Settings, switch between X/Y axes with the new tabs.' },
      { type: 'added',   text: 'First-run welcome wizard — three quick questions on first launch get new users to a sensible starting point.' },
      { type: 'added',   text: 'DPI calibration page — drag-test that measures your mouse\'s real CPI and recommends a curve threshold based on the result.' },
      { type: 'added',   text: 'Speed histogram — graph backdrop now shows where you\'ve been moving recently, so you can see exactly where on the curve you spend your time.' },
      { type: 'added',   text: 'Game presets — built-in starting points (FPS Pure, Tracking, Flick Boost, Productivity, Smooth Accel, Classic Windows). One click to apply.' },
      { type: 'added',   text: 'Configurable hotkeys — rebind toggle-accel to any key combo, plus new actions: cycle profiles, A/B compare. All set in the Startup page.' },
      { type: 'added',   text: 'A/B compare profiles — pair two saved profiles, hit a hotkey to swap between them in real time and feel which is better.' },
      { type: 'added',   text: 'Tray quick-switch — right-click the tray icon to apply any saved profile without opening the app.' },
      { type: 'added',   text: 'Toast notifications — Windows toast confirms every hotkey action ("Acceleration ON", "Profile: Slot 2", etc.) so you know it took effect.' },
      { type: 'added',   text: 'Curve smoothing slider — softens transitions for step-curves (Classic, Jump). 0–100%.' },
      { type: 'added',   text: 'Plain-English curve labels — every curve now shows a one-word feel hint ("Snappy", "Smooth", "S-curve") next to the math name.' },
      { type: 'added',   text: 'Help tooltips — small ? icons on technical fields (Threshold, Exponent, EPP, Smoothing) explain what each one actually does.' },
    ],
  },
  {
    version: '1.2.1',
    date:    '2026-04-27',
    changes: [
      { type: 'fixed', text: 'Cursor curve now activates within ~half a second of launch instead of taking several seconds. The auto-updater was loading at boot and stalling the hook worker — it now starts up in the background a few seconds after the app is already running.' },
    ],
  },
  {
    version: '1.2.0',
    date:    '2026-04-27',
    changes: [
      { type: 'added',  text: 'Local profile — set a display name, avatar, email, and phone right from the title bar. All saved on your PC, never uploaded.' },
      { type: 'added',  text: 'What\'s New page — see exactly what changed in each release.' },
      { type: 'added',  text: 'Global hotkey — Ctrl+Alt+X toggles acceleration on/off, even mid-game. Disable in the Startup page if you don\'t want it.' },
      { type: 'added',  text: 'Auto-update support — when the developer ships a new version, you\'ll be notified inside the app. (Activates after the next published release.)' },
    ],
  },
  {
    version: '1.1.4',
    date:    '2026-04-27',
    changes: [
      { type: 'fixed',   text: 'Startup is much faster — settings apply in the background instead of blocking the window for ~200–400ms.' },
      { type: 'added',   text: 'Support email — click "Support" in the sidebar to send feedback to customersupport80@gmail.com.' },
      { type: 'changed', text: 'In-app icon is brighter and slightly larger.' },
      { type: 'fixed',   text: 'Imported profiles with missing V/H ratio no longer crash the Profiles summary.' },
    ],
  },
  {
    version: '1.1.3',
    date:    '2026-04-24',
    changes: [
      { type: 'removed', text: 'Removed the sensitivity slider — pointer speed is now solely controlled by your OS / mouse software (raw-accel style).' },
      { type: 'fixed',   text: 'Trackpad + mouse desync resolved when both devices are used at the same time.' },
      { type: 'fixed',   text: 'No more cursor lag when applying a curve — the hook now updates in-place instead of restarting.' },
      { type: 'fixed',   text: 'Settings randomly turning off — the hook worker now auto-restarts if it crashes.' },
      { type: 'added',   text: 'macOS personalized accent colors are now reflected in the UI.' },
      { type: 'added',   text: 'The live speed dot now follows the curve smoothly even when the cursor leaves the window.' },
    ],
  },
  {
    version: '1.1.2',
    date:    '2026-04-23',
    changes: [
      { type: 'fixed',   text: 'Stability improvements and minor UI polish.' },
    ],
  },
  {
    version: '1.1.1',
    date:    '2026-04-22',
    changes: [
      { type: 'fixed',   text: 'Bug fixes for curve application and registry restoration on quit.' },
    ],
  },
  {
    version: '1.1.0',
    date:    '2026-04-22',
    tag:     'major',
    changes: [
      { type: 'added',   text: 'Custom curve editor with draggable control points.' },
      { type: 'added',   text: 'Profiles page — save up to 5 named curves and share them via a code.' },
      { type: 'added',   text: 'Live curve preview with input speed indicator.' },
      { type: 'changed', text: 'New theme system: Light, Dark, and High Contrast.' },
    ],
  },
]

const CHIP: Record<Release['changes'][number]['type'], { label: string; cls: string }> = {
  added:   { label: 'New',     cls: 'chip-added' },
  fixed:   { label: 'Fixed',   cls: 'chip-fixed' },
  changed: { label: 'Updated', cls: 'chip-changed' },
  removed: { label: 'Removed', cls: 'chip-removed' },
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso + 'T00:00:00')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch { return iso }
}

export default function Changelog() {
  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">What's New</h1>
        <p className="page-sub">Version-by-version history of changes</p>
      </div>

      <div className="changelog-list">
        {RELEASES.map(r => (
          <article key={r.version} className={`release-card ${r.tag === 'current' ? 'release-current' : ''}`}>
            <header className="release-head">
              <div className="release-version-row">
                <h2 className="release-version">v{r.version}</h2>
                {r.tag === 'current' && <span className="release-badge release-badge-current">You're on this</span>}
                {r.tag === 'major'   && <span className="release-badge release-badge-major">Major</span>}
              </div>
              <span className="release-date">{formatDate(r.date)}</span>
            </header>

            <ul className="release-changes">
              {r.changes.map((c, i) => (
                <li key={i} className="release-change">
                  <span className={`release-chip ${CHIP[c.type].cls}`}>{CHIP[c.type].label}</span>
                  <span className="release-change-text">{c.text}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </div>
  )
}
