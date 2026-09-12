import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Bell, Building2, ChevronDown, KeyRound, LogOut, Menu, Search, Settings, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AppSidebar } from './AppSidebar'
import { PRODUCT_NAME } from '../data/modules'
import { getPageTitle, getSearchableNav } from '../data/navigation'
import { clearSession, getSession } from '../data/auth'
import { FIRM_PROFILE_EVENT, getActiveCentre, getFirmName } from '../data/firmProfile'
import { roleLabel } from '../data/roles'
import { getCachedLicense } from '../data/license'
import { STORE_PERSIST_EVENT } from '../data/tenantCache'
import { OperationalPeriodBadge } from './OperationalPeriodBadge'

const MOBILE_MAX = 899

function dayGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function Layout() {
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [centreName, setCentreName] = useState(() => getActiveCentre().name || getFirmName())
  const [persistError, setPersistError] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const pageTitle = getPageTitle(location.pathname)
  const greeting = useMemo(() => dayGreeting(), [])
  const session = getSession()
  const displayName = session?.username || 'User'
  const displayRole = roleLabel(session?.role || 'user')
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

  const searchable = getSearchableNav()
  const filtered =
    query.trim().length > 0
      ? searchable.filter(
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
    const onPersist = (event: Event) => {
      const detail = (event as CustomEvent<{ ok?: boolean; message?: string }>).detail
      setPersistError(detail?.ok ? '' : detail?.message || 'Could not save data. Retrying.')
    }
    window.addEventListener(STORE_PERSIST_EVENT, onPersist)
    return () => window.removeEventListener(STORE_PERSIST_EVENT, onPersist)
  }, [])

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > MOBILE_MAX) setMobileNav(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  useEffect(() => {
    if (!mobileNav) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileNav(false)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [mobileNav])

  return (
    <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <AppSidebar
        collapsed={collapsed}
        mobileOpen={mobileNav}
        centreName={centreName}
        onToggleCollapsed={() => setCollapsed((v) => !v)}
        onNavigate={() => setMobileNav(false)}
      />

      {mobileNav && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        />
      )}

      <div className="app-frame">
        <header className="top-header">
          <div className="header-left">
            <button
              type="button"
              className="header-menu-btn"
              aria-label={mobileNav ? 'Close menu' : collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={mobileNav || !collapsed}
              onClick={() => {
                if (window.innerWidth <= MOBILE_MAX) setMobileNav((v) => !v)
                else setCollapsed((v) => !v)
              }}
            >
              {mobileNav ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="header-title-block">
              <h1 className="header-page-title">{pageTitle}</h1>
              <p className="header-greeting">
                {greeting}, {displayName} 👋
              </p>
            </div>
          </div>

          {session?.tenantId && (
            <div className="tenant-chip" title={`Tenant ID: ${session.tenantId}`}>
              <Building2 size={14} />
              <span>{tenantLabel}</span>
              {session.centreKind === 'osc' ? <span> · own data</span> : null}
            </div>
          )}
          {session?.tenantId ? <OperationalPeriodBadge compact /> : null}
          {persistError && (
            <div
              className="tenant-chip"
              style={{ borderColor: '#b91c1c', color: '#991b1b', maxWidth: 280 }}
              title={persistError}
            >
              Save failed — retrying
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
              <Search className="search-box-icon" size={18} aria-hidden />
              <input
                type="search"
                placeholder="Search modules..."
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

            <button
              type="button"
              className={`header-icon-btn header-bell-btn${licenseWarn ? ' has-alert' : ''}`}
              aria-label={licenseWarn ? `Notifications: ${licenseWarn}` : 'Notifications'}
              title={licenseWarn ? licenseWarn : 'Notifications'}
            >
              <Bell size={20} />
              {licenseWarn ? <span className="header-bell-dot" aria-hidden /> : null}
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
                    <KeyRound size={16} /> Change Password
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

        <main className="app-main main-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
