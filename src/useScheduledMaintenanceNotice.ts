import { useEffect, useState } from 'react'
import { fetchScheduledMaintenanceNotice } from './data/scheduledMaintenanceNoticeApi'
import {
  presentScheduledMaintenance,
  type PresentedScheduledMaintenance,
} from './scheduledMaintenanceNotice'

const BANNER_KEY_PREFIX = 'shrija-sched-maint-banner:'

export function useScheduledMaintenanceNotice(): PresentedScheduledMaintenance | null {
  const [notice, setNotice] = useState<PresentedScheduledMaintenance | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetchScheduledMaintenanceNotice().then((draft) => {
      if (!cancelled) setNotice(draft ? presentScheduledMaintenance(draft) : null)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return notice
}

function bannerStorageKey(fingerprint: string) {
  return `${BANNER_KEY_PREFIX}${fingerprint}`
}

export function isMaintenanceBannerDismissed(fingerprint: string): boolean {
  try {
    return sessionStorage.getItem(bannerStorageKey(fingerprint)) === '1'
  } catch {
    return false
  }
}

export function dismissMaintenanceBanner(fingerprint: string) {
  try {
    sessionStorage.setItem(bannerStorageKey(fingerprint), '1')
  } catch {
    /* the in-memory dismiss still hides it for this view */
  }
}
