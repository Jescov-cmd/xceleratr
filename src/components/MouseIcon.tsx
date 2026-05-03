interface Props {
  size?: number
  strokeWidth?: number
  className?: string
}

// Brand mark — coolicons "Mouse" silhouette: rounded body with a vertical
// scroll-wheel stroke. Color is set by `currentColor` in the parent so it
// stays theme-aware (white on dark, black on light, max contrast in HC).
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
      <path d="M12 10V7M18 9V15C18 18.3137 15.3137 21 12 21C8.68629 21 6 18.3137 6 15V9C6 5.68629 8.68629 3 12 3C15.3137 3 18 5.68629 18 9Z" />
    </svg>
  )
}
