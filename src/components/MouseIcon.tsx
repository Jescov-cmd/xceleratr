interface Props {
  size?: number
  strokeWidth?: number
  className?: string
}

// Hexagonal brand mark — geometric tech feel. Color is set by `currentColor`
// in the parent (theme-aware: white on dark, black on light, max contrast in HC).
export default function MouseIcon({ size = 36, strokeWidth = 1.6, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polygon points="12,2 19.5,6.5 19.5,17.5 12,22 4.5,17.5 4.5,6.5" />
      <path d="M12 7v3.5" strokeWidth={strokeWidth + 0.6} />
    </svg>
  )
}
