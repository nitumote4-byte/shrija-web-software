import { useEffect, useState, type ReactNode } from 'react'
import { getToken } from '../api/client'
import { clearSession, isAuthenticated } from '../data/auth'
import { hydrateTenantData, isTenantHydrated } from '../data/tenantCache'

/** Loads store + KV from API for the JWT tenant before rendering the app shell. */
export function TenantBootstrap({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(() => !isAuthenticated() || isTenantHydrated())
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isAuthenticated() || !getToken()) {
      setReady(true)
      return
    }
    if (isTenantHydrated()) {
      setReady(true)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        await hydrateTenantData()
        if (!cancelled) setReady(true)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load centre data')
          // Bad/expired token — force re-login
          if (String(e).toLowerCase().includes('token') || String(e).includes('401')) {
            clearSession()
            window.location.assign('/login')
          }
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!ready) {
    return (
      <div className="login-page" style={{ placeItems: 'center' }}>
        <p>Loading centre data…</p>
        {error && <p className="login-error">{error}</p>}
      </div>
    )
  }

  return <>{children}</>
}
