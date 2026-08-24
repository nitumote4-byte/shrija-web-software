/**
 * Request / QM / bill deletion workflow — request-side only, Lab preserved.
 * Run: npx --yes tsx scripts/request-billing-deletion.selftest.ts
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  BILL_DELETE_CONFIRM_1,
  BILL_DELETE_CONFIRM_2,
  BILL_DELETE_PASSWORD_PROMPT,
  BILL_GENERATED_DELETE_BLOCKED,
  canCommitBillDelete,
  deleteInvoiceById,
  deleteRequestFromBillingWorkflow,
  existingRequestNosAmong,
  hasGeneratedBillForRequest,
  reduceBillDeletePhase,
  type RequestBillingData,
} from '../src/data/requestBillingDeletion.ts'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

function assertEq(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

const REQ = '118723574'

function emptyData(overrides: Partial<RequestBillingData> = {}): RequestBillingData {
  return {
    requests: [],
    roughSheets: [],
    pendingRough: [],
    invoices: [],
    fireAssays: [],
    xray: [],
    ...overrides,
  }
}

function seeded(opts?: { billed?: boolean; extraActive?: boolean }): RequestBillingData {
  const fireAssays = [{ id: 'fa-1', requestNo: REQ, purityFound: 91.6 }]
  const xray = [{ id: 'x-1', requestNo: REQ }]
  return emptyData({
    requests: [
      { id: 'r-1', requestNo: REQ, centreId: 'main', centreKind: 'main' },
      ...(opts?.extraActive
        ? [{ id: 'r-other', requestNo: '999000111', centreId: 'main', centreKind: 'main' as const }]
        : []),
    ],
    roughSheets: [
      { id: 'rs-1', requestNo: REQ, centreId: 'main', centreKind: 'main' },
      { id: 'rs-2', requestNo: REQ, centreId: 'main', centreKind: 'main' },
    ],
    pendingRough: [{ id: 'pr-1', requestNo: REQ, centreId: 'main', centreKind: 'main' }],
    invoices: opts?.billed
      ? [{ id: 'inv-1', requestNo: REQ, centreId: 'main', centreKind: 'main' }]
      : [],
    fireAssays,
    xray,
  })
}

function deleteBatch(data: RequestBillingData, requestNos: string[]) {
  for (const no of requestNos) {
    if (hasGeneratedBillForRequest(data.invoices, no)) {
      return { ok: false as const, error: BILL_GENERATED_DELETE_BLOCKED, blockedByBill: true as const }
    }
  }
  let deleted = 0
  for (const no of requestNos) {
    const result = deleteRequestFromBillingWorkflow(data, no)
    if (result.ok) deleted += 1
  }
  return { ok: true as const, deleted }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

// --- TEST 1: Request exists, no bill → QM deletion succeeds ---
{
  const data = seeded()
  const result = deleteRequestFromBillingWorkflow(data, REQ)
  assert(result.ok, 'TEST 1: deletion should succeed when no bill exists')
  assertEq(result.deletedRequestIds.length, 1, 'TEST 1: one request row removed')
}

// --- TEST 2: Deleted request disappears from Request List data (requests + roughSheets) ---
{
  const data = seeded()
  deleteRequestFromBillingWorkflow(data, REQ)
  assertEq(data.requests.length, 0, 'TEST 2: requests list is empty')
  assertEq(
    data.roughSheets.filter((r) => r.requestNo === REQ).length,
    0,
    'TEST 2: Request List / day-sheet rows gone',
  )
}

// --- TEST 3: Deleted request disappears from QM Request List data (roughSheets) ---
{
  const data = seeded()
  deleteRequestFromBillingWorkflow(data, REQ)
  assertEq(data.roughSheets.length, 0, 'TEST 3: QM day-sheet rows gone')
  assertEq(data.pendingRough.length, 0, 'TEST 3: pending/manual staging rows gone')
}

// --- TEST 4: Deleted request no longer blocks duplicate Request Number ---
{
  const data = seeded()
  assertEq(existingRequestNosAmong(data.requests, [REQ]).length, 1, 'TEST 4 setup: active duplicate')
  deleteRequestFromBillingWorkflow(data, REQ)
  assertEq(
    existingRequestNosAmong(data.requests, [REQ]).length,
    0,
    'TEST 4: deleted number is not a duplicate',
  )
}

// --- TEST 5: Same Request Number can be used for a new Manual Request ---
{
  const data = seeded()
  deleteRequestFromBillingWorkflow(data, REQ)
  assertEq(existingRequestNosAmong(data.requests, [REQ]).length, 0, 'TEST 5: number is free')
  data.requests.push({ id: 'r-new', requestNo: REQ, centreId: 'main', centreKind: 'main' })
  assertEq(data.requests[0]?.id, 'r-new', 'TEST 5: new request accepted')
  assertEq(existingRequestNosAmong(data.requests, [REQ])[0], REQ, 'TEST 5: new row is the active identity')
}

// --- TEST 6: Active request still blocks duplicate creation ---
{
  const data = seeded({ extraActive: true })
  const hits = existingRequestNosAmong(data.requests, [REQ, '999000111', 'brand-new'])
  assertEq(hits.length, 2, 'TEST 6: only active numbers are blocked')
  assert(hits.includes(REQ), 'TEST 6: active 118723574 still blocked')
  assert(hits.includes('999000111'), 'TEST 6: other active number still blocked')
}

// --- TEST 7: Bill exists → QM deletion is blocked ---
{
  const data = seeded({ billed: true })
  const before = JSON.stringify(data)
  const result = deleteBatch(data, [REQ])
  assertEq(result.ok, false, 'TEST 7: batch delete blocked')
  assertEq(data.requests.length, 1, 'TEST 7: request remains')
  assertEq(data.invoices.length, 1, 'TEST 7: bill remains')
  assertEq(data.roughSheets.length, 2, 'TEST 7: no partial QM delete')
  assertEq(JSON.stringify(data), before, 'TEST 7: store unchanged')
}

// --- TEST 8: Bill exists → correct English warning ---
{
  const data = seeded({ billed: true })
  const result = deleteRequestFromBillingWorkflow(data, REQ)
  assertEq(result.ok, false, 'TEST 8: blocked')
  assertEq(result.error, BILL_GENERATED_DELETE_BLOCKED, 'TEST 8: exact English warning')
  assertEq(
    result.error,
    'Bill already generated. Please delete the bill first, then delete the request.',
    'TEST 8: exact copy',
  )
}

// --- TEST 9: Bill deletion with wrong password → deletion blocked ---
{
  const data = seeded({ billed: true })
  let phase = reduceBillDeletePhase('idle', { type: 'start' })
  phase = reduceBillDeletePhase(phase, { type: 'passwordResult', ok: false })
  assertEq(phase, 'password', 'TEST 9: stays on password prompt')
  assertEq(canCommitBillDelete(phase), false, 'TEST 9: must not commit')
  assertEq(data.invoices.length, 1, 'TEST 9: bill unchanged')
}

// --- TEST 10: Bill deletion with correct password → Confirmation 1 ---
{
  let phase = reduceBillDeletePhase('idle', { type: 'start' })
  phase = reduceBillDeletePhase(phase, { type: 'passwordResult', ok: true })
  assertEq(phase, 'confirm1', 'TEST 10: Confirmation 1 appears')
}

// --- TEST 11: Confirmation 1 Cancel → bill remains ---
{
  const data = seeded({ billed: true })
  let phase = reduceBillDeletePhase('idle', { type: 'start' })
  phase = reduceBillDeletePhase(phase, { type: 'passwordResult', ok: true })
  phase = reduceBillDeletePhase(phase, { type: 'confirm1', ok: false })
  assertEq(phase, 'idle', 'TEST 11: flow stops')
  assertEq(canCommitBillDelete(phase), false, 'TEST 11: not committed')
  assertEq(data.invoices.length, 1, 'TEST 11: bill remains')
}

// --- TEST 12: Confirmation 1 OK → Confirmation 2 ---
{
  let phase = reduceBillDeletePhase('idle', { type: 'start' })
  phase = reduceBillDeletePhase(phase, { type: 'passwordResult', ok: true })
  phase = reduceBillDeletePhase(phase, { type: 'confirm1', ok: true })
  assertEq(phase, 'confirm2', 'TEST 12: Confirmation 2 appears')
}

// --- TEST 13: Confirmation 2 Cancel → bill remains ---
{
  const data = seeded({ billed: true })
  let phase = reduceBillDeletePhase('idle', { type: 'start' })
  phase = reduceBillDeletePhase(phase, { type: 'passwordResult', ok: true })
  phase = reduceBillDeletePhase(phase, { type: 'confirm1', ok: true })
  phase = reduceBillDeletePhase(phase, { type: 'confirm2', ok: false })
  assertEq(phase, 'idle', 'TEST 13: flow stops')
  assertEq(data.invoices.length, 1, 'TEST 13: bill remains')
}

// --- TEST 14: Both confirmations OK → bill deleted ---
{
  const data = seeded({ billed: true })
  let phase = reduceBillDeletePhase('idle', { type: 'start' })
  phase = reduceBillDeletePhase(phase, { type: 'passwordResult', ok: true })
  phase = reduceBillDeletePhase(phase, { type: 'confirm1', ok: true })
  phase = reduceBillDeletePhase(phase, { type: 'confirm2', ok: true })
  assertEq(phase, 'deleted', 'TEST 14: commit phase reached')
  assert(canCommitBillDelete(phase), 'TEST 14: may delete')
  assert(deleteInvoiceById(data, 'inv-1'), 'TEST 14: invoice removed')
  assertEq(data.invoices.length, 0, 'TEST 14: generated bills empty')
}

// --- TEST 15: After bill deletion, request still exists ---
{
  const data = seeded({ billed: true })
  deleteInvoiceById(data, 'inv-1')
  assertEq(data.requests.length, 1, 'TEST 15: request remains')
  assertEq(data.requests[0]?.requestNo, REQ, 'TEST 15: same request number')
  assertEq(data.roughSheets.length, 2, 'TEST 15: QM rows remain')
}

// --- TEST 16: After bill deletion, QM deletion becomes available ---
{
  const data = seeded({ billed: true })
  deleteInvoiceById(data, 'inv-1')
  assertEq(hasGeneratedBillForRequest(data.invoices, REQ), false, 'TEST 16: no bill')
  const result = deleteRequestFromBillingWorkflow(data, REQ)
  assert(result.ok, 'TEST 16: QM deletion now allowed')
}

// --- TEST 17: After bill + request deletion, same Request Number can be reused ---
{
  const data = seeded({ billed: true })
  deleteInvoiceById(data, 'inv-1')
  deleteRequestFromBillingWorkflow(data, REQ)
  assertEq(existingRequestNosAmong(data.requests, [REQ]).length, 0, 'TEST 17: number is free')
  data.requests.push({ id: 'r-recreated', requestNo: REQ, centreId: 'main', centreKind: 'main' })
  assertEq(existingRequestNosAmong(data.requests, [REQ])[0], REQ, 'TEST 17: recreated request is active')
  assertEq(data.requests.some((r) => r.id === 'r-1'), false, 'TEST 17: old identity is gone')
}

// --- TEST 18: Deleting request does NOT delete Lab/Fire Assay data ---
{
  const data = seeded()
  const fa = data.fireAssays
  const xr = data.xray
  deleteRequestFromBillingWorkflow(data, REQ)
  assert(data.fireAssays === fa, 'TEST 18: fireAssays array identity preserved')
  assert(data.xray === xr, 'TEST 18: xray array identity preserved')
  assertEq((data.fireAssays[0] as { requestNo: string }).requestNo, REQ, 'TEST 18: lab row still present')
}

// --- TEST 19: Deleting bill does NOT delete Lab/Fire Assay data ---
{
  const data = seeded({ billed: true })
  const fa = data.fireAssays
  deleteInvoiceById(data, 'inv-1')
  assert(data.fireAssays === fa, 'TEST 19: fireAssays unchanged by bill delete')
  assertEq(data.requests.length, 1, 'TEST 19: request untouched')
  assertEq((data.fireAssays[0] as { id: string }).id, 'fa-1', 'TEST 19: lab id intact')
}

// --- TEST 20: Tenant/centre isolation remains intact ---
{
  const data = emptyData({
    requests: [
      { id: 'r-main', requestNo: REQ, centreId: 'main', centreKind: 'main' },
      { id: 'r-osc', requestNo: REQ, centreId: 'osc-1', centreKind: 'osc' },
      { id: 'r-other', requestNo: '555111000', centreId: 'main', centreKind: 'main' },
    ],
    roughSheets: [
      { id: 'rs-main', requestNo: REQ, centreId: 'main', centreKind: 'main' },
      { id: 'rs-osc', requestNo: REQ, centreId: 'osc-1', centreKind: 'osc' },
    ],
    pendingRough: [],
    invoices: [],
    fireAssays: [
      { id: 'fa-main', requestNo: REQ },
      { id: 'fa-osc', requestNo: REQ },
    ],
    xray: [],
  })
  const result = deleteRequestFromBillingWorkflow(data, REQ, {
    centreId: 'osc-1',
    centreKind: 'osc',
  })
  assert(result.ok, 'TEST 20: OSC delete succeeds')
  assertEq(
    data.requests.some((r) => r.id === 'r-osc'),
    false,
    'TEST 20: OSC request removed',
  )
  assertEq(
    data.requests.some((r) => r.id === 'r-main'),
    true,
    'TEST 20: Main request with same number remains',
  )
  assertEq(
    data.requests.some((r) => r.id === 'r-other'),
    true,
    'TEST 20: other Main request remains',
  )
  assertEq(
    data.roughSheets.some((r) => r.id === 'rs-main'),
    true,
    'TEST 20: Main day-sheet remains',
  )
  assertEq(data.fireAssays.length, 2, 'TEST 20: both lab records remain')
  assert(
    existingRequestNosAmong(data.requests, [REQ]).length === 1,
    'TEST 20: remaining Main request still participates in duplicate detection',
  )
}

// --- UI / API wiring (exact English + existing auth, no cascade into Lab) ---
{
  const qm = readFileSync(path.join(root, 'src/pages/QMRequestList.tsx'), 'utf8')
  assert(qm.includes('BILL_GENERATED_DELETE_BLOCKED'), 'QM Delete uses bill-protection copy')
  assert(qm.includes('deleteRequestsFromBillingWorkflow'), 'QM Delete removes request-side records')
  assert(qm.includes('hasGeneratedBillForRequest'), 'QM Delete checks invoices, not UI-only state')
  assert(!qm.includes('fireAssays'), 'QM Delete does not mention Lab arrays')
}

{
  const bills = readFileSync(path.join(root, 'src/pages/ViewGeneratedBills.tsx'), 'utf8')
  assert(bills.includes('BILL_DELETE_PASSWORD_PROMPT'), 'bill delete asks for login password')
  assert(bills.includes('BILL_DELETE_CONFIRM_1'), 'bill delete has confirmation 1')
  assert(bills.includes('BILL_DELETE_CONFIRM_2'), 'bill delete has confirmation 2')
  assert(bills.includes('verifyLoginPassword'), 'bill delete uses existing auth verification')
  assert(!bills.includes('window.confirm'), 'bill delete no longer uses a single window.confirm')
}

{
  const authClient = readFileSync(path.join(root, 'src/data/auth.ts'), 'utf8')
  assert(authClient.includes('/api/auth/verify-password'), 'client calls verify-password')
  assert(authClient.includes('verifyLoginPassword'), 'client helper exists')
}

{
  const authServer = readFileSync(path.join(root, 'server/src/routes/auth.ts'), 'utf8')
  const verifyStart = authServer.indexOf("authRouter.post('/verify-password'")
  assert(verifyStart >= 0, 'verify-password route exists')
  const verifyBlock = authServer.slice(verifyStart, verifyStart + 1400)
  assert(verifyBlock.includes('bcrypt.compareSync'), 'verify-password uses existing bcrypt check')
  assert(!verifyBlock.includes('UPDATE users'), 'verify-password does not change stored credentials')
  assert(verifyBlock.includes('requireAuth'), 'verify-password is authenticated')
}

{
  const helper = readFileSync(path.join(root, 'src/data/requestBillingDeletion.ts'), 'utf8')
  assert(
    helper.includes("data.fireAssays") === false || !helper.includes('data.fireAssays ='),
    'helper never assigns fireAssays',
  )
  assert(!helper.includes('data.xray ='), 'helper never assigns xray')
  assertEq(BILL_DELETE_PASSWORD_PROMPT, 'Enter your login password to delete this bill.', 'password copy')
  assertEq(BILL_DELETE_CONFIRM_1, 'Do you want to delete this bill?', 'confirm 1 copy')
  assertEq(BILL_DELETE_CONFIRM_2, 'Are you sure you want to delete this bill?', 'confirm 2 copy')
}

{
  const storeSrc = readFileSync(path.join(root, 'src/data/store.ts'), 'utf8')
  assert(storeSrc.includes('existingRequestNosAmong'), 'duplicate check uses shared active-request helper')
  assert(storeSrc.includes('removeRequestBillingRecords'), 'store delete is request-side only')
}

console.log('request-billing-deletion.selftest: all 20 checks passed')
