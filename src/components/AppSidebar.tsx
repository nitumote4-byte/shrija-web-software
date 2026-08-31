import { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { ChevronDown, Sparkles } from 'lucide-react'
import { BrandLogo } from './BrandLogo'
import {
  getVisibleNavGroups,
  isFolderActive,
  isGroupActive,
  isNavPathActive,
  type NavGroup,
  type NavItem,
} from '../data/navigation'
import { PRODUCT_VERSION } from '../data/modules'

export function AppSidebar({
  collapsed,
  mobileOpen,
  centreName,
  onNavigate,
}: {
  collapsed: boolean
  mobileOpen: boolean
  centreName?: string
  onToggleCollapsed?: () => void
  onNavigate: () => void
}) {
  const groups = getVisibleNavGroups()
  const location = useLocation()
  const navigate = useNavigate()
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setOpenMenus((prev) => {
      let changed = false
      const next = { ...prev }
      for (const group of getVisibleNavGroups()) {
        if (group.collapsible && isGroupActive(group, location.pathname) && !next[group.id]) {
          next[group.id] = true
          changed = true
        }
        for (const item of group.items) {
          if (item.children?.some((child) => isNavPathActive(child.path, location.pathname))) {
            if (!next[item.id]) {
              next[item.id] = true
              changed = true
            }
          }
        }
      }
      return changed ? next : prev
    })
  }, [location.pathname])

  const iconOnly = collapsed && !mobileOpen

  const toggleMenu = (id: string) => {
    setOpenMenus((prev) => ({ ...prev, [id]: !(prev[id] ?? false) }))
  }

  return (
    <aside
      className={`app-sidebar ${collapsed ? 'is-collapsed' : ''} ${mobileOpen ? 'is-open' : ''}`}
      aria-label="Application navigation"
    >
      <div className="sidebar-brand">
        <div className="brand-mark" aria-hidden>
          <BrandLogo markOnly size={42} />
        </div>
        <div className="sidebar-brand-copy">
          <span className="sidebar-brand-name">Shrija Hallmarking</span>
          <span className="sidebar-brand-centre">{centreName || 'Centre A'}</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {groups.map((group) => (
          <SidebarGroup
            key={group.id}
            group={group}
            iconOnly={iconOnly}
            openMenus={openMenus}
            currentPath={location.pathname}
            onToggle={toggleMenu}
            onNavigate={onNavigate}
            onCollapsedFolder={(item) => {
              const dest = item.path || item.children?.[0]?.path
              if (dest) {
                navigate(dest)
                onNavigate()
              }
            }}
          />
        ))}
      </nav>

      <div className="sidebar-foot">
        <span className="sidebar-foot-label">Hallmark Suite</span>
        <span>v{PRODUCT_VERSION}</span>
      </div>
    </aside>
  )
}

function SidebarGroup({
  group,
  iconOnly,
  openMenus,
  currentPath,
  onToggle,
  onNavigate,
  onCollapsedFolder,
}: {
  group: NavGroup
  iconOnly: boolean
  openMenus: Record<string, boolean>
  currentPath: string
  onToggle: (id: string) => void
  onNavigate: () => void
  onCollapsedFolder: (item: NavItem) => void
}) {
  const groupOpen = group.collapsible ? Boolean(openMenus[group.id]) : true
  const expanded = iconOnly ? false : groupOpen
  const groupActive = isGroupActive(group, currentPath)

  return (
    <div
      className={`sidebar-group${group.variant === 'upcoming' ? ' is-upcoming' : ''}${
        group.collapsible ? ' is-collapsible' : ''
      }${expanded ? ' is-open' : ''}`}
    >
      {group.label ? (
        group.collapsible ? (
          <button
            type="button"
            className={`sidebar-group-label is-toggle${groupActive ? ' is-current' : ''}`}
            aria-expanded={expanded}
            aria-controls={`sidebar-group-${group.id}`}
            onClick={() => {
              if (iconOnly) {
                const dest = group.items[0]?.path
                if (dest) onCollapsedFolder(group.items[0])
              } else {
                onToggle(group.id)
              }
            }}
          >
            {group.variant === 'upcoming' ? <Sparkles size={13} strokeWidth={2} aria-hidden /> : null}
            <span>{group.label}</span>
            <ChevronDown size={14} className={`sidebar-chevron${expanded ? ' is-open' : ''}`} aria-hidden />
          </button>
        ) : (
          <p className="sidebar-group-label">{group.label}</p>
        )
      ) : null}
      {expanded || !group.collapsible ? (
        <ul id={`sidebar-group-${group.id}`}>
          {group.items.map((item) => (
            <SidebarEntry
              key={item.id}
              item={item}
              collapsed={iconOnly}
              open={Boolean(openMenus[item.id])}
              currentPath={currentPath}
              onToggle={() => onToggle(item.id)}
              onNavigate={onNavigate}
              onCollapsedFolder={() => onCollapsedFolder(item)}
            />
          ))}
        </ul>
      ) : iconOnly ? (
        <ul>
          {group.items.map((item) => (
            <SidebarEntry
              key={item.id}
              item={item}
              collapsed
              open={false}
              currentPath={currentPath}
              onToggle={() => onToggle(item.id)}
              onNavigate={onNavigate}
              onCollapsedFolder={() => onCollapsedFolder(item)}
            />
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function SidebarEntry({
  item,
  collapsed,
  open,
  currentPath,
  onToggle,
  onNavigate,
  onCollapsedFolder,
}: {
  item: NavItem
  collapsed: boolean
  open: boolean
  currentPath: string
  onToggle: () => void
  onNavigate: () => void
  onCollapsedFolder: () => void
}) {
  const Icon = item.icon
  const children = item.children || []
  const folderActive = isFolderActive(item, currentPath)

  if (children.length > 0) {
    const expanded = collapsed ? false : open
    return (
      <li className={`sidebar-folder${folderActive ? ' is-current' : ''}${expanded ? ' is-open' : ''}`}>
        <button
          type="button"
          className={`sidebar-link sidebar-folder-toggle${folderActive ? ' is-active' : ''}`}
          aria-expanded={expanded}
          aria-controls={`sidebar-folder-${item.id}`}
          title={item.title}
          onClick={() => {
            if (collapsed) onCollapsedFolder()
            else onToggle()
          }}
        >
          <span className="sidebar-icon" data-accent={item.accent || 'slate'} aria-hidden>
            <Icon size={18} strokeWidth={2} />
          </span>
          <span className="sidebar-link-label">{item.title}</span>
          <ChevronDown size={16} className={`sidebar-chevron${expanded ? ' is-open' : ''}`} aria-hidden />
        </button>
        {!collapsed ? (
          <div
            className={`sidebar-submenu${expanded ? ' is-open' : ''}`}
            id={`sidebar-folder-${item.id}`}
            aria-hidden={!expanded}
          >
            <ul className="sidebar-children">
              {children.map((child) => {
                const ChildIcon = child.icon
                return (
                  <li key={child.id}>
                    <NavLink
                      to={child.path}
                      tabIndex={expanded ? undefined : -1}
                      className={({ isActive }) =>
                        `sidebar-link sidebar-child-link${isActive ? ' is-active' : ''}`
                      }
                      title={child.title}
                      onClick={onNavigate}
                    >
                      <span className="sidebar-icon" data-accent={child.accent || 'slate'} aria-hidden>
                        <ChildIcon size={16} strokeWidth={2} />
                      </span>
                      <span className="sidebar-link-label">{child.title}</span>
                    </NavLink>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}
      </li>
    )
  }

  return (
    <li>
      <NavLink
        to={item.path}
        end={item.path === '/' || item.path === '/dashboard'}
        className={() => `sidebar-link${isNavPathActive(item.path, currentPath) ? ' is-active' : ''}`}
        title={item.title}
        onClick={onNavigate}
      >
        <span className="sidebar-icon" data-accent={item.accent || 'slate'} aria-hidden>
          <Icon size={18} strokeWidth={2} />
        </span>
        <span className="sidebar-link-label">{item.title}</span>
      </NavLink>
    </li>
  )
}
