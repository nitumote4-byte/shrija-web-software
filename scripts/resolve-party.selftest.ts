/**
 * Orphan party resolve — after delete+recreate, billing still finds CML / state by name.
 * Run: npx --yes tsx scripts/resolve-party.selftest.ts
 */
import { isOrphanPartyId, resolveParty } from '../src/utils/resolveParty.ts'

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg)
}

function assertEq(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

const parties = [
  { id: 'p-new', name: 'VASANT JEWELLERS', licenseNo: 'CML-999', state: 'Bihar' },
  { id: 'p-other', name: 'Other Shop', licenseNo: 'CML-1', state: 'Bihar' },
]

assertEq(
  resolveParty(parties, { partyId: 'p-new', partyName: 'VASANT JEWELLERS' })?.id,
  'p-new',
  'id match wins',
)

assertEq(
  resolveParty(parties, { partyId: 'p-deleted', partyName: 'VASANT JEWELLERS' })?.id,
  'p-new',
  'orphan id falls back to name',
)

assertEq(
  resolveParty(parties, { partyId: 'p-deleted', partyName: 'vasant  jewellers' })?.id,
  'p-new',
  'name normalize ignores case/spaces',
)

assertEq(
  resolveParty(parties, { partyId: 'p-deleted', partyName: 'Missing Party' }),
  undefined,
  'unknown name returns undefined',
)

assert(isOrphanPartyId(parties, 'p-deleted'), 'deleted id is orphan')
assert(!isOrphanPartyId(parties, 'p-new'), 'live id is not orphan')
assert(!isOrphanPartyId(parties, ''), 'empty id is not orphan')

// --- store heal on addParty (delete + recreate) ---
const mem = new Map<string, string>()
const localStorageMock = {
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k: string, v: string) => {
    mem.set(k, String(v))
  },
  removeItem: (k: string) => {
    mem.delete(k)
  },
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
}
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, configurable: true })
mem.set('shrija-active-tenant', 'tn-resolve-party-selftest')

const { store } = await import('../src/data/store.ts')

const partyFields = {
  phone: '',
  address: 'Darbhanga',
  gstin: '10AAAAA0000A1Z5',
  transactionType: 'Cash' as const,
  state: 'Bihar',
  stateCode: '10',
  groupName: '',
  skipMinBill: false,
  skipRejectedPics: false,
  skipCutting: false,
  igstApplicable: false,
  discount: 0,
  minBillCalc: false,
}

{
  const original = store.addParty({
    name: 'VASANT JEWELLERS',
    licenseNo: 'CML-OLD',
    ...partyFields,
  })
  const req = store.addRequest({
    partyId: original.id,
    partyName: original.name,
    categoryId: 'c1',
    categoryName: 'Pendant',
    purity: '916',
    pieces: 2,
    weight: 10,
    status: 'Assayed',
  })

  assert(store.deleteParty(original.id), 'delete party')
  assert(
    isOrphanPartyId(store.getAll().parties, req.partyId),
    'request partyId orphaned after delete',
  )

  const recreated = store.addParty({
    name: 'VASANT JEWELLERS',
    licenseNo: 'CML-NEW-999',
    ...partyFields,
  })

  const healed = store.getAll().requests.find((r) => r.id === req.id)
  assertEq(healed?.partyId, recreated.id, 'addParty relinks orphaned request')
  assertEq(
    resolveParty(store.getAll().parties, {
      partyId: 'still-orphan-id',
      partyName: healed?.partyName,
    })?.licenseNo,
    'CML-NEW-999',
    'billing resolve sees new CML by name',
  )
}

console.log('resolve-party.selftest: ok')
