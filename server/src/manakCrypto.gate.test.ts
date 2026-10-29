/**
 * Legacy Manak cipher characterization.
 * The historical helper derived an AES-256-GCM key with scryptSync and no
 * options object. These checks lock that layout and Node's default cost
 * parameters. They use synthetic values only.
 */
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { describe, it } from 'node:test'
import {
  LEGACY_SCRYPT_N,
  LEGACY_SCRYPT_P,
  LEGACY_SCRYPT_R,
  decryptLegacyManak,
  deriveLegacyManakKey,
  encryptLegacyManak,
} from './legacyManakCrypto.js'

const SYNTHETIC_SECRET = 'synthetic-jwt-secret-for-characterization-only'
const SYNTHETIC_PLAIN = 'synthetic-manak-password'

describe('legacy Manak cipher characterization', () => {
  it('round-trips the historical iv | tag | ciphertext layout', () => {
    const payload = encryptLegacyManak(SYNTHETIC_PLAIN, SYNTHETIC_SECRET)
    const buf = Buffer.from(payload, 'base64url')
    assert.ok(buf.length > 28)
    assert.equal(buf.subarray(0, 12).length, 12)
    assert.equal(buf.subarray(12, 28).length, 16)
    assert.equal(decryptLegacyManak(payload, SYNTHETIC_SECRET), SYNTHETIC_PLAIN)
  })

  it('matches Node scryptSync when no options object is passed', () => {
    const implicit = deriveLegacyManakKey(SYNTHETIC_SECRET, false)
    const explicit = deriveLegacyManakKey(SYNTHETIC_SECRET, true)
    assert.equal(LEGACY_SCRYPT_N, 16384)
    assert.equal(LEGACY_SCRYPT_R, 8)
    assert.equal(LEGACY_SCRYPT_P, 1)
    assert.equal(crypto.timingSafeEqual(implicit, explicit), true)
  })
})
