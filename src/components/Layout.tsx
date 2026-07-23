import { Link, Outlet, useNavigate } from 'react-router-dom'
import { Bell, Building2, ChevronDown, LogOut, Menu, Search, Settings, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { CENTRE_NAME, PRODUCT_NAME, USER_NAME, USER_ROLE, allModules, modules } from '../data/modules'
import { clearSession, getSession } from '../data/auth'
import { FIRM_PROFILE_EVENT, getActiveCentre, getFirmName } from '../data/firmProfile'
import { canAccessPath } from '../data/roles'
import { getCachedLicense } from '../data/license'

export function Layout() {
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [allOpen, setAllOpen] = useState(false)
  const [centreName, setCentreName] = useState(() => getActiveCentre().name || getFirmName())
  const menuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const session = getSession()
  const displayName = session?.username || USER_NAME
  const displayRole = (session?.role || USER_ROLE).replace(/\s+/g, '_').toLowerCase()
  const tenantLabel =
    session?.centreKind === 'osc'
      ? session.centreName || 'Off-Site Centre'
      : session?.tenantName || centreName
  const license = getCachedLicense()
  const licenseWarn =
    license && license.ok && license.daysLeft !== null && license.daysLeft <= 14
      ? `${license.daysLeft}d left`
      : license && !license.ok
        ? 'Licence expired'
        : null

  const visibleModules = modules.filter((m) => canAccessPath(m.path))
  const visibleAll = allModules.filter((m) => canAccessPath(m.path))

  const filtered =
    query.trim().length > 0
      ? visibleModules.filter(
          (m) =>
            m.title.toLowerCase().includes(query.toLowerCase()) ||
            m.description.toLowerCase().includes(query.toLowerCase()),
        )
      : []

  useEffect(() => {
    const syncName = () => {
      const active = getActiveCentre()
      const name = active.name || getFirmName()
      setCentreName(name)
      document.title = `${name} · ${PRODUCT_NAME}`
    }
    syncName()
    window.addEventListener(FIRM_PROFILE_EVENT, syncName)
    window.addEventListener('storage', syncName)
    return () => {
      window.removeEventListener(FIRM_PROFILE_EVENT, syncName)
      window.removeEventListener('storage', syncName)
    }
  }, [])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  useEffect(() => {
    if (!allOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAllOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [allOpen])

  const goModule = (path: string) => {
    setAllOpen(false)
    navigate(path)
  }

  return (
    <div className="app-shell">
      <header className="top-header">
        <Link to="/" className="brand">
          <div className="brand-mark" aria-hidden>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="10" r="5" stroke="currentColor" strokeWidth="2" />
              <path
                d="M6 20c1.5-4 4.5-6 6-6s4.5 2 6 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className="brand-copy">
            <span className="brand-text">{centreName || CENTRE_NAME}</span>
            <span className="brand-product">
              {PRODUCT_NAME}
              {session?.tenantId ? ' · Tenant demo' : ''}
            </span>
          </div>
        </Link>

        {session?.tenantId && (
          <div className="tenant-chip" title={`Tenant ID: ${session.tenantId}`}>
            <Building2 size={14} />
            <span>{tenantLabel}</span>
          </div>
        )}
        {licenseWarn && (
          <button
            type="button"
            className="tenant-chip"
            style={{ cursor: 'pointer', borderColor: '#b45309', color: '#92400e' }}
            onClick={() => navigate('/license')}
            title="Open licence page"
          >
            {licenseWarn}
          </button>
        )}

        <div className="header-actions">
          <div className="search-box">
            <Search size={16} />
            <input
              type="search"
              placeholder="Search Modules..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filtered[0]) {
                  navigate(filtered[0].path)
                  setQuery('')
                }
              }}
              aria-label="Search modules"
            />
            {filtered.length > 0 && (
              <div className="module-search-results">
                {filtered.slice(0, 6).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      navigate(m.path)
                      setQuery('')
                    }}
                  >
                    <strong>{m.title}</strong>
                    <div>{m.description}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button type="button" className="header-icon-btn" aria-label="Notifications">
            <Bell size={18} />
          </button>

          <div className="user-menu" ref={menuRef}>
            <button
              type="button"
              className="user-chip user-chip-btn"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
            >
              <div className="user-avatar">{displayName.slice(0, 2).toUpperCase()}</div>
              <div className="user-meta">
                <strong>{displayName}</strong>
                <span>{displayRole}</span>
              </div>
              <ChevronDown size={16} className={`chev ${menuOpen ? 'open' : ''}`} />
            </button>

            {menuOpen && (
              <div className="user-dropdown">
                <div className="user-dropdown-head">
                  <div className="user-avatar">{displayName.slice(0, 2).toUpperCase()}</div>
                  <div>
                    <strong>{displayName}</strong>
                    <span>{displayRole}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="user-dropdown-item"
                  onClick={() => {
                    setMenuOpen(false)
                    navigate('/license')
                  }}
                >
                  <Settings size={16} /> Licence
                </button>
                <button
                  type="button"
                  className="user-dropdown-item"
                  onClick={() => {
                    setMenuOpen(false)
                    navigate('/account-settings')
                  }}
                >
                  <Settings size={16} /> Account Settings
                </button>
                <button
                  type="button"
                  className="user-dropdown-item logout"
                  onClick={() => {
                    setMenuOpen(false)
                    clearSession()
                    window.location.assign('/login')
                  }}
                >
                  <LogOut size={16} /> Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="main-content">
        <Outlet />
      </main>

      <button
        type="button"
        className="all-modules-fab"
        aria-label="All Modules"
        onClick={() => setAllOpen(true)}
      >
        <Menu size={22} />
      </button>

      {allOpen && (
        <div
          className="all-modules-backdrop"
          role="presentation"
          onClick={() => setAllOpen(false)}
        >
          <div
            className="all-modules-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="all-modules-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="all-modules-close"
              aria-label="Close"
              onClick={() => setAllOpen(false)}
            >
              <X size={18} />
            </button>
            <h2 id="all-modules-title">All Modules</h2>
            <div className="all-modules-grid">
              {visibleAll.map((mod) => {
                const Icon = mod.icon
                return (
                  <button
                    key={mod.id}
                    type="button"
                    className="all-modules-tile"
                    onClick={() => goModule(mod.path)}
                  >
                    <Icon size={28} strokeWidth={1.75} />
                    <span>{mod.title}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
