import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Building2, Loader2, RefreshCw, Search } from 'lucide-react'
import {
  activateAdminTenant,
  centreAccessBadge,
  formatExpiry,
  listAdminTenants,
  suspendAdminTenant,
  type AdminTenantRow,
  type CentreAccessBadge,
} from '../data/license'

const SUSPEND_CONFIRM =
  'Are you sure you want to suspend this centre? The centre will no longer be able to access the software, but all data will remain intact.'

const REACTIVATE_CONFIRM =
  'Reactivate this centre? The centre will regain normal software access subject to licence validity.'

type StatusFilter = 'all' | 'active' | 'suspended' | 'expired'
type ConfirmAction = { type: 'suspend' | 'reactivate'; row: AdminTenantRow }

type Props = {
  masterSecret: string
  onMasterSecretChange: (value: string) => void
  toast: (msg: string) => void
}

function badgeClass(badge: CentreAccessBadge) {
  if (badge === 'SUSPENDED') return 'badge badge-danger centres-badge'
  if (badge === 'EXPIRED') return 'badge badge-pending centres-badge'
  return 'badge badge-done centres-badge'
}

function formatCreated(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function licenceLabel(row: AdminTenantRow) {
  const badge = centreAccessBadge(row)
  if (badge === 'SUSPENDED') return 'Suspended'
  if (badge === 'EXPIRED') return 'Expired'
  if (!row.licenseExpiresAt) return 'Legacy / valid'
  if (row.daysLeft !== null && row.daysLeft <= 30) return `${row.daysLeft}d left`
  return 'Valid'
}

export function RegisteredCentresPanel({ masterSecret, onMasterSecretChange, toast }: Props) {
  const [tenants, setTenants] = useState<AdminTenantRow[]>([])
  const [loaded, setLoaded] = useState(false)
  const [listBusy, setListBusy] = useState(false)
  const [actionId, setActionId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null)
  const confirmTitleId = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!confirm) return
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !actionId) setConfirm(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirm, actionId])

  const stats = useMemo(() => {
    let active = 0
    let suspended = 0
    let expiringSoon = 0
    for (const row of tenants) {
      const badge = centreAccessBadge(row)
      if (badge === 'SUSPENDED') suspended += 1
      else if (badge === 'ACTIVE') active += 1
      if (
        row.status === 'active' &&
        row.daysLeft !== null &&
        row.daysLeft >= 0 &&
        row.daysLeft <= 30
      ) {
        expiringSoon += 1
      }
    }
    return { total: tenants.length, active, suspended, expiringSoon }
  }, [tenants])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return tenants.filter((row) => {
      const badge = centreAccessBadge(row)
      if (statusFilter === 'active' && badge !== 'ACTIVE') return false
      if (statusFilter === 'suspended' && badge !== 'SUSPENDED') return false
      if (statusFilter === 'expired' && badge !== 'EXPIRED') return false
      if (!q) return true
      const hay = [
        row.firmName,
        row.id,
        row.slug,
        row.adminUsername || '',
        row.adminEmail || '',
        row.plan || '',
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [tenants, search, statusFilter])

  const loadCentres = async () => {
    if (!masterSecret.trim()) {
      toast('Enter the master secret first')
      return
    }
    setListBusy(true)
    try {
      const res = await listAdminTenants(masterSecret)
      setTenants(res.tenants)
      setLoaded(true)
      toast(`Loaded ${res.tenants.length} centre(s)`)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Cannot list centres')
    } finally {
      setListBusy(false)
    }
  }

  const runConfirmed = async () => {
    if (!confirm || !masterSecret.trim()) return
    const { type, row } = confirm
    setActionId(row.id)
    try {
      const res =
        type === 'suspend'
          ? await suspendAdminTenant(row.id, masterSecret)
          : await activateAdminTenant(row.id, masterSecret)
      toast(res.message || (type === 'suspend' ? `Suspended ${row.firmName}` : `Reactivated ${row.firmName}`))
      const refreshed = await listAdminTenants(masterSecret)
      setTenants(refreshed.tenants)
      setLoaded(true)
      setConfirm(null)
    } catch (err) {
      toast(err instanceof Error ? err.message : type === 'suspend' ? 'Suspend failed' : 'Reactivate failed')
    } finally {
      setActionId(null)
    }
  }

  const busy = listBusy || Boolean(actionId)

  return (
    <section className="panel centres-admin-panel" data-accent="blue" aria-labelledby="centres-admin-title">
      <header className="centres-admin-head">
        <div>
          <h2 id="centres-admin-title">
            <Building2 size={18} aria-hidden style={{ verticalAlign: 'middle', marginRight: 8 }} />
            Registered Centres
          </h2>
          <p className="auto-manak-hint centres-admin-sub">
            Manage access to registered Hallmark Centres. Suspension only sets{' '}
            <code>tenants.status</code> — data and users are kept. Requires the same{' '}
            <code>LICENSE_MASTER_SECRET</code> as key issuance.
          </p>
        </div>
      </header>

      <div className="form-grid centres-admin-auth">
        <div className="field">
          <label htmlFor="centres-master-secret">Master secret (Railway LICENSE_MASTER_SECRET)</label>
          <input
            id="centres-master-secret"
            type="password"
            value={masterSecret}
            onChange={(e) => onMasterSecretChange(e.target.value)}
            placeholder="Paste the value you set on Railway"
            autoComplete="off"
          />
        </div>
        <div className="auto-manak-actions centres-admin-load">
          <button
            type="button"
            className="btn btn-navy"
            disabled={busy || !masterSecret.trim()}
            onClick={() => void loadCentres()}
            aria-busy={listBusy}
          >
            {listBusy ? (
              <>
                <Loader2 size={16} className="centres-spin" aria-hidden /> Loading…
              </>
            ) : (
              <>
                <RefreshCw size={16} aria-hidden /> Load registered centres
              </>
            )}
          </button>
        </div>
      </div>

      {loaded && (
        <>
          <div className="stats-row centres-stats" role="group" aria-label="Centre statistics">
            <div className="stat-card">
              <span>Total Centres</span>
              <strong>{stats.total}</strong>
            </div>
            <div className="stat-card">
              <span>Active</span>
              <strong>{stats.active}</strong>
            </div>
            <div className="stat-card">
              <span>Suspended</span>
              <strong>{stats.suspended}</strong>
            </div>
            <div className="stat-card">
              <span>Expiring Soon</span>
              <strong>{stats.expiringSoon}</strong>
            </div>
          </div>

          <div className="centres-toolbar">
            <label className="centres-search" htmlFor="centres-search">
              <Search size={16} aria-hidden />
              <span className="sr-only">Search centres</span>
              <input
                id="centres-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, tenant ID, admin…"
                autoComplete="off"
              />
            </label>
            <div className="centres-filters" role="group" aria-label="Filter by status">
              {(
                [
                  ['all', 'All'],
                  ['active', 'Active'],
                  ['suspended', 'Suspended'],
                  ['expired', 'Expired'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`btn centres-filter-btn ${statusFilter === value ? 'btn-navy' : 'btn-ghost'}`}
                  aria-pressed={statusFilter === value}
                  onClick={() => setStatusFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="table-wrap centres-table-wrap">
            <table className="data-table centres-table">
              <thead>
                <tr>
                  <th>Centre</th>
                  <th>Tenant ID</th>
                  <th>Admin</th>
                  <th>Plan</th>
                  <th>Licence</th>
                  <th>Expiry</th>
                  <th>Created</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="centres-empty">
                      No centres match this search or filter.
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => {
                    const badge = centreAccessBadge(row)
                    const suspended = badge === 'SUSPENDED'
                    const rowBusy = actionId === row.id
                    const adminLine =
                      [row.adminUsername, row.adminEmail].filter((v) => v && String(v).trim()).join(' · ') ||
                      '—'
                    return (
                      <tr key={row.id} className={suspended ? 'centres-row-suspended' : undefined}>
                        <td>
                          <strong>{row.firmName}</strong>
                        </td>
                        <td>
                          <code className="centres-id">{row.id}</code>
                        </td>
                        <td className="centres-admin-cell">{adminLine}</td>
                        <td>{row.plan || '—'}</td>
                        <td>{licenceLabel(row)}</td>
                        <td>{formatExpiry(row.licenseExpiresAt)}</td>
                        <td>{formatCreated(row.createdAt)}</td>
                        <td>
                          <span className={badgeClass(badge)}>{badge}</span>
                        </td>
                        <td>
                          {suspended ? (
                            <button
                              type="button"
                              className="btn btn-gold"
                              disabled={busy}
                              aria-label={`Reactivate ${row.firmName}`}
                              onClick={() => setConfirm({ type: 'reactivate', row })}
                            >
                              {rowBusy ? <Loader2 size={14} className="centres-spin" aria-hidden /> : null}
                              Reactivate
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-danger"
                              disabled={busy}
                              aria-label={`Suspend ${row.firmName}`}
                              onClick={() => setConfirm({ type: 'suspend', row })}
                            >
                              {rowBusy ? <Loader2 size={14} className="centres-spin" aria-hidden /> : null}
                              Suspend
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {confirm && (
        <div
          className="party-edit-overlay centres-confirm-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby={confirmTitleId}
        >
          <div className="panel party-edit-modal centres-confirm-modal">
            <h2 id={confirmTitleId}>
              {confirm.type === 'suspend' ? 'Suspend centre?' : 'Reactivate centre?'}
            </h2>
            <p className="auto-manak-hint">
              <strong>{confirm.row.firmName}</strong>
              <br />
              {confirm.type === 'suspend' ? SUSPEND_CONFIRM : REACTIVATE_CONFIRM}
            </p>
            <div className="auto-manak-actions">
              <button
                ref={cancelRef}
                type="button"
                className="btn btn-ghost"
                disabled={Boolean(actionId)}
                onClick={() => setConfirm(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={confirm.type === 'suspend' ? 'btn btn-danger' : 'btn btn-gold'}
                disabled={Boolean(actionId)}
                aria-busy={Boolean(actionId)}
                onClick={() => void runConfirmed()}
              >
                {actionId ? (
                  <>
                    <Loader2 size={16} className="centres-spin" aria-hidden /> Working…
                  </>
                ) : confirm.type === 'suspend' ? (
                  'Suspend access'
                ) : (
                  'Reactivate access'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
