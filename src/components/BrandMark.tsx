/** Refined navy + bronze mark — not a gold circular badge. */
export function BrandMark({
  size = 40,
  className,
  title = 'Shrija',
}: {
  size?: number
  className?: string
  title?: string
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
    >
      <rect width="40" height="40" rx="3" fill="#0F2942" />
      <rect x="1.25" y="1.25" width="37.5" height="37.5" rx="2.25" stroke="#A8815C" strokeWidth="1" opacity="0.55" />
      {/* Hallmark bars — quiet vertical rhythm */}
      <path d="M11 12.5h18" stroke="#A8815C" strokeWidth="1.35" strokeLinecap="square" />
      <path d="M13 20h14" stroke="#EDE8E0" strokeWidth="1.1" strokeLinecap="square" opacity="0.85" />
      <path d="M15 27.5h10" stroke="#A8815C" strokeWidth="1.35" strokeLinecap="square" />
      {/* Small bronze diamond accent */}
      <path d="M20 15.2l1.35 1.35L20 17.9l-1.35-1.35L20 15.2z" fill="#A8815C" />
    </svg>
  )
}
