import { useEffect, useState, type ReactNode } from 'react'
import { ApiRequestError, getToken, readStoredSession } from '../api/client'
import { clearSession, isAuthenticated, refreshSessionFromServer } from '../data/auth'
import { fetchLicenseStatus, getCachedLicense, setCachedLicense, type LicenseStatus } from '../data/license'
import { hydrateTenantData, isTenantHydrated, flushPendingKv } from '../data/tenantCache'
import { recoverFireAssaySheetFromBrowserCache } from '../data/manakFireAssayBridge'

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
  const [phase, setPhase] = useState<'loading' | 'out' | 'app'>(() =>
    !isAuthenticated() || isTenantHydrated() ? 'app' : 'loading',
  )
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
        if (recoverFireAssaySheetFromBrowserCache()) {
          void flushPendingKv()
        }
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

  useEffect(() => {
    if (!ready || phase === 'app') return
    setPhase('out')
    const timer = window.setTimeout(() => setPhase('app'), 400)
    return () => window.clearTimeout(timer)
  }, [ready, phase])

  useEffect(() => {
    if (phase === 'app') return
    document.documentElement.classList.add('promo-on')
    return () => document.documentElement.classList.remove('promo-on')
  }, [phase])

  if (phase !== 'app') {
    return (
      <div
        className={phase === 'out' ? 'suite-promo is-hold is-out' : 'suite-promo is-hold'}
        role="status"
        aria-live="polite"
        aria-label="Loading centre data"
      >
        <img className="suite-promo-logo" src="/logo.svg" width="112" height="112" alt="" />
        <p className="suite-promo-name">
          <strong>Shrija</strong>
          <small>Hallmark Suite</small>
        </p>
        <span className="suite-promo-line" aria-hidden="true" />
        {error ? <p className="suite-promo-error">{error}</p> : null}
      </div>
    )
  }

  return <>{children}</>
}
