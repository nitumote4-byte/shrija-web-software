/**
 * Tenant isolation unit tests.
 * Run: npm --prefix server test
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  GENERIC_LOGIN_ERROR,
  collectClientCentreOverride,
  collectClientTenantOverride,
  filterFirmCentres,
  filterKvForSession,
  filterStoreForSession,
  isCrossTenantOverride,
  isOscRestrictedKvKey,
  mergeOscStoreWrite,
  ownTenantPublicView,
  selectPasswordMatch,
  stripClientTenantOverrides,
} from './tenantIsolation.js'

describe('login without centre selection', () => {
  it('resolves Center A from the user record when username+password match one account', () => {
    const user = selectPasswordMatch(
      [
        { passwordHash: 'hash-a', tenantId: 'tn_a', username: 'qm_a' },
        { passwordHash: 'hash-b', tenantId: 'tn_b', username: 'qm_a' },
      ],
      'secret-a',
      (plain, hash) => plain === 'secret-a' && hash === 'hash-a',
    )
    assert.ok(user)
    assert.equal(user.tenantId, 'tn_a')
  })

  it('does not require a client tenantId to authenticate', () => {
    const override = collectClientTenantOverride({ body: { username: 'qm_a', password: 'x' } })
    assert.equal(override, undefined)
  })

  it('returns no match when the password is wrong', () => {
    const user = selectPasswordMatch(
      [{ passwordHash: 'hash-a', tenantId: 'tn_a' }],
      'wrong',
      (plain, hash) => plain === 'secret-a' && hash === 'hash-a',
    )
    assert.equal(user, null)
  })

  it('refuses to pick a tenant when the same username+password exists in two centres', () => {
    const user = selectPasswordMatch(
      [
        { passwordHash: 'same', tenantId: 'tn_a' },
        { passwordHash: 'same', tenantId: 'tn_b' },
      ],
      'pw',
      (plain, hash) => plain === 'pw' && hash === 'same',
    )
    assert.equal(user, null)
  })

  it('uses a generic login error so usernames are not enumerated', () => {
    assert.equal(GENERIC_LOGIN_ERROR, 'Invalid username or password')
  })
})

describe('client tenant/centre overrides', () => {
  it('detects tenantId / tenant_id / tenantCode spoofing', () => {
    assert.equal(collectClientTenantOverride({ body: { tenantId: 'tn_b' } }), 'tn_b')
    assert.equal(collectClientTenantOverride({ query: { tenant_id: 'tn_b' } }), 'tn_b')
    assert.equal(collectClientTenantOverride({ params: { tenantCode: 'tn_b' } }), 'tn_b')
    assert.equal(isCrossTenantOverride('tn_a', 'tn_b'), true)
    assert.equal(isCrossTenantOverride('tn_a', 'tn_a'), false)
    assert.equal(isCrossTenantOverride('tn_a', undefined), false)
  })

  it('ignores a matching tenant id and strips override keys so handlers cannot use them', () => {
    const stripped = stripClientTenantOverrides({
      tenantId: 'tn_a',
      centreId: 'osc-1',
      data: { parties: [] },
    })
    assert.equal('tenantId' in stripped, false)
    assert.equal('centreId' in stripped, false)
    assert.deepEqual(stripped.data, { parties: [] })
  })

  it('reads centreId separately so it is not compared against tenantId', () => {
    assert.equal(collectClientCentreOverride({ query: { centreId: 'osc-2' } }), 'osc-2')
    assert.equal(collectClientTenantOverride({ query: { centreId: 'osc-2' } }), undefined)
  })
})

describe('store isolation for OSC vs other centres', () => {
  const payload = {
    parties: [
      { id: 'p-a', name: 'A Party', centreId: 'osc-a' },
      { id: 'p-b', name: 'B Party', centreId: 'osc-b' },
      { id: 'p-main', name: 'Main Party', centreId: 'main' },
    ],
    requests: [
      { requestNo: 'R-A', centreId: 'osc-a' },
      { requestNo: 'R-B', centreId: 'osc-b' },
    ],
    invoices: [
      { id: 'i-a', requestNo: 'R-A', centreId: 'osc-a' },
      { id: 'i-b', requestNo: 'R-B', centreId: 'osc-b' },
    ],
    funds: [],
    categories: [{ id: 'c1', name: 'Gold' }],
  }

  it('lets an OSC user read only their own centre records', () => {
    const scoped = filterStoreForSession(payload, { centreId: 'osc-a', centreKind: 'osc' })
    assert.equal((scoped.parties as { id: string }[]).map((p) => p.id).join(','), 'p-a')
    assert.equal((scoped.requests as { requestNo: string }[]).map((r) => r.requestNo).join(','), 'R-A')
    assert.equal((scoped.invoices as { id: string }[]).map((i) => i.id).join(','), 'i-a')
    assert.deepEqual(scoped.categories, payload.categories)
  })

  it('does not let OSC A see Center B parties by filtering the payload', () => {
    const scoped = filterStoreForSession(payload, { centreId: 'osc-a', centreKind: 'osc' })
    const names = (scoped.parties as { name: string }[]).map((p) => p.name)
    assert.equal(names.includes('B Party'), false)
    assert.equal(names.includes('Main Party'), false)
  })

  it('keeps the full tenant payload for main-centre users (lab handoff)', () => {
    const full = filterStoreForSession(payload, { centreId: 'main', centreKind: 'main' })
    assert.equal((full.parties as unknown[]).length, 3)
  })

  it('merges OSC writes without wiping another centre\'s rows', () => {
    const incoming = {
      parties: [
        { id: 'p-a2', name: 'A Updated', centreId: 'osc-a' },
        { id: 'p-stolen', name: 'Stolen B', centreId: 'osc-b' },
      ],
      requests: [],
      invoices: [],
    }
    const merged = mergeOscStoreWrite(payload, incoming, 'osc-a')
    const parties = merged.parties as { id: string; name: string; centreId: string }[]
    assert.equal(parties.some((p) => p.id === 'p-b' && p.name === 'B Party'), true)
    assert.equal(parties.some((p) => p.id === 'p-main'), true)
    assert.equal(parties.some((p) => p.id === 'p-a2' && p.centreKind === 'osc'), true)
    assert.equal(parties.some((p) => p.id === 'p-stolen'), false)
    assert.equal(parties.some((p) => p.id === 'p-a'), false)
  })
})

describe('centre list privacy', () => {
  it('own-tenant public view does not include gstin, emails, or other centres', () => {
    const view = ownTenantPublicView({
      id: 'tn_a',
      slug: 'centre-a',
      firmName: 'Centre A',
      plan: 'standard',
      status: 'active',
    })
    assert.deepEqual(view, {
      id: 'tn_a',
      slug: 'centre-a',
      firmName: 'Centre A',
      plan: 'standard',
      status: 'active',
    })
    assert.equal('gstin' in view, false)
  })

  it('OSC firm-profile centres list only includes the authenticated outlet', () => {
    const centres = [
      { id: 'main', kind: 'main', name: 'Main' },
      { id: 'osc-a', kind: 'osc', name: 'Outlet A' },
      { id: 'osc-b', kind: 'osc', name: 'Outlet B' },
    ]
    const filtered = filterFirmCentres(centres, { centreId: 'osc-a', centreKind: 'osc' })
    assert.equal(filtered.length, 1)
    assert.equal((filtered[0] as { name: string }).name, 'Outlet A')
  })

  it('OSC backup/kv cannot read tenant-wide Manak credentials', () => {
    const filtered = filterKvForSession(
      { invoice: { paper: 'A5' }, manak_credentials: { passwordEnc: 'secret' } },
      'osc',
    )
    assert.equal('invoice' in filtered, true)
    assert.equal('manak_credentials' in filtered, false)
    assert.equal(isOscRestrictedKvKey('manak_credentials', 'osc'), true)
    assert.equal(isOscRestrictedKvKey('manak_credentials', 'main'), false)
  })
})
