import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, KeyRound, Shield } from 'lucide-react'
import { BrandLogo } from '../components/BrandLogo'
import { RegisteredCentresPanel } from '../components/RegisteredCentresPanel'
import { useToast } from '../components/ui'
import { issueLicenseKeys, listIssuedKeys } from '../data/license'
import { createTenant } from '../data/tenant'
import { PRODUCT_NAME } from '../data/modules'
import { MIN_PASSWORD_LENGTH, passwordPolicyError } from '../utils/passwordPolicy'

export function PlatformOperator() {
  const { toast, Toast } = useToast()
  const [masterSecret, setMasterSecret] = useState('')
  const [busy, setBusy] = useState(false)

  const [firmName, setFirmName] = useState('')
  const [gstin, setGstin] = useState('')
  const [adminUser, setAdminUser] = useState('qm_admin')
  const [adminPass, setAdminPass] = useState('')

  const [issuePlan, setIssuePlan] = useState<'trial' | 'standard' | 'pro'>('standard')
  const [issueDays, setIssueDays] = useState(365)
  const [issueCount, setIssueCount] = useState(1)
  const [issued, setIssued] = useState<string[]>([])
  const [issuedList, setIssuedList] = useState<
    Array<{ code: string; plan: string; usedByTenantId: string | null; durationDays: number }>
  >([])

  const registerCentre = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!masterSecret.trim()) {
      toast('Enter the master secret first')
      return
    }
    const passErr = passwordPolicyError(adminPass, adminUser)
    if (passErr) {
      toast(passErr)
      return
    }
    setBusy(true)
    try {
      const result = await createTenant({
        masterSecret,
        firmName,
        gstin,
        adminUsername: adminUser,
        adminPassword: adminPass,
      })
      if (!result.ok) {
        toast(result.error)
        return
      }
      toast(`Registered ${result.tenant.firmName}`)
      setFirmName('')
      setGstin('')
      setAdminPass('')
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
        note: 'Issued by platform operator',
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

  return (
    <div className="operator-page">
      <header className="operator-top">
        <div className="operator-brand">
          <BrandLogo markOnly size={28} />
          <div>
            <p className="login-eyebrow">{PRODUCT_NAME}</p>
            <h1>Platform Operator</h1>
          </div>
        </div>
        <Link to="/login" className="btn btn-ghost">
          Centre login
        </Link>
      </header>

      <p className="operator-lead">
        <Shield size={16} aria-hidden /> Authorized operators only. Every action is verified with{' '}
        <code>LICENSE_MASTER_SECRET</code>. Centre data is never deleted by Suspend.
      </p>

      <div className="panel">
        <h2>Operator authorization</h2>
        <p className="auto-manak-hint">
          Paste the Railway <code>LICENSE_MASTER_SECRET</code>. Production no longer falls back to{' '}
          <code>JWT_SECRET</code>. This value is not stored in the application.
        </p>
        <div className="field">
          <label htmlFor="operator-secret">Master secret</label>
          <input
            id="operator-secret"
            type="password"
            value={masterSecret}
            onChange={(e) => setMasterSecret(e.target.value)}
            placeholder="Paste the value you set on Railway"
            autoComplete="off"
          />
        </div>
      </div>

      <div className="panel">
        <h2>
          <Building2 size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />
          Register Centre
        </h2>
        <p className="auto-manak-hint">
          Creates a new isolated Hallmark Centre. Admin username must be unique across all centres
          — users sign in with username and password only (no centre picker).
        </p>
        <form className="form-grid" onSubmit={(e) => void registerCentre(e)}>
          <div className="field">
            <label htmlFor="op-firm">Centre / firm name</label>
            <input
              id="op-firm"
              value={firmName}
              onChange={(e) => setFirmName(e.target.value)}
              required
              placeholder="e.g. Shrija Hallmarking Centre B"
            />
          </div>
          <div className="field">
            <label htmlFor="op-gstin">GSTIN (optional)</label>
            <input
              id="op-gstin"
              value={gstin}
              onChange={(e) => setGstin(e.target.value)}
              placeholder="22AAAAA0000A1Z5"
            />
          </div>
          <div className="field">
            <label htmlFor="op-user">Admin username (unique across centres)</label>
            <input
              id="op-user"
              value={adminUser}
              onChange={(e) => setAdminUser(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="op-pass">Admin password</label>
            <input
              id="op-pass"
              type="password"
              value={adminPass}
              onChange={(e) => setAdminPass(e.target.value)}
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
            />
          </div>
          <div className="auto-manak-actions">
            <button type="submit" className="btn btn-navy" disabled={busy || !masterSecret.trim()}>
              {busy ? 'Creating…' : 'Create centre'}
            </button>
          </div>
        </form>
      </div>

      <RegisteredCentresPanel
        masterSecret={masterSecret}
        onMasterSecretChange={setMasterSecret}
        toast={toast}
      />

      <div className="panel">
        <h2>
          <KeyRound size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />
          Issue licence keys
        </h2>
        <p className="auto-manak-hint">
          Issue Trial, Standard, or Pro keys. Activation is performed by the centre admin on the
          centre Licence page.
        </p>
        <form className="form-grid" onSubmit={(e) => void issue(e)}>
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
            <button type="submit" className="btn btn-gold" disabled={busy || !masterSecret.trim()}>
              Issue keys
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={!masterSecret.trim()}
              onClick={() => void loadIssued()}
            >
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
    </div>
  )
}
