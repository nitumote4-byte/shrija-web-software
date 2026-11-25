import { canonicalKvKey } from './secretKv.js'

const ARCHIVE_KEYS = new Set(['fire-assay-sheets-archive', 'manak-fire-assay-archive'])

export function isFireAssayArchiveKvKey(key: string): boolean {
  return ARCHIVE_KEYS.has(canonicalKvKey(key))
}

export function fireAssayArchivePrevKey(key: string): string {
  return `${canonicalKvKey(key)}-prev`
}

export function isFireAssayArchivePrevKvKey(key: string): boolean {
  const canonical = canonicalKvKey(key)
  return canonical.endsWith('-prev') && ARCHIVE_KEYS.has(canonical.slice(0, -'-prev'.length))
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'string') {
    try {
      return asRecord(JSON.parse(value))
    } catch {
      return null
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function filledRows(sheet: unknown): number {
  if (!sheet || typeof sheet !== 'object') return 0
  const rows = (sheet as { rows?: unknown }).rows
  if (!Array.isArray(rows)) return 0
  return rows.filter((row) => {
    if (!row || typeof row !== 'object') return false
    const job = String((row as { jobCardNo?: unknown }).jobCardNo || '').trim()
    const weight = Number((row as { sampleWeight?: unknown }).sampleWeight)
    const fineness = Number((row as { fineness?: unknown }).fineness)
    return Boolean(job) || weight > 0 || fineness > 0
  }).length
}

/**
 * A stale browser sends the whole archive. Keep every sheet already in the
 * database. An incoming copy replaces a sheet only when it still has at least
 * as many filled job rows, so an empty republish cannot wipe a BIS record.
 */
export function mergeFireAssayArchiveWrite(existing: unknown, incoming: unknown): Record<string, unknown> {
  const prev = asRecord(existing) ?? {}
  const next = asRecord(incoming)
  if (!next) return { ...prev }
  const merged: Record<string, unknown> = { ...prev }
  for (const [key, sheet] of Object.entries(next)) {
    const kept = prev[key]
    if (kept && filledRows(sheet) < filledRows(kept)) {
      merged[key] = kept
      continue
    }
    merged[key] = sheet
  }
  return merged
}
