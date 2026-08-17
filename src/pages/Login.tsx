import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Eye,
  EyeOff,
  FlaskConical,
  Lock,
  Scale,
  User,
} from 'lucide-react'
import { isAuthenticated, login } from '../data/auth'
import { BrandLogo } from '../components/BrandLogo'
import { PRODUCT_NAME, PRODUCT_TAGLINE, PRODUCT_VERSION } from '../data/modules'
import { listTenants, type Tenant } from '../data/tenant'

export function Login() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [tenantId, setTenantId] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [bootError, setBootError] = useState('')
  const [forgotOpen, setForgotOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const list = await listTenants()
        if (cancelled) return
        const safe = Array.isArray(list) ? list : []
        setTenants(safe)
        if (safe[0]) setTenantId(safe[0].id)
      } catch (e) {
        if (!cancelled) {
          setTenants([])
          setBootError(
            e instanceof Error
              ? e.message
              : 'Cannot reach API — check Railway is online and Vercel /api proxy',
          )
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!forgotOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setForgotOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [forgotOpen])

  const selectedTenant = useMemo(
    () => tenants.find((t) => t.id === tenantId),
    [tenants, tenantId],
  )

  if (isAuthenticated()) {
    return <Navigate to="/" replace />
  }

  const submitLogin = async (e: React.FormEvent, asAdmin = false) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const result = await login(username, password, tenantId, asAdmin)
    setLoading(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    if (result.licenseExpired) {
      window.location.assign('/license')
      return
    }
    window.location.assign('/')
  }

  return (
    <div className="login-page">
      <aside className="login-brand">
        <div className="login-brand-inner">
          <p className="login-product">{PRODUCT_NAME}</p>
          <div className="login-logo" aria-hidden>
            <BrandLogo size={112} />
          </div>
          <h1>Hallmark Centre Login</h1>
          <p className="login-tagline">{PRODUCT_TAGLINE}</p>
          <ul className="login-pillars">
            <li>
              <Scale size={16} /> Hallmarking workflow
            </li>
            <li>
              <FlaskConical size={16} /> Assay &amp; lab stock
            </li>
            <li>
              <BadgeCheck size={16} /> Billing &amp; reports
            </li>
            <li>
              <Lock size={16} /> Secure centre access
            </li>
          </ul>
        </div>
      </aside>

      <main className="login-form-side">
        <div className="login-form-card">
          <p className="login-eyebrow">{PRODUCT_NAME}</p>
          <h2>Sign in</h2>
          <p className="login-sub">Select your Hallmark Centre, then enter your credentials.</p>

          {(bootError || error) && (
            <p className="login-error" role="alert">
              {bootError || error}
            </p>
          )}

          <form onSubmit={(e) => void submitLogin(e, false)}>
            <div className="login-field">
              <label htmlFor="login-centre">Centre</label>
              <div className="login-input">
                <Building2 size={16} aria-hidden />
                <select
                  id="login-centre"
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  required
                  disabled={!tenants.length}
                >
                  {!tenants.length && <option value="">No centres available</option>}
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.firmName}
                    </option>
                  ))}
                </select>
              </div>
              {selectedTenant && (
                <p className="login-tenant-meta">Signing into {selectedTenant.firmName}</p>
              )}
            </div>

            <div className="login-field">
              <label htmlFor="login-user">Username</label>
              <div className="login-input">
                <User size={16} aria-hidden />
                <input
                  id="login-user"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                  placeholder="Enter username"
                />
              </div>
            </div>

            <div className="login-field">
              <label htmlFor="login-pass">Password</label>
              <div className="login-input">
                <Lock size={16} aria-hidden />
                <input
                  id="login-pass"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  placeholder="Enter password"
                />
                <button
                  type="button"
                  className="login-visibility"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="login-row-actions">
              <button
                type="button"
                className="login-forgot"
                onClick={() => setForgotOpen(true)}
              >
                Forgot Password
              </button>
            </div>

            <button
              type="submit"
              className="login-btn"
              disabled={loading || !tenantId}
              aria-busy={loading}
            >
              {loading ? 'Signing in…' : 'Login'}
              <ArrowRight size={16} aria-hidden />
            </button>
          </form>

          <button
            type="button"
            className="login-admin-link"
            disabled={loading || !tenantId}
            onClick={(e) => void submitLogin(e as unknown as React.FormEvent, true)}
          >
            Centre admin? <strong>Admin sign-in</strong>
          </button>

          <p className="login-hint">
            {PRODUCT_NAME} · v{PRODUCT_VERSION}
            <span className="login-hint-sep"> · </span>
            <Link to="/operator" className="login-operator-link">
              Platform operator
            </Link>
          </p>
        </div>
      </main>

      {forgotOpen && (
        <div
          className="party-edit-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="forgot-title"
        >
          <div className="panel party-edit-modal login-forgot-modal">
            <h2 id="forgot-title">Forgot Password</h2>
            <p className="auto-manak-hint">
              Password reset by email is not available in this system. Contact your centre
              administrator or Shrija support to restore access. For security, we cannot confirm
              whether a username exists.
            </p>
            <div className="auto-manak-actions">
              <button type="button" className="btn btn-navy" onClick={() => setForgotOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
