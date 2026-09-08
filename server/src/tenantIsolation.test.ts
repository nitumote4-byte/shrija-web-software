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
  isOscOutlet,
  isOscRestrictedKvKey,
  listFirmOutlets,
  mergeAssignedOscOutlets,
  mergeMainStoreWrite,
  mergeOscStoreWrite,
  ownTenantPublicView,
  resolveCentreFromList,
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

  it('lets a stale Main PUT keep a new OSC party it never loaded', () => {
    const existing = {
      parties: [
        { id: 'p-main', name: 'Main Party', centreId: 'main' },
        { id: 'p-old', name: 'Old OSC', centreId: 'osc-a', centreKind: 'osc' },
        { id: 'p-new', name: 'New OSC', centreId: 'osc-a', centreKind: 'osc' },
      ],
      requests: [{ id: 'r-new', requestNo: 'HM-NEW', centreId: 'osc-a', centreKind: 'osc' }],
      invoices: [{ id: 'i-new', requestNo: 'HM-NEW', centreId: 'osc-a', centreKind: 'osc' }],
      categories: [{ id: 'c1', name: 'Gold' }],
    }
    const staleMain = {
      parties: [
        { id: 'p-main', name: 'Main Party', centreId: 'main' },
        { id: 'p-old', name: 'Old OSC', centreId: 'osc-a', centreKind: 'osc' },
      ],
      requests: [],
      invoices: [],
      categories: [{ id: 'c1', name: 'Gold' }],
    }
    const merged = mergeMainStoreWrite(existing, staleMain)
    const parties = merged.parties as { id: string }[]
    const requests = merged.requests as { id: string }[]
    const invoices = merged.invoices as { id: string }[]
    assert.equal(parties.some((p) => p.id === 'p-new'), true)
    assert.equal(parties.some((p) => p.id === 'p-old'), true)
    assert.equal(parties.some((p) => p.id === 'p-main'), true)
    assert.equal(requests.some((r) => r.id === 'r-new'), true)
    assert.equal(invoices.some((i) => i.id === 'i-new'), true)
  })

  it('lets Main lab update an OSC request it already has, without dropping a newer OSC bill', () => {
    const existing = {
      requests: [
        {
          id: 'r-osc',
          requestNo: 'HM-1',
          status: 'Pending',
          oscTransferStatus: 'sent_to_main',
          centreId: 'osc-a',
          centreKind: 'osc',
        },
      ],
      invoices: [{ id: 'i-osc', requestNo: 'HM-1', centreId: 'osc-a', centreKind: 'osc' }],
      parties: [{ id: 'p-osc', name: 'OSC Party', centreId: 'osc-a', centreKind: 'osc' }],
    }
    const incoming = {
      requests: [
        {
          id: 'r-osc',
          requestNo: 'HM-1',
          status: 'Assayed',
          oscTransferStatus: 'returned_to_osc',
          centreId: 'osc-a',
          centreKind: 'osc',
        },
      ],
      invoices: [],
      parties: [{ id: 'p-osc', name: 'OSC Party', centreId: 'osc-a', centreKind: 'osc' }],
    }
    const merged = mergeMainStoreWrite(existing, incoming)
    const req = (merged.requests as { id: string; status: string; oscTransferStatus: string }[]).find(
      (r) => r.id === 'r-osc',
    )
    const invoices = merged.invoices as { id: string }[]
    assert.equal(req?.status, 'Assayed')
    assert.equal(req?.oscTransferStatus, 'returned_to_osc')
    assert.equal(invoices.some((i) => i.id === 'i-osc'), true)
  })

  it('lets Main delete its own party while keeping OSC parties', () => {
    const existing = {
      parties: [
        { id: 'p-main', name: 'Main Party', centreId: 'main' },
        { id: 'p-osc', name: 'OSC Party', centreId: 'osc-a', centreKind: 'osc' },
      ],
    }
    const incoming = { parties: [] }
    const merged = mergeMainStoreWrite(existing, incoming)
    const parties = merged.parties as { id: string }[]
    assert.equal(parties.some((p) => p.id === 'p-main'), false)
    assert.equal(parties.some((p) => p.id === 'p-osc'), true)
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

describe('firm outlets for user creation', () => {
  const main = { name: 'Smg2', address: 'Main Road' }

  it('includes an OSC outlet even when kind is omitted but id is osc-*', () => {
    const list = listFirmOutlets(
      [
        { id: 'main', kind: 'main', name: 'Smg2' },
        { id: 'osc-smg2', name: 'Smg2 Off-Site' },
      ],
      main,
    )
    assert.equal(list.some((c) => c.id === 'osc-smg2' && c.kind === 'osc'), true)
    assert.equal(isOscOutlet({ id: 'osc-smg2' }), true)
  })

  it('includes a non-main row in the tenant centres list as OSC', () => {
    const list = listFirmOutlets(
      [
        { id: 'main', kind: 'main', name: 'Smg2' },
        { id: 'smg2-osc', name: 'OSC Smg2', address: 'Outlet road' },
      ],
      main,
    )
    const osc = list.find((c) => c.id === 'smg2-osc')
    assert.ok(osc)
    assert.equal(osc?.kind, 'osc')
  })

  it('does not treat another tenant id as an OSC outlet option', () => {
    const list = mergeAssignedOscOutlets(listFirmOutlets([], main), ['tn_other_centre'])
    assert.equal(list.some((c) => c.id === 'tn_other_centre'), false)
  })

  it('keeps an existing tenant user OSC assignment in the outlet list', () => {
    const list = mergeAssignedOscOutlets(listFirmOutlets([], main), ['osc-smg2', 'main'])
    assert.equal(list.some((c) => c.id === 'osc-smg2' && c.kind === 'osc'), true)
    assert.equal(list[0]?.kind, 'main')
  })

  it('resolves a listed OSC id as osc, and main stays main', () => {
    const list = listFirmOutlets(
      [
        { id: 'main', kind: 'main', name: 'Smg2' },
        { id: 'osc-smg2', kind: 'osc', name: 'OSC Smg2' },
      ],
      main,
    )
    const osc = resolveCentreFromList(list, 'osc-smg2', 'Smg2')
    assert.equal(osc.centreKind, 'osc')
    assert.equal(osc.centreId, 'osc-smg2')
    const home = resolveCentreFromList(list, 'main', 'Smg2')
    assert.equal(home.centreKind, 'main')
    assert.equal(home.centreId, 'main')
  })

  it('keeps an orphaned non-main centreId as OSC so lab stays on Main', () => {
    const list = listFirmOutlets([{ id: 'main', kind: 'main', name: 'Smg2' }], main)
    const orphan = resolveCentreFromList(list, 'osc-legacy', 'Smg2')
    assert.equal(orphan.centreKind, 'osc')
    assert.equal(orphan.centreId, 'osc-legacy')
  })
})
