import assert from 'node:assert/strict'
import { unionCentreScopedStore } from '../src/data/storeMerge.ts'

const remote = {
  parties: [
    { id: 'p-old', name: 'Old OSC' },
    { id: 'p-remote', name: 'From other tab' },
  ],
  requests: [{ id: 'r-old', requestNo: 'HM-1' }],
  invoices: [],
  categories: [{ id: 'c1', name: 'Gold' }],
}
const local = {
  parties: [
    { id: 'p-old', name: 'Old OSC edited' },
    { id: 'p-local', name: 'This tab' },
  ],
  requests: [
    { id: 'r-old', requestNo: 'HM-1' },
    { id: 'r-new', requestNo: 'HM-2' },
  ],
  invoices: [{ id: 'i-new', requestNo: 'HM-2' }],
  categories: [{ id: 'c1', name: 'Gold' }, { id: 'c2', name: 'Silver' }],
}

const merged = unionCentreScopedStore(remote, local)
const parties = merged.parties as { id: string; name: string }[]
const requests = merged.requests as { id: string }[]
const invoices = merged.invoices as { id: string }[]

assert.equal(parties.some((p) => p.id === 'p-remote'), true)
assert.equal(parties.some((p) => p.id === 'p-local'), true)
assert.equal(parties.find((p) => p.id === 'p-old')?.name, 'Old OSC edited')
assert.equal(requests.some((r) => r.id === 'r-new'), true)
assert.equal(invoices.some((i) => i.id === 'i-new'), true)
assert.equal((merged.categories as { id: string }[]).some((c) => c.id === 'c2'), true)

{
  const remote = {
    invoices: [{ id: 'i-a', requestNo: 'HM-1', centreId: 'osc-a', centreKind: 'osc' }],
    deletedInvoices: [],
    parties: [{ id: 'p-a', centreId: 'osc-a' }],
  }
  const local = {
    invoices: [],
    deletedInvoices: [
      { id: 'i-a', centreId: 'osc-a', centreKind: 'osc', deletedAt: '2026-09-12T12:00:00.000Z' },
    ],
    parties: [{ id: 'p-a', centreId: 'osc-a' }],
  }
  const reconciled = unionCentreScopedStore(remote, local)
  const invoices = reconciled.invoices as { id: string }[]
  assert.equal(
    invoices.some((i) => i.id === 'i-a'),
    false,
    '409 union must not restore a locally tombstoned OSC invoice',
  )
}

{
  const remote = {
    invoices: [{ id: 'i-legit', requestNo: 'HM-9', centreId: 'osc-a', centreKind: 'osc' }],
    deletedInvoices: [],
  }
  const local = {
    invoices: [],
    deletedInvoices: [],
  }
  const reconciled = unionCentreScopedStore(remote, local)
  const invoices = reconciled.invoices as { id: string }[]
  assert.equal(
    invoices.some((i) => i.id === 'i-legit'),
    true,
    '409 union still keeps remote-only invoices that were not deleted',
  )
}

console.log('store-merge.selftest.ts: ok')
