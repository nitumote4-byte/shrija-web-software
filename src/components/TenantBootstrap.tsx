import { useEffect, useState, type ReactNode } from 'react'
import { ApiRequestError, getToken } from '../api/client'
import { clearSession, isAuthenticated } from '../data/auth'
import { fetchLicenseStatus, setCachedLicense } from '../data/license'
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
    let cancelled = false
    ;(async () => {
      try {
        // Always refresh licence status first
        try {
          await fetchLicenseStatus()
        } catch (e) {
          if (e instanceof ApiRequestError && (e.code === 'EXPIRED' || e.status === 403)) {
            const body = e.body as { license?: Parameters<typeof setCachedLicense>[0] } | null
            if (body?.license) setCachedLicense(body.license)
            else
              setCachedLicense({
                ok: false,
                plan: 'unknown',
                status: 'active',
                licenseKey: null,
                expiresAt: null,
                activatedAt: null,
                maxUsers: 0,
                daysLeft: -1,
                reason: e.message,
                code: 'EXPIRED',
              })
            if (!cancelled) {
              setReady(true)
              if (!window.location.pathname.includes('license')) {
                window.location.assign('/license')
              }
            }
            return
          }
        }

        if (isTenantHydrated()) {
          if (!cancelled) setReady(true)
          return
        }

        await hydrateTenantData()
        if (!cancelled) setReady(true)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load centre data')
          if (e instanceof ApiRequestError && (e.code === 'EXPIRED' || e.status === 403)) {
            setReady(true)
            window.location.assign('/license')
            return
          }
          if (String(e).toLowerCase().includes('token') || (e instanceof ApiRequestError && e.status === 401)) {
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
