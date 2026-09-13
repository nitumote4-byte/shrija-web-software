import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resolveStoreWriteBaseRev } from './storeWritePolicy.js'

describe('store write baseRev policy', () => {
  it('rejects normal writes without baseRev', () => {
    const r = resolveStoreWriteBaseRev({ baseRevRaw: undefined, replaceAll: false })
    assert.equal(r.ok, false)
    if (!r.ok) {
      assert.equal(r.status, 400)
      assert.equal(r.code, 'BASE_REV_REQUIRED')
    }
  })

  it('rejects normal writes with empty baseRev', () => {
    const r = resolveStoreWriteBaseRev({ baseRevRaw: '', replaceAll: false })
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.code, 'BASE_REV_REQUIRED')
  })

  it('rejects normal writes with null baseRev', () => {
    const r = resolveStoreWriteBaseRev({ baseRevRaw: null, replaceAll: false })
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.code, 'BASE_REV_REQUIRED')
  })

  it('accepts normal writes with valid baseRev', () => {
    const r = resolveStoreWriteBaseRev({ baseRevRaw: 3, replaceAll: false })
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.baseRev, 3)
  })

  it('accepts string numeric baseRev', () => {
    const r = resolveStoreWriteBaseRev({ baseRevRaw: '12', replaceAll: false })
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.baseRev, 12)
  })

  it('rejects invalid baseRev values', () => {
    for (const bad of [Number.NaN, Infinity, -1, 'abc']) {
      const r = resolveStoreWriteBaseRev({ baseRevRaw: bad, replaceAll: false })
      assert.equal(r.ok, false, `expected reject for ${String(bad)}`)
      if (!r.ok) assert.equal(r.code, 'BASE_REV_INVALID')
    }
  })

  it('allows replaceAll without baseRev (admin restore path)', () => {
    const r = resolveStoreWriteBaseRev({ baseRevRaw: undefined, replaceAll: true })
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.baseRev, null)
  })

  it('still parses baseRev when replaceAll provides one (stale check remains possible)', () => {
    const r = resolveStoreWriteBaseRev({ baseRevRaw: 7, replaceAll: true })
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.baseRev, 7)
  })
})
