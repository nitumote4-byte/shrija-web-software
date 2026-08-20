/**
 * Centre-wise billing letterhead — tenant + JWT centre scoped.
 * Client-supplied tenantId / centreId is never used to select a record.
 */

export const TENANT_DEFAULT_CENTRE_ID = '__tenant_default__'

export const LETTERHEAD_ALLOWED_MIMES = ['image/png', 'image/jpeg', 'image/webp'] as const
export type LetterheadMime = (typeof LETTERHEAD_ALLOWED_MIMES)[number]

export const LETTERHEAD_MAX_BYTES = 2 * 1024 * 1024
export const LETTERHEAD_MIN_WIDTH = 200
export const LETTERHEAD_MAX_WIDTH = 8000
export const LETTERHEAD_MIN_HEIGHT = 40
export const LETTERHEAD_MAX_HEIGHT = 2500

export type LetterheadRecord = {
  id: string
  tenantId: string
  centreId: string
  fileName: string
  mimeType: string
  width: number
  height: number
  dataUrl: string
  createdAt: string
  updatedAt: string
}

export type LetterheadSession = {
  tenantId: string
  centreId?: string | null
  centreKind?: 'main' | 'osc' | string | null
}

const DATA_URL_RE =
  /^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=\s]+)$/i

export function normalizeLetterheadMime(raw: string): LetterheadMime | null {
  const mime = String(raw || '')
    .trim()
    .toLowerCase()
    .replace('image/jpg', 'image/jpeg')
  if (LETTERHEAD_ALLOWED_MIMES.includes(mime as LetterheadMime)) {
    return mime as LetterheadMime
  }
  return null
}

function decodedBase64Bytes(b64: string): number {
  const compact = b64.replace(/\s+/g, '')
  const padding = compact.endsWith('==') ? 2 : compact.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor((compact.length * 3) / 4) - padding)
}

export type LetterheadValidationError = { ok: false; error: string }
export type LetterheadValidationOk = {
  ok: true
  mimeType: LetterheadMime
  byteLength: number
  width: number
  height: number
  dataUrl: string
  fileName: string
}

/**
 * Validate an uploaded letterhead image. Does not accept SVG or other executable types.
 */
export function validateLetterheadUpload(input: {
  dataUrl?: unknown
  mimeType?: unknown
  fileName?: unknown
  width?: unknown
  height?: unknown
}): LetterheadValidationOk | LetterheadValidationError {
  const dataUrl = typeof input.dataUrl === 'string' ? input.dataUrl.trim() : ''
  if (!dataUrl) return { ok: false, error: 'Letterhead image is required' }

  const match = DATA_URL_RE.exec(dataUrl)
  if (!match) {
    return { ok: false, error: 'Unsupported file. Use PNG, JPG, or WebP' }
  }

  const fromUrl = normalizeLetterheadMime(match[1])
  const claimed = normalizeLetterheadMime(String(input.mimeType || ''))
  if (!fromUrl) return { ok: false, error: 'Unsupported file. Use PNG, JPG, or WebP' }
  if (claimed && claimed !== fromUrl) {
    return { ok: false, error: 'Image type does not match the file contents' }
  }

  const byteLength = decodedBase64Bytes(match[2])
  if (byteLength < 32) return { ok: false, error: 'Image file is too small or invalid' }
  if (byteLength > LETTERHEAD_MAX_BYTES) {
    return { ok: false, error: 'Letterhead must be 2 MB or smaller' }
  }

  const width = Number(input.width)
  const height = Number(input.height)
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return { ok: false, error: 'Image dimensions are required' }
  }
  if (
    width < LETTERHEAD_MIN_WIDTH ||
    width > LETTERHEAD_MAX_WIDTH ||
    height < LETTERHEAD_MIN_HEIGHT ||
    height > LETTERHEAD_MAX_HEIGHT
  ) {
    return {
      ok: false,
      error: `Image must be between ${LETTERHEAD_MIN_WIDTH}×${LETTERHEAD_MIN_HEIGHT} and ${LETTERHEAD_MAX_WIDTH}×${LETTERHEAD_MAX_HEIGHT} pixels`,
    }
  }

  const fileName = String(input.fileName || 'letterhead')
    .trim()
    .replace(/[^\w.\- ()]/g, '')
    .slice(0, 180) || 'letterhead'

  return {
    ok: true,
    mimeType: fromUrl,
    byteLength,
    width: Math.round(width),
    height: Math.round(height),
    dataUrl,
    fileName,
  }
}

/**
 * Always bind letterhead I/O to the JWT tenant + JWT centre.
 * A centreId in the request body/query is ignored.
 */
export function letterheadScopeFromSession(user: LetterheadSession): {
  tenantId: string
  centreId: string
} {
  return {
    tenantId: String(user.tenantId),
    centreId: String(user.centreId || 'main').trim() || 'main',
  }
}

export function assertLetterheadAccess(
  user: LetterheadSession,
  requestedCentreId?: string | null,
): { ok: true; tenantId: string; centreId: string } | { ok: false; error: string } {
  const scope = letterheadScopeFromSession(user)
  const requested = String(requestedCentreId || '').trim()
  if (requested && requested !== scope.centreId) {
    if (user.centreKind === 'osc') {
      return { ok: false, error: 'centre_id mismatch — cross-centre access denied' }
    }
    // Main may not switch to another tenant; client centre ids are still ignored
    // so Main billing cannot accidentally load an OSC letterhead.
    return { ok: false, error: 'centre_id mismatch — use the authenticated centre' }
  }
  return { ok: true, ...scope }
}

/**
 * Pick the letterhead for billing:
 * 1) exact tenant + centre
 * 2) same-tenant default (never another centre's letterhead)
 * 3) none → caller uses a minimal fallback
 *
 * Records from other tenants are never returned.
 */
export function resolveLetterhead(
  records: LetterheadRecord[],
  tenantId: string,
  centreId: string,
): LetterheadRecord | null {
  const tid = String(tenantId)
  const cid = String(centreId || 'main').trim() || 'main'
  const scoped = records.filter((r) => r && String(r.tenantId) === tid)
  const exact = scoped.find((r) => String(r.centreId) === cid)
  if (exact) return exact
  const tenantDefault = scoped.find((r) => String(r.centreId) === TENANT_DEFAULT_CENTRE_ID)
  return tenantDefault || null
}

export function publicLetterheadView(row: LetterheadRecord | null) {
  if (!row) return null
  return {
    id: row.id,
    centreId: row.centreId,
    fileName: row.fileName,
    mimeType: row.mimeType,
    width: row.width,
    height: row.height,
    dataUrl: row.dataUrl,
    updatedAt: row.updatedAt,
  }
}
