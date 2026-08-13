type BrandLogoProps = {
  size?: number
  className?: string
  /** When true, skip outer rounded navy plate (for use inside .brand-mark). */
  markOnly?: boolean
}

/** Shrija hallmark seal — navy + gold “S”. */
export function BrandLogo({ size = 40, className, markOnly = false }: BrandLogoProps) {
  if (markOnly) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        className={className}
        aria-hidden
      >
        <circle cx="32" cy="30" r="18" fill="none" stroke="currentColor" strokeWidth="3.5" />
        <circle cx="32" cy="30" r="14" fill="none" stroke="currentColor" strokeWidth="1.25" />
        <text
          x="32"
          y="38"
          textAnchor="middle"
          fontFamily="Georgia, 'Times New Roman', serif"
          fontSize="26"
          fontWeight="700"
          fill="currentColor"
        >
          S
        </text>
        <rect x="20" y="42" width="24" height="2.5" rx="1" fill="currentColor" />
      </svg>
    )
  }

  return (
    <img
      src="/logo.svg"
      alt="Shrija"
      width={size}
      height={size}
      className={className}
      draggable={false}
    />
  )
}
