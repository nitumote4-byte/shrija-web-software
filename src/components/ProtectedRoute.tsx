import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { getSession, isAuthenticated } from '../data/auth'
import { getCachedLicense } from '../data/license'
import { canAccessPath } from '../data/roles'
import { ErrorPage } from './ErrorPage'

/** Top-level path segments that exist in App routes (presentation catalog). */
const KNOWN_APP_ROOTS = new Set([
  'dashboard',
  'license',
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
  'xray-hallmark',
  'xrf-daily-standard',
  'fund-entry',
  'expense-entry',
  'add-party',
  'new-category',
  'create-fire-assay',
  'view-fire-assay',
  'qm-stock',
  'lab-stock',
  'touch-form',
  'touch-billing',
  'reports',
  'others',
  'account-settings',
  'change-password',
  'other-services',
  'error',
])

function isKnownAppPath(pathname: string): boolean {
  const path = pathname.replace(/\/$/, '') || '/'
  if (path === '/' || path === '') return true
  const root = path.slice(1).split('/')[0] || ''
  return KNOWN_APP_ROOTS.has(root)
}

export function ProtectedRoute() {
  const location = useLocation()
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />
  }

  const path = location.pathname
  const session = getSession()
  if (session?.mustChangePassword && path !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }

  const onLicensePage = path === '/license' || path === '/others/license'
  const onErrorPage = path === '/error' || path.startsWith('/error/')
  const license = getCachedLicense()

  // Expired → only licence page (and logout via layout)
  if (license && !license.ok && !onLicensePage) {
    return <Navigate to="/license" replace />
  }

  // RBAC unchanged — known routes denied by role show Access Denied (session kept).
  // Unknown URLs fall through to the catch-all 404 route.
  if (!onLicensePage && !onErrorPage && isKnownAppPath(path) && !canAccessPath(path)) {
    return <ErrorPage status={403} />
  }
  return <Outlet />
}
