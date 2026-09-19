/**
 * Durable pending KV for CG weights / Fire Assay archive.
 * Run: npx --yes tsx ./scripts/pending-kv.selftest.ts
 */
import assert from 'node:assert/strict'
import {
  applyPendingKvToDocs,
  clearAllPendingKv,
  clearPendingKvKeys,
  mergeCgWeightsJson,
  mergeFireAssayArchiveJson,
  pendingKvStorageKey,
  readPendingKv,
  rememberPendingKvRemove,
  rememberPendingKvSet,
  setPendingKvStorageForTests,
} from '../src/data/pendingKv.ts'

class MemoryStorage {
  private map = new Map<string, string>()
  getItem(key: string) {
    return this.map.has(key) ? this.map.get(key)! : null
  }
  setItem(key: string, value: string) {
    this.map.set(key, value)
  }
  removeItem(key: string) {
    this.map.delete(key)
  }
}

const scope = { tenantId: 'tn_test' }
const storage = new MemoryStorage()
setPendingKvStorageForTests(storage)
clearAllPendingKv(scope)

assert.equal(pendingKvStorageKey(scope), 'shrija-pending-kv:v1:tn_test')

rememberPendingKvSet(scope, 'qm-cg-weights', JSON.stringify([{ id: 1, weight: 100, used: false }]))
rememberPendingKvSet(
  scope,
  'fire-assay-sheets-archive',
  JSON.stringify({ '2026-09-18|916|Day|1': { sheetNo: '1', purity: '916' } }),
)

const pending = readPendingKv(scope)
assert.equal(pending['qm-cg-weights']?.op, 'set')
assert.equal(pending['fire-assay-sheets-archive']?.op, 'set')

const serverDocs = {
  'qm-cg-weights': JSON.stringify([{ id: 1, weight: 99, used: true }, { id: 2, weight: 50, used: false }]),
  'fire-assay-sheets-archive': JSON.stringify({
    '2026-09-09|916|Day|1': { sheetNo: '1', purity: '916' },
    '2026-09-18|916|Day|1': { sheetNo: '1', purity: '916', stale: true },
  }),
}

const applied = applyPendingKvToDocs(serverDocs, scope)
assert.ok(applied.dirtyKeys.includes('qm-cg-weights'))
assert.ok(applied.dirtyKeys.includes('fire-assay-sheets-archive'))

const cg = JSON.parse(applied.docs['qm-cg-weights']) as { id: number; weight: number; used: boolean }[]
assert.equal(cg.find((r) => r.id === 1)?.weight, 100)
assert.equal(cg.find((r) => r.id === 1)?.used, false)
assert.equal(cg.find((r) => r.id === 2)?.weight, 50)

const archive = JSON.parse(applied.docs['fire-assay-sheets-archive']) as Record<string, { stale?: boolean }>
assert.ok(archive['2026-09-09|916|Day|1'])
assert.equal(archive['2026-09-18|916|Day|1']?.stale, undefined)

assert.equal(
  mergeCgWeightsJson(
    JSON.stringify([{ id: 1, weight: 1 }]),
    JSON.stringify([{ id: 1, weight: 2 }, { id: 3, weight: 3 }]),
  ),
  JSON.stringify([{ id: 1, weight: 2 }, { id: 3, weight: 3 }]),
)

assert.equal(
  mergeFireAssayArchiveJson(
    JSON.stringify({ a: 1, b: 2 }),
    JSON.stringify({ b: 9, c: 3 }),
  ),
  JSON.stringify({ a: 1, b: 9, c: 3 }),
)

rememberPendingKvRemove(scope, 'manak-fire-assay-sheet')
const withRemove = applyPendingKvToDocs(
  { ...applied.docs, 'manak-fire-assay-sheet': '{"x":1}' },
  scope,
)
assert.equal('manak-fire-assay-sheet' in withRemove.docs, false)

clearPendingKvKeys(scope, ['qm-cg-weights'])
assert.equal(readPendingKv(scope)['qm-cg-weights'], undefined)
assert.ok(readPendingKv(scope)['fire-assay-sheets-archive'])

clearAllPendingKv(scope)
assert.deepEqual(readPendingKv(scope), {})

setPendingKvStorageForTests(null)
console.log('pending-kv.selftest: all assertions passed')
