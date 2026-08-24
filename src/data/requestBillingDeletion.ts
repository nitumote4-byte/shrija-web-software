/**
 * Request / billing deletion helpers.
 * Lab arrays (fireAssays, xray, Fire Assay sheets) are never mutated here.
 */

export const BILL_GENERATED_DELETE_BLOCKED =
  'Bill already generated. Please delete the bill first, then delete the request.'

export const BILL_DELETE_PASSWORD_PROMPT = 'Enter your login password to delete this bill.'

export const BILL_DELETE_CONFIRM_1 = 'Do you want to delete this bill?'

export const BILL_DELETE_CONFIRM_2 = 'Are you sure you want to delete this bill?'

export type CentreScope = {
  centreId?: string
  centreKind?: 'main' | 'osc'
}

type CentreMeta = {
  centreId?: string
  centreKind?: 'main' | 'osc'
}

export type RequestBillingData = {
  requests: Array<{ id: string; requestNo: string } & CentreMeta>
  roughSheets: Array<{ id: string; requestNo?: string } & CentreMeta>
  pendingRough: Array<{ id: string; requestNo: string } & CentreMeta>
  invoices: Array<{ id: string; requestNo: string } & CentreMeta>
  fireAssays: unknown[]
  xray: unknown[]
}

export type DeleteRequestResult =
  | { ok: true; requestNo: string; deletedRequestIds: string[] }
  | { ok: false; error: string; blockedByBill?: boolean }

export type BillDeletePhase = 'idle' | 'password' | 'confirm1' | 'confirm2' | 'deleted'

export type BillDeleteEvent =
  | { type: 'start' }
  | { type: 'passwordResult'; ok: boolean }
  | { type: 'confirm1'; ok: boolean }
  | { type: 'confirm2'; ok: boolean }
  | { type: 'cancel' }

export function normalizeRequestNo(requestNo: string | undefined | null): string {
  return String(requestNo || '').trim().toLowerCase()
}

export function matchesRequestNo(
  value: string | undefined | null,
  requestNo: string | undefined | null,
): boolean {
  const q = normalizeRequestNo(requestNo)
  if (!q) return false
  return normalizeRequestNo(value) === q
}

function isOscRecord(meta?: CentreMeta | null) {
  if (!meta) return false
  if (meta.centreKind === 'osc') return true
  if (meta.centreId && meta.centreId !== 'main') return true
  return false
}

export function requestVisibleInCentreScope(
  record: CentreMeta | null | undefined,
  scope?: CentreScope | null,
): boolean {
  if (!scope) return true
  if (scope.centreKind === 'osc') {
    const id = scope.centreId
    if (!id) return false
    if (record?.centreId) return record.centreId === id
    return record?.centreKind === 'osc'
  }
  return !isOscRecord(record)
}

export function hasGeneratedBillForRequest(
  invoices: Array<{ requestNo: string }>,
  requestNo: string,
): boolean {
  return invoices.some((inv) => matchesRequestNo(inv.requestNo, requestNo))
}

/** Same identity rules as Manual Request duplicate detection. */
export function existingRequestNosAmong(
  requests: Array<{ requestNo?: string | null }>,
  candidates: string[],
): string[] {
  const existing = new Set(
    requests
      .map((r) => String(r.requestNo || '').trim().toLowerCase())
      .filter(Boolean),
  )
  const seen = new Set<string>()
  const hits: string[] = []
  for (const candidate of candidates) {
    const value = String(candidate || '').trim()
    const key = value.toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    if (existing.has(key)) hits.push(value)
  }
  return hits
}

function inScope(record: CentreMeta, scope?: CentreScope | null) {
  return requestVisibleInCentreScope(record, scope)
}

export function deleteRequestFromBillingWorkflow<T extends RequestBillingData>(
  data: T,
  requestNo: string,
  scope?: CentreScope | null,
): DeleteRequestResult {
  const value = String(requestNo || '').trim()
  if (!normalizeRequestNo(value)) {
    return { ok: false, error: 'Request number is required' }
  }

  if (hasGeneratedBillForRequest(data.invoices, value)) {
    return { ok: false, error: BILL_GENERATED_DELETE_BLOCKED, blockedByBill: true }
  }

  const targeted = data.requests.filter(
    (r) => matchesRequestNo(r.requestNo, value) && inScope(r, scope),
  )
  const targetedSheets = data.roughSheets.filter(
    (r) => matchesRequestNo(r.requestNo, value) && inScope(r, scope),
  )
  const targetedPending = data.pendingRough.filter(
    (r) => matchesRequestNo(r.requestNo, value) && inScope(r, scope),
  )

  if (targeted.length === 0 && targetedSheets.length === 0 && targetedPending.length === 0) {
    return { ok: false, error: 'Request not found' }
  }

  const deletedRequestIds = targeted.map((r) => r.id)
  data.requests = data.requests.filter(
    (r) => !(matchesRequestNo(r.requestNo, value) && inScope(r, scope)),
  ) as T['requests']
  data.roughSheets = data.roughSheets.filter(
    (r) => !(matchesRequestNo(r.requestNo, value) && inScope(r, scope)),
  ) as T['roughSheets']
  data.pendingRough = data.pendingRough.filter(
    (r) => !(matchesRequestNo(r.requestNo, value) && inScope(r, scope)),
  ) as T['pendingRough']

  return { ok: true, requestNo: value, deletedRequestIds }
}

export function deleteInvoiceById<T extends { invoices: Array<{ id: string }> }>(
  data: T,
  invoiceId: string,
): boolean {
  const before = data.invoices.length
  data.invoices = data.invoices.filter((i) => i.id !== invoiceId) as T['invoices']
  return data.invoices.length < before
}

export function reduceBillDeletePhase(
  phase: BillDeletePhase,
  event: BillDeleteEvent,
): BillDeletePhase {
  if (event.type === 'cancel') return 'idle'
  switch (phase) {
    case 'idle':
      return event.type === 'start' ? 'password' : phase
    case 'password':
      if (event.type === 'passwordResult') return event.ok ? 'confirm1' : 'password'
      return phase
    case 'confirm1':
      if (event.type === 'confirm1') return event.ok ? 'confirm2' : 'idle'
      return phase
    case 'confirm2':
      if (event.type === 'confirm2') return event.ok ? 'deleted' : 'idle'
      return phase
    default:
      return phase
  }
}

export function canCommitBillDelete(phase: BillDeletePhase) {
  return phase === 'deleted'
}
