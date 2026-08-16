import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Banknote,
  BarChart3,
  Bell,
  Bot,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eye,
  File,
  FileSpreadsheet,
  Flame,
  FlaskConical,
  Gauge,
  Keyboard,
  LayoutDashboard,
  List,
  ListOrdered,
  LogOut,
  Menu,
  MoreHorizontal,
  Package,
  Printer,
  Receipt,
  ScrollText,
  Search,
  Settings,
  Tag,
  UserPlus,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { BrandLogo } from './BrandLogo'
import { CENTRE_NAME, PRODUCT_NAME, USER_NAME, USER_ROLE, allModules, modules } from '../data/modules'
import { clearSession, getSession } from '../data/auth'
import { FIRM_PROFILE_EVENT, getActiveCentre, getFirmName } from '../data/firmProfile'
import { canAccessPath } from '../data/roles'
import { getCachedLicense } from '../data/license'

interface NavGroup {
  label: string
  items: {
    title: string
    path: string
    icon: React.ComponentType<{ size?: number; className?: string }>
  }[]
}

export function Layout() {
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [allOpen, setAllOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('shrija_sidebar_collapsed') === 'true'
  })
  const [mobileOpen, setMobileOpen] = useState(false)
  const [centreName, setCentreName] = useState(() => getActiveCentre().name || getFirmName())
  const menuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const location = useLocation()
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

  const navGroups: NavGroup[] = [
    {
      label: 'Core Operations',
      items: [
        { title: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
        { title: 'Manual Request', path: '/manual-request', icon: Keyboard },
        { title: 'Auto Request', path: '/auto-request', icon: Bot },
        { title: 'Rough Sheet', path: '/rough-sheet', icon: ScrollText },
        { title: 'Request List', path: '/request-list', icon: ListOrdered },
        { title: 'QM Request List', path: '/qm-request-list', icon: ClipboardList },
      ],
    },
    {
      label: 'Laboratory & Assay',
      items: [
        { title: 'Create Fire Assay', path: '/create-fire-assay', icon: Flame },
        { title: 'View Fire Assay', path: '/view-fire-assay', icon: Eye },
        { title: 'XRF Standard Check', path: '/xrf-daily-standard', icon: Gauge },
        { title: 'Touch Form', path: '/touch-form', icon: File },
        { title: 'Extra Hallmark', path: '/xray-hallmark', icon: List },
      ],
    },
    {
      label: 'Billing & Accounting',
      items: [
        { title: 'Billing', path: '/billing', icon: FileSpreadsheet },
        { title: 'Generated Bills', path: '/generated-bills', icon: Receipt },
        { title: 'Monthly Billing', path: '/monthly-billing', icon: FileSpreadsheet },
        { title: 'Monthly Bills', path: '/monthly-bills', icon: Eye },
        { title: 'Touch Billing', path: '/touch-billing', icon: FileSpreadsheet },
        { title: 'Fund Entry', path: '/fund-entry', icon: Banknote },
        { title: 'Expense Entry', path: '/expense-entry', icon: Receipt },
      ],
    },
    {
      label: 'Stock & Masters',
      items: [
        { title: 'QM Stock', path: '/qm-stock', icon: Package },
        { title: 'Lab Stock', path: '/lab-stock', icon: FlaskConical },
        { title: 'Add Party', path: '/add-party', icon: UserPlus },
        { title: 'New Category', path: '/new-category', icon: Tag },
        { title: 'Print Job Card', path: '/print-job-card', icon: Printer },
      ],
    },
    {
      label: 'Reports & Admin',
      items: [
        { title: 'Reports', path: '/reports', icon: BarChart3 },
        { title: 'Others / Admin', path: '/others', icon: MoreHorizontal },
        { title: 'Licence', path: '/license', icon: Settings },
      ],
    },
  ]

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
    setMobileOpen(false)
  }, [location.pathname])

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

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem('shrija_sidebar_collapsed', String(next))
      return next
    })
  }

  const goModule = (path: string) => {
    setAllOpen(false)
    navigate(path)
  }

  return (
    <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
          role="presentation"
        />
      )}

      {/* Left Sidebar Navigation */}
      <aside className={`app-sidebar ${mobileOpen ? 'mobile-show' : ''}`}>
        <div className="sidebar-header">
          <Link to="/" className="sidebar-brand">
            <div className="brand-mark" aria-hidden>
              <BrandLogo markOnly size={22} />
            </div>
            {!collapsed && (
              <div className="brand-copy">
                <span className="brand-text">{centreName || CENTRE_NAME}</span>
                <span className="brand-product">{PRODUCT_NAME}</span>
              </div>
            )}
          </Link>

          <button
            type="button"
            className="sidebar-toggle-btn desktop-only"
            onClick={toggleCollapse}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-home-link">
            <NavLink
              to="/"
              end
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              title="Home Dashboard"
            >
              <LayoutDashboard size={18} className="nav-icon" />
              {!collapsed && <span className="nav-label">Home Overview</span>}
            </NavLink>
          </div>

          {navGroups.map((group) => {
            const accessibleItems = group.items.filter((item) => canAccessPath(item.path))
            if (accessibleItems.length === 0) return null

            return (
              <div key={group.label} className="nav-group">
                {!collapsed && <div className="nav-group-label">{group.label}</div>}
                <div className="nav-group-items">
                  {accessibleItems.map((item) => {
                    const Icon = item.icon
                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                          `nav-item ${isActive ? 'active' : ''}`
                        }
                        title={item.title}
                      >
                        <Icon size={18} className="nav-icon" />
                        {!collapsed && <span className="nav-label">{item.title}</span>}
                      </NavLink>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </nav>

        {!collapsed && (
          <div className="sidebar-footer">
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{displayName}</span>
              <span className="sidebar-user-role">{displayRole}</span>
            </div>
          </div>
        )}
      </aside>

      {/* Main Area Container */}
      <div className="app-main-wrapper">
        {/* Top Header */}
        <header className="top-header">
          <div className="header-left">
            <button
              type="button"
              className="mobile-menu-btn mobile-only"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Toggle navigation"
            >
              <Menu size={20} />
            </button>

            {session?.tenantId && (
              <div className="tenant-chip" title={`Tenant ID: ${session.tenantId}`}>
                <Building2 size={14} />
                <span>{tenantLabel}</span>
                {session.centreKind === 'osc' ? <span> · own data</span> : null}
              </div>
            )}

            {licenseWarn && (
              <button
                type="button"
                className="tenant-chip license-alert-chip"
                onClick={() => navigate('/license')}
                title="Open licence page"
              >
                {licenseWarn}
              </button>
            )}
          </div>

          <div className="header-actions">
            <div className="search-box">
              <Search size={16} />
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

            <button type="button" className="header-icon-btn" aria-label="Notifications" title="Notifications">
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
                <div className="user-meta desktop-only">
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

        {/* Page Content */}
        <main className="main-content">
          <div className="page-container">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Floating Action Launcher for All Modules */}
      <button
        type="button"
        className="all-modules-fab"
        aria-label="All Modules"
        title="All Modules Launcher"
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
            <h2 id="all-modules-title">All Modules Launcher</h2>
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
                    <Icon size={26} strokeWidth={1.75} />
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

