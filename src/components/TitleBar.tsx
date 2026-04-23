import './TitleBar.css'

export default function TitleBar() {
  return (
    <div className="titlebar" data-drag="true">
      <span className="titlebar-name">Xceleratr</span>
      <div className="titlebar-controls">
        <button className="ctrl-btn ctrl-min" onClick={() => window.api?.minimize()} title="Minimize">
          &#x2014;
        </button>
        <button className="ctrl-btn ctrl-close" onClick={() => window.api?.close()} title="Close">
          &#x2715;
        </button>
      </div>
    </div>
  )
}
