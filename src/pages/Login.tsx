import { useEffect, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  BadgeCheck,
  Eye,
  EyeOff,
  FlaskConical,
  Lock,
  Scale,
  User,
} from 'lucide-react'
import { isAuthenticated, login, requestPasswordReset } from '../data/auth'
import { BrandLogo } from '../components/BrandLogo'
import { PRODUCT_NAME, PRODUCT_TAGLINE, PRODUCT_VERSION } from '../data/modules'

export function Login() {
  const [params] = useSearchParams()
  const resetSuccess = params.get('reset') === 'success'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [forgotOpen, setForgotOpen] = useState(false)
  const [forgotUsername, setForgotUsername] = useState('')
  const [forgotBusy, setForgotBusy] = useState(false)
  const [forgotError, setForgotError] = useState('')
  const [forgotDone, setForgotDone] = useState(false)

  useEffect(() => {
    if (!forgotOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setForgotOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [forgotOpen])

  const openForgot = () => {
    setForgotUsername(username)
    setForgotError('')
    setForgotDone(false)
    setForgotOpen(true)
  }

  const submitForgot = async (e: React.FormEvent) => {
    e.preventDefault()
    setForgotError('')
    setForgotDone(false)
    if (!forgotUsername.trim()) {
      setForgotError('Username is required')
      return
    }
    setForgotBusy(true)
    try {
      await requestPasswordReset(forgotUsername.trim())
      setForgotDone(true)
      setForgotError('')
    } catch (err) {
      setForgotError(
        err instanceof Error
          ? err.message
          : 'Password reset by email is not available. Contact your centre administrator.',
      )
    } finally {
      setForgotBusy(false)
    }
  }

  if (isAuthenticated()) {
    return <Navigate to="/" replace />
  }

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const result = await login(username, password)
    setLoading(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    if (result.session.mustChangePassword) {
      window.location.assign('/change-password')
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
          <p className="login-sub">Enter your username and password.</p>

          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}
          {resetSuccess && !error && (
            <p className="login-success" role="status">
              Password has been reset. You can now sign in with your new password.
            </p>
          )}

          <form onSubmit={(e) => void submitLogin(e)}>
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
              <button type="button" className="login-forgot" onClick={openForgot}>
                Forgot Password
              </button>
            </div>

            <button type="submit" className="login-btn" disabled={loading} aria-busy={loading}>
              {loading ? 'Signing in…' : 'Login'}
              <ArrowRight size={16} aria-hidden />
            </button>
          </form>

          <p className="login-hint">
            {PRODUCT_NAME} · v{PRODUCT_VERSION}
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
            {forgotDone ? (
              <p className="auto-manak-hint" role="status">
                If the account exists, password reset instructions have been sent.
              </p>
            ) : (
              <>
                <p className="auto-manak-hint">
                  Enter your username. If the account exists, password reset instructions will be
                  sent to the email on file for your centre.
                </p>
                {forgotError && (
                  <p className="login-error" role="alert">
                    {forgotError}
                  </p>
                )}
                <form className="login-forgot-form" onSubmit={(e) => void submitForgot(e)}>
                  <div className="login-field">
                    <label htmlFor="forgot-user">Username</label>
                    <div className="login-input">
                      <User size={16} aria-hidden />
                      <input
                        id="forgot-user"
                        value={forgotUsername}
                        onChange={(e) => setForgotUsername(e.target.value)}
                        autoComplete="username"
                        required
                        placeholder="Enter username"
                        disabled={forgotBusy}
                      />
                    </div>
                  </div>
                  <p className="auto-manak-hint login-forgot-secure">
                    For security, we cannot confirm whether a username exists.
                  </p>
                  <div className="auto-manak-actions">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setForgotOpen(false)}
                      disabled={forgotBusy}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-navy"
                      disabled={forgotBusy}
                      aria-busy={forgotBusy}
                    >
                      {forgotBusy ? 'Please wait…' : 'Send Reset Link'}
                    </button>
                  </div>
                </form>
              </>
            )}
            {forgotDone && (
              <div className="auto-manak-actions">
                <button type="button" className="btn btn-navy" onClick={() => setForgotOpen(false)}>
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
