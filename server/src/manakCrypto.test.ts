import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { decryptSecret, encryptSecret, openManakSecret } from './crypto.js'
import { encryptLegacyManak } from './legacyManakCrypto.js'

const JWT = 'synthetic-jwt-secret-for-characterization-only'
const MANAK = 'synthetic-manak-encryption-key-not-jwt'
const PLAIN = 'synthetic-manak-password'

const previous = {
  JWT_SECRET: process.env.JWT_SECRET,
  MANAK_ENCRYPTION_KEY: process.env.MANAK_ENCRYPTION_KEY,
}

afterEach(() => {
  restore('JWT_SECRET', previous.JWT_SECRET)
  restore('MANAK_ENCRYPTION_KEY', previous.MANAK_ENCRYPTION_KEY)
})

function restore(name: 'JWT_SECRET' | 'MANAK_ENCRYPTION_KEY', value: string | undefined) {
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}

describe('Manak encryption migration', () => {
  it('refuses to encrypt when the dedicated key is missing', () => {
    delete process.env.MANAK_ENCRYPTION_KEY
    process.env.JWT_SECRET = JWT
    assert.throws(() => encryptSecret(PLAIN), /MANAK_ENCRYPTION_KEY is required/)
  })

  it('reads a legacy blob without rewriting it when the new key is absent', () => {
    delete process.env.MANAK_ENCRYPTION_KEY
    process.env.JWT_SECRET = JWT
    let stored = encryptLegacyManak(PLAIN, JWT)
    const opened = openManakSecret(stored)
    const original = stored
    assert.equal(opened.plain, PLAIN)
    assert.equal(opened.replacement, null)
    assert.equal(stored, original)
  })

  it('replaces legacy ciphertext only after the new blob round-trips', () => {
    process.env.JWT_SECRET = JWT
    process.env.MANAK_ENCRYPTION_KEY = MANAK
    let stored = encryptLegacyManak(PLAIN, JWT)
    const opened = openManakSecret(stored)
    assert.equal(opened.plain, PLAIN)
    assert.ok(opened.replacement)
    assert.notEqual(opened.replacement, stored)
    const check = openManakSecret(opened.replacement!)
    if (check.plain !== opened.plain) throw new Error('round-trip mismatch')
    stored = opened.replacement!
    assert.equal(decryptSecret(stored), PLAIN)
    assert.equal(openManakSecret(stored).replacement, null)
  })

  it('leaves a blob unchanged when authentication fails', () => {
    process.env.JWT_SECRET = JWT
    process.env.MANAK_ENCRYPTION_KEY = MANAK
    let stored = 'not-valid-ciphertext'
    assert.throws(() => openManakSecret(stored))
    assert.equal(stored, 'not-valid-ciphertext')
  })

  it('encrypts new passwords with the dedicated key only', () => {
    process.env.JWT_SECRET = JWT
    process.env.MANAK_ENCRYPTION_KEY = MANAK
    const sealed = encryptSecret(PLAIN)
    delete process.env.JWT_SECRET
    assert.equal(decryptSecret(sealed), PLAIN)
    assert.equal(openManakSecret(sealed).replacement, null)
  })
})
