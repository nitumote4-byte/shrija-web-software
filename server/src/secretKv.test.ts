import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { mergeManakKvWrite, redactKvEntry } from './secretKv.js'

describe('secret KV redaction', () => {
  it('does not return a Manak password or ciphertext', () => {
    const pub = redactKvEntry('manak_credentials', {
      username: 'portal-user',
      password: 'synthetic-manak-password',
      passwordEnc: 'synthetic-ciphertext',
      baseUrl: 'https://example.test',
    })
    const encoded = JSON.stringify(pub)
    assert.equal(encoded.includes('synthetic-manak-password'), false)
    assert.equal(encoded.includes('synthetic-ciphertext'), false)
    assert.equal(encoded.includes('passwordEnc'), false)
    assert.equal((pub as { hasPassword: boolean }).hasPassword, true)
  })

  it('keeps the stored Manak ciphertext when a generic write tries to replace it', () => {
    const merged = mergeManakKvWrite(
      { username: 'portal-user', passwordEnc: 'stored-ciphertext', baseUrl: 'https://old.test' },
      {
        username: 'renamed',
        password: 'synthetic-manak-password',
        passwordEnc: 'attacker-ciphertext',
        baseUrl: 'https://new.test',
      },
    )
    assert.equal(merged.passwordEnc, 'stored-ciphertext')
    assert.equal('password' in merged, false)
    assert.equal(merged.username, 'renamed')
    assert.equal(merged.baseUrl, 'https://new.test')
  })

  it('does not return a reception password or hash', () => {
    const pub = redactKvEntry('shrija-reception-creds', {
      username: 'desk',
      password: 'synthetic-desk-password',
      passwordHash: '$2b$10$synthetic-hash-value',
      macAddresses: 'AA',
    })
    const encoded = JSON.stringify(pub)
    assert.equal(encoded.includes('synthetic-desk-password'), false)
    assert.equal(encoded.includes('passwordHash'), false)
    assert.equal(encoded.includes('$2b$'), false)
    assert.deepEqual(pub, { username: 'desk', macAddresses: 'AA', hasPassword: true })
  })
})
