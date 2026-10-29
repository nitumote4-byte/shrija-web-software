import crypto from 'node:crypto'

/** Salt and layout copied from the historical encryptSecret implementation. */
export const LEGACY_MANAK_SALT = 'shrija-manak-creds-v1'

/**
 * Node's scryptSync defaults when no options object is passed.
 * The characterization test must show these match a no-options derivation
 * before any ciphertext is rewritten.
 */
export const LEGACY_SCRYPT_N = 16384
export const LEGACY_SCRYPT_R = 8
export const LEGACY_SCRYPT_P = 1

export function deriveLegacyManakKey(secret: string, explicitParams = false): Buffer {
  if (explicitParams) {
    return crypto.scryptSync(secret, LEGACY_MANAK_SALT, 32, {
      N: LEGACY_SCRYPT_N,
      r: LEGACY_SCRYPT_R,
      p: LEGACY_SCRYPT_P,
    })
  }
  return crypto.scryptSync(secret, LEGACY_MANAK_SALT, 32)
}

/** AES-256-GCM, base64url(iv[12] | tag[16] | ciphertext). Same layout as the original helper. */
export function encryptLegacyManak(plain: string, secret: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveLegacyManakKey(secret), iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString('base64url')
}

export function decryptLegacyManak(payload: string, secret: string): string {
  const buf = Buffer.from(payload, 'base64url')
  if (buf.length < 28) throw new Error('Invalid encrypted secret')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const data = buf.subarray(28)
  const decipher = crypto.createDecipheriv('aes-256-gcm', deriveLegacyManakKey(secret), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}
