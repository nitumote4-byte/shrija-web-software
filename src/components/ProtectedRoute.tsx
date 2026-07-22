import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { isAuthenticated } from '../data/auth'
import { canAccessPath } from '../data/roles'

export function ProtectedRoute() {
  const location = useLocation()
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />
  }
  if (!canAccessPath(location.pathname)) {
    return <Navigate to="/" replace />
  }
  return <Outlet />
}
