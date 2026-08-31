import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  CalendarDays,
  FileSpreadsheet,
  Inbox,
  LayoutDashboard,
  Receipt,
  Sparkles,
} from 'lucide-react'
import { allModules, modules, type ModuleAccent, type ModuleDef } from './modules'
import { canAccessPath } from './roles'

/**
 * Presentation-only navigation catalog.
 * Visibility is always decided by canAccessPath (same source as ProtectedRoute).
 */
export type NavItem = {
  id: string
  title: string
  path: string
  icon: LucideIcon
  description?: string
  accent?: ModuleAccent
  children?: NavItem[]
}

export type NavGroup = {
  id: string
  label: string
  items: NavItem[]
  variant?: 'default' | 'upcoming'
  collapsible?: boolean
}

type NavFolderDef = {
  folder: string
  title: string
  icon: LucideIcon
  accent?: ModuleAccent
  description?: string
  children: string[]
}

type NavEntry = string | NavFolderDef

type NavGroupDef = {
  id: string
  label: string
  entries: NavEntry[]
  variant?: 'default' | 'upcoming'
  collapsible?: boolean
}

/** Billing routes that exist in ROLE_MODULES / App routes but not on the old launcher grid. */
const EXTRA_NAV: NavItem[] = [
  {
    id: 'generated-bills',
    title: 'Generated Bills',
    path: '/generated-bills',
    icon: Receipt,
    description: 'View issued invoices and delivery challans.',
    accent: 'cyan',
  },
  {
    id: 'monthly-billing',
    title: 'Monthly Billing',
    path: '/monthly-billing',
    icon: CalendarDays,
    description: 'Raise monthly party invoices.',
    accent: 'orange',
  },
  {
    id: 'monthly-bills',
    title: 'Monthly Bills',
    path: '/monthly-bills',
    icon: FileSpreadsheet,
    description: 'Browse saved monthly invoices.',
    accent: 'teal',
  },
]

/** Visual grouping only — does not grant or deny access. */
const NAV_GROUPS: NavGroupDef[] = [
  { id: 'overview', label: 'Overview', entries: ['home', 'dashboard'] },
  {
    id: 'operations',
    label: 'Operations & Requests',
    entries: [
      {
        folder: 'reception',
        title: 'Reception',
        icon: Inbox,
        accent: 'blue',
        description: 'Walk-in requests, auto request and rough sheet.',
        children: ['manual-request', 'auto-request', 'rough-sheet'],
      },
      'request-list',
      'qm-request-list',
      'print-job-card',
      'billing',
      'fund-entry',
      'expense-entry',
    ],
  },
  {
    id: 'lab',
    label: 'Lab & Assay',
    entries: ['create-fire-assay', 'view-fire-assay'],
  },
  {
    id: 'inventory',
    label: 'Inventory & Stock',
    entries: ['qm-stock', 'lab-stock'],
  },
  { id: 'reports', label: 'Reports & Analytics', entries: ['reports'] },
  {
    id: 'settings',
    label: 'Settings & Others',
    entries: ['add-party', 'new-category', 'others'],
  },
  {
    id: 'upcoming',
    label: 'Upcoming Features',
    variant: 'upcoming',
    entries: [
      {
        folder: 'upcoming-features',
        title: 'Upcoming Features',
        icon: Sparkles,
        accent: 'orange',
        description: 'Features in development.',
        children: ['extra-hallmark', 'touch-form', 'touch-billing'],
      },
    ],
  },
]

const HOME_ITEM: NavItem = {
  id: 'home',
  title: 'Dashboard',
  path: '/',
  icon: LayoutDashboard,
  description: 'Operations overview for this desk.',
  accent: 'blue',
}

function catalog(): Map<string, NavItem> {
  const map = new Map<string, NavItem>()
  map.set('home', HOME_ITEM)
  for (const m of allModules) {
    if (m.id === 'dashboard') {
      map.set('dashboard', {
        id: 'dashboard',
        title: 'Analytics',
        path: m.path,
        icon: BarChart3,
        description: m.description,
        accent: m.accent || 'violet',
      })
    } else {
      map.set(m.id, {
        id: m.id,
        title: m.title,
        path: m.path,
        icon: m.icon,
        description: m.description,
        accent: m.accent,
      })
    }
  }
  for (const extra of EXTRA_NAV) {
    map.set(extra.id, extra)
  }
  return map
}

function visibleLeaf(item: NavItem | undefined): NavItem | undefined {
  if (!item) return undefined
  if (!canAccessPath(item.path)) return undefined
  if (item.id === 'reports') return { ...item, title: 'Daily' }
  return item
}

function buildFolder(def: NavFolderDef, items: Map<string, NavItem>): NavItem | undefined {
  const children = def.children
    .map((id) => visibleLeaf(items.get(id)))
    .filter((item): item is NavItem => Boolean(item))
  if (children.length === 0) return undefined
  return {
    id: def.folder,
    title: def.title,
    path: children[0].path,
    icon: def.icon,
    description: def.description,
    accent: def.accent,
    children,
  }
}

/** Sidebar groups for the signed-in session — empty groups are omitted. */
export function getVisibleNavGroups(): NavGroup[] {
  const items = catalog()
  const groups: NavGroup[] = []
  for (const group of NAV_GROUPS) {
    const visible: NavItem[] = []
    for (const entry of group.entries) {
      if (typeof entry === 'string') {
        const item = visibleLeaf(items.get(entry))
        if (item) visible.push(item)
      } else {
        const folder = buildFolder(entry, items)
        if (folder) visible.push(folder)
      }
    }
    if (visible.length > 0) {
      groups.push({
        id: group.id,
        label: group.label,
        items: visible,
        variant: group.variant || 'default',
        collapsible: group.collapsible,
      })
    }
  }
  return groups
}

/** Leaf destinations currently shown in the sidebar (folders are expanded). */
export function flattenNavLeaves(groups: NavGroup[] = getVisibleNavGroups()): NavItem[] {
  return groups.flatMap((group) =>
    group.items.flatMap((item) => (item.children?.length ? item.children : [item])),
  )
}

/** Header search — same visibility as the sidebar, plus billing subpages still reachable from Billing. */
export function getSearchableNav(): Pick<ModuleDef, 'id' | 'title' | 'description' | 'path'>[] {
  const fromModules = modules
    .filter((m) => canAccessPath(m.path))
    .map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      path: m.path,
    }))
  const extras = EXTRA_NAV.filter((m) => canAccessPath(m.path)).map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description || '',
    path: m.path,
  }))
  const home = canAccessPath('/')
    ? [{ id: 'home', title: 'Dashboard', description: HOME_ITEM.description || '', path: '/' }]
    : []
  const analytics = canAccessPath('/dashboard')
    ? [
        {
          id: 'dashboard',
          title: 'Analytics',
          description: 'Live operations KPIs, calendar & performance.',
          path: '/dashboard',
        },
      ]
    : []
  return [...home, ...analytics, ...fromModules, ...extras]
}

const PAGE_TITLE_ALIASES: Record<string, string> = {
  '/': 'Dashboard',
  '/account-settings': 'Account Settings',
  '/license': 'Licence',
  '/others/operational-period': 'Operational Financial Period',
}

/** Header title for the current route — presentation only. */
export function getPageTitle(pathname: string): string {
  const current = pathname.replace(/\/$/, '') || '/'
  if (PAGE_TITLE_ALIASES[current]) return PAGE_TITLE_ALIASES[current]
  const items = [...catalog().values()]
  const exact = items.find((m) => m.path === current)
  if (exact) return exact.title
  const nested = items
    .filter((m) => m.path !== '/' && current.startsWith(`${m.path}/`))
    .sort((a, b) => b.path.length - a.path.length)[0]
  return nested?.title || 'Dashboard'
}

export function isNavPathActive(itemPath: string, currentPath: string) {
  const current = currentPath.replace(/\/$/, '') || '/'
  const item = itemPath.replace(/\/$/, '') || '/'
  if (item === '/') return current === '/'
  if (item === '/dashboard') return current === '/dashboard'
  if (item === '/billing') return current === '/billing' || current.startsWith('/billing/')
  return current === item || current.startsWith(`${item}/`)
}

export function isFolderActive(item: NavItem, currentPath: string) {
  if (item.children?.length) {
    return item.children.some((child) => isNavPathActive(child.path, currentPath))
  }
  return isNavPathActive(item.path, currentPath)
}

export function isGroupActive(group: NavGroup, currentPath: string) {
  return group.items.some((item) => isFolderActive(item, currentPath))
}
