/**
 * Centre letterhead isolation + validation tests (no database).
 * Run: npm --prefix server test
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  TENANT_DEFAULT_CENTRE_ID,
  assertLetterheadAccess,
  letterheadScopeFromSession,
  publicLetterheadView,
  resolveLetterhead,
  validateLetterheadUpload,
  type LetterheadRecord,
} from './letterhead.js'

function pngDataUrl(byteHint = 80): string {
  // Valid-looking PNG prefix + padding so decoded size exceeds the minimum.
  const pad = 'A'.repeat(Math.max(0, byteHint))
  return `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==${pad}`
}

function rec(
  patch: Partial<LetterheadRecord> & Pick<LetterheadRecord, 'tenantId' | 'centreId'>,
): LetterheadRecord {
  return {
    id: patch.id || `lh_${patch.tenantId}_${patch.centreId}`,
    tenantId: patch.tenantId,
    centreId: patch.centreId,
    fileName: patch.fileName || 'letterhead.png',
    mimeType: patch.mimeType || 'image/png',
    width: patch.width || 1600,
    height: patch.height || 280,
    dataUrl: patch.dataUrl || pngDataUrl(),
    createdAt: patch.createdAt || '2026-01-01T00:00:00.000Z',
    updatedAt: patch.updatedAt || '2026-01-01T00:00:00.000Z',
  }
}

const tenantAMain = rec({ tenantId: 'tn_a', centreId: 'main', dataUrl: 'data:image/png;base64,MAINA' })
const tenantAOsc = rec({ tenantId: 'tn_a', centreId: 'osc-a', dataUrl: 'data:image/png;base64,OSCA' })
const tenantAOscB = rec({ tenantId: 'tn_a', centreId: 'osc-b', dataUrl: 'data:image/png;base64,OSCB' })
const tenantBMain = rec({ tenantId: 'tn_b', centreId: 'main', dataUrl: 'data:image/png;base64,MAINB' })
const tenantBOsc = rec({ tenantId: 'tn_b', centreId: 'osc-a', dataUrl: 'data:image/png;base64,BOSCA' })
const tenantADefault = rec({
  tenantId: 'tn_a',
  centreId: TENANT_DEFAULT_CENTRE_ID,
  dataUrl: 'data:image/png;base64,DEFAULTA',
})

const ALL = [tenantAMain, tenantAOsc, tenantAOscB, tenantBMain, tenantBOsc, tenantADefault]

describe('letterhead upload validation', () => {
  it('accepts PNG/JPEG/WebP data URLs within size and dimension limits', () => {
    const png = validateLetterheadUpload({
      dataUrl: pngDataUrl(120),
      mimeType: 'image/png',
      fileName: 'smg-letterhead.png',
      width: 1800,
      height: 320,
    })
    assert.equal(png.ok, true)
    if (png.ok) {
      assert.equal(png.mimeType, 'image/png')
      assert.equal(png.width, 1800)
      assert.equal(png.height, 320)
    }
  })

  it('rejects SVG and other unsupported types', () => {
    const svg = validateLetterheadUpload({
      dataUrl: 'data:image/svg+xml;base64,PHN2Zy4uLg==',
      mimeType: 'image/svg+xml',
      width: 800,
      height: 200,
    })
    assert.equal(svg.ok, false)
  })

  it('rejects a MIME spoof that does not match the data URL', () => {
    const spoof = validateLetterheadUpload({
      dataUrl: pngDataUrl(),
      mimeType: 'image/webp',
      width: 800,
      height: 200,
    })
    assert.equal(spoof.ok, false)
  })

  it('rejects oversized files and unreasonable dimensions', () => {
    const huge = validateLetterheadUpload({
      dataUrl: `data:image/png;base64,${'A'.repeat(4_000_000)}`,
      mimeType: 'image/png',
      width: 800,
      height: 200,
    })
    assert.equal(huge.ok, false)

    const tall = validateLetterheadUpload({
      dataUrl: pngDataUrl(),
      mimeType: 'image/png',
      width: 800,
      height: 9000,
    })
    assert.equal(tall.ok, false)
  })
})

describe('letterhead centre/tenant authorization', () => {
  it('binds scope to the JWT tenant and centre, ignoring a browser centreId', () => {
    const scope = letterheadScopeFromSession({
      tenantId: 'tn_a',
      centreId: 'main',
      centreKind: 'main',
    })
    assert.deepEqual(scope, { tenantId: 'tn_a', centreId: 'main' })
  })

  it('uses the OSC JWT centre, not Main', () => {
    const scope = letterheadScopeFromSession({
      tenantId: 'tn_a',
      centreId: 'osc-a',
      centreKind: 'osc',
    })
    assert.equal(scope.centreId, 'osc-a')
    assert.equal(scope.tenantId, 'tn_a')
  })

  it('denies an OSC user who asks for another outlet or Main', () => {
    const osc = { tenantId: 'tn_a', centreId: 'osc-a', centreKind: 'osc' as const }
    const otherOsc = assertLetterheadAccess(osc, 'osc-b')
    assert.equal(otherOsc.ok, false)
    const main = assertLetterheadAccess(osc, 'main')
    assert.equal(main.ok, false)
    const own = assertLetterheadAccess(osc, 'osc-a')
    assert.equal(own.ok, true)
    if (own.ok) assert.equal(own.centreId, 'osc-a')
  })

  it('denies Main switching onto an OSC letterhead via a supplied centreId', () => {
    const main = { tenantId: 'tn_a', centreId: 'main', centreKind: 'main' as const }
    const stealOsc = assertLetterheadAccess(main, 'osc-a')
    assert.equal(stealOsc.ok, false)
    const own = assertLetterheadAccess(main)
    assert.equal(own.ok, true)
    if (own.ok) assert.equal(own.centreId, 'main')
  })
})

describe('letterhead retrieval isolation', () => {
  it('returns the Main Centre letterhead for Main billing, not an OSC letterhead', () => {
    const row = resolveLetterhead(ALL, 'tn_a', 'main')
    assert.ok(row)
    assert.equal(row?.centreId, 'main')
    assert.equal(row?.tenantId, 'tn_a')
    assert.equal(row?.dataUrl.includes('MAINA'), true)
  })

  it('returns the OSC letterhead for that OSC, not Main and not another OSC', () => {
    const row = resolveLetterhead(ALL, 'tn_a', 'osc-a')
    assert.ok(row)
    assert.equal(row?.centreId, 'osc-a')
    assert.equal(row?.dataUrl.includes('OSCA'), true)
    assert.equal(row?.dataUrl.includes('MAINA'), false)
    assert.equal(row?.dataUrl.includes('OSCB'), false)
  })

  it('never returns Tenant B letterhead to Tenant A', () => {
    const main = resolveLetterhead(ALL, 'tn_a', 'main')
    const osc = resolveLetterhead(ALL, 'tn_a', 'osc-a')
    assert.notEqual(main?.tenantId, 'tn_b')
    assert.notEqual(osc?.dataUrl, tenantBOsc.dataUrl)
    assert.equal(resolveLetterhead(ALL, 'tn_a', 'main')?.dataUrl.includes('MAINB'), false)
  })

  it('never returns Tenant A Main when Tenant B OSC asks for osc-a', () => {
    const row = resolveLetterhead(ALL, 'tn_b', 'osc-a')
    assert.equal(row?.tenantId, 'tn_b')
    assert.equal(row?.centreId, 'osc-a')
    assert.equal(row?.dataUrl.includes('BOSCA'), true)
  })

  it('falls back to the tenant default, never another centre or tenant', () => {
    const missingOsc = resolveLetterhead(
      [tenantAMain, tenantADefault, tenantBMain],
      'tn_a',
      'osc-missing',
    )
    assert.equal(missingOsc?.centreId, TENANT_DEFAULT_CENTRE_ID)
    assert.equal(missingOsc?.tenantId, 'tn_a')
    assert.notEqual(missingOsc?.centreId, 'main')
  })

  it('returns null when the centre has no letterhead and no tenant default (minimal fallback)', () => {
    const row = resolveLetterhead([tenantAMain], 'tn_a', 'osc-a')
    assert.equal(row, null)
  })

  it('does not use Main as a fallback for OSC', () => {
    const row = resolveLetterhead([tenantAMain], 'tn_a', 'osc-a')
    assert.equal(row, null)
  })

  it('omits other-tenant rows even if centreId collides (both "main")', () => {
    const row = resolveLetterhead([tenantAMain, tenantBMain], 'tn_a', 'main')
    assert.equal(row?.id, tenantAMain.id)
    assert.equal(publicLetterheadView(row)?.dataUrl.includes('MAINB'), false)
  })
})
