import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, Lock } from 'lucide-react'
import { BrandLogo } from '../components/BrandLogo'
import { confirmPasswordReset } from '../data/auth'
import { PRODUCT_NAME, PRODUCT_TAGLINE } from '../data/modules'

export function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const tenantId = params.get('tenant') || ''
  const linkValid = token.length >= 16 && Boolean(tenantId)

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const missingLink = useMemo(() => !linkValid, [linkValid])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!linkValid) {
      setError('Invalid or expired password reset link.')
      return
    }
    if (password.length < 4) {
      setError('New password must be at least 4 characters.')
      return
    }
    if (password !== confirm) {
      setError('New password and confirmation do not match.')
      return
    }
    setLoading(true)
    try {
      await confirmPasswordReset(token, tenantId, password)
      window.location.assign('/login?reset=success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid or expired password reset link.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <aside className="login-brand">
        <div className="login-brand-inner">
          <p className="login-product">{PRODUCT_NAME}</p>
          <div className="login-logo" aria-hidden>
            <BrandLogo size={112} />
          </div>
          <h1>Reset password</h1>
          <p className="login-tagline">{PRODUCT_TAGLINE}</p>
        </div>
      </aside>

      <main className="login-form-side">
        <div className="login-form-card">
          <p className="login-eyebrow">{PRODUCT_NAME}</p>
          <h2>Set a new password</h2>
          <p className="login-sub">Choose a new password for this Hallmark Centre account.</p>

          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}

          {missingLink ? (
            <p className="auto-manak-hint">
              This reset link is missing or incomplete. Request a new link from the sign-in page.
            </p>
          ) : (
            <form onSubmit={(e) => void submit(e)}>
              <div className="login-field">
                <label htmlFor="reset-pass">New password</label>
                <div className="login-input">
                  <Lock size={16} aria-hidden />
                  <input
                    id="reset-pass"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                    minLength={4}
                    placeholder="Enter new password"
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

              <div className="login-field">
                <label htmlFor="reset-confirm">Confirm password</label>
                <div className="login-input">
                  <Lock size={16} aria-hidden />
                  <input
                    id="reset-confirm"
                    type={showPassword ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                    required
                    minLength={4}
                    placeholder="Re-enter new password"
                  />
                </div>
              </div>

              <button type="submit" className="login-btn" disabled={loading} aria-busy={loading}>
                {loading ? 'Updating…' : 'Reset Password'}
                <ArrowRight size={16} aria-hidden />
              </button>
            </form>
          )}

          <p className="login-hint">
            <Link to="/login" className="login-forgot">
              Back to sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
