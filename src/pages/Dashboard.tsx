import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  FileSpreadsheet,
  Flame,
  FlaskConical,
  IndianRupee,
  Keyboard,
  LayoutGrid,
  Package,
  UserPlus,
  Users,
} from 'lucide-react'
import { getSession } from '../data/auth'
import { FIRM_PROFILE_EVENT, getFirmName } from '../data/firmProfile'
import { PRODUCT_NAME, PRODUCT_TAGLINE, USER_NAME, USER_ROLE } from '../data/modules'
import { flattenNavLeaves, getVisibleNavGroups } from '../data/navigation'
import { canAccessPath, isLabOnlyRole, isOscSession, roleLabel } from '../data/roles'
import { LiveJobTracking } from '../components/LiveJobTracking'
import { store, type HallmarkRequest } from '../data/store'
import { getStoreVersion } from '../data/tenantCache'
import { OFP_CHANGE_EVENT } from '../data/operationalPeriod'
import { OperationalPeriodBadge } from '../components/OperationalPeriodBadge'

function formatWelcomeDate(d = new Date()) {
  const weekday = d.toLocaleDateString('en-IN', { weekday: 'long' })
  const day = d.getDate()
  const month = d.toLocaleDateString('en-IN', { month: 'long' })
  const year = d.getFullYear()
  const suffix =
    day % 10 === 1 && day !== 11
      ? 'st'
      : day % 10 === 2 && day !== 12
        ? 'nd'
        : day % 10 === 3 && day !== 13
          ? 'rd'
          : 'th'
  return `${weekday}, ${day}${suffix} ${month} ${year}`
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function statusBadgeClass(status: string) {
  if (status === 'Pending') return 'badge badge-pending'
  if (status === 'In Progress' || status === 'In Lab' || status === 'Assayed') return 'badge badge-progress'
  if (status === 'Billed') return 'badge badge-billed'
  if (status === 'Hallmarked' || status === 'Delivered' || status === 'Completed') return 'badge badge-done'
  return 'badge'
}

type KpiCard = {
  id: string
  label: string
  value: string
  icon: LucideIcon
  accent: string
}

type ActivityRow = {
  id: string
  date: string
  title: string
  detail: string
}

const OPEN_STATUSES: HallmarkRequest['status'][] = ['Pending', 'In Progress', 'Assayed']
const COMPLETED_STATUSES: HallmarkRequest['status'][] = ['Hallmarked', 'Billed', 'Delivered']

export function Dashboard() {
  const session = getSession()
  const name = session?.username || USER_NAME
  const role = session?.role || USER_ROLE
  const labOnly = isLabOnlyRole(role)
  const oscDesk = isOscSession(session)
  const [firmName, setFirmName] = useState(() => getFirmName())
  const storeVersion = getStoreVersion()
  const [ofpTick, setOfpTick] = useState(0)

  const canRequests = canAccessPath('/request-list') || canAccessPath('/qm-request-list')
  const canQmList = canAccessPath('/qm-request-list')
  const canBilling = canAccessPath('/billing')
  const canFunds = canAccessPath('/fund-entry')
  const canParties = canAccessPath('/add-party')
  const canLabAssay = !oscDesk && (canAccessPath('/create-fire-assay') || canAccessPath('/view-fire-assay'))
  const canLabStock = !oscDesk && canAccessPath('/lab-stock')
  const canQmStock = !oscDesk && canAccessPath('/qm-stock')
  const requestsPath = canAccessPath('/request-list')
    ? '/request-list'
    : canAccessPath('/qm-request-list')
      ? '/qm-request-list'
      : '/'

  useEffect(() => {
    const sync = () => setFirmName(getFirmName())
    window.addEventListener(FIRM_PROFILE_EVENT, sync)
    window.addEventListener('storage', sync)
    const onPeriod = () => setOfpTick((n) => n + 1)
    window.addEventListener(OFP_CHANGE_EVENT, onPeriod)
    return () => {
      window.removeEventListener(FIRM_PROFILE_EVENT, sync)
      window.removeEventListener('storage', sync)
      window.removeEventListener(OFP_CHANGE_EVENT, onPeriod)
    }
  }, [])

  const { kpis, recentRequests, recentAssays, activities } = useMemo(() => {
    const data = store.getAll()
    const today = todayIso()
    const pending = data.requests.filter((r) => OPEN_STATUSES.includes(r.status)).length
    const todayReqs = data.requests.filter((r) => r.date === today).length
    const completed = data.requests.filter((r) => COMPLETED_STATUSES.includes(r.status)).length
    const todayBills = data.invoices.filter((i) => i.date === today)
    const todayFunds = data.funds.filter((f) => f.date === today).reduce((s, f) => s + f.amount, 0)
    const assaysInLab = data.fireAssays.filter((a) => a.status === 'In Lab').length
    const assaysDone = data.fireAssays.filter((a) => a.status === 'Completed').length
    const labStockQty = data.stock
      .filter((s) => s.location === 'Lab')
      .reduce((s, item) => s + (Number(item.quantity) || 0), 0)
    const qmStockQty = data.stock
      .filter((s) => s.location === 'QM')
      .reduce((s, item) => s + (Number(item.quantity) || 0), 0)

    const cards: KpiCard[] = []
    const push = (card: KpiCard, show: boolean) => {
      if (show && cards.length < 6) cards.push(card)
    }

    if (labOnly) {
      push(
        {
          id: 'assays-lab',
          label: 'Assays in Lab',
          value: String(assaysInLab),
          icon: Flame,
          accent: 'rose',
        },
        canLabAssay,
      )
      push(
        {
          id: 'assays-done',
          label: 'Completed Assays',
          value: String(assaysDone),
          icon: ClipboardList,
          accent: 'emerald',
        },
        canLabAssay,
      )
      push(
        {
          id: 'lab-stock',
          label: 'Lab Inventory',
          value: labStockQty.toLocaleString('en-IN'),
          icon: FlaskConical,
          accent: 'cyan',
        },
        canLabStock,
      )
      push(
        {
          id: 'qm-stock',
          label: 'QM Inventory',
          value: qmStockQty.toLocaleString('en-IN'),
          icon: Package,
          accent: 'teal',
        },
        canQmStock,
      )
    } else if (canLabAssay) {
      push(
        {
          id: 'open-reqs',
          label: 'Open Requests',
          value: String(pending),
          icon: ClipboardList,
          accent: 'blue',
        },
        canRequests,
      )
      push(
        {
          id: 'pending-qm',
          label: 'Pending QM',
          value: String(data.requests.filter((r) => r.status === 'Pending').length),
          icon: ClipboardList,
          accent: 'amber',
        },
        canQmList,
      )
      push(
        {
          id: 'assays-lab',
          label: 'Assays in Lab',
          value: String(assaysInLab),
          icon: Flame,
          accent: 'rose',
        },
        true,
      )
      push(
        {
          id: 'today-bills',
          label: "Today's Billing",
          value: String(todayBills.length),
          icon: FileSpreadsheet,
          accent: 'cyan',
        },
        canBilling,
      )
      push(
        {
          id: 'today-funds',
          label: 'Funds today',
          value: `₹${todayFunds.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
          icon: IndianRupee,
          accent: 'emerald',
        },
        canFunds,
      )
    } else {
      push(
        {
          id: 'today-reqs',
          label: "Today's Requests",
          value: String(todayReqs),
          icon: ClipboardList,
          accent: 'blue',
        },
        canRequests,
      )
      push(
        {
          id: 'open-reqs',
          label: 'Pending Requests',
          value: String(pending),
          icon: ClipboardList,
          accent: 'amber',
        },
        canRequests,
      )
      push(
        {
          id: 'done-reqs',
          label: 'Completed Requests',
          value: String(completed),
          icon: ClipboardList,
          accent: 'emerald',
        },
        canRequests,
      )
      push(
        {
          id: 'today-bills',
          label: "Today's Billing",
          value: String(todayBills.length),
          icon: FileSpreadsheet,
          accent: 'cyan',
        },
        canBilling,
      )
      push(
        {
          id: 'today-funds',
          label: 'Funds today',
          value: `₹${todayFunds.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
          icon: IndianRupee,
          accent: 'emerald',
        },
        canFunds,
      )
      push(
        {
          id: 'parties',
          label: 'Parties',
          value: String(data.parties.length),
          icon: Users,
          accent: 'violet',
        },
        canParties,
      )
    }

    push(
      {
        id: 'parties-shared',
        label: 'Parties',
        value: String(data.parties.length),
        icon: Users,
        accent: 'violet',
      },
      canParties && !cards.some((c) => c.id === 'parties'),
    )
    push(
      {
        id: 'modules',
        label: 'Modules',
        value: String(flattenNavLeaves(getVisibleNavGroups()).length),
        icon: LayoutGrid,
        accent: 'orange',
      },
      true,
    )

    const activityRows: ActivityRow[] = []
    if (canRequests) {
      for (const r of data.requests) {
        activityRows.push({
          id: `req-${r.id}`,
          date: r.date,
          title: `Request ${r.requestNo}`,
          detail: `${r.partyName} · ${r.status}`,
        })
      }
    }
    if (canBilling) {
      for (const inv of data.invoices) {
        activityRows.push({
          id: `inv-${inv.id}`,
          date: inv.date,
          title: `Invoice ${inv.invoiceNo}`,
          detail: `${inv.partyName} · ₹${Number(inv.total || 0).toLocaleString('en-IN')}`,
        })
      }
    }
    if (canFunds) {
      for (const f of data.funds) {
        activityRows.push({
          id: `fund-${f.id}`,
          date: f.date,
          title: 'Fund receipt',
          detail: `${f.partyName || f.source || 'Receipt'} · ₹${Number(f.amount || 0).toLocaleString('en-IN')}`,
        })
      }
    }
    if (canLabAssay) {
      for (const a of data.fireAssays) {
        activityRows.push({
          id: `fa-${a.id}`,
          date: a.date,
          title: `Assay ${a.assayNo}`,
          detail: `${a.partyName} · ${a.status}`,
        })
      }
    }
    activityRows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    const todayActivities = activityRows.filter((row) => row.date === today)

    return {
      kpis: cards,
      recentRequests: canRequests ? data.requests.slice(0, 5) : [],
      recentAssays: canLabAssay ? data.fireAssays.slice(0, 5) : [],
      activities: todayActivities.slice(0, 5),
    }
  }, [
    storeVersion,
    ofpTick,
    canRequests,
    canQmList,
    canBilling,
    canFunds,
    canParties,
    canLabAssay,
    canLabStock,
    canQmStock,
    labOnly,
  ])

  const quickActionCandidates = labOnly
    ? [
        canAccessPath('/create-fire-assay')
          ? { to: '/create-fire-assay', label: 'Create Fire Assay', primary: true }
          : null,
        canAccessPath('/view-fire-assay')
          ? { to: '/view-fire-assay', label: 'View Fire Assay', primary: false }
          : null,
        canAccessPath('/lab-stock') ? { to: '/lab-stock', label: 'Lab Stock', primary: false } : null,
      ]
    : [
        canAccessPath('/request-list')
          ? { to: '/request-list', label: 'Daily Sheet', primary: true }
          : canAccessPath('/qm-request-list')
            ? { to: '/qm-request-list', label: 'QM Requests', primary: true }
            : null,
        canAccessPath('/billing') ? { to: '/billing', label: 'Billing', primary: false } : null,
        canAccessPath('/dashboard') ? { to: '/dashboard', label: 'Analytics', primary: false } : null,
      ]
  const seenActions = new Set<string>()
  const quickActions = quickActionCandidates.filter(
    (action): action is { to: string; label: string; primary: boolean } => {
      if (!action || seenActions.has(action.to)) return false
      seenActions.add(action.to)
      return true
    },
  )

  const stripCandidates: { to: string; label: string; accent: string; icon: LucideIcon }[] = [
    { to: '/manual-request', label: 'Manual Request', accent: 'blue', icon: Keyboard },
    { to: '/auto-request', label: 'Auto Request', accent: 'green', icon: FileSpreadsheet },
    { to: '/create-fire-assay', label: 'Create Fire Assay', accent: 'rose', icon: Flame },
    { to: '/fund-entry', label: 'Fund Entry', accent: 'emerald', icon: IndianRupee },
    { to: '/add-party', label: 'Add Party', accent: 'indigo', icon: UserPlus },
    { to: '/qm-stock', label: 'QM Stock', accent: 'teal', icon: Package },
    { to: '/reports', label: 'Reports', accent: 'violet', icon: FileSpreadsheet },
    { to: '/others', label: 'Others', accent: 'slate', icon: LayoutGrid },
  ]
  const stripActions = stripCandidates.filter((a) => canAccessPath(a.to))
  const listTitle = canRequests ? 'Recent Requests' : canLabAssay ? 'Recent Assays' : 'Recent Records'
  const listPath = canRequests ? requestsPath : canLabAssay ? '/view-fire-assay' : '/'

  return (
    <div className="home-page page-content">
      <section className="home-hero home-welcome-card">
        <div className="home-welcome-copy">
          <p className="home-eyebrow">{PRODUCT_NAME}</p>
          <h1>{firmName}</h1>
          <p className="home-lead">{PRODUCT_TAGLINE}</p>
          <p className="home-welcome">
            Welcome back, <strong>{name}</strong>
            <span className="home-welcome-meta">
              ({roleLabel(role)}
              {oscDesk ? ' · Off-Site Centre' : ''})
            </span>
            <span className="home-hero-date">
              <CalendarDays size={16} />
              {formatWelcomeDate()}
            </span>
          </p>
          <div className="home-hero-actions">
            {quickActions.map((action) => (
              <Link
                key={action.to}
                to={action.to}
                className={action.primary ? 'home-hero-pill is-primary' : 'home-hero-pill'}
              >
                {action.label === 'Analytics' ? (
                  <BarChart3 size={18} />
                ) : action.label === 'Billing' ? (
                  <FileSpreadsheet size={18} />
                ) : (
                  <ClipboardList size={18} />
                )}
                {action.label}
              </Link>
            ))}
          </div>
        </div>
        {oscDesk && (
          <p className="home-osc-note">
            Off-Site desk — fire assay and lab stock stay at the Main Centre.
          </p>
        )}
      </section>

      <OperationalPeriodBadge />

      {kpis.length > 0 && (
        <div className="home-kpi-row home-kpi-row-saas">
          {kpis.map((kpi) => {
            const Icon = kpi.icon
            return (
              <div key={kpi.id} className="home-kpi" data-accent={kpi.accent}>
                <Icon size={24} />
                <div>
                  <span>{kpi.label}</span>
                  <strong>{kpi.value}</strong>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="home-ops-grid">
        <section className="home-panel" data-accent="blue">
          <div className="home-panel-head">
            <div>
              <h2>{listTitle}</h2>
              <p>
                {canRequests
                  ? 'Latest jobs visible to this desk.'
                  : canLabAssay
                    ? 'Latest fire assay sheets for this centre.'
                    : 'Operational records available to this role.'}
              </p>
            </div>
            {(canRequests || canLabAssay) && (
              <Link to={listPath} className="home-panel-link">
                View All
              </Link>
            )}
          </div>

          {canRequests ? (
            recentRequests.length === 0 ? (
              <p className="dash-group-empty">No requests yet for this centre.</p>
            ) : (
              <ul className="home-record-list">
                {recentRequests.map((r) => (
                  <li key={r.id}>
                    <span className="home-record-icon" data-accent="blue" aria-hidden>
                      <ClipboardList size={18} />
                    </span>
                    <div className="home-record-copy">
                      <strong>{r.requestNo}</strong>
                      <span>
                        {r.source} · {r.partyName}
                      </span>
                    </div>
                    <span className={statusBadgeClass(r.status)}>{r.status}</span>
                    <span className="home-record-date">{r.date}</span>
                  </li>
                ))}
              </ul>
            )
          ) : canLabAssay ? (
            recentAssays.length === 0 ? (
              <p className="dash-group-empty">No fire assay records yet.</p>
            ) : (
              <ul className="home-record-list">
                {recentAssays.map((a) => (
                  <li key={a.id}>
                    <span className="home-record-icon" data-accent="rose" aria-hidden>
                      <Flame size={18} />
                    </span>
                    <div className="home-record-copy">
                      <strong>{a.assayNo}</strong>
                      <span>
                        {a.declaredPurity || a.assayType} · {a.partyName}
                      </span>
                    </div>
                    <span className={statusBadgeClass(a.status)}>{a.status}</span>
                    <span className="home-record-date">{a.date}</span>
                  </li>
                ))}
              </ul>
            )
          ) : (
            <p className="dash-group-empty">No request or assay list is assigned to this role.</p>
          )}

          {(canRequests || canLabAssay) && (
            <Link to={listPath} className="home-panel-foot">
              {canRequests ? 'View All Requests →' : 'View All Assays →'}
            </Link>
          )}
        </section>

        <section className="home-panel" data-accent="green">
          <div className="home-panel-head">
            <div>
              <h2>Today&apos;s Activity</h2>
              <p>From existing requests, invoices, funds and assays.</p>
            </div>
          </div>
          {activities.length === 0 ? (
            <p className="dash-group-empty">No operational records to summarise yet.</p>
          ) : (
            <ul className="home-activity-list">
              {activities.map((row) => (
                <li key={row.id}>
                  <span className="home-activity-dot" aria-hidden />
                  <span className="home-activity-date">{row.date}</span>
                  <div>
                    <strong>{row.title}</strong>
                    <span>{row.detail}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {canRequests && (
            <Link to={requestsPath} className="home-panel-foot">
              View All Activity →
            </Link>
          )}
        </section>
      </div>

      <LiveJobTracking />

      {stripActions.length > 0 && (
        <section className="home-quick-panel" data-accent="slate">
          <h2>Quick Actions</h2>
          <div className="home-quick-row">
            {stripActions.map((action) => {
              const Icon = action.icon
              return (
                <Link key={action.to} to={action.to} className="home-quick-action" data-accent={action.accent}>
                  <span className="home-quick-icon" data-accent={action.accent} aria-hidden>
                    <Icon size={20} strokeWidth={1.85} />
                  </span>
                  <span>{action.label}</span>
                </Link>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
