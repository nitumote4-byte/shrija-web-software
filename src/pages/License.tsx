import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { KeyRound, ShieldCheck } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { useToast } from '../components/ui'
import { getSession } from '../data/auth'
import { activateLicenseKey, fetchLicenseStatus, formatExpiry, type LicenseStatus } from '../data/license'

export function LicensePage() {
  const { toast, Toast } = useToast()
  const session = getSession()
  const [license, setLicense] = useState<LicenseStatus | null>(null)
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    try {
      const s = await fetchLicenseStatus()
      setLicense(s)
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load licence')
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const activate = async (e: React.FormEvent) => {
    e.preventDefault()
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

  const expired = license && !license.ok

  return (
    <div className="license-page">
      <PageHeader
        title="Licence"
        subtitle="Activate and renew your Shrija Hallmark Suite licence for this centre."
      />

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
              <strong>{license.ok ? 'Active' : license.code || 'Blocked'}</strong>
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
        ) : (
          <p>Loading…</p>
        )}
        {license?.licenseKey && (
          <p className="auto-manak-hint" style={{ marginTop: '0.75rem' }}>
            Active key: <code>{license.licenseKey}</code>
          </p>
        )}
      </div>

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
      {Toast}
    </div>
  )
}
