import { getSession } from './auth'

/** Gold Shark–style desk roles → module access */
const ROLE_MODULES: Record<string, string[] | '*'> = {
  admin: '*',
  quality_manager: '*',
  assay_lab: [
    'manual-request',
    'auto-request',
    'rough-sheet',
    'request-list',
    'qm-request-list',
    'print-job-card',
    'create-fire-assay',
    'view-fire-assay',
    'xray-hallmark',
    'stock',
    'dashboard',
  ],
  reception: [
    'manual-request',
    'auto-request',
    'add-party',
    'fund-entry',
    'billing',
    'generated-bills',
    'monthly-billing',
    'monthly-bills',
    'print-job-card',
    'dashboard',
  ],
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

export function canAccessPath(pathname: string): boolean {
  const session = getSession()
  if (!session) return false
  if (session.isAdmin) return true
  const role = session.role || 'quality_manager'
  const allowed = ROLE_MODULES[role] ?? ROLE_MODULES.quality_manager
  if (allowed === '*') return true

  // Map path prefix to module id loosely
  const path = pathname.replace(/\/$/, '') || '/'
  if (path === '/' || path === '') return allowed.includes('dashboard')
  if (path === '/license' || path.startsWith('/others/license')) return true
  if (path.startsWith('/reports')) return allowed.includes('reports')
  if (path.startsWith('/others')) return session.isAdmin || role === 'quality_manager' || role === 'admin'
  if (path.startsWith('/create-fire-assay') || path.startsWith('/view-fire-assay')) {
    return allowed.includes('create-fire-assay') || allowed.includes('view-fire-assay')
  }
  if (path.startsWith('/qm-stock') || path.startsWith('/lab-stock')) {
    return allowed.includes('stock') || allowed.includes('qm-stock') || allowed.includes('lab-stock')
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
  // path /manual-request → manual-request
  return allowed.some((m) => id === m || id.startsWith(m) || m.includes(id))
}

export function roleLabel(role: string) {
  return role.replace(/_/g, ' ')
}
