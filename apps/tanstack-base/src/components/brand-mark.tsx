interface BrandMarkProps {
  readonly size?: number
  readonly cursorClassName?: string
}

export function BrandMark({ size = 22, cursorClassName = 'fill-primary' }: BrandMarkProps) {
  return (
    <svg aria-hidden="true" height={size} viewBox="0 0 16 16" width={size}>
      <path
        d="M2.6 3.6 7 8l-4.4 4.4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="square"
        strokeWidth="1.9"
      />
      <rect className={cursorClassName} height="2.6" width="5.4" x="8.6" y="10.6" />
    </svg>
  )
}
