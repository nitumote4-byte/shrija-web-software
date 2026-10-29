/**
 * Applies a confirmed sampling import through the existing QM save path.
 * Only Job Number (`jobCardNo`) and Sample Tag ID are written, and only
 * after the operator confirms. Server persistence is checked before success.
 */
import { getToken, readStoredSession } from '../api/client.ts'
import { store } from '../data/store.ts'
import { flushStoreNow, getStoreCache } from '../data/tenantCache.ts'
import {
  SAMPLING_EXTENSION_ID,
  canonicalConfirmation,
  isConfirmationHash,
  type ConfirmationConsumeResult,
} from './importConfirmation.ts'
import {
  SAMPLING_IMPORT_SOURCE,
  SAMPLING_IMPORT_VERSION,
  cleanSamplingText,
  isAcceptableSamplingCode,
  matchSamplingImport,
  parseSamplingExtract,
  sameRequestNo,
  type SamplingProposal,
  type ShrijaSamplingRow,
} from './samplingImportCore.ts'

export type SamplingApplyCode =
  | 'APPLIED'
  | 'NOTHING_TO_WRITE'
  | 'SESSION_EXPIRED'
  | 'NOT_READY'
  | 'PERSIST_FAILED'
  | 'VERIFY_FAILED'
  | 'REJECTED'

export type SamplingApplyResult = {
  ok: boolean
  persisted: boolean
  code: SamplingApplyCode
  summary: string
  error?: string
  updated: number
  skipped: number
  ambiguous: number
  failed: number
  written: { id: string; date: string; shift: string; jobCardNo: string; sampleTagId: string }[]
  details: { rowKey: string; status: string; message: string }[]
}

export type SamplingWritePatch = {
  jobCardNo: string
  jobCardSaved: boolean
  sampleTagId?: string
}

export type SamplingTrackedField = 'jobCardNo' | 'jobCardSaved' | 'sampleTagId'

export type SamplingImportPort = {
  hasSession: () => boolean
  isReady: () => boolean
  listRows: () => ShrijaSamplingRow[]
  listRequests: () => { requestNo: string; jobCardNo?: string }[]
  readRow: (id: string) => ShrijaSamplingRow | null
  readRequestJobCard: (requestNo: string) => string | null
  writeRow: (id: string, patch: SamplingWritePatch) => void
  restoreField: (id: string, field: SamplingTrackedField, value: string | boolean) => void
  writeRequestJobCard: (requestNo: string, jobCardNo: string) => void
  flush: () => Promise<{ ok: boolean; message?: string; status?: number }>
}

const SESSION_MESSAGE = 'Your session has expired or is invalid. Please sign in again. Nothing was saved.'

function detailsOf(proposals: SamplingProposal[]) {
  return proposals.map((proposal) => ({
    rowKey: proposal.rowKey,
    status: proposal.status,
    message: proposal.message,
  }))
}

function tally(proposals: SamplingProposal[], updated: number, failed: number) {
  const ambiguous = proposals.filter((proposal) => proposal.status === 'ambiguous').length
  const skipped = Math.max(0, proposals.length - ambiguous - failed - updated)
  return { updated, skipped, ambiguous, failed }
}

function result(
  code: SamplingApplyCode,
  summary: string,
  proposals: SamplingProposal[],
  updated: number,
  failed: number,
  extra?: { error?: string; written?: SamplingApplyResult['written'] },
): SamplingApplyResult {
  const counts = tally(proposals, updated, failed)
  return {
    ok: code === 'APPLIED' || code === 'NOTHING_TO_WRITE',
    persisted: code === 'APPLIED',
    code,
    summary,
    error: extra?.error,
    ...counts,
    written: extra?.written || [],
    details: detailsOf(proposals),
  }
}

function toShrijaRow(row: {
  id: string
  requestNo?: string
  item?: string
  purity?: string
  samplingMethod?: string
  pic?: number
  weight?: number
  jobCardNo?: string
  sampleTagId?: string
  jobCardSaved?: boolean
  date?: string
  shift?: string
  partyName?: string
}): ShrijaSamplingRow {
  return {
    id: row.id,
    requestNo: row.requestNo || '',
    item: row.item || '',
    purity: row.purity || '',
    samplingMethod: row.samplingMethod || '',
    pic: Number(row.pic) || 0,
    weight: Number(row.weight) || 0,
    jobCardNo: row.jobCardNo || '',
    sampleTagId: row.sampleTagId || '',
    jobCardSaved: Boolean(row.jobCardSaved),
    date: row.date || '',
    shift: row.shift || '',
    partyName: row.partyName || '',
  }
}

export function createProductionSamplingPort(): SamplingImportPort {
  return {
    hasSession: () => Boolean(getToken() && readStoredSession()?.tenantId),
    isReady: () => getStoreCache() != null,
    listRows: () => store.getAll().roughSheets.map(toShrijaRow),
    listRequests: () =>
      store.getAll().requests.map((request) => ({
        requestNo: request.requestNo,
        jobCardNo: request.jobCardNo || '',
      })),
    readRow: (id) => {
      const row = store.getAll().roughSheets.find((entry) => entry.id === id)
      return row ? toShrijaRow(row) : null
    },
    readRequestJobCard: (requestNo) => {
      const request = store.getAll().requests.find((entry) => entry.requestNo === requestNo)
      if (!request) return null
      return request.jobCardNo || ''
    },
    writeRow: (id, patch) => {
      const visible = store.getAll().roughSheets.some((entry) => entry.id === id)
      if (!visible) throw new Error('That QM row is outside the current centre.')
      store.updateRoughSheetRow(id, {
        jobCardNo: patch.jobCardNo,
        jobCardSaved: patch.jobCardSaved,
        ...(patch.sampleTagId !== undefined ? { sampleTagId: patch.sampleTagId } : {}),
      })
    },
    restoreField: (id, field, value) => {
      if (field === 'jobCardNo') store.restoreScopedRoughSheetFields(id, { jobCardNo: String(value) })
      else if (field === 'jobCardSaved') store.restoreScopedRoughSheetFields(id, { jobCardSaved: Boolean(value) })
      else store.restoreScopedRoughSheetFields(id, { sampleTagId: String(value) })
    },
    writeRequestJobCard: (requestNo, jobCardNo) => {
      store.setScopedRequestJobCardNo(requestNo, jobCardNo)
    },
    flush: async () => {
      if (!getToken() || !readStoredSession()?.tenantId) {
        return { ok: false, status: 401, message: SESSION_MESSAGE }
      }
      try {
        const flushed = await flushStoreNow()
        if (!getToken() || !readStoredSession()?.tenantId) {
          return { ok: false, status: 401, message: SESSION_MESSAGE }
        }
        if (!flushed.ok && /session has expired|sign in again/i.test(flushed.message || '')) {
          return { ok: false, status: 401, message: flushed.message || SESSION_MESSAGE }
        }
        return flushed
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Network error'
        return { ok: false, message }
      }
    },
  }
}

function liveField(row: ShrijaSamplingRow, field: SamplingTrackedField): string | boolean {
  if (field === 'jobCardSaved') return Boolean(row.jobCardSaved)
  if (field === 'sampleTagId') return cleanSamplingText(row.sampleTagId)
  return cleanSamplingText(row.jobCardNo)
}

export function mergePersistedSamplingRows<
  T extends { id: string; jobCardNo?: string; sampleTagId?: string; jobCardSaved?: boolean },
>(rows: readonly T[], written: readonly { id: string; jobCardNo: string; sampleTagId: string }[]): T[] {
  if (written.length === 0) return rows.slice()
  const byId = new Map(written.map((row) => [row.id, row]))
  return rows.map((row) => {
    const next = byId.get(row.id)
    if (!next) return row
    return {
      ...row,
      jobCardNo: next.jobCardNo,
      sampleTagId: next.sampleTagId,
      jobCardSaved: true,
    }
  })
}

export async function applyConfirmedSamplingImport(
  input: {
    extracted: unknown
    resolutions?: readonly { rowKey?: string; shrijaId?: string }[]
    overwriteRowKeys?: readonly string[]
  },
  port: SamplingImportPort,
): Promise<SamplingApplyResult> {
  if (!port.hasSession()) {
    return result('SESSION_EXPIRED', SESSION_MESSAGE, [], 0, 0, { error: SESSION_MESSAGE })
  }
  if (!port.isReady()) {
    const error = 'Shrija data is still loading. Wait for QM Request List, then try again. Nothing was saved.'
    return result('NOT_READY', error, [], 0, 0, { error })
  }

  const extracted = parseSamplingExtract(input.extracted)
  if (!extracted.ok) {
    return result('REJECTED', extracted.error, [], 0, 0, { error: extracted.error })
  }

  const match = matchSamplingImport(extracted, port.listRows(), port.listRequests(), {
    resolutions: input.resolutions,
    overwriteRowKeys: input.overwriteRowKeys,
  })
  if (!match.ok) {
    return result('REJECTED', match.error, [], 0, 0, { error: match.error })
  }

  const writes = match.proposals.filter((proposal) => proposal.willWrite && proposal.selectedId)
  if (writes.length === 0) {
    const unchanged = match.proposals.filter((proposal) => proposal.status === 'unchanged').length
    const ambiguous = match.proposals.filter((proposal) => proposal.status === 'ambiguous').length
    const summary =
      unchanged === match.proposals.length
        ? 'Nothing new to save. These Job Numbers and Sample Tag IDs already match.'
        : ambiguous > 0
          ? `Nothing was saved. ${ambiguous} row(s) need a QM row chosen before import.`
          : 'Nothing was saved. Resolve conflicts or duplicate Tag IDs, then import again.'
    return result('NOTHING_TO_WRITE', summary, match.proposals, 0, 0)
  }

  for (const proposal of writes) {
    const live = port.readRow(proposal.selectedId || '')
    if (
      !live ||
      !sameRequestNo(live.requestNo, extracted.requestNumber) ||
      cleanSamplingText(live.jobCardNo) !== proposal.existingJobCardNo ||
      cleanSamplingText(live.sampleTagId) !== proposal.existingSampleTagId ||
      cleanSamplingText(live.item) !== cleanSamplingText(proposal.existingItem)
    ) {
      const error = 'QM rows changed before import. Nothing was saved.'
      return result('REJECTED', error, match.proposals, 0, 0, { error })
    }
  }

  const tracked: {
    id: string
    field: SamplingTrackedField
    previous: string | boolean
    written: string | boolean
  }[] = []
  let writtenRequestJob = ''
  for (const proposal of writes) {
    const id = proposal.selectedId || ''
    const live = port.readRow(id)
    const nextJob = cleanSamplingText(proposal.proposedJobNumber)
    tracked.push({
      id,
      field: 'jobCardNo',
      previous: cleanSamplingText(live?.jobCardNo),
      written: nextJob,
    })
    tracked.push({
      id,
      field: 'jobCardSaved',
      previous: Boolean(live?.jobCardSaved),
      written: true,
    })
    if (proposal.assignTag) {
      tracked.push({
        id,
        field: 'sampleTagId',
        previous: cleanSamplingText(live?.sampleTagId),
        written: cleanSamplingText(proposal.proposedTagId),
      })
    }
    writtenRequestJob = nextJob
  }
  const previousRequestJob = port.readRequestJobCard(match.storedRequestNo)

  const revert = () => {
    for (const change of tracked) {
      const live = port.readRow(change.id)
      if (!live || liveField(live, change.field) !== change.written) continue
      port.restoreField(change.id, change.field, change.previous)
    }
    if (previousRequestJob != null && writtenRequestJob) {
      const current = cleanSamplingText(port.readRequestJobCard(match.storedRequestNo) || '')
      if (current === writtenRequestJob) port.writeRequestJobCard(match.storedRequestNo, previousRequestJob)
    }
  }

  try {
    for (const proposal of writes) {
      port.writeRow(proposal.selectedId || '', {
        jobCardNo: proposal.proposedJobNumber,
        jobCardSaved: true,
        ...(proposal.assignTag ? { sampleTagId: proposal.proposedTagId } : {}),
      })
    }
    if (!port.hasSession()) {
      revert()
      return result('SESSION_EXPIRED', SESSION_MESSAGE, match.proposals, 0, writes.length, {
        error: SESSION_MESSAGE,
      })
    }
    const flushed = await port.flush()
    if (!flushed.ok) {
      revert()
      const expired = flushed.status === 401
      const message = expired
        ? SESSION_MESSAGE
        : `Nothing was saved. ${flushed.message || 'The server did not confirm the update.'}`
      return result(expired ? 'SESSION_EXPIRED' : 'PERSIST_FAILED', message, match.proposals, 0, writes.length, {
        error: message,
      })
    }

    const written: SamplingApplyResult['written'] = []
    for (const proposal of writes) {
      const live = port.readRow(proposal.selectedId || '')
      const tagOk = proposal.assignTag
        ? cleanSamplingText(live?.sampleTagId) === proposal.proposedTagId
        : cleanSamplingText(live?.sampleTagId) === proposal.existingSampleTagId
      if (!live || cleanSamplingText(live.jobCardNo) !== proposal.proposedJobNumber || !tagOk) {
        revert()
        const error =
          'The saved QM row did not keep the Job Number and Sample Tag ID. Nothing was saved. Only fields still holding this import were restored.'
        return result('VERIFY_FAILED', error, match.proposals, 0, writes.length, { error })
      }
      written.push({
        id: live.id,
        date: live.date,
        shift: live.shift,
        jobCardNo: cleanSamplingText(live.jobCardNo),
        sampleTagId: cleanSamplingText(live.sampleTagId),
      })
    }

    const counts = tally(match.proposals, written.length, 0)
    const summary = `Saved ${counts.updated} row(s) after the server confirmed. Skipped ${counts.skipped}. Ambiguous ${counts.ambiguous}. Failed ${counts.failed}.`
    return {
      ok: true,
      persisted: true,
      code: 'APPLIED',
      summary,
      ...counts,
      written,
      details: detailsOf(match.proposals),
    }
  } catch (error) {
    try {
      revert()
    } catch {
      /* The original failure is reported below. */
    }
    const message = `Nothing was saved. ${error instanceof Error ? error.message : 'The import failed.'}`
    return result('PERSIST_FAILED', message, match.proposals, 0, writes.length, { error: message })
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function listPayload(requestNumber: unknown) {
  const port = createProductionSamplingPort()
  if (!port.hasSession()) {
    return { ok: false, code: 'SESSION_EXPIRED', error: SESSION_MESSAGE }
  }
  if (!port.isReady()) {
    return {
      ok: false,
      code: 'NOT_READY',
      error: 'Shrija data is still loading. Wait for QM Request List, then try again.',
    }
  }
  if (typeof requestNumber !== 'string' || !isAcceptableSamplingCode(requestNumber, 5)) {
    return { ok: false, code: 'REJECTED', error: 'Request Number from the sampling page is not usable.' }
  }
  const requestNo = requestNumber.trim()
  const matching = port.listRows().filter((row) => sameRequestNo(row.requestNo, requestNo))
  const tagLocks = port
    .listRows()
    .filter((row) => !sameRequestNo(row.requestNo, requestNo) && cleanSamplingText(row.sampleTagId))
    .map((row) => ({
      ...row,
      item: '',
      partyName: '',
      purity: '',
      samplingMethod: '',
      pic: 0,
      weight: 0,
      jobCardNo: '',
    }))
  return {
    ok: true,
    rows: [...matching, ...tagLocks],
    requests: port.listRequests().filter((request) => sameRequestNo(request.requestNo, requestNo)),
  }
}

function confirmationRejected(): SamplingApplyResult {
  const error = 'Import was not confirmed by the extension. Nothing was saved.'
  return result('REJECTED', error, [], 0, 0, { error })
}

function normalizeConsumeResponse(response: unknown): ConfirmationConsumeResult {
  if (!isRecord(response) || response.ok !== true) return { ok: false, code: 'REJECTED' }
  return { ok: true, payload: canonicalConfirmation(response.payload) }
}

function pageChromeRuntime(): {
  sendMessage: (extensionId: string, message: unknown, callback: (response: unknown) => void) => void
  lastError?: { message?: string }
} | null {
  if (typeof window === 'undefined') return null
  const runtime = (
    window as Window & {
      chrome?: {
        runtime?: {
          sendMessage?: (extensionId: string, message: unknown, callback: (response: unknown) => void) => void
          lastError?: { message?: string }
        }
      }
    }
  ).chrome?.runtime
  if (!runtime?.sendMessage) return null
  return runtime as {
    sendMessage: (extensionId: string, message: unknown, callback: (response: unknown) => void) => void
    lastError?: { message?: string }
  }
}

export function consumeSamplingConfirmation(hash: string): Promise<ConfirmationConsumeResult> {
  if (!isConfirmationHash(hash)) return Promise.resolve({ ok: false, code: 'REJECTED' })
  const runtime = pageChromeRuntime()
  if (!runtime) return Promise.resolve({ ok: false, code: 'REJECTED' })
  return new Promise((resolve) => {
    try {
      runtime.sendMessage(
        SAMPLING_EXTENSION_ID,
        {
          source: SAMPLING_IMPORT_SOURCE,
          version: SAMPLING_IMPORT_VERSION,
          type: 'CONSUME_IMPORT',
          hash,
        },
        (response: unknown) => {
          if (runtime.lastError) {
            resolve({ ok: false, code: 'REJECTED' })
            return
          }
          resolve(normalizeConsumeResponse(response))
        },
      )
    } catch {
      resolve({ ok: false, code: 'REJECTED' })
    }
  })
}

export async function handleSamplingApplyMessage(
  hash: string,
  consume: (hash: string) => Promise<ConfirmationConsumeResult>,
  port: SamplingImportPort,
): Promise<SamplingApplyResult> {
  if (!isConfirmationHash(hash)) return confirmationRejected()
  let confirmed: ConfirmationConsumeResult
  try {
    confirmed = await consume(hash)
  } catch {
    return confirmationRejected()
  }
  if (!confirmed.ok) return confirmationRejected()
  return applyConfirmedSamplingImport(confirmed.payload, port)
}

export type SamplingBridgeOptions = {
  consume?: (hash: string) => Promise<ConfirmationConsumeResult>
  port?: SamplingImportPort
  target?: Window
}

export function installSamplingImportBridge(
  onApplied: (result: SamplingApplyResult) => void,
  options?: SamplingBridgeOptions,
): () => void {
  const target = options?.target ?? (typeof window === 'undefined' ? undefined : window)
  if (!target) return () => {}
  const consume = options?.consume ?? consumeSamplingConfirmation
  const port = options?.port ?? createProductionSamplingPort()
  const onMessage = (event: MessageEvent) => {
    if (target.top && target.top !== target) return
    if (event.source !== target) return
    if (event.origin !== target.location.origin) return
    if (!target.location.pathname.includes('/qm-request-list')) return
    const data = event.data
    if (!isRecord(data)) return
    if (data.source !== SAMPLING_IMPORT_SOURCE || data.version !== SAMPLING_IMPORT_VERSION) return
    if (data.direction !== 'request') return
    if (typeof data.requestId !== 'string' || data.requestId.length < 8 || data.requestId.length > 80) return
    const requestId = data.requestId
    const action = data.action
    const payload = isRecord(data.payload) ? data.payload : {}

    const reply = (body: unknown) => {
      target.postMessage(
        {
          source: SAMPLING_IMPORT_SOURCE,
          version: SAMPLING_IMPORT_VERSION,
          direction: 'response',
          requestId,
          payload: body,
        },
        target.location.origin,
      )
    }

    if (action === 'list') {
      reply(listPayload(payload.requestNumber))
      return
    }
    if (action !== 'apply') return

    const hash = typeof payload.hash === 'string' ? payload.hash : ''
    void handleSamplingApplyMessage(hash, consume, port).then((applied) => {
      onApplied(applied)
      reply(applied)
    })
  }
  target.addEventListener('message', onMessage)
  return () => target.removeEventListener('message', onMessage)
}
