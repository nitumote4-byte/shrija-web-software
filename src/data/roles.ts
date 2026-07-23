import { getSession } from './auth'

/** Lab-only modules (In Lab / assay_lab users) */
export const LAB_ONLY_MODULES = [
  'create-fire-assay',
  'view-fire-assay',
  'qm-stock',
  'lab-stock',
] as const

/** Reception — everything except lab (fire assay + QM/Lab stock) */
export const RECEPTION_MODULES = [
  'dashboard',
  'manual-request',
  'auto-request',
  'rough-sheet',
  'request-list',
  'qm-request-list',
  'billing',
  'generated-bills',
  'monthly-billing',
  'monthly-bills',
  'print-job-card',
  'extra-hallmark',
  'xray-hallmark',
  'fund-entry',
  'expense-entry',
  'add-party',
  'new-category',
  'touch-form',
  'touch-billing',
  'reports',
  'others',
] as const

/** Gold Shark–style desk roles → module access */
const ROLE_MODULES: Record<string, string[] | '*'> = {
  admin: '*',
  quality_manager: '*',
  /** In Lab user — only fire assay + stock */
  assay_lab: [...LAB_ONLY_MODULES],
  in_lab: [...LAB_ONLY_MODULES],
  inlab: [...LAB_ONLY_MODULES],
  /** Reception — all desk modules except lab */
  reception: [...RECEPTION_MODULES],
  accountant: [
    'billing',
    'generated-bills',
    'monthly-billing',
    'monthly-bills',
    'fund-entry',
    'expense-entry',
    'reports',
    'dashboard',
    'stock',
  ],
}

export function normalizeRole(role: string) {
  return String(role || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
}

export function isLabOnlyRole(role?: string | null) {
  const r = normalizeRole(role || '')
  return r === 'assay_lab' || r === 'in_lab' || r === 'inlab'
}

export function getRoleModules(role?: string | null): string[] | '*' {
  const r = normalizeRole(role || 'quality_manager')
  return ROLE_MODULES[r] ?? ROLE_MODULES.quality_manager
}

export function canAccessPath(pathname: string): boolean {
  const session = getSession()
  if (!session) return false
  if (session.isAdmin) return true
  const role = normalizeRole(session.role || 'quality_manager')
  const allowed = getRoleModules(role)
  if (allowed === '*') return true

  const path = pathname.replace(/\/$/, '') || '/'
  // Home always allowed — module cards are filtered separately
  if (path === '/' || path === '') return true
  if (path === '/license' || path.startsWith('/others/license')) return true
  if (path.startsWith('/reports')) return allowed.includes('reports')
  if (path.startsWith('/others')) {
    return allowed.includes('others')
  }
  if (path.startsWith('/create-fire-assay')) {
    return allowed.includes('create-fire-assay')
  }
  if (path.startsWith('/view-fire-assay')) {
    return allowed.includes('view-fire-assay')
  }
  if (path.startsWith('/qm-stock')) {
    return allowed.includes('qm-stock') || allowed.includes('stock')
  }
  if (path.startsWith('/lab-stock')) {
    return allowed.includes('lab-stock') || allowed.includes('stock')
  }
  if (path.startsWith('/touch-')) {
    return allowed.includes('touch-form') || allowed.includes('touch-billing') || allowed.includes('stock')
  }
  if (path === '/generated-bills' || path.startsWith('/billing') || path.startsWith('/monthly-')) {
    return (
      allowed.includes('billing') ||
      allowed.includes('generated-bills') ||
      allowed.includes('monthly-billing') ||
      allowed.includes('monthly-bills')
    )
  }

  const id = path.slice(1).split('/')[0]
  return allowed.some((m) => id === m || id.startsWith(m) || m.includes(id))
}

export function roleLabel(role: string) {
  const r = normalizeRole(role)
  if (r === 'assay_lab' || r === 'in_lab' || r === 'inlab') return 'In Lab'
  if (r === 'reception') return 'Reception'
  return role.replace(/_/g, ' ')
}
