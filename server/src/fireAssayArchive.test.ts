import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  fireAssayArchivePrevKey,
  isFireAssayArchiveKvKey,
  isFireAssayArchivePrevKvKey,
  mergeFireAssayArchiveWrite,
} from './fireAssayArchive.js'

const filled = (jobCardNo: string) => ({ jobCardNo, sampleWeight: 1, fineness: 916 })

describe('fire assay archive merge', () => {
  it('keeps sheets the incoming browser never had', () => {
    const merged = mergeFireAssayArchiveWrite(
      {
        '2026-11-05|916|Day|1': { sheetNo: '1', rows: [filled('1_100')] },
        '2026-11-21|916|Day|4': { sheetNo: '4', rows: [filled('1_200')] },
      },
      {
        '2026-11-23|916|Day|1': { sheetNo: '1', rows: [filled('1_300')] },
      },
    )
    assert.equal(Object.keys(merged).length, 3)
    assert.ok(merged['2026-11-05|916|Day|1'])
    assert.ok(merged['2026-11-21|916|Day|4'])
    assert.ok(merged['2026-11-23|916|Day|1'])
  })

  it('does not replace a filled sheet with an empty republish', () => {
    const kept = { sheetNo: '1', rows: [filled('1_100'), filled('1_101')] }
    const merged = mergeFireAssayArchiveWrite(
      { '2026-11-23|916|Day|1': kept },
      { '2026-11-23|916|Day|1': { sheetNo: '1', rows: [] } },
    )
    assert.deepEqual(merged['2026-11-23|916|Day|1'], kept)
  })

  it('accepts an edit that still has the filled rows', () => {
    const merged = mergeFireAssayArchiveWrite(
      { '2026-11-23|916|Day|1': { sheetNo: '1', rows: [filled('1_100')] } },
      { '2026-11-23|916|Day|1': { sheetNo: '1', rows: [{ ...filled('1_100'), silver: 370 }] } },
    )
    assert.equal(
      (merged['2026-11-23|916|Day|1'] as { rows: { silver: number }[] }).rows[0].silver,
      370,
    )
  })

  it('names the archive keys that must not be deleted', () => {
    assert.equal(isFireAssayArchiveKvKey('shrija-fire-assay-sheets-archive'), true)
    assert.equal(isFireAssayArchiveKvKey('manak-fire-assay-archive'), true)
    assert.equal(isFireAssayArchiveKvKey('invoice-settings'), false)
    assert.equal(fireAssayArchivePrevKey('fire-assay-sheets-archive'), 'fire-assay-sheets-archive-prev')
    assert.equal(isFireAssayArchivePrevKvKey('fire-assay-sheets-archive-prev'), true)
  })
})
