/** Minimal geometric mark — accent blue, SaaS-style. */
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
      <rect width="40" height="40" rx="8" fill="#2563EB" />
      <path
        d="M12 26V14h7.2c3.1 0 5.1 1.7 5.1 4.2 0 1.7-.9 3.1-2.5 3.8L25.2 26h-3.3l-2.9-3.7H15.2V26H12zm3.2-6.2h3.7c1.45 0 2.35-.75 2.35-1.9s-.9-1.85-2.35-1.85H15.2v3.75z"
        fill="#fff"
      />
    </svg>
  )
}
