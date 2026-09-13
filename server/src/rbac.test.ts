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

  it('does not send other services to lab roles', () => {
    const withOs = { ...full, otherServices: [{ id: 'os1' }], otherServiceTypes: [{ id: 't1' }] }
    const lab = pickStoreForRole(withOs, 'assay_lab')
    assert.equal('otherServices' in lab, false)
    assert.equal('otherServiceTypes' in lab, false)
  })

  it('lets reception and accountant persist other services', () => {
    const withOs = { ...full, otherServices: [{ id: 'os1' }], otherServiceTypes: [{ id: 't1' }] }
    assert.ok(pickStoreForRole(withOs, 'reception').otherServices)
    assert.ok(pickStoreForRole(withOs, 'accountant').otherServices)
  })

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

  it('lets reception and accountant persist invoice tombstones', () => {
    const withTombs = { ...full, deletedInvoices: [{ id: 'i1', centreId: 'osc-a' }] }
    assert.ok(pickStoreForRole(withTombs, 'reception').deletedInvoices)
    assert.ok(pickStoreForRole(withTombs, 'accountant').deletedInvoices)
    assert.equal('deletedInvoices' in pickStoreForRole(withTombs, 'assay_lab'), false)
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
  it('treats staff HR, reception creds, and Manak creds as admin-only KV (normalized + legacy)', () => {
    assert.equal(isAdminOnlyKvKey('staff'), true)
    assert.equal(isAdminOnlyKvKey('shrija-staff'), true)
    assert.equal(isAdminOnlyKvKey('reception-creds'), true)
    assert.equal(isAdminOnlyKvKey('shrija-reception-creds'), true)
    assert.equal(isAdminOnlyKvKey('manak_credentials'), true)
    assert.equal(isAdminOnlyKvKey('shrija-manak_credentials'), true)
    assert.equal(isAdminOnlyKvKey('shrija-invoice-settings'), false)
    assert.equal(isAdminOnlyKvKey('invoice-settings'), false)
  })

  it('strips staff and reception-creds for lab, reception, and accountant', () => {
    const docs = {
      staff: [{ name: 'X', bank: 'hidden' }],
      'shrija-staff': [{ name: 'Legacy' }],
      'reception-creds': { username: 'desk', password: 'redacted-in-test' },
      'shrija-reception-creds': { username: 'legacy-desk' },
      'invoice-settings': '{}',
    }
    for (const role of ['assay_lab', 'in_lab', 'reception', 'accountant'] as const) {
      const filtered = filterKvForRole(docs, { role, isAdmin: false })
      assert.equal('staff' in filtered, false, `${role} must not see staff`)
      assert.equal('shrija-staff' in filtered, false, `${role} must not see shrija-staff`)
      assert.equal('reception-creds' in filtered, false, `${role} must not see reception-creds`)
      assert.equal(
        'shrija-reception-creds' in filtered,
        false,
        `${role} must not see shrija-reception-creds`,
      )
      assert.ok(filtered['invoice-settings'], `${role} keeps non-secret KV`)
    }
  })

  it('lets centre admin and quality_manager retain admin-only KV', () => {
    const docs = {
      staff: [{ name: 'X' }],
      'reception-creds': { username: 'desk' },
      manak_credentials: { username: 'm' },
    }
    for (const user of [
      { role: 'admin', isAdmin: true },
      { role: 'quality_manager', isAdmin: false },
    ]) {
      const filtered = filterKvForRole(docs, user)
      assert.ok(filtered.staff, `${user.role} keeps staff`)
      assert.ok(filtered['reception-creds'], `${user.role} keeps reception-creds`)
      assert.ok(filtered.manak_credentials, `${user.role} keeps manak_credentials`)
    }
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
