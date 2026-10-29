import bcrypt from 'bcryptjs'

export type ReceptionStored = {
  username: string
  passwordHash: string
  macAddresses: string
}

export type ReceptionPublic = {
  username: string
  macAddresses: string
  hasPassword: boolean
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * One-way storage for the desk password. Nothing in this application compares
 * it during login, Manak fetch, or the scrap tool. Hashing exists so the value
 * cannot be read back.
 */
export function reduceReception(value: unknown): { record: ReceptionStored | null; changed: boolean } {
  const rec = asRecord(value)
  if (!rec) return { record: null, changed: false }

  const username = text(rec.username)
  const macAddresses = text(rec.macAddresses)
  const legacy = typeof rec.password === 'string' ? rec.password : ''
  const hash = typeof rec.passwordHash === 'string' ? rec.passwordHash : ''

  if (legacy) {
    return {
      changed: true,
      record: {
        username,
        macAddresses,
        passwordHash: bcrypt.hashSync(legacy, 10),
      },
    }
  }

  if (!hash) return { record: null, changed: false }

  const extra = Object.keys(rec).some(
    (key) => key !== 'username' && key !== 'passwordHash' && key !== 'macAddresses',
  )
  return {
    changed: extra,
    record: { username, macAddresses, passwordHash: hash },
  }
}

export function applyReceptionWrite(
  existing: unknown,
  incoming: unknown,
): { ok: true; record: ReceptionStored } | { ok: false; error: string } {
  const inc = asRecord(incoming)
  if (!inc) return { ok: false, error: 'value required' }

  const prev = reduceReception(existing).record
  const username = text(inc.username) || prev?.username || ''
  const macAddresses = text(inc.macAddresses) || (inc.macAddresses === '' ? '' : prev?.macAddresses || '')
  let passwordHash = prev?.passwordHash || ''
  if (typeof inc.password === 'string' && inc.password.length > 0) {
    passwordHash = bcrypt.hashSync(inc.password, 10)
  }
  if (!passwordHash) return { ok: false, error: 'password required' }
  if (!username) return { ok: false, error: 'username required' }

  return {
    ok: true,
    record: { username, passwordHash, macAddresses },
  }
}

export function publicReception(value: unknown): ReceptionPublic {
  const rec = asRecord(value)
  const username = text(rec?.username)
  const macAddresses = text(rec?.macAddresses)
  const hasPassword = Boolean(
    (typeof rec?.passwordHash === 'string' && rec.passwordHash) ||
      (typeof rec?.password === 'string' && rec.password) ||
      rec?.hasPassword === true,
  )
  return { username, macAddresses, hasPassword }
}
