import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, KeyRound, ShieldCheck } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { useToast } from '../components/ui'
import { getSession } from '../data/auth'
import {
  activateAdminTenant,
  activateLicenseKey,
  fetchLicenseStatus,
  formatExpiry,
  issueLicenseKeys,
  listAdminTenants,
  listIssuedKeys,
  suspendAdminTenant,
  type AdminTenantRow,
  type LicenseStatus,
} from '../data/license'

const SUSPEND_CONFIRM =
  'Suspending this centre will immediately prevent its users from logging in and accessing the software. Existing data will not be deleted.'

const REACTIVATE_CONFIRM =
  'Reactivating this centre will restore login and software access for its users (subject to a valid licence). Continue?'

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
  const [adminTenants, setAdminTenants] = useState<AdminTenantRow[]>([])
  const [centresBusy, setCentresBusy] = useState(false)

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

  const loadAdminCentres = async () => {
    if (!masterSecret.trim()) {
      toast('Enter the master secret first')
      return
    }
    setCentresBusy(true)
    try {
      const res = await listAdminTenants(masterSecret)
      setAdminTenants(res.tenants)
      toast(`Loaded ${res.tenants.length} centre(s)`)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Cannot list centres')
    } finally {
      setCentresBusy(false)
    }
  }

  const suspendCentre = async (row: AdminTenantRow) => {
    if (!masterSecret.trim()) {
      toast('Enter the master secret first')
      return
    }
    if (!window.confirm(SUSPEND_CONFIRM)) return
    setCentresBusy(true)
    try {
      const res = await suspendAdminTenant(row.id, masterSecret)
      toast(res.message || `Suspended ${row.firmName}`)
      const refreshed = await listAdminTenants(masterSecret)
      setAdminTenants(refreshed.tenants)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Suspend failed')
    } finally {
      setCentresBusy(false)
    }
  }

  const reactivateCentre = async (row: AdminTenantRow) => {
    if (!masterSecret.trim()) {
      toast('Enter the master secret first')
      return
    }
    if (!window.confirm(REACTIVATE_CONFIRM)) return
    setCentresBusy(true)
    try {
      const res = await activateAdminTenant(row.id, masterSecret)
      toast(res.message || `Reactivated ${row.firmName}`)
      const refreshed = await listAdminTenants(masterSecret)
      setAdminTenants(refreshed.tenants)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Reactivate failed')
    } finally {
      setCentresBusy(false)
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

      <div className="panel">
        <h2>
          <Building2 size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />
          Registered centres (platform operator)
        </h2>
        <p className="auto-manak-hint">
          Suspend or reactivate a Hallmark Centre using the same{' '}
          <code>LICENSE_MASTER_SECRET</code> as key issuance. Suspension only sets{' '}
          <code>tenants.status</code> — data and users are kept. Normal centre admins cannot use
          this.
        </p>
        <div className="form-grid">
          <div className="field">
            <label>Master secret (same as Railway LICENSE_MASTER_SECRET)</label>
            <input
              type="password"
              value={masterSecret}
              onChange={(e) => setMasterSecret(e.target.value)}
              placeholder="Paste the value you set on Railway"
              autoComplete="off"
            />
          </div>
          <div className="auto-manak-actions">
            <button
              type="button"
              className="btn btn-navy"
              disabled={centresBusy || !masterSecret.trim()}
              onClick={() => void loadAdminCentres()}
            >
              {centresBusy ? 'Loading…' : 'Load registered centres'}
            </button>
          </div>
        </div>
        {adminTenants.length > 0 && (
          <div className="table-wrap" style={{ marginTop: '1rem' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Centre</th>
                  <th>Tenant ID</th>
                  <th>Status</th>
                  <th>Plan</th>
                  <th>Expires</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {adminTenants.map((row) => {
                  const suspended = row.status !== 'active'
                  return (
                    <tr key={row.id}>
                      <td>
                        <strong>{row.firmName}</strong>
                      </td>
                      <td>
                        <code style={{ fontSize: '0.75rem' }}>{row.id}</code>
                      </td>
                      <td>{suspended ? 'Suspended' : 'Active'}</td>
                      <td>{row.plan || '—'}</td>
                      <td>{formatExpiry(row.licenseExpiresAt)}</td>
                      <td>
                        {suspended ? (
                          <button
                            type="button"
                            className="btn btn-gold"
                            disabled={centresBusy}
                            onClick={() => void reactivateCentre(row)}
                          >
                            Reactivate
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-ghost"
                            disabled={centresBusy}
                            onClick={() => void suspendCentre(row)}
                          >
                            Suspend Access
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel">
        <h2>Issue keys (platform operator)</h2>
        <p className="auto-manak-hint">
          This is <strong>not</strong> auto-filled from Railway. In Railway → your API service →{' '}
          <strong>Variables</strong>, create <code>LICENSE_MASTER_SECRET</code> with any strong
          password you choose (e.g. a long random string). Then type <em>that same value</em> here to
          issue keys. If you never set it, use your <code>JWT_SECRET</code> value instead (fallback).
        </p>
        <form className="form-grid" onSubmit={issue}>
          <div className="field">
            <label>Master secret (same as Railway LICENSE_MASTER_SECRET)</label>
            <input
              type="password"
              value={masterSecret}
              onChange={(e) => setMasterSecret(e.target.value)}
              placeholder="Paste the value you set on Railway"
              required
              autoComplete="off"
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
