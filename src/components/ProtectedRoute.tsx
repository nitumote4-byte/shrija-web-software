import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { isAuthenticated } from '../data/auth'
import { getCachedLicense } from '../data/license'
import { canAccessPath } from '../data/roles'

export function ProtectedRoute() {
  const location = useLocation()
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />
  }

  const path = location.pathname
  const onLicensePage = path === '/license' || path === '/others/license'
  const license = getCachedLicense()

  // Expired → only licence page (and logout via layout)
  if (license && !license.ok && !onLicensePage) {
    return <Navigate to="/license" replace />
  }

  if (!onLicensePage && !canAccessPath(path)) {
    return <Navigate to="/" replace />
  }
  return <Outlet />
}
