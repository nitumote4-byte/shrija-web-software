import { flushStoreNow, getStoreCache, setStoreCache } from './tenantCache'
import { getFirmProfile, saveFirmProfile } from './firmProfile'
import { tenantGet, tenantSet } from './tenant'
import { getSession } from './auth'

export type BackupPayload = {
  version: number
  exportedAt: string
  tenantId?: string
  firm?: unknown
  store?: unknown
  kv?: Record<string, string>
}

export function buildLocalBackup(): BackupPayload {
  const kv: Record<string, string> = {}
  const keys = [
    'shrija-invoice-settings',
    'shrija-reception-creds',
    'shrija-cashflow',
    'shrija-operational-periods',
  ]
  for (const k of keys) {
    const v = tenantGet(k)
    if (v) kv[k] = v
  }
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    tenantId: getSession()?.tenantId,
    firm: getFirmProfile(),
    store: getStoreCache(),
    kv,
  }
}

export function downloadBackupFile() {
  const payload = buildLocalBackup()
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `shrija-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function restoreBackupFile(file: File): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const text = await file.text()
    const parsed = JSON.parse(text) as BackupPayload
    if (!parsed || typeof parsed !== 'object') throw new Error('Invalid backup')
    const tenantId = getSession()?.tenantId
    if (parsed.tenantId && tenantId && parsed.tenantId !== tenantId) {
      return { ok: false, error: 'This backup belongs to a different centre' }
    }
    if (parsed.store && typeof parsed.store === 'object') {
      setStoreCache(parsed.store as never)
      await flushStoreNow({ replaceAll: true })
    }
    if (parsed.firm && typeof parsed.firm === 'object') {
      saveFirmProfile(parsed.firm as never)
    }
    if (parsed.kv) {
      for (const [k, v] of Object.entries(parsed.kv)) {
        tenantSet(k, v)
      }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Restore failed' }
  }
}
