import crypto from 'node:crypto'
import { decryptLegacyManak } from './legacyManakCrypto.js'

const NEW_SALT = 'shrija-manak-creds-v2'
const SCRYPT = { N: 16384, r: 8, p: 1 } as const

function newKeyMaterial(): string {
  const secret = process.env.MANAK_ENCRYPTION_KEY
  if (!secret) throw new Error('MANAK_ENCRYPTION_KEY is required')
  return secret
}

function deriveNewKey(secret: string): Buffer {
  return crypto.scryptSync(secret, NEW_SALT, 32, SCRYPT)
}

function seal(plain: string, key: Buffer): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString('base64url')
}

function openWith(payload: string, key: Buffer): string {
  const buf = Buffer.from(payload, 'base64url')
  if (buf.length < 28) throw new Error('Invalid encrypted secret')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const data = buf.subarray(28)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

export type OpenedManakSecret = {
  plain: string
  /**
   * Present only after a legacy blob was decrypted and the new ciphertext
   * decrypted back to the same plaintext. Callers must not write otherwise.
   */
  replacement: string | null
}

/** Encrypt with MANAK_ENCRYPTION_KEY. Never uses the JWT signing secret. */
export function encryptSecret(plain: string): string {
  return seal(plain, deriveNewKey(newKeyMaterial()))
}

/**
 * Read a stored Manak secret.
 * Current ciphertext is returned as-is. Legacy JWT-derived ciphertext is
 * re-wrapped only after the new blob round-trips. A bad authentication tag
 * throws and leaves the stored value untouched.
 */
export function openManakSecret(payload: string): OpenedManakSecret {
  const nextKey = process.env.MANAK_ENCRYPTION_KEY
  if (nextKey) {
    try {
      return { plain: openWith(payload, deriveNewKey(nextKey)), replacement: null }
    } catch {
      // Not ciphertext under the current key.
    }
  }

  const legacySecret = process.env.JWT_SECRET
  if (!legacySecret) throw new Error('Invalid encrypted secret')
  const plain = decryptLegacyManak(payload, legacySecret)
  if (!nextKey) return { plain, replacement: null }

  const replacement = seal(plain, deriveNewKey(nextKey))
  const check = openWith(replacement, deriveNewKey(nextKey))
  if (check !== plain) throw new Error('Invalid encrypted secret')
  return { plain, replacement }
}

export function decryptSecret(payload: string): string {
  return openManakSecret(payload).plain
}
