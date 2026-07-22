import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  FlaskConical,
  Lock,
  Scale,
  Shield,
  User,
} from 'lucide-react'
import { isAuthenticated, login } from '../data/auth'
import { setAuth } from '../api/client'
import { hydrateTenantData } from '../data/tenantCache'
import { PRODUCT_NAME, PRODUCT_TAGLINE, PRODUCT_VERSION } from '../data/modules'
import { createTenant, listTenants, type Tenant } from '../data/tenant'

export function Login() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [tenantId, setTenantId] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [bootError, setBootError] = useState('')

  const [firmName, setFirmName] = useState('')
  const [gstin, setGstin] = useState('')
  const [adminUser, setAdminUser] = useState('qm_admin')
  const [adminPass, setAdminPass] = useState('')

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

  const submitSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const result = await createTenant({
      firmName,
      gstin,
      adminUsername: adminUser,
      adminPassword: adminPass,
    })
    if (!result.ok) {
      setLoading(false)
      setError(result.error)
      return
    }
    setAuth(result.token, result.session)
    try {
      await hydrateTenantData()
      window.location.assign('/')
    } catch (err) {
      setLoading(false)
      setError(err instanceof Error ? err.message : 'Centre created but hydrate failed')
    }
  }

  return (
    <div className="login-page">
      <aside className="login-brand">
        <div className="login-brand-inner">
          <p className="login-product">{PRODUCT_NAME}</p>
          <div className="login-logo" aria-hidden>
            <svg viewBox="0 0 120 120" width="108" height="108">
              <circle cx="60" cy="60" r="56" fill="#c9a227" opacity="0.2" />
              <circle cx="60" cy="60" r="48" fill="none" stroke="#c9a227" strokeWidth="3" />
              <path
                d="M28 62c8-18 22-28 36-28 18 0 30 12 34 28-6 4-14 8-22 8-4 0-8-1-12-3-6 8-16 14-28 14-4 0-6-1-8-2z"
                fill="#c9a227"
              />
              <circle cx="48" cy="52" r="3" fill="#1a1208" />
              <path d="M72 70c6 2 14 2 22-2" stroke="#1a1208" strokeWidth="2" fill="none" />
            </svg>
          </div>
          <h1>Multi-centre</h1>
          <p className="login-tagline">{PRODUCT_TAGLINE}</p>
          <p className="login-tenant-note">
            Each centre is isolated in PostgreSQL with server-side tenant_id enforcement.
          </p>
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
              <Shield size={16} /> JWT + tenant-bound API
            </li>
          </ul>
        </div>
      </aside>

      <main className="login-form-side">
        <div className="login-form-card">
          <p className="login-eyebrow">{PRODUCT_NAME}</p>
          <h2>{mode === 'login' ? 'Sign in' : 'Register centre'}</h2>
          <p className="login-sub">
            {mode === 'login'
              ? 'Select your centre, then enter credentials.'
              : 'Create a new hallmarking centre with its own isolated data.'}
          </p>

          <div className="login-mode-tabs">
            <button
              type="button"
              className={mode === 'login' ? 'active' : ''}
              onClick={() => {
                setMode('login')
                setError('')
              }}
            >
              Sign in
            </button>
            <button
              type="button"
              className={mode === 'signup' ? 'active' : ''}
              onClick={() => {
                setMode('signup')
                setError('')
              }}
            >
              Register centre
            </button>
          </div>

          {(bootError || error) && <p className="login-error">{bootError || error}</p>}

          {mode === 'login' ? (
            <>
              <form onSubmit={(e) => void submitLogin(e, false)}>
                <div className="login-field">
                  <label htmlFor="login-centre">Centre</label>
                  <div className="login-input">
                    <Building2 size={16} />
                    <select
                      id="login-centre"
                      value={tenantId}
                      onChange={(e) => setTenantId(e.target.value)}
                      required
                      disabled={!tenants.length}
                    >
                      {!tenants.length && (
                        <option value="">No centres yet — register one</option>
                      )}
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
                    <User size={16} />
                    <input
                      id="login-user"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      autoComplete="username"
                      required
                      placeholder="qm_admin"
                    />
                  </div>
                </div>

                <div className="login-field">
                  <label htmlFor="login-pass">Password</label>
                  <div className="login-input">
                    <Lock size={16} />
                    <input
                      id="login-pass"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <button type="submit" className="login-btn" disabled={loading || !tenantId}>
                  {loading ? 'Signing in…' : 'Sign in'}
                  <ArrowRight size={16} />
                </button>
              </form>

              <button
                type="button"
                className="login-admin-link"
                disabled={loading || !tenantId}
                onClick={(e) => void submitLogin(e as unknown as React.FormEvent, true)}
              >
                Prefer admin access? <strong>Admin sign-in</strong>
              </button>
            </>
          ) : (
            <form onSubmit={(e) => void submitSignup(e)}>
              <div className="login-field">
                <label htmlFor="reg-firm">Centre / firm name</label>
                <div className="login-input">
                  <Building2 size={16} />
                  <input
                    id="reg-firm"
                    value={firmName}
                    onChange={(e) => setFirmName(e.target.value)}
                    required
                    placeholder="e.g. Shrija Hallmarking Centre B"
                  />
                </div>
              </div>

              <div className="login-field">
                <label htmlFor="reg-gstin">GSTIN (optional)</label>
                <div className="login-input">
                  <input
                    id="reg-gstin"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value)}
                    placeholder="22AAAAA0000A1Z5"
                  />
                </div>
              </div>

              <div className="login-field">
                <label htmlFor="reg-user">Admin username</label>
                <div className="login-input">
                  <User size={16} />
                  <input
                    id="reg-user"
                    value={adminUser}
                    onChange={(e) => setAdminUser(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="login-field">
                <label htmlFor="reg-pass">Admin password</label>
                <div className="login-input">
                  <Lock size={16} />
                  <input
                    id="reg-pass"
                    type="password"
                    value={adminPass}
                    onChange={(e) => setAdminPass(e.target.value)}
                    required
                    minLength={4}
                  />
                </div>
              </div>

              <button type="submit" className="login-btn" disabled={loading}>
                {loading ? 'Creating…' : 'Create centre'}
                <ArrowRight size={16} />
              </button>
            </form>
          )}

          <p className="login-hint">
            {PRODUCT_NAME} · v{PRODUCT_VERSION}
          </p>
        </div>
      </main>
    </div>
  )
}
