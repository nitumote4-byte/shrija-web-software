import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { applyReceptionWrite, publicReception, reduceReception } from './receptionCreds.js'

const PLAIN = 'synthetic-desk-password'

describe('reception credential storage', () => {
  it('hashes a legacy password once and does not change that hash on the next read', () => {
    const first = reduceReception({
      username: 'desk',
      password: PLAIN,
      macAddresses: 'AA-BB',
    })
    assert.equal(first.changed, true)
    assert.ok(first.record)
    assert.notEqual(first.record?.passwordHash, PLAIN)
    assert.match(first.record?.passwordHash || '', /^\$2[aby]\$/)

    const second = reduceReception(first.record)
    assert.equal(second.changed, false)
    assert.equal(second.record?.passwordHash, first.record?.passwordHash)
  })

  it('ignores a client-supplied hash and keeps a blank update on the existing hash', () => {
    const rejected = applyReceptionWrite(null, {
      username: 'desk',
      passwordHash: '$2b$10$not-a-password-the-client-sent',
      macAddresses: 'AA',
    })
    assert.equal(rejected.ok, false)

    const created = applyReceptionWrite(null, {
      username: 'desk',
      password: PLAIN,
      macAddresses: 'AA',
    })
    assert.equal(created.ok, true)
    if (!created.ok) return
    const kept = applyReceptionWrite(created.record, {
      username: 'desk',
      password: '',
      macAddresses: 'BB',
    })
    assert.equal(kept.ok, true)
    if (!kept.ok) return
    assert.equal(kept.record.passwordHash, created.record.passwordHash)
    assert.equal(kept.record.macAddresses, 'BB')

    const cleared = applyReceptionWrite(created.record, {
      username: 'desk',
      macAddresses: '',
    })
    assert.equal(cleared.ok, true)
    if (!cleared.ok) return
    assert.equal(cleared.record.macAddresses, '')
    assert.equal(cleared.record.passwordHash, created.record.passwordHash)
  })

  it('returns username, MAC addresses, and hasPassword only', () => {
    const created = applyReceptionWrite(null, {
      username: 'desk',
      password: PLAIN,
      macAddresses: 'AA',
    })
    assert.equal(created.ok, true)
    if (!created.ok) return
    const pub = publicReception(created.record)
    assert.deepEqual(pub, { username: 'desk', macAddresses: 'AA', hasPassword: true })
    const encoded = JSON.stringify(pub)
    assert.equal(encoded.includes(PLAIN), false)
    assert.equal(encoded.includes('passwordHash'), false)
    assert.equal(encoded.includes(created.record.passwordHash), false)
  })
})
