/**
 * One-time sampling-import confirmation kept inside the extension.
 * The QM page cannot create a ticket. A page message is only a wake-up.
 * Extension id is derived from the public key in the sampling extension manifest.
 */
export const SAMPLING_EXTENSION_ID = 'mjhbgacoafonlicldohfdlpdkajneoag'
export const CONFIRMATION_SOURCE = 'shrija-sampling-import'
export const CONFIRMATION_VERSION = 1
export const CONFIRMATION_TTL_MS = 30_000

const SHRIJA_ORIGIN = 'https://shrija-web-software.vercel.app'

export type SamplingConfirmationPayload = {
  extracted: unknown
  resolutions: { rowKey: string; shrijaId: string }[]
  overwriteRowKeys: string[]
}

export type ConfirmationConsumeResult =
  | { ok: true; payload: SamplingConfirmationPayload }
  | {
      ok: false
      code: 'MISSING' | 'EXPIRED' | 'REJECTED' | 'HASH_MISMATCH' | 'UNVERIFIED_SENDER'
    }

export type ExtensionSender = {
  id?: string
  url?: string
  origin?: string
  tab?: unknown
}

type Ticket = {
  text: string
  expiresAt: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((entry) => stable(entry))
  if (!isRecord(value)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value == null) {
      return value
    }
    return null
  }
  const sorted: Record<string, unknown> = {}
  for (const key of Object.keys(value).sort()) sorted[key] = stable(value[key])
  return sorted
}

export function canonicalConfirmation(input: unknown): SamplingConfirmationPayload {
  const record = isRecord(input) ? input : {}
  const resolutions = (Array.isArray(record.resolutions) ? record.resolutions : [])
    .map((entry) => {
      const row = isRecord(entry) ? entry : {}
      return { rowKey: clean(row.rowKey), shrijaId: clean(row.shrijaId) }
    })
    .filter((entry) => entry.rowKey && entry.shrijaId)
    .sort((a, b) => a.rowKey.localeCompare(b.rowKey) || a.shrijaId.localeCompare(b.shrijaId))
  const overwriteRowKeys = [
    ...new Set(
      (Array.isArray(record.overwriteRowKeys) ? record.overwriteRowKeys : []).map(clean).filter(Boolean),
    ),
  ].sort()
  return {
    extracted: stable(record.extracted ?? null),
    resolutions,
    overwriteRowKeys,
  }
}

export function canonicalConfirmationText(input: unknown): string {
  const canonical = canonicalConfirmation(input)
  return JSON.stringify({
    extracted: canonical.extracted,
    overwriteRowKeys: canonical.overwriteRowKeys,
    resolutions: canonical.resolutions,
  })
}

export async function hashConfirmationPayload(input: unknown): Promise<string> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) throw new Error('SHA-256 is not available')
  const bytes = new TextEncoder().encode(canonicalConfirmationText(input))
  const digest = await subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function isConfirmationHash(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value)
}

export function createConfirmationStore() {
  const tickets = new Map<string, Ticket>()

  const sweep = (now: number, keep?: string) => {
    for (const [hash, ticket] of tickets) {
      if (hash !== keep && now >= ticket.expiresAt) tickets.delete(hash)
    }
  }

  return {
    create(payload: unknown, hash: string, now: number) {
      if (!isConfirmationHash(hash)) return
      sweep(now)
      tickets.set(hash, {
        text: canonicalConfirmationText(payload),
        expiresAt: now + CONFIRMATION_TTL_MS,
      })
    },
    consume(hash: string, now: number): ConfirmationConsumeResult {
      if (!isConfirmationHash(hash)) return { ok: false, code: 'REJECTED' }
      sweep(now, hash)
      const ticket = tickets.get(hash)
      if (!ticket) return { ok: false, code: 'MISSING' }
      tickets.delete(hash)
      if (now >= ticket.expiresAt) return { ok: false, code: 'EXPIRED' }
      return { ok: true, payload: JSON.parse(ticket.text) as SamplingConfirmationPayload }
    },
  }
}

export type ConfirmationStore = ReturnType<typeof createConfirmationStore>

export async function sealConfirmation(
  store: ConfirmationStore,
  payload: unknown,
  claimedHash: unknown,
  now: number,
): Promise<{ ok: true } | { ok: false; code: 'HASH_MISMATCH' }> {
  if (typeof claimedHash !== 'string' || !isConfirmationHash(claimedHash)) {
    return { ok: false, code: 'HASH_MISMATCH' }
  }
  const actual = await hashConfirmationPayload(payload)
  if (actual !== claimedHash) return { ok: false, code: 'HASH_MISMATCH' }
  store.create(payload, actual, now)
  return { ok: true }
}

export function isPopupSender(sender: ExtensionSender | null | undefined, extensionId: string): boolean {
  if (!sender || !extensionId || sender.id !== extensionId) return false
  if (extensionId !== SAMPLING_EXTENSION_ID) return false
  if (sender.tab != null) return false
  const url = String(sender.url || '')
  const popup = `chrome-extension://${extensionId}/popup.html`
  return url === popup || url.startsWith(`${popup}?`)
}

export function isAllowedConsumeSender(sender: ExtensionSender | null | undefined): boolean {
  const raw = sender?.url || sender?.origin || ''
  if (!raw) return false
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }
  if (url.origin === SHRIJA_ORIGIN) return true
  if (url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) return true
  return false
}

function isExtensionMessage(message: unknown): message is Record<string, unknown> {
  return isRecord(message) && message.source === CONFIRMATION_SOURCE && message.version === CONFIRMATION_VERSION
}

export function acceptPopupConfirmation(
  message: unknown,
  sender: ExtensionSender | null | undefined,
  extensionId: string,
): boolean {
  if (!isExtensionMessage(message) || message.type !== 'CONFIRM_IMPORT') return false
  return isPopupSender(sender, extensionId)
}

export function acceptExternalConsume(message: unknown, sender: ExtensionSender | null | undefined): boolean {
  if (!isExtensionMessage(message) || message.type !== 'CONSUME_IMPORT') return false
  return isAllowedConsumeSender(sender)
}
