/**
 * Party GSTIN optional — validation, store save, display, billing mapping.
 * Run: npx --yes tsx scripts/party-gstin-optional.selftest.ts
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  displayPartyGstin,
  invoicePartyGstin,
  isFakeGstinPlaceholder,
  normalizePartyGstin,
  PARTY_GSTIN_ERROR,
  validatePartyGstin,
} from '../src/utils/partyGstin.ts'

const FAKE_GSTINS = ['NA', 'NOT APPLICABLE', 'UNREGISTERED', '000000000000000']

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg)
}

function assertEq(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

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
mem.set('shrija-active-tenant', 'tn-gstin-selftest')

const { store } = await import('../src/data/store.ts')

function partyInput(gstin: string) {
  return {
    name: 'Dagru Sheth',
    phone: '',
    address: 'bara bazar',
    gstin,
    transactionType: 'Cash' as const,
    licenseNo: 'LIC-5390',
    state: 'Bihar',
    stateCode: '10',
    groupName: '',
    skipMinBill: false,
    skipRejectedPics: true,
    skipCutting: true,
    igstApplicable: false,
    discount: 0,
    minBillCalc: false,
  }
}

function submitParty(gstin: string) {
  const error = validatePartyGstin(gstin)
  if (error) return { ok: false as const, error }
  return { ok: true as const, gstin: normalizePartyGstin(gstin) }
}

// --- 1. Valid GSTIN saves ---
{
  const submitted = submitParty('27AAAAA0000A1Z5')
  assert(submitted.ok, 'valid GSTIN should pass validation')
  const saved = store.addParty(partyInput(submitted.ok ? submitted.gstin : ''))
  assertEq(saved.gstin, '27AAAAA0000A1Z5', 'valid GSTIN stored as entered')
  assertEq(displayPartyGstin(saved.gstin), '27AAAAA0000A1Z5', 'valid GSTIN displays as entered')
}

// --- 2. Blank GST saves ---
{
  const submitted = submitParty('')
  assert(submitted.ok, 'blank GST should pass validation')
  assertEq(submitted.ok ? submitted.gstin : 'fail', '', 'blank GST normalizes to empty string')
  const saved = store.addParty(partyInput(submitted.ok ? submitted.gstin : 'SHOULD_NOT_SAVE'))
  assertEq(saved.gstin, '', 'blank GST stored as empty string')
}

// --- 3. Invalid non-empty GSTIN → existing error ---
{
  const submitted = submitParty('INVALID')
  assert(!submitted.ok, 'invalid GSTIN should fail validation')
  assertEq(submitted.ok ? '' : submitted.error, PARTY_GSTIN_ERROR, 'invalid GSTIN uses existing error copy')
  const short = validatePartyGstin('22AAAAA0000A1Z')
  assertEq(short, PARTY_GSTIN_ERROR, '14-character GSTIN is invalid')
  const long = validatePartyGstin('22AAAAA0000A1Z55')
  assertEq(long, PARTY_GSTIN_ERROR, '16-character GSTIN is invalid')
}

// --- 4 & 5. Existing parties display ---
{
  const withGst = store.addParty(partyInput('27BBBBB0000B1Z5'))
  withGst.name = 'Rajesh Jewellers'
  const withoutGst = store.addParty({ ...partyInput(''), name: 'Mehta Ornaments' })
  assertEq(displayPartyGstin(withGst.gstin), '27BBBBB0000B1Z5', 'existing party with GST displays GSTIN')
  assertEq(displayPartyGstin(withoutGst.gstin), '—', 'existing party without GST displays em dash')
  const listed = store.getAllRaw().parties
  const foundWith = listed.find((p) => p.gstin === '27BBBBB0000B1Z5')
  const foundWithout = listed.find((p) => p.id === withoutGst.id)
  assert(foundWith, 'existing party with GST remains in store')
  assertEq(foundWithout?.gstin, '', 'existing party without GST remains blank in store')
}

// --- 6. Billing / customer mapping with blank GST ---
{
  const party = store.addParty({ ...partyInput(''), name: 'Unregistered Jeweller' })
  const billed = invoicePartyGstin(party)
  assertEq(billed, '', 'billing partyGstin is empty string when GST is blank')
  assertEq(invoicePartyGstin({ gstin: '27AAAAA0000A1Z5' }), '27AAAAA0000A1Z5', 'billing keeps GSTIN when present')
  assertEq(invoicePartyGstin(undefined), '', 'billing survives missing party')
  assertEq(invoicePartyGstin({ gstin: undefined }), '', 'billing survives undefined gstin')
}

// --- 7. No fake GST auto-inserted ---
{
  const whitespace = submitParty('   ')
  assert(whitespace.ok, 'whitespace-only GST is treated as blank')
  const saved = store.addParty(partyInput(whitespace.ok ? whitespace.gstin : 'NA'))
  assertEq(saved.gstin, '', 'whitespace GST is stored blank, not a placeholder')
  assert(!isFakeGstinPlaceholder(saved.gstin), 'blank GST is not a fake placeholder')
  for (const fake of FAKE_GSTINS) {
    assertEq(saved.gstin === fake, false, `blank save must not insert ${fake}`)
  }
  const missingKey = normalizePartyGstin('')
  assertEq(missingKey, '', 'normalize never invents a GSTIN')
}

// Source-path: required marker and HTML required removed; submit is conditional
{
  const root = path.dirname(fileURLToPath(import.meta.url))
  const addPartySrc = readFileSync(path.join(root, '../src/pages/AddParty.tsx'), 'utf8')
  assert(
    !addPartySrc.includes('GST Number <span className="req">*</span>'),
    'GST Number must not show a required asterisk',
  )
  assert(addPartySrc.includes('validatePartyGstin(form.gstin)'), 'submit uses conditional GST validation')
  assert(addPartySrc.includes('normalizePartyGstin(form.gstin)'), 'save uses normalizePartyGstin')
  const gstLabel = addPartySrc.indexOf('<label>GST Number</label>')
  assert(gstLabel >= 0, 'GST Number label remains')
  const gstBlock = addPartySrc.slice(gstLabel, addPartySrc.indexOf('License Number', gstLabel))
  assert(gstBlock.length > 0, 'GST field block found')
  assert(!/\brequired\b/.test(gstBlock), 'GST input must not have HTML required')
}

{
  const root = path.dirname(fileURLToPath(import.meta.url))
  const billing = readFileSync(path.join(root, '../src/pages/Billing.tsx'), 'utf8')
  const monthly = readFileSync(path.join(root, '../src/pages/MonthlyBilling.tsx'), 'utf8')
  const challan = readFileSync(path.join(root, '../src/components/InvoiceChallan.tsx'), 'utf8')
  const storeSrc = readFileSync(path.join(root, '../src/data/store.ts'), 'utf8')
  assert(billing.includes('partyGstin: party?.gstin || \'\''), 'Billing already maps blank GSTIN to empty string')
  assert(monthly.includes('partyGstin: party.gstin || \'\''), 'Monthly billing already maps blank GSTIN to empty string')
  assert(challan.includes('view?.partyGstin || \'\''), 'Invoice challan already renders blank GSTIN safely')
  assert(storeSrc.includes('gstin: p.gstin ?? \'\''), 'Party model already treats missing GSTIN as blank')
  assert(!storeSrc.includes('NOT APPLICABLE'), 'store does not auto-insert NOT APPLICABLE GSTIN')
}

console.log('party-gstin-optional.selftest: all checks passed')
