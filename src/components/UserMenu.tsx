import { useEffect, useRef, useState } from 'react'
import { AppSettings } from '../types'
import './UserMenu.css'

interface Props {
  settings: AppSettings
  updateSettings: (patch: Partial<AppSettings>) => void
}

const MAX_AVATAR_BYTES = 1_500_000  // ~1.5 MB raw — base64 inflates ~33% in settings.json

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function UserMenu({ settings, updateSettings }: Props) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState({
    userName:   settings.userName  ?? '',
    userEmail:  settings.userEmail ?? '',
    userPhone:  settings.userPhone ?? '',
    userAvatar: settings.userAvatar ?? '',
  })
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  useEffect(() => {
    setDraft({
      userName:   settings.userName  ?? '',
      userEmail:  settings.userEmail ?? '',
      userPhone:  settings.userPhone ?? '',
      userAvatar: settings.userAvatar ?? '',
    })
  }, [settings.userName, settings.userEmail, settings.userPhone, settings.userAvatar])

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith('image/')) { setError('Please choose an image file'); return }
    if (f.size > MAX_AVATAR_BYTES)    { setError('Image must be under 1.5 MB');  return }
    const reader = new FileReader()
    reader.onload = () => {
      setDraft(d => ({ ...d, userAvatar: String(reader.result) }))
      setError('')
    }
    reader.onerror = () => setError('Failed to read image')
    reader.readAsDataURL(f)
  }

  const handleSave = async () => {
    const patch: Partial<AppSettings> = {
      userName:   draft.userName.trim().slice(0, 40),
      userEmail:  draft.userEmail.trim().slice(0, 80),
      userPhone:  draft.userPhone.trim().slice(0, 30),
      userAvatar: draft.userAvatar,
    }
    updateSettings(patch)
    try { await window.api?.saveSettings?.(patch as Record<string, unknown>) } catch { /* no-op */ }
    setOpen(false)
  }

  const handleClear = () => {
    setDraft(d => ({ ...d, userAvatar: '' }))
    if (fileRef.current) fileRef.current.value = ''
  }

  const display = settings.userName || 'You'
  const avatar  = settings.userAvatar

  return (
    <div className="user-menu" ref={popoverRef}>
      <button
        className="user-menu-trigger"
        onClick={() => setOpen(o => !o)}
        title={display}
        aria-label="Open profile menu"
      >
        {avatar
          ? <img src={avatar} alt="" className="user-avatar-img" />
          : <span className="user-avatar-initials">{initials(display) || '·'}</span>
        }
      </button>

      {open && (
        <div className="user-popover">
          <div className="user-popover-header">
            <div className="user-popover-avatar">
              {draft.userAvatar
                ? <img src={draft.userAvatar} alt="" />
                : <span className="user-avatar-initials">{initials(draft.userName) || '·'}</span>
              }
            </div>
            <div className="user-popover-meta">
              <div className="user-popover-name">{draft.userName || 'Unnamed'}</div>
              <div className="user-popover-sub">Stored locally on this PC</div>
            </div>
          </div>

          <div className="user-form">
            <label className="user-field">
              <span>Display name</span>
              <input
                type="text"
                value={draft.userName}
                onChange={e => setDraft(d => ({ ...d, userName: e.target.value }))}
                placeholder="e.g. Jaxson"
                maxLength={40}
              />
            </label>

            <label className="user-field">
              <span>Email <em>(optional)</em></span>
              <input
                type="email"
                value={draft.userEmail}
                onChange={e => setDraft(d => ({ ...d, userEmail: e.target.value }))}
                placeholder="you@example.com"
                maxLength={80}
              />
            </label>

            <label className="user-field">
              <span>Phone <em>(optional)</em></span>
              <input
                type="tel"
                value={draft.userPhone}
                onChange={e => setDraft(d => ({ ...d, userPhone: e.target.value }))}
                placeholder="+1 555 123 4567"
                maxLength={30}
              />
            </label>

            <div className="user-field">
              <span>Profile picture</span>
              <div className="user-avatar-row">
                <button
                  type="button"
                  className="user-btn-secondary"
                  onClick={() => fileRef.current?.click()}
                >
                  {draft.userAvatar ? 'Change image' : 'Upload image'}
                </button>
                {draft.userAvatar && (
                  <button type="button" className="user-btn-link" onClick={handleClear}>
                    Remove
                  </button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={onPickFile}
                  hidden
                />
              </div>
            </div>

            {error && <div className="user-error">{error}</div>}
          </div>

          <div className="user-popover-footer">
            <span className="user-privacy-note">
              Profile data is saved on this PC only. Nothing is uploaded.
            </span>
            <button className="user-btn-primary" onClick={handleSave}>Save</button>
          </div>
        </div>
      )}
    </div>
  )
}
