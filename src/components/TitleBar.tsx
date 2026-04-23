import mouseIcon from '../assets/mouse.png'
import './TitleBar.css'

export default function TitleBar() {
  return (
    <div className="titlebar" data-drag="true">
      <div className="titlebar-brand">
        <img src={mouseIcon} alt="" className="titlebar-icon" />
        <span className="titlebar-name">Xceleratr</span>
      </div>
      <div className="titlebar-controls">
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
