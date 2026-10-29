import { publicReception } from './receptionCreds.js'

export function canonicalKvKey(key: string): string {
  const value = String(key || '').trim()
  return value.startsWith('shrija-') ? value.slice('shrija-'.length) : value
}

export function isReceptionKvKey(key: string): boolean {
  return canonicalKvKey(key) === 'reception-creds'
}

export function isManakKvKey(key: string): boolean {
  return canonicalKvKey(key) === 'manak_credentials'
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** Browser-facing Manak record. The stored ciphertext stays in the database. */
export function publicManak(value: unknown): Record<string, unknown> {
  const rec = asRecord(value) ?? {}
  return {
    username: text(rec.username),
    baseUrl: text(rec.baseUrl),
    bridgeUrl: text(rec.bridgeUrl),
    allowedMacs: text(rec.allowedMacs),
    updatedAt: text(rec.updatedAt),
    hasPassword: Boolean(text(rec.passwordEnc) || text(rec.password) || rec.hasPassword === true),
  }
}

/**
 * Generic KV writes must not replace or clear the server-held Manak ciphertext.
 * Credential changes go through PUT /api/data/manak/credentials.
 */
export function mergeManakKvWrite(existing: unknown, incoming: unknown): Record<string, unknown> {
  const prev = asRecord(existing) ?? {}
  const inc = asRecord(incoming) ?? {}
  const next: Record<string, unknown> = { ...inc }
  delete next.password
  delete next.passwordEnc
  if (typeof prev.passwordEnc === 'string' && prev.passwordEnc) {
    next.passwordEnc = prev.passwordEnc
  }
  return next
}

export function redactKvEntry(key: string, value: unknown): unknown {
  if (isReceptionKvKey(key)) return publicReception(value)
  if (isManakKvKey(key)) return publicManak(value)
  return value
}
