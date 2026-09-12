import { useEffect, useState, type ReactNode } from 'react'
import { ApiRequestError, getToken, readStoredSession } from '../api/client'
import { clearSession, isAuthenticated, refreshSessionFromServer } from '../data/auth'
import { fetchLicenseStatus, getCachedLicense, setCachedLicense, type LicenseStatus } from '../data/license'
import { hydrateTenantData, isTenantHydrated } from '../data/tenantCache'

function goToLicensePage() {
  if (!window.location.pathname.includes('license')) {
    window.location.assign('/license')
  }
}

function cacheBlockedLicense(code: 'EXPIRED' | 'SUSPENDED', reason: string): LicenseStatus {
  const license: LicenseStatus = {
    ok: false,
    plan: 'unknown',
    status: code === 'SUSPENDED' ? 'suspended' : 'active',
    licenseKey: null,
    expiresAt: null,
    activatedAt: null,
    maxUsers: 0,
    daysLeft: -1,
    reason,
    code,
  }
  setCachedLicense(license)
  return license
}

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
    const finishWithoutHydrate = () => {
      if (!cancelled) {
        setReady(true)
        goToLicensePage()
      }
    }
    ;(async () => {
      try {
        try {
          await refreshSessionFromServer()
        } catch (e) {
          if (e instanceof ApiRequestError && e.status === 401) {
            clearSession()
            window.location.assign('/login')
            return
          }
        }

        // Always refresh licence status first. 200 + !ok (EXPIRED/SUSPENDED) must not hydrate.
        try {
          const license = await fetchLicenseStatus()
          if (license && !license.ok) {
            finishWithoutHydrate()
            return
          }
        } catch (e) {
          if (e instanceof ApiRequestError && e.status === 401) {
            clearSession()
            window.location.assign('/login')
            return
          }
          if (e instanceof ApiRequestError && (e.code === 'EXPIRED' || e.code === 'SUSPENDED' || e.status === 403)) {
            const body = e.body as { license?: LicenseStatus } | null
            if (body?.license) setCachedLicense(body.license)
            else cacheBlockedLicense(e.code === 'SUSPENDED' ? 'SUSPENDED' : 'EXPIRED', e.message)
            finishWithoutHydrate()
            return
          }
        }

        const cached = getCachedLicense()
        if (cached?.code === 'SUSPENDED') {
          finishWithoutHydrate()
          return
        }

        if (readStoredSession()?.mustChangePassword) {
          if (!cancelled) setReady(true)
          return
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
          if (e instanceof ApiRequestError && e.status === 401) {
            clearSession()
            window.location.assign('/login')
            return
          }
          if (e instanceof ApiRequestError && e.code === 'PASSWORD_CHANGE_REQUIRED') {
            setReady(true)
            return
          }
          if (e instanceof ApiRequestError && (e.code === 'EXPIRED' || e.code === 'SUSPENDED' || e.status === 403)) {
            setReady(true)
            goToLicensePage()
            return
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
