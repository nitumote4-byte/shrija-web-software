/**
 * Manual Request — party ↔ ASC voucher identity (license primary).
 * Run: npx --yes tsx scripts/voucher-party-match.selftest.ts
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseVoucherText } from '../src/utils/voucherReader.ts'
import {
  extractVoucherPartyIdentity,
  namesSupportMatch,
  normalizeLicenseNo,
  normalizePartyName,
  noticeForVerdict,
  PARTY_VERIFY_FAILED_MESSAGE,
  PARTY_VERIFY_FAILED_TITLE,
  verifyVoucherParty,
} from '../src/utils/voucherPartyMatch.ts'
import {
  scheduleStatusNoticeDismissal,
  STATUS_NOTICE_DURATION_MS,
} from '../src/utils/statusNotice.ts'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg)
}

function assertEq(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const REAL_PENDENT_VOUCHER =
  'AHC Receipt Voucher  AHC Name   :   S M G ASSAYING & 13/08/2026 Request 118596676 Request Number License Validity   20/06/2026 Jeweller Address : GSTN PAN Number Net Weight Jeweller   270.23   Material Type   Gold Bara Bazar ,Darbhanga, Receipt Number   28407906 Observed Net weight   270.23 Receipt   13/08/2026 Jeweller Name   ALANKAR   Licence No.   5390090114 Item Category   Quantity   Tot. Item Category Weight Declared Purity   Received Quantity by AHC Observed Item Category Weight(Gms) pendent   61   270.23   22K916   61   270.23 AHC Receiving Remarks   well in condition'

if (typeof globalThis.window === 'undefined') {
  Object.defineProperty(globalThis, 'window', { value: globalThis, configurable: true })
}

// 1. Exact license match + exact name → valid
{
  const v = verifyVoucherParty(
    { name: 'ALANKAR JEWELLERS', licenseNo: 'ABC123' },
    { jewellerName: 'ALANKAR JEWELLERS', licenseNo: 'ABC123' },
  )
  assertEq(v.status, 'valid', '1 status')
  assertEq(v.allowAutoMap, true, '1 auto-map')
  assertEq(v.licenseMatch, true, '1 license')
  assertEq(v.nameMatch, true, '1 name')
}

// 2. License match + truncated voucher name → valid
{
  const v = verifyVoucherParty(
    { name: 'ALANKAR JEWELLERS PRIVATE LIMITED', licenseNo: 'ABC123' },
    { jewellerName: 'ALANKAR JEWELLERS', licenseNo: 'ABC123' },
  )
  assertEq(v.status, 'valid', '2 status')
  assertEq(v.allowAutoMap, true, '2 auto-map')
  assertEq(v.reason, 'license_match_truncated_name', '2 truncated reason')
  assert(v.nameMatch, '2 truncated name still supports match')
}

// 3. Same Jewellers Name + different license → wrong party
{
  const v = verifyVoucherParty(
    { name: 'ALANKAR JEWELLERS', licenseNo: 'ABC123' },
    { jewellerName: 'ALANKAR JEWELLERS', licenseNo: 'XYZ456' },
  )
  assertEq(v.status, 'wrong_party', '3 status')
  assertEq(v.allowAutoMap, false, '3 no auto-map')
  assertEq(v.reason, 'license_mismatch', '3 reason')
  assert(v.nameMatch, '3 name may match but must not win')
  const notice = noticeForVerdict(v)
  assert(notice, '3 notice')
  assertEq(notice?.kind, 'error', '3 error notice')
  assertEq(notice?.beep, true, '3 beep')
  assertEq(notice?.title, PARTY_VERIFY_FAILED_TITLE, '3 title')
  assert(notice?.message.includes('License number verification failed'), '3 message')
}

// 4. Different name + matching license → license remains primary; do not reject solely on name
{
  const v = verifyVoucherParty(
    { name: 'ALANKAR JEWELLERS', licenseNo: 'ABC123' },
    { jewellerName: 'DIFFERENT JEWELLERS', licenseNo: 'ABC123' },
  )
  assert(v.status !== 'wrong_party', '4 not wrong-party on name alone')
  assertEq(v.licenseMatch, true, '4 license primary')
  assertEq(v.allowAutoMap, true, '4 still maps')
  assertEq(v.reason, 'license_match_name_differs', '4 warning reason')
  assertEq(v.status, 'warning', '4 warning not hard block')
}

// 5. Different name + different license → wrong party
{
  const v = verifyVoucherParty(
    { name: 'ALANKAR JEWELLERS', licenseNo: 'ABC123' },
    { jewellerName: 'DIFFERENT JEWELLERS', licenseNo: 'XYZ456' },
  )
  assertEq(v.status, 'wrong_party', '5 status')
  assertEq(v.allowAutoMap, false, '5 no auto-map')
  assertEq(v.reason, 'both_mismatch', '5 reason')
}

// 6. Missing license on party → safe warning / no unsafe auto-match
{
  const v = verifyVoucherParty(
    { name: 'ALANKAR JEWELLERS', licenseNo: '' },
    { jewellerName: 'ALANKAR JEWELLERS', licenseNo: 'ABC123' },
  )
  assertEq(v.status, 'warning', '6 status')
  assertEq(v.reason, 'missing_license', '6 reason')
  assertEq(v.allowAutoMap, false, '6 no auto-map from name')
}

// 7. Missing license on voucher → safe warning / no unsafe auto-match
{
  const v = verifyVoucherParty(
    { name: 'ALANKAR JEWELLERS', licenseNo: 'ABC123' },
    { jewellerName: 'ALANKAR JEWELLERS', licenseNo: '' },
  )
  assertEq(v.status, 'warning', '7 status')
  assertEq(v.reason, 'missing_license', '7 reason')
  assertEq(v.allowAutoMap, false, '7 no auto-map from name')
}

// 8. Case/whitespace normalization for license number
{
  const v = verifyVoucherParty(
    { name: 'ALANKAR JEWELLERS', licenseNo: '  abc123  ' },
    { jewellerName: 'ALANKAR JEWELLERS', licenseNo: 'ABC 123' },
  )
  assertEq(normalizeLicenseNo('  abc123  '), 'ABC123', '8 party license norm')
  assertEq(normalizeLicenseNo('ABC 123'), 'ABC123', '8 voucher license norm')
  assertEq(v.status, 'valid', '8 status after norm')
  assertEq(v.allowAutoMap, true, '8 auto-map')
  assertEq(normalizeLicenseNo('ABC-123'), 'ABC-123', '8 hyphen kept')
  assert(
    normalizeLicenseNo('ABC-123') !== normalizeLicenseNo('ABC123'),
    '8 hyphen is meaningful — not stripped',
  )
}

// 9. Name normalization is not the primary identity
{
  assert(namesSupportMatch('ALANKAR JEWELLERS PRIVATE LIMITED', 'alankar  jewellers'), '9 truncated ok')
  assert(namesSupportMatch('ALANKAR JEWELLERS', 'ALANKAR'), '9 short voucher prefix')
  const sameNameWrongLicense = verifyVoucherParty(
    { name: 'ALANKAR JEWELLERS', licenseNo: 'ABC123' },
    { jewellerName: 'alankar jewellers', licenseNo: 'XYZ456' },
  )
  assertEq(sameNameWrongLicense.status, 'wrong_party', '9 name must not override license')
  assertEq(sameNameWrongLicense.allowAutoMap, false, '9 no silent accept')
  assert(sameNameWrongLicense.nameMatch, '9 names would match if they were primary')
}

// Vouchers with no identity fields keep existing auto-fill
{
  const v = verifyVoucherParty(
    { name: 'ALANKAR JEWELLERS', licenseNo: 'ABC123' },
    { jewellerName: '', licenseNo: '' },
  )
  assertEq(v.reason, 'no_identity', 'no-identity reason')
  assertEq(v.allowAutoMap, true, 'no-identity still maps (existing fill)')
}

// Real AHC voucher extraction (identity only — item parser stays unchanged)
{
  const id = extractVoucherPartyIdentity(REAL_PENDENT_VOUCHER)
  assertEq(id.jewellerName, 'ALANKAR', 'real jeweller truncated name')
  assertEq(id.licenseNo, '5390090114', 'real licence no — not License Validity date')
  const parsed = parseVoucherText(REAL_PENDENT_VOUCHER, 'AHC_UID_Voucher_5390090114.pdf')
  assertEq(parsed.lines[0].item, 'pendent', 'parser item still pendent')
  assertEq(parsed.lines[0].pic, '61', 'parser pic still 61')
  assertEq(parsed.lines[0].weight, '270.23', 'parser weight still 270.23')
  const v = verifyVoucherParty(
    { name: 'ALANKAR JEWELLERS PRIVATE LIMITED', licenseNo: '5390090114' },
    id,
  )
  assertEq(v.status, 'valid', 'real truncated name + license = valid')
  assertEq(v.allowAutoMap, true, 'real voucher maps')
}

{
  const labeled = extractVoucherPartyIdentity(`
Jewellers Name: ALANKAR JEWELLERS PRIVATE LIMITED
License Number: ABC123
Item Category: Necklace
`)
  assertEq(normalizePartyName(labeled.jewellerName), 'ALANKAR JEWELLERS PRIVATE LIMITED', 'labelled name')
  assertEq(labeled.licenseNo, 'ABC123', 'labelled license')
}

// 10. Notification auto-dismiss behavior
{
  assertEq(STATUS_NOTICE_DURATION_MS, 3000, '10 default visible duration is 3s')
  let exited = false
  let gone = false
  const cleanup = scheduleStatusNoticeDismissal(
    () => {
      exited = true
    },
    () => {
      gone = true
    },
    25,
    15,
  )
  await sleep(10)
  assert(!exited && !gone, '10 still visible before duration')
  await sleep(25)
  assert(exited, '10 exit animation starts after duration')
  await sleep(20)
  assert(gone, '10 removed after exit animation')
  cleanup()

  let leaked = false
  const stop = scheduleStatusNoticeDismissal(
    () => {
      leaked = true
    },
    () => {
      leaked = true
    },
    20,
    10,
  )
  stop()
  await sleep(45)
  assert(!leaked, '10 cleanup prevents timer leak on unmount')
}

// 11. Notification does not require a button
{
  const noticeSrc = readFileSync(path.join(root, 'src/components/StatusNotice.tsx'), 'utf8')
  assert(!/<button\b/i.test(noticeSrc), '11 no <button>')
  assert(!/\bOK\b|\bCancel\b|\bClose\b|\bHide\b/.test(noticeSrc), '11 no OK/Cancel/Close/Hide')
  assert(!/window\.alert/.test(noticeSrc), '11 not a browser alert')
  const css = readFileSync(path.join(root, 'src/index.css'), 'utf8')
  assert(css.includes('status-notice-in'), '11 enter animation')
  assert(css.includes('status-notice-out'), '11 exit animation')
  const manualSrc = readFileSync(path.join(root, 'src/pages/ManualRequest.tsx'), 'utf8')
  assert(manualSrc.includes('useStatusNotice'), '11 Manual Request uses StatusNotice')
  assert(manualSrc.includes('allowAutoMap'), '11 mapping gated on verdict')
  assert(manualSrc.includes('verifyVoucherParty'), '11 license-primary verify is wired')
}

// 12. Beep is triggered once for a validation failure and does not loop
{
  const noticeSrc = readFileSync(path.join(root, 'src/components/StatusNotice.tsx'), 'utf8')
  const beepSrc = readFileSync(path.join(root, 'src/utils/noticeBeep.ts'), 'utf8')
  const playCalls = noticeSrc.split('playNoticeBeep(').length - 1
  assertEq(playCalls, 1, '12 single playNoticeBeep call site')
  assert(noticeSrc.includes('lastBeepedNoticeId'), '12 once-per-id guard')
  assert(!/setInterval/.test(noticeSrc), '12 no interval in notice')
  assert(!/setInterval/.test(beepSrc), '12 no interval in beep')
  assert(!/osc\.start\([^)]*\)[\s\S]*osc\.start/.test(beepSrc), '12 oscillator starts once')
  assert(beepSrc.includes('osc.stop'), '12 oscillator stops')
  const failNotice = noticeForVerdict(
    verifyVoucherParty(
      { name: 'ALANKAR JEWELLERS', licenseNo: 'ABC123' },
      { jewellerName: 'ALANKAR JEWELLERS', licenseNo: 'XYZ456' },
    ),
  )
  assertEq(failNotice?.beep, true, '12 wrong-party beeps')
  const validNotice = noticeForVerdict(
    verifyVoucherParty(
      { name: 'ALANKAR JEWELLERS', licenseNo: 'ABC123' },
      { jewellerName: 'ALANKAR JEWELLERS', licenseNo: 'ABC123' },
    ),
  )
  assertEq(validNotice, null, '12 valid party has no error notice')
  assert(PARTY_VERIFY_FAILED_MESSAGE.includes('Please verify the selected party'), '12 professional copy')
}

console.log('voucher-party-match.selftest: all checks passed')
