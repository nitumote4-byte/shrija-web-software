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
import { ScheduledMaintenanceNoticeCard } from './ScheduledMaintenanceNotice'
import {
  dismissMaintenanceBanner,
  isMaintenanceBannerDismissed,
  useScheduledMaintenanceNotice,
} from '../useScheduledMaintenanceNotice'

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
  const [bellOpen, setBellOpen] = useState(false)
  const [bannerHidden, setBannerHidden] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const bellRef = useRef<HTMLDivElement>(null)
  const maintenanceNotice = useScheduledMaintenanceNotice()
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
      if (!bellRef.current?.contains(e.target as Node)) setBellOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setBellOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  useEffect(() => {
    if (!maintenanceNotice) {
      setBannerHidden('')
      return
    }
    setBannerHidden(
      isMaintenanceBannerDismissed(maintenanceNotice.fingerprint) ? maintenanceNotice.fingerprint : '',
    )
  }, [maintenanceNotice])

  useEffect(() => {
    setBellOpen(false)
  }, [location.pathname])

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

            <div className="header-bell" ref={bellRef}>
              <button
                type="button"
                className={`header-icon-btn header-bell-btn${licenseWarn || maintenanceNotice ? ' has-alert' : ''}`}
                aria-label={
                  maintenanceNotice
                    ? 'Notifications: Scheduled Maintenance / निर्धारित रखरखाव'
                    : licenseWarn
                      ? `Notifications: ${licenseWarn}`
                      : 'Notifications'
                }
                aria-expanded={bellOpen}
                aria-controls="header-notifications"
                title={
                  maintenanceNotice
                    ? 'Scheduled Maintenance / निर्धारित रखरखाव'
                    : licenseWarn
                      ? licenseWarn
                      : 'Notifications'
                }
                onClick={() => {
                  setMenuOpen(false)
                  setBellOpen((open) => !open)
                }}
              >
                <Bell size={20} />
                {licenseWarn || maintenanceNotice ? <span className="header-bell-dot" aria-hidden /> : null}
              </button>
              {bellOpen ? (
                <div id="header-notifications" className="header-bell-panel" role="region" aria-label="Notifications">
                  <p className="header-bell-panel-label">Notifications</p>
                  {licenseWarn ? (
                    <button
                      type="button"
                      className="header-bell-license"
                      onClick={() => {
                        setBellOpen(false)
                        navigate('/license')
                      }}
                    >
                      {licenseWarn}
                    </button>
                  ) : null}
                  {maintenanceNotice ? <ScheduledMaintenanceNoticeCard notice={maintenanceNotice} /> : null}
                  {!licenseWarn && !maintenanceNotice ? (
                    <p className="header-bell-empty">No notifications.</p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="user-menu" ref={menuRef}>
              <button
                type="button"
                className="user-chip user-chip-btn"
                onClick={() => {
                  setBellOpen(false)
                  setMenuOpen((v) => !v)
                }}
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
          {maintenanceNotice && bannerHidden === '' ? (
            <ScheduledMaintenanceNoticeCard
              notice={maintenanceNotice}
              onDismiss={() => {
                dismissMaintenanceBanner(maintenanceNotice.fingerprint)
                setBannerHidden(maintenanceNotice.fingerprint)
              }}
            />
          ) : null}
          <Outlet />
        </main>
      </div>
    </div>
  )
}
