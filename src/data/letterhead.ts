/**
 * Centre-wise billing letterhead (JWT tenant + session centre).
 * Never send or trust a browser-supplied centreId.
 */
import { api, readStoredSession } from '../api/client'

export const LETTERHEAD_EVENT = 'shrija-letterhead-updated'

export const LETTERHEAD_ALLOWED_MIMES = ['image/png', 'image/jpeg', 'image/webp'] as const
export const LETTERHEAD_MAX_BYTES = 2 * 1024 * 1024
export const LETTERHEAD_MIN_WIDTH = 200
export const LETTERHEAD_MAX_WIDTH = 8000
export const LETTERHEAD_MIN_HEIGHT = 40
export const LETTERHEAD_MAX_HEIGHT = 2500

export type CentreLetterhead = {
  id: string
  centreId: string
  fileName: string
  mimeType: string
  width: number
  height: number
  dataUrl: string
  updatedAt: string
}

export type LetterheadResponse = {
  letterhead: CentreLetterhead | null
  centreId: string
  centreKind: 'main' | 'osc'
  centreName: string
}

let cache: LetterheadResponse | null = null
let inflight: Promise<LetterheadResponse> | null = null

export function resetLetterheadCache() {
  cache = null
  inflight = null
}

export function getCachedLetterhead(): LetterheadResponse | null {
  return cache
}

function emitUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(LETTERHEAD_EVENT))
  }
}

function remember(next: LetterheadResponse) {
  cache = next
  emitUpdated()
  return next
}

function sessionCentreFallback() {
  const session = readStoredSession()
  return {
    centreId: session?.centreId || 'main',
    centreKind: (session?.centreKind === 'osc' ? 'osc' : 'main') as 'main' | 'osc',
    centreName: session?.centreName || session?.tenantName || 'Centre',
  }
}

export function centreLetterheadLabel(kind?: string | null, name?: string | null) {
  const session = sessionCentreFallback()
  const k = kind || session.centreKind
  const n = (name || session.centreName || '').trim()
  return `${k === 'osc' ? 'OSC' : 'Main'} · ${n || 'Centre'}`
}

function withSessionMeta(res: Partial<LetterheadResponse> & { letterhead: CentreLetterhead | null }): LetterheadResponse {
  const session = sessionCentreFallback()
  const kind =
    res.centreKind === 'osc' || res.centreKind === 'main' ? res.centreKind : session.centreKind
  return {
    letterhead: res.letterhead,
    centreId: res.centreId || session.centreId,
    centreKind: kind,
    centreName: res.centreName || session.centreName,
  }
}

export async function fetchLetterhead(force = false): Promise<LetterheadResponse> {
  if (!force && cache) return cache
  if (!force && inflight) return inflight
  inflight = (async () => {
    try {
      const res = await api<LetterheadResponse>('/api/data/letterhead')
      return remember(withSessionMeta({ ...res, letterhead: res.letterhead || null }))
    } catch {
      const empty = withSessionMeta({ letterhead: null })
      cache = empty
      emitUpdated()
      return empty
    } finally {
      inflight = null
    }
  })()
  return inflight
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

function imageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => reject(new Error('Invalid image file'))
    img.src = dataUrl
  })
}

export async function prepareLetterheadFile(file: File): Promise<{
  dataUrl: string
  mimeType: string
  fileName: string
  width: number
  height: number
}> {
  const mime = file.type === 'image/jpg' ? 'image/jpeg' : file.type
  if (!LETTERHEAD_ALLOWED_MIMES.includes(mime as (typeof LETTERHEAD_ALLOWED_MIMES)[number])) {
    throw new Error('Please choose a PNG, JPG, or WebP image')
  }
  if (file.size > LETTERHEAD_MAX_BYTES) {
    throw new Error('Letterhead must be 2 MB or smaller')
  }
  const dataUrl = await readFileAsDataUrl(file)
  const { width, height } = await imageDimensions(dataUrl)
  if (
    width < LETTERHEAD_MIN_WIDTH ||
    width > LETTERHEAD_MAX_WIDTH ||
    height < LETTERHEAD_MIN_HEIGHT ||
    height > LETTERHEAD_MAX_HEIGHT
  ) {
    throw new Error(
      `Image must be between ${LETTERHEAD_MIN_WIDTH}×${LETTERHEAD_MIN_HEIGHT} and ${LETTERHEAD_MAX_WIDTH}×${LETTERHEAD_MAX_HEIGHT} pixels`,
    )
  }
  return { dataUrl, mimeType: mime, fileName: file.name, width, height }
}

export async function saveLetterhead(file: File): Promise<LetterheadResponse> {
  const payload = await prepareLetterheadFile(file)
  const res = await api<LetterheadResponse>('/api/data/letterhead', {
    method: 'PUT',
    json: payload,
  })
  return remember(withSessionMeta({ ...res, letterhead: res.letterhead || null }))
}

export async function removeLetterhead(): Promise<LetterheadResponse> {
  const res = await api<LetterheadResponse>('/api/data/letterhead', { method: 'DELETE' })
  return remember(withSessionMeta({ ...res, letterhead: null }))
}
