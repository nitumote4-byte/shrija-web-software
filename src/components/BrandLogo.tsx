type BrandLogoProps = {
  size?: number
  className?: string
  /** When true, skip outer rounded navy plate (for use inside .brand-mark). */
  markOnly?: boolean
}

/** Shrija hallmark seal — assay balance, fire, and the Shrija monogram. */
export function BrandLogo({ size = 40, className, markOnly = false }: BrandLogoProps) {
  return (
    <img
      src="/logo.svg"
      alt={markOnly ? '' : 'Shrija Hallmark Suite'}
      width={size}
      height={size}
      className={className}
      draggable={false}
      aria-hidden={markOnly || undefined}
    />
  )
}
