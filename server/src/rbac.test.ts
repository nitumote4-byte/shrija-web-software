import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  canUseManakDesk,
  filterKvForRole,
  isAdminOnlyKvKey,
  isAdminUser,
  isKnownRole,
  pickStoreForRole,
  redactFirmProfileForRole,
  storeKeysForRole,
} from './rbac.js'
import { passwordPolicyError } from './passwordPolicy.js'

describe('RBAC store scoping', () => {
  const full = {
    parties: [{ id: 'p1' }],
    invoices: [{ id: 'i1' }],
    fireAssays: [{ id: 'f1' }],
    stock: [{ id: 's1' }],
    funds: [{ id: 'n1' }],
    requests: [{ id: 'r1' }],
  }

  it('does not send invoices or funds to lab roles', () => {
    const lab = pickStoreForRole(full, 'assay_lab')
    assert.equal('invoices' in lab, false)
    assert.equal('funds' in lab, false)
    assert.ok(lab.fireAssays)
    assert.ok(lab.stock)
    assert.ok(lab.requests)
  })

  it('does not send fireAssays or stock to reception', () => {
    const rec = pickStoreForRole(full, 'reception')
    assert.equal('fireAssays' in rec, false)
    assert.equal('stock' in rec, false)
    assert.ok(rec.invoices)
    assert.ok(rec.requests)
  })

  it('gives quality_manager the full blob', () => {
    assert.equal(storeKeysForRole('quality_manager'), '*')
    assert.deepEqual(pickStoreForRole(full, 'quality_manager'), full)
  })

  it('denies unknown roles', () => {
    assert.equal(isKnownRole('super_hacker'), false)
    assert.deepEqual(pickStoreForRole(full, 'super_hacker'), {})
  })
})

describe('RBAC secrets', () => {
  it('treats staff HR and Manak creds as admin-only KV', () => {
    assert.equal(isAdminOnlyKvKey('shrija-staff'), true)
    assert.equal(isAdminOnlyKvKey('manak_credentials'), true)
    assert.equal(isAdminOnlyKvKey('shrija-invoice-settings'), false)
  })

  it('strips admin KV for reception', () => {
    const filtered = filterKvForRole(
      { 'shrija-staff': [{ name: 'X' }], 'shrija-invoice-settings': '{}' },
      { role: 'reception', isAdmin: false },
    )
    assert.equal('shrija-staff' in filtered, false)
    assert.ok(filtered['shrija-invoice-settings'])
  })

  it('redacts bank fields from lab firm profile', () => {
    const redacted = redactFirmProfileForRole(
      { firmName: 'A', bankName: 'ICICI', accountNo: '99', ifsc: 'ICIC0001', address: 'Main' },
      { role: 'assay_lab', isAdmin: false },
    )
    assert.equal(redacted.firmName, 'A')
    assert.equal('bankName' in redacted, false)
    assert.equal('accountNo' in redacted, false)
  })

  it('allows Manak desk for reception and admin only', () => {
    assert.equal(canUseManakDesk({ role: 'reception', isAdmin: false }), true)
    assert.equal(canUseManakDesk({ role: 'quality_manager', isAdmin: true }), true)
    assert.equal(canUseManakDesk({ role: 'assay_lab', isAdmin: false }), false)
    assert.equal(canUseManakDesk({ role: 'accountant', isAdmin: false }), false)
  })

  it('treats quality_manager as admin even if isAdmin flag is stale false', () => {
    assert.equal(isAdminUser({ role: 'quality_manager', isAdmin: false }), true)
    assert.equal(isAdminUser({ role: 'reception', isAdmin: false }), false)
  })
})

describe('password policy', () => {
  it('rejects short and well-known passwords', () => {
    assert.ok(passwordPolicyError('ab'))
    assert.ok(passwordPolicyError('admin123'))
    assert.ok(passwordPolicyError('smg123'))
    assert.equal(passwordPolicyError('correct-horse-battery'), null)
  })

  it('rejects passwords that contain the username', () => {
    assert.ok(passwordPolicyError('qm_admin-xxxx', 'qm_admin'))
  })
})
