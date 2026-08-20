import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { KeyRound, ShieldCheck } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { useToast } from '../components/ui'
import { ApiRequestError } from '../api/client'
import { clearSession, getSession } from '../data/auth'
import {
  activateLicenseKey,
  fetchLicenseStatus,
  formatExpiry,
  getCachedLicense,
  type LicenseStatus,
} from '../data/license'

function suspendedStub(reason: string): LicenseStatus {
  return {
    ok: false,
    plan: 'unknown',
    status: 'suspended',
    licenseKey: null,
    expiresAt: null,
    activatedAt: null,
    maxUsers: 0,
    daysLeft: null,
    reason,
    code: 'SUSPENDED',
  }
}

export function LicensePage() {
  const { toast, Toast } = useToast()
  const session = getSession()
  const [license, setLicense] = useState<LicenseStatus | null>(() => getCachedLicense())
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    try {
      const s = await fetchLicenseStatus()
      setLicense(s)
      setError('')
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 401) {
        clearSession()
        window.location.assign('/login')
        return
      }
      if (e instanceof ApiRequestError && e.status === 403) {
        const body = e.body as { license?: LicenseStatus } | null
        if (body?.license) {
          setLicense(body.license)
          setError('')
          return
        }
        if (e.code === 'SUSPENDED') {
          setLicense(suspendedStub(e.message || 'This centre is suspended'))
          setError('')
          return
        }
        setError(e.message)
        return
      }
      setError(e instanceof Error ? e.message : 'Failed to load licence')
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const activate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (license?.code === 'SUSPENDED') {
      toast('This centre is suspended. Ask the platform operator to reactivate it.')
      return
    }
    if (!session?.isAdmin) {
      toast('Only centre admin can activate')
      return
    }
    setBusy(true)
    setError('')
    try {
      const s = await activateLicenseKey(key)
      setLicense(s)
      setKey('')
      toast(`Licence activated · ${s.plan} · ${formatExpiry(s.expiresAt)}`)
      window.setTimeout(() => window.location.assign('/'), 800)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Activation failed')
    } finally {
      setBusy(false)
    }
  }

  const suspended = license?.code === 'SUSPENDED'
  const expired = Boolean(license && !license.ok && !suspended)

  return (
    <div className="license-page">
      <PageHeader
        title="Licence"
        subtitle={
          suspended
            ? 'This Hallmark Centre has been suspended.'
            : 'Activate and renew your Shrija Hallmark Suite licence for this centre.'
        }
      />

      {suspended && (
        <div className="panel" style={{ borderColor: 'var(--danger, #b91c1c)', marginBottom: '1rem' }}>
          <h2>Centre Suspended</h2>
          <p className="auto-manak-hint">
            Access to this Hallmark Centre has been suspended. The centre administrator or platform
            operator must reactivate it before work can continue.
          </p>
        </div>
      )}

      {expired && (
        <div className="panel" style={{ borderColor: 'var(--danger, #b91c1c)', marginBottom: '1rem' }}>
          <h2>Licence expired</h2>
          <p className="auto-manak-hint">
            {license?.reason || 'Activate a valid licence key to continue using centre data.'}
          </p>
        </div>
      )}

      <div className="panel">
        <h2>
          <ShieldCheck size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />
          Current centre status
        </h2>
        {error && (
          <p className="login-error">
            {/<\/?[a-z][\s\S]*>/i.test(error)
              ? 'Licence API not reachable yet (Railway may still be redeploying). Wait 1–2 min and refresh.'
              : error}
          </p>
        )}
        {license ? (
          <div className="stats-row">
            <div className="stat-card">
              <span>Plan</span>
              <strong>{license.plan}</strong>
            </div>
            <div className="stat-card">
              <span>Status</span>
              <strong>
                {license.ok ? 'Active' : suspended ? 'Suspended' : license.code || 'Blocked'}
              </strong>
            </div>
            <div className="stat-card">
              <span>Expires</span>
              <strong>{formatExpiry(license.expiresAt)}</strong>
            </div>
            <div className="stat-card">
              <span>Days left</span>
              <strong>{license.daysLeft ?? '—'}</strong>
            </div>
            <div className="stat-card">
              <span>Max users</span>
              <strong>{license.maxUsers}</strong>
            </div>
          </div>
        ) : error ? null : (
          <p>Loading…</p>
        )}
        {license?.licenseKey && (
          <p className="auto-manak-hint" style={{ marginTop: '0.75rem' }}>
            Active key: <code>{license.licenseKey}</code>
          </p>
        )}
      </div>

      {!suspended && (
        <div className="panel">
          <h2>
            <KeyRound size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />
            Activate licence key
          </h2>
          <p className="auto-manak-hint">
            Paste the key provided by Shrija support. Extends from today (or from current expiry if still
            valid).
          </p>
          <form className="form-grid" onSubmit={activate}>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Licence key</label>
              <input
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="SHRIJA-XXXX-XXXX-XXXX-XXXX"
                required
                autoComplete="off"
              />
            </div>
            <div className="auto-manak-actions">
              <button type="submit" className="btn btn-navy" disabled={busy || !session?.isAdmin}>
                {busy ? 'Activating…' : 'Activate'}
              </button>
              <Link to="/" className="btn btn-back">
                Back
              </Link>
            </div>
          </form>
          {!session?.isAdmin && (
            <p className="auto-manak-hint">Ask your centre admin to activate the licence.</p>
          )}
        </div>
      )}
      {Toast}
    </div>
  )
}
