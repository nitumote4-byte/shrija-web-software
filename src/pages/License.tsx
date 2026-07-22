import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { KeyRound, ShieldCheck } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { useToast } from '../components/ui'
import { getSession } from '../data/auth'
import {
  activateLicenseKey,
  fetchLicenseStatus,
  formatExpiry,
  issueLicenseKeys,
  listIssuedKeys,
  type LicenseStatus,
} from '../data/license'

export function LicensePage() {
  const { toast, Toast } = useToast()
  const session = getSession()
  const [license, setLicense] = useState<LicenseStatus | null>(null)
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const [masterSecret, setMasterSecret] = useState('')
  const [issuePlan, setIssuePlan] = useState<'trial' | 'standard' | 'pro'>('standard')
  const [issueDays, setIssueDays] = useState(365)
  const [issueCount, setIssueCount] = useState(1)
  const [issued, setIssued] = useState<string[]>([])
  const [issuedList, setIssuedList] = useState<
    Array<{ code: string; plan: string; usedByTenantId: string | null; durationDays: number }>
  >([])

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

  const issue = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const res = await issueLicenseKeys({
        masterSecret,
        plan: issuePlan,
        durationDays: issueDays,
        count: issueCount,
        note: `Issued by ${session?.username || 'operator'}`,
      })
      setIssued(res.keys)
      toast(`Issued ${res.keys.length} key(s)`)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Issue failed')
    } finally {
      setBusy(false)
    }
  }

  const loadIssued = async () => {
    try {
      const res = await listIssuedKeys(masterSecret)
      setIssuedList(
        res.keys.map((k) => ({
          code: k.code,
          plan: k.plan,
          usedByTenantId: k.usedByTenantId,
          durationDays: k.durationDays,
        })),
      )
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Cannot list keys')
    }
  }

  const expired = license && !license.ok

  return (
    <>
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
        {error && <p className="login-error">{error}</p>}
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

      <div className="panel">
        <h2>Issue keys (platform operator)</h2>
        <p className="auto-manak-hint">
          Requires <code>LICENSE_MASTER_SECRET</code> from Railway env. Generate keys to share with
          centres.
        </p>
        <form className="form-grid" onSubmit={issue}>
          <div className="field">
            <label>Master secret</label>
            <input
              type="password"
              value={masterSecret}
              onChange={(e) => setMasterSecret(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>Plan</label>
            <select
              value={issuePlan}
              onChange={(e) => setIssuePlan(e.target.value as 'trial' | 'standard' | 'pro')}
            >
              <option value="trial">Trial</option>
              <option value="standard">Standard</option>
              <option value="pro">Pro</option>
            </select>
          </div>
          <div className="field">
            <label>Duration (days)</label>
            <input
              type="number"
              min={1}
              max={3650}
              value={issueDays}
              onChange={(e) => setIssueDays(Number(e.target.value) || 365)}
            />
          </div>
          <div className="field">
            <label>Count</label>
            <input
              type="number"
              min={1}
              max={50}
              value={issueCount}
              onChange={(e) => setIssueCount(Number(e.target.value) || 1)}
            />
          </div>
          <div className="auto-manak-actions">
            <button type="submit" className="btn btn-gold" disabled={busy}>
              Issue keys
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => void loadIssued()}>
              List issued
            </button>
          </div>
        </form>
        {issued.length > 0 && (
          <div className="table-wrap" style={{ marginTop: '1rem' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>New key</th>
                </tr>
              </thead>
              <tbody>
                {issued.map((k) => (
                  <tr key={k}>
                    <td>
                      <code>{k}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {issuedList.length > 0 && (
          <div className="table-wrap" style={{ marginTop: '1rem' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Plan</th>
                  <th>Days</th>
                  <th>Used</th>
                </tr>
              </thead>
              <tbody>
                {issuedList.map((k) => (
                  <tr key={k.code}>
                    <td>
                      <code>{k.code}</code>
                    </td>
                    <td>{k.plan}</td>
                    <td>{k.durationDays}</td>
                    <td>{k.usedByTenantId ? 'Yes' : 'Unused'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {Toast}
    </>
  )
}
