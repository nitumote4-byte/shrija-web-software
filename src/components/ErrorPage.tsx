import { BrandLogo } from './BrandLogo'
import {
  getActionLabel,
  getHttpErrorConfig,
  resolveHttpErrorStatus,
  type HttpErrorActionId,
  type HttpErrorStatus,
} from '../errors/httpErrorConfig'
import { PRODUCT_NAME } from '../data/modules'

export type ErrorPageProps = {
  /** HTTP status to display. Unknown values fall back to 500. */
  status: number
  /** Optional override for the explanation (must already be user-safe). */
  description?: string
  /** When true, hide secondary action. */
  hideSecondary?: boolean
  /** Extra class on the root element. */
  className?: string
}

function runAction(action: HttpErrorActionId) {
  switch (action) {
    case 'dashboard':
      window.location.assign('/')
      return
    case 'login':
      window.location.assign('/login')
      return
    case 'back':
      if (window.history.length > 1) {
        window.history.back()
      } else {
        window.location.assign('/')
      }
      return
    case 'retry':
    case 'reload':
      window.location.reload()
      return
    default:
      window.location.assign('/')
  }
}

/**
 * Centralized branded error screen for HTTP / render failures.
 * Does not change auth, RBAC, or domain logic — presentation only.
 */
export function ErrorPage({
  status,
  description,
  hideSecondary = false,
  className,
}: ErrorPageProps) {
  const resolved: HttpErrorStatus = resolveHttpErrorStatus(status)
  const config = getHttpErrorConfig(resolved)
  const Icon = config.icon
  const explanation = description || config.description
  const secondary = hideSecondary ? undefined : config.secondaryAction

  return (
    <div
      className={['error-screen', className].filter(Boolean).join(' ')}
      role="alert"
      aria-labelledby="error-screen-title"
      aria-describedby="error-screen-desc"
      data-error-status={resolved}
      data-requested-status={status}
    >
      <div className="error-screen-card">
        <div className="error-screen-brand">
          <div className="error-screen-logo" aria-hidden>
            <BrandLogo size={56} />
          </div>
          <p className="error-screen-product">{PRODUCT_NAME}</p>
        </div>

        <p className="error-screen-code" aria-hidden>
          {resolved}
        </p>
        <span className="sr-only">HTTP status {resolved}</span>

        <div className="error-screen-icon" aria-hidden>
          <Icon size={40} strokeWidth={1.75} />
        </div>

        <h1 id="error-screen-title" className="error-screen-title">
          {config.title}
        </h1>
        <p id="error-screen-desc" className="error-screen-desc">
          {explanation}
        </p>

        <div className="error-screen-actions">
          <button
            type="button"
            className="btn-primary error-screen-btn"
            onClick={() => runAction(config.primaryAction)}
            aria-label={getActionLabel(config.primaryAction)}
          >
            {getActionLabel(config.primaryAction)}
          </button>
          {secondary ? (
            <button
              type="button"
              className="btn-gold error-screen-btn error-screen-btn-secondary"
              onClick={() => runAction(secondary)}
              aria-label={getActionLabel(secondary)}
            >
              {getActionLabel(secondary)}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/** Convenience wrappers for named routes / tests. */
export function BadRequestPage() {
  return <ErrorPage status={400} />
}
export function UnauthorizedPage() {
  return <ErrorPage status={401} />
}
export function ForbiddenPage() {
  return <ErrorPage status={403} />
}
export function NotFoundPage() {
  return <ErrorPage status={404} />
}
export function ConflictPage() {
  return <ErrorPage status={409} />
}
export function TooManyRequestsPage() {
  return <ErrorPage status={429} />
}
export function InternalServerErrorPage() {
  return <ErrorPage status={500} />
}
export function BadGatewayPage() {
  return <ErrorPage status={502} />
}
export function ServiceUnavailablePage() {
  return <ErrorPage status={503} />
}
export function GatewayTimeoutPage() {
  return <ErrorPage status={504} />
}
