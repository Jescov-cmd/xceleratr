import { useEffect, useRef, useState } from 'react'
import GlassIcon from './GlassIcon'
import './Tooltip.css'

interface Props {
  text: string
  size?: 'sm' | 'md'
}

export default function Tooltip({ text, size = 'sm' }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <span
      ref={ref}
      className={`tooltip-wrap tooltip-${size}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={() => setOpen(o => !o)}
    >
      <span className="tooltip-icon" aria-label="More info">
        <GlassIcon name="help" size={10} />
      </span>
      {open && <span className="tooltip-bubble">{text}</span>}
    </span>
  )
}
