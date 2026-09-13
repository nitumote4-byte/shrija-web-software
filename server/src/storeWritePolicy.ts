/**
 * Store write concurrency policy.
 * Normal merge PUTs must include baseRev; replaceAll may omit it.
 */

export type StoreBaseRevResult =
  | { ok: true; baseRev: number | null }
  | { ok: false; status: 400; error: string; code: 'BASE_REV_REQUIRED' | 'BASE_REV_INVALID' }

function hasProvidedBaseRev(baseRevRaw: unknown): boolean {
  return baseRevRaw !== undefined && baseRevRaw !== null && baseRevRaw !== ''
}

function parseRev(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.trunc(n)
}

/**
 * Resolve baseRev for PUT /api/data/store.
 * - Normal writes: baseRev required and must be a non-negative number.
 * - replaceAll (admin restore): baseRev optional; when present it is still validated
 *   and compared for stale conflicts by the route handler.
 */
export function resolveStoreWriteBaseRev(opts: {
  baseRevRaw: unknown
  replaceAll: boolean
}): StoreBaseRevResult {
  const provided = hasProvidedBaseRev(opts.baseRevRaw)
  if (!opts.replaceAll && !provided) {
    return {
      ok: false,
      status: 400,
      error: 'baseRev is required for store writes',
      code: 'BASE_REV_REQUIRED',
    }
  }
  if (!provided) {
    return { ok: true, baseRev: null }
  }
  const baseRev = parseRev(opts.baseRevRaw)
  if (baseRev == null) {
    return {
      ok: false,
      status: 400,
      error: 'baseRev must be a non-negative number',
      code: 'BASE_REV_INVALID',
    }
  }
  return { ok: true, baseRev }
}
