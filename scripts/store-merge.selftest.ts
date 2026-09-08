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

console.log('store-merge.selftest.ts: ok')
