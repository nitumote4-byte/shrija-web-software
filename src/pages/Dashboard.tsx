import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ClipboardList,
  FileSpreadsheet,
  Flame,
  IndianRupee,
  Package,
  Users,
} from 'lucide-react'
import { ModuleCard } from '../components/ModuleCard'
import { getSession } from '../data/auth'
import { FIRM_PROFILE_EVENT, getFirmName } from '../data/firmProfile'
import { PRODUCT_NAME, PRODUCT_TAGLINE, USER_NAME, USER_ROLE, modules } from '../data/modules'
import { store } from '../data/store'

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

/** Quality Manager home — opens when tapping the centre name. */
export function Dashboard() {
  const session = getSession()
  const name = session?.username || USER_NAME
  const role = session?.role || USER_ROLE
  const [firmName, setFirmName] = useState(() => getFirmName())

  useEffect(() => {
    const sync = () => setFirmName(getFirmName())
    window.addEventListener(FIRM_PROFILE_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(FIRM_PROFILE_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const stats = useMemo(() => {
    const data = store.getAll()
    const today = new Date().toISOString().slice(0, 10)
    const pending = data.requests.filter((r) =>
      ['Pending', 'In Progress', 'Assayed'].includes(r.status),
    ).length
    const todayBills = data.invoices.filter((i) => i.date === today).length
    const todayFunds = data.funds
      .filter((f) => f.date === today)
      .reduce((s, f) => s + f.amount, 0)
    const parties = data.parties.length
    const assays = data.fireAssays.filter((a) => a.status === 'In Lab').length
    return { pending, todayBills, todayFunds, parties, assays }
  }, [])

  return (
    <>
      <section className="welcome-banner home-hero">
        <div className="home-hero-copy">
          <p className="home-eyebrow">{PRODUCT_NAME}</p>
          <h1>{firmName}</h1>
          <p className="home-lead">{PRODUCT_TAGLINE}</p>
          <p className="home-welcome">
            Welcome back, <strong>{name}</strong> · {role} · {formatWelcomeDate()}
          </p>
          <div className="home-hero-actions">
            <Link to="/request-list" className="btn btn-gold">
              Daily Sheet
            </Link>
            <Link to="/billing" className="btn btn-secondary home-hero-secondary">
              Billing
            </Link>
            <Link to="/dashboard" className="btn btn-secondary home-hero-secondary">
              Analytics
            </Link>
          </div>
        </div>
      </section>

      <div className="home-kpi-row">
        <div className="home-kpi">
          <ClipboardList size={18} />
          <div>
            <span>Open requests</span>
            <strong>{stats.pending}</strong>
          </div>
        </div>
        <div className="home-kpi">
          <FileSpreadsheet size={18} />
          <div>
            <span>Invoices today</span>
            <strong>{stats.todayBills}</strong>
          </div>
        </div>
        <div className="home-kpi">
          <IndianRupee size={18} />
          <div>
            <span>Funds today</span>
            <strong>
              ₹{stats.todayFunds.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </strong>
          </div>
        </div>
        <div className="home-kpi">
          <Users size={18} />
          <div>
            <span>Parties</span>
            <strong>{stats.parties}</strong>
          </div>
        </div>
        <div className="home-kpi">
          <Flame size={18} />
          <div>
            <span>Assays in lab</span>
            <strong>{stats.assays}</strong>
          </div>
        </div>
        <div className="home-kpi">
          <Package size={18} />
          <div>
            <span>Modules</span>
            <strong>{modules.length}</strong>
          </div>
        </div>
      </div>

      <div className="home-section-head">
        <h2 className="section-title">Operations & Quality Control</h2>
        <p>Launch hallmarking, assay, stock, billing and compliance tools.</p>
      </div>

      <div className="module-grid">
        {modules.map((mod, i) => (
          <ModuleCard key={mod.id} module={mod} delay={i * 30} />
        ))}
      </div>
    </>
  )
}
