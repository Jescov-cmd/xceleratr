import home        from '../assets/icons/glass/home.svg?raw'
import curves      from '../assets/icons/glass/curves.svg?raw'
import profiles    from '../assets/icons/glass/profiles.svg?raw'
import compare     from '../assets/icons/glass/compare.svg?raw'
import hotkeys     from '../assets/icons/glass/hotkeys.svg?raw'
import calibrate   from '../assets/icons/glass/calibrate.svg?raw'
import preferences from '../assets/icons/glass/preferences.svg?raw'
import changelog   from '../assets/icons/glass/changelog.svg?raw'
import buy         from '../assets/icons/glass/buy.svg?raw'
import support     from '../assets/icons/glass/support.svg?raw'
import warning     from '../assets/icons/glass/warning.svg?raw'
import check       from '../assets/icons/glass/check.svg?raw'
import help        from '../assets/icons/glass/help.svg?raw'
import close       from '../assets/icons/glass/close.svg?raw'
import minimize    from '../assets/icons/glass/minimize.svg?raw'
import dismiss     from '../assets/icons/glass/dismiss.svg?raw'
import save        from '../assets/icons/glass/save.svg?raw'
import info        from '../assets/icons/glass/info.svg?raw'
import './GlassIcon.css'

export type GlassIconName =
  | 'home' | 'curves' | 'profiles' | 'compare'
  | 'hotkeys' | 'calibrate' | 'preferences' | 'changelog'
  | 'buy'
  | 'support' | 'warning' | 'check' | 'help' | 'info'
  | 'close' | 'minimize' | 'dismiss' | 'save'

const ICONS: Record<GlassIconName, string> = {
  home, curves, profiles, compare,
  hotkeys, calibrate, preferences, changelog,
  buy,
  support, warning, check, help, info,
  close, minimize, dismiss, save,
}

interface Props {
  name: GlassIconName
  size?: number
}

export default function GlassIcon({ name, size = 20 }: Props) {
  return (
    <span
      className="glass-icon"
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: ICONS[name] }}
    />
  )
}
