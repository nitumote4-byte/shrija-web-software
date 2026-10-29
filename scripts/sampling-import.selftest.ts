/**
 * Manak sampling extraction, QM matching, and confirmed persistence.
 * Run: npx --yes tsx scripts/sampling-import.selftest.ts
 *
 * Screenshot values appear only in this fixture. Production code must not contain them.
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'
import { parseVoucherText } from '../src/utils/voucherReader.ts'
import {
  applyConfirmedSamplingImport,
  handleSamplingApplyMessage,
  installSamplingImportBridge,
  mergePersistedSamplingRows,
  type SamplingImportPort,
  type SamplingWritePatch,
} from '../src/samplingImport/applySamplingImport.ts'
import {
  SAMPLING_EXTENSION_ID,
  acceptExternalConsume,
  acceptPopupConfirmation,
  createConfirmationStore,
  hashConfirmationPayload,
  isAllowedConsumeSender,
  isPopupSender,
  sealConfirmation,
} from '../src/samplingImport/importConfirmation.ts'
import {
  extractSamplingDetails,
  matchSamplingImport,
  type ShrijaSamplingRow,
} from '../src/samplingImport/samplingImportCore.ts'

const root = dirname(fileURLToPath(new URL('.', import.meta.url)))
const REQUEST = '118347688'
const JOB = '128898569'

function documentOf(html: string, url?: string): Document {
  return new JSDOM(`<!doctype html><html><body>${html}</body></html>`, {
    url: url || 'https://huid.manakonline.in/MANAK/BIS_SamplingDetails',
  }).window.document
}

function toBase64Ascii(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64')
}

function samplingHtml(
  body: string,
  options?: { request?: string; job?: string; labels?: boolean; extraHeaders?: string; tail?: string },
) {
  const request = options?.request ?? REQUEST
  const job = options?.job ?? JOB
  const labels =
    options?.labels === false
      ? ''
      : `<table class="layout-unstable">
          <tr>
            <td>Request Number</td><td>${request}</td>
            <td>Receipt Number</td><td>28358861</td>
            <td>Job Number</td><td>${job}</td>
          </tr>
        </table>`
  return `${labels}
    <table class="grid-unstable">
      <tr>
        <th class="col-a">Sr No</th>
        <th class="col-b">Item Type</th>
        <th class="col-c">Material Type</th>
        <th class="col-d">Sampling Method</th>
        <th class="col-e">Tag ID</th>
        <th class="col-f">Samples</th>
        ${options?.extraHeaders || ''}
      </tr>
      ${body}
    </table>
    ${options?.tail || ''}`
}

function rowHtml(input: {
  n: string
  item: string
  tag: string
  samples: string
  material?: string
  method?: string
  id?: string
  extra?: string
}) {
  const id = input.id ? ` data-id="${input.id}"` : ''
  return `<tr${id}>
    <td>${input.n}</td>
    <td>${input.item}</td>
    <td>${input.material ?? 'Gold'}</td>
    <td>${input.method ?? 'Cutting'}</td>
    <td>${input.tag}</td>
    <td>${input.samples}</td>
    ${input.extra || ''}
  </tr>`
}

function qm(partial: Partial<ShrijaSamplingRow> & Pick<ShrijaSamplingRow, 'id'>): ShrijaSamplingRow {
  return {
    requestNo: REQUEST,
    item: 'Ring',
    purity: '916',
    samplingMethod: '',
    pic: 1,
    weight: 0,
    jobCardNo: '',
    sampleTagId: '',
    jobCardSaved: false,
    date: '2026-10-20',
    shift: 'Day',
    partyName: 'Test Jeweller',
    ...partial,
  }
}

type Mem = {
  rows: ShrijaSamplingRow[]
  requests: { requestNo: string; jobCardNo: string }[]
  requestJob: string | null
  session: boolean
  ready: boolean
  failFlush: { ok: false; message: string; status?: number } | null
  corruptId: string
  writes: number
  flushes: number
  patchKeys: string[]
  duringFlush: ((state: Mem) => void) | null
}

function memory(seed?: Partial<Mem>): { mem: Mem; port: SamplingImportPort } {
  const mem: Mem = {
    rows: [qm({ id: 'ring-a' })],
    requests: [{ requestNo: REQUEST, jobCardNo: 'KEEP' }],
    requestJob: 'KEEP',
    session: true,
    ready: true,
    failFlush: null,
    corruptId: '',
    writes: 0,
    flushes: 0,
    patchKeys: [],
    duringFlush: null,
    ...seed,
  }
  const port: SamplingImportPort = {
    hasSession: () => mem.session,
    isReady: () => mem.ready,
    listRows: () => mem.rows.map((row) => ({ ...row })),
    listRequests: () => mem.requests.map((request) => ({ ...request })),
    readRow: (id) => {
      const row = mem.rows.find((entry) => entry.id === id)
      return row ? { ...row } : null
    },
    readRequestJobCard: (requestNo) => {
      const request = mem.requests.find((entry) => entry.requestNo === requestNo)
      if (!request) return null
      return mem.requestJob
    },
    writeRow: (id, patch: SamplingWritePatch) => {
      mem.writes += 1
      mem.patchKeys.push(Object.keys(patch).sort().join(','))
      const row = mem.rows.find((entry) => entry.id === id)
      if (!row) throw new Error(`missing row ${id}`)
      row.jobCardNo = patch.jobCardNo
      row.jobCardSaved = patch.jobCardSaved
      if (patch.sampleTagId !== undefined) row.sampleTagId = patch.sampleTagId
      mem.requestJob = patch.jobCardNo
      const request = mem.requests.find((entry) => entry.requestNo === row.requestNo)
      if (request) request.jobCardNo = patch.jobCardNo
    },
    restoreField: (id, field, value) => {
      const row = mem.rows.find((entry) => entry.id === id)
      if (!row) throw new Error(`missing row ${id}`)
      if (field === 'jobCardNo') row.jobCardNo = String(value)
      else if (field === 'jobCardSaved') row.jobCardSaved = Boolean(value)
      else row.sampleTagId = String(value)
    },
    writeRequestJobCard: (requestNo, jobCardNo) => {
      const request = mem.requests.find((entry) => entry.requestNo === requestNo)
      if (!request) return
      request.jobCardNo = jobCardNo
      mem.requestJob = jobCardNo
    },
    flush: async () => {
      mem.flushes += 1
      if (mem.corruptId) {
        const row = mem.rows.find((entry) => entry.id === mem.corruptId)
        if (row) row.jobCardNo = 'OTHER'
      }
      mem.duringFlush?.(mem)
      return mem.failFlush || { ok: true }
    },
  }
  return { mem, port }
}

function mustExtract(htmlOrDoc: string | Document, url?: string) {
  const extracted = extractSamplingDetails(
    typeof htmlOrDoc === 'string' ? documentOf(htmlOrDoc, url) : htmlOrDoc,
  )
  assert.equal(extracted.ok, true, extracted.ok ? '' : extracted.error)
  if (!extracted.ok) throw new Error(extracted.error)
  return extracted
}

const screenshot = samplingHtml(
  [
    rowHtml({ n: '1', item: 'Ring', tag: '3', samples: 'Yes', id: 'samp-3' }),
    rowHtml({ n: '2', item: 'Ring', tag: '1', samples: 'No' }),
    rowHtml({ n: '3', item: 'Ring', tag: '2', samples: 'No' }),
  ].join(''),
)
const extractedScreenshot = mustExtract(screenshot)
assert.equal(extractedScreenshot.requestNumber, REQUEST)
assert.equal(extractedScreenshot.jobNumber, JOB)
assert.equal(extractedScreenshot.rows.length, 3)
assert.deepEqual(
  extractedScreenshot.rows.map((row) => [row.rowKey, row.itemType, row.tagId, row.samples]),
  [
    ['id:samp-3', 'Ring', '3', 'Yes'],
    ['row:2', 'Ring', '1', 'No'],
    ['row:3', 'Ring', '2', 'No'],
  ],
)

const threeRings = [
  qm({ id: 'ring-a', weight: 10 }),
  qm({ id: 'ring-b', weight: 11 }),
  qm({ id: 'ring-c', weight: 12 }),
]
const ambiguous = matchSamplingImport(extractedScreenshot, threeRings, [{ requestNo: REQUEST }])
assert.equal(ambiguous.ok, true)
if (ambiguous.ok) {
  assert.equal(ambiguous.proposals.every((proposal) => proposal.selectedId == null), true)
  assert.equal(ambiguous.proposals.every((proposal) => proposal.status === 'ambiguous'), true)
  assert.equal(ambiguous.proposals.every((proposal) => proposal.willWrite === false), true)
}

{
  const { mem, port } = memory({ rows: threeRings })
  const applied = await applyConfirmedSamplingImport({ extracted: extractedScreenshot }, port)
  assert.equal(applied.persisted, false)
  assert.equal(applied.code, 'NOTHING_TO_WRITE')
  assert.equal(mem.writes, 0)
  assert.equal(mem.flushes, 0)
  assert.equal(mem.rows.every((row) => row.jobCardNo === '' && row.sampleTagId === ''), true)
}

{
  const { mem, port } = memory({ rows: threeRings })
  const applied = await applyConfirmedSamplingImport(
    {
      extracted: extractedScreenshot,
      resolutions: [
        { rowKey: 'id:samp-3', shrijaId: 'ring-b' },
        { rowKey: 'row:2', shrijaId: 'ring-a' },
      ],
    },
    port,
  )
  assert.equal(applied.persisted, true, applied.summary)
  assert.equal(applied.updated, 2)
  assert.equal(mem.rows.find((row) => row.id === 'ring-b')?.jobCardNo, JOB)
  assert.equal(mem.rows.find((row) => row.id === 'ring-b')?.sampleTagId, '3')
  assert.equal(mem.rows.find((row) => row.id === 'ring-a')?.jobCardNo, JOB)
  assert.equal(mem.rows.find((row) => row.id === 'ring-a')?.sampleTagId, '')
  assert.equal(mem.rows.find((row) => row.id === 'ring-c')?.jobCardNo, '')
  assert.equal(mem.rows.find((row) => row.id === 'ring-c')?.sampleTagId, '')
  assert.equal(mem.patchKeys.every((keys) => !keys.includes('sampleWeight')), true)
  const again = await applyConfirmedSamplingImport(
    {
      extracted: extractedScreenshot,
      resolutions: [
        { rowKey: 'id:samp-3', shrijaId: 'ring-b' },
        { rowKey: 'row:2', shrijaId: 'ring-a' },
      ],
    },
    port,
  )
  assert.equal(again.code, 'NOTHING_TO_WRITE')
  assert.equal(again.persisted, false)
  assert.equal(mem.flushes, 1)
  assert.equal(mem.rows.find((row) => row.id === 'ring-b')?.sampleTagId, '3')
}

{
  const chain = mustExtract(
    samplingHtml(rowHtml({ n: '1', item: 'Chain', tag: '8', samples: 'Yes' })),
  )
  const { mem, port } = memory({
    rows: [qm({ id: 'chain-1', item: 'Chain', sampleWeight: undefined as unknown as never })],
  })
  const row = mem.rows[0]
  Object.assign(row, { sampleWeight: 0.35 })
  const applied = await applyConfirmedSamplingImport({ extracted: chain }, port)
  assert.equal(applied.persisted, true, applied.summary)
  assert.equal(applied.written[0]?.jobCardNo, JOB)
  assert.equal(applied.written[0]?.sampleTagId, '8')
  assert.equal(applied.written[0]?.date, '2026-10-20')
  assert.equal(port.readRow('chain-1')?.jobCardNo, JOB)
  assert.equal(port.readRow('chain-1')?.sampleTagId, '8')
  assert.equal((row as ShrijaSamplingRow & { sampleWeight?: number }).sampleWeight, 0.35)
  assert.equal(mem.requests[0]?.jobCardNo, JOB)
}

{
  const missingJob = extractSamplingDetails(
    documentOf(samplingHtml(rowHtml({ n: '1', item: 'Ring', tag: '3', samples: 'Yes' }), { job: '' })),
  )
  assert.equal(missingJob.ok, false)
  if (!missingJob.ok) assert.match(missingJob.error, /Job Number/)
  const { mem, port } = memory()
  const applied = await applyConfirmedSamplingImport({ extracted: missingJob }, port)
  assert.equal(applied.persisted, false)
  assert.equal(mem.writes, 0)
}

{
  const missingTag = extractSamplingDetails(
    documentOf(samplingHtml(rowHtml({ n: '1', item: 'Ring', tag: '', samples: 'Yes' }))),
  )
  assert.equal(missingTag.ok, false)
  if (!missingTag.ok) assert.match(missingTag.error, /Tag ID/)
}

{
  const duplicate = matchSamplingImport(
    extractedScreenshot,
    [qm({ id: 'only' })],
    [{ requestNo: REQUEST }, { requestNo: REQUEST }],
  )
  assert.equal(duplicate.ok, false)
  if (!duplicate.ok) assert.equal(duplicate.code, 'DUPLICATE_REQUEST')
  const { mem, port } = memory({
    requests: [
      { requestNo: REQUEST, jobCardNo: 'KEEP' },
      { requestNo: REQUEST, jobCardNo: 'OTHER' },
    ],
  })
  const applied = await applyConfirmedSamplingImport({ extracted: extractedScreenshot }, port)
  assert.equal(applied.code, 'REJECTED')
  assert.equal(mem.writes, 0)
  assert.equal(mem.requestJob, 'KEEP')
}

{
  const conflictSource = mustExtract(samplingHtml(rowHtml({ n: '1', item: 'Chain', tag: '3', samples: 'Yes' })))
  const { mem, port } = memory({
    rows: [qm({ id: 'chain-1', item: 'Chain', sampleTagId: '9', jobCardNo: '999' })],
  })
  const blocked = await applyConfirmedSamplingImport({ extracted: conflictSource }, port)
  assert.equal(blocked.persisted, false)
  assert.equal(mem.rows[0]?.sampleTagId, '9')
  assert.equal(mem.rows[0]?.jobCardNo, '999')
  const allowed = await applyConfirmedSamplingImport(
    { extracted: conflictSource, overwriteRowKeys: ['row:1'] },
    port,
  )
  assert.equal(allowed.persisted, true, allowed.summary)
  assert.equal(mem.rows[0]?.sampleTagId, '3')
  assert.equal(mem.rows[0]?.jobCardNo, JOB)
}

{
  const sameTag = mustExtract(
    samplingHtml(
      [
        rowHtml({ n: '1', item: 'Chain', tag: '3', samples: 'Yes' }),
        rowHtml({ n: '2', item: 'Bangle', tag: '3', samples: 'Yes' }),
      ].join(''),
    ),
  )
  const { mem, port } = memory({
    rows: [qm({ id: 'chain-1', item: 'Chain' }), qm({ id: 'bangle-1', item: 'Bangle' })],
  })
  const applied = await applyConfirmedSamplingImport({ extracted: sameTag }, port)
  assert.equal(applied.persisted, false)
  assert.equal(mem.writes, 0)
}

{
  const taken = mustExtract(samplingHtml(rowHtml({ n: '1', item: 'Chain', tag: '3', samples: 'Yes' })))
  const { mem, port } = memory({
    rows: [
      qm({ id: 'chain-1', item: 'Chain' }),
      qm({ id: 'other', requestNo: '200000001', item: 'Pendant', sampleTagId: '3' }),
    ],
  })
  const applied = await applyConfirmedSamplingImport({ extracted: taken }, port)
  assert.equal(applied.code, 'NOTHING_TO_WRITE')
  assert.equal(mem.rows[0]?.sampleTagId, '')
}

{
  const weighed = mustExtract(
    samplingHtml(
      [
        rowHtml({ n: '1', item: 'Ring', tag: '3', samples: 'Yes', extra: '<td>10.500</td><td>2</td>' }),
        rowHtml({ n: '2', item: 'Ring', tag: '4', samples: 'Yes', extra: '<td>20</td><td>1</td>' }),
      ].join(''),
      { extraHeaders: '<th>Weight</th><th>Quantity</th>' },
    ),
  )
  const matched = matchSamplingImport(
    weighed,
    [qm({ id: 'light', weight: 10.5, pic: 2 }), qm({ id: 'heavy', weight: 20, pic: 1 })],
    [{ requestNo: REQUEST }],
  )
  assert.equal(matched.ok, true)
  if (matched.ok) {
    assert.equal(matched.proposals[0]?.selectedId, 'light')
    assert.equal(matched.proposals[1]?.selectedId, 'heavy')
    assert.equal(matched.proposals.every((proposal) => proposal.willWrite), true)
  }
}

{
  const gold = mustExtract(samplingHtml(rowHtml({ n: '1', item: 'Ring', tag: '3', samples: 'Yes' })))
  const matched = matchSamplingImport(gold, [qm({ id: 'silver', purity: '925' })], [{ requestNo: REQUEST }])
  assert.equal(matched.ok, true)
  if (matched.ok) assert.equal(matched.proposals[0]?.status, 'unmatched')
}

{
  const wrong = extractSamplingDetails(documentOf('<h1>Login</h1><p>Request Number</p>'))
  assert.equal(wrong.ok, false)
  const changed = extractSamplingDetails(
    documentOf('<table><tr><th>Name</th><th>Value</th></tr><tr><td>Ring</td><td>Yes</td></tr></table>'),
  )
  assert.equal(changed.ok, false)
  const merged = extractSamplingDetails(
    documentOf(
      samplingHtml(
        '<tr><td>1</td><td colspan="2">Ring</td><td>Cutting</td><td>3</td><td>Yes</td></tr>',
      ),
    ),
  )
  assert.equal(merged.ok, false)
  if (!merged.ok) assert.match(merged.error, /merged cells/)

  const liveLayout = mustExtract(
    `<table>
      <tr><td>Request Number</td><td>${REQUEST}</td><td>Job Number</td><td>${JOB}</td></tr>
    </table>
    <table>
      <tr>
        <th>S.No.</th>
        <th>Tag ID</th>
        <th>Item Type</th>
        <th>Material Type</th>
        <th>Samples</th>
      </tr>
      <tr><td colspan="5">Lot Number : 1 (3 Items,1 samples)</td></tr>
      <tr><td>1</td><td>3</td><td>Ring</td><td>Gold</td><td>Yes</td></tr>
      <tr><td>2</td><td>1</td><td>Ring</td><td>Gold</td><td>No</td></tr>
      <tr><td>3</td><td>2</td><td>Ring</td><td>Gold</td><td>No</td></tr>
    </table>`,
  )
  assert.equal(liveLayout.jobNumber, JOB)
  assert.equal(liveLayout.requestNumber, REQUEST)
  assert.equal(liveLayout.rows.length, 3)
  assert.deepEqual(
    liveLayout.rows.map((row) => [row.rowKey, row.tagId, row.itemType, row.samples]),
    [
      ['row:1', '3', 'Ring', 'Yes'],
      ['row:2', '1', 'Ring', 'No'],
      ['row:3', '2', 'Ring', 'No'],
    ],
  )
}

{
  const requestFromUrl = '119548724'
  const jobFromUrl = '134947890'
  const manakUrl = `https://huid.manakonline.in/MANAK/BIS_SamplingDetails?request_no=${toBase64Ascii(requestFromUrl)}&job_no=${toBase64Ascii(jobFromUrl)}`
  const blankJobIgnoresUrlJob = extractSamplingDetails(
    documentOf(
      `<p>Sampling Method</p><p>cutting</p>
       <p>Job Number</p><p></p>
       <table>
         <tr><th>S.No.</th><th>Tag ID</th><th>Item Type</th><th>Material Type</th><th>Samples</th></tr>
         <tr><td colspan="5">Lot Number : 1 (3 Items,1 samples)</td></tr>
         <tr><td>1</td><td>84</td><td>DHOLNA</td><td>Gold</td><td>No</td></tr>
         <tr><td>2</td><td>86</td><td>DHOLNA</td><td>Gold</td><td>No</td></tr>
         <tr><td>3</td><td>94</td><td>DHOLNA</td><td>Gold</td><td>Yes</td></tr>
       </table>`,
      manakUrl,
    ),
  )
  assert.equal(blankJobIgnoresUrlJob.ok, false)
  if (!blankJobIgnoresUrlJob.ok) assert.match(blankJobIgnoresUrlJob.error, /Job Number/)

  const pageJobNotUrlJob = mustExtract(
    `<p>Sampling Method</p><p>scraping</p>
     <p>Job Number</p><p>128947894</p>
     <table>
       <tr><th>S.No.</th><th>Tag ID</th><th>Item Type</th><th>Material Type</th><th>Samples</th></tr>
       <tr><td colspan="5">Lot Number : 1 (2 Items,1 samples)</td></tr>
       <tr><td>1</td><td>1</td><td>Bangles</td><td>Gold</td><td>No</td></tr>
       <tr><td>2</td><td>2</td><td>Bangles</td><td>Gold</td><td>Yes</td></tr>
     </table>`,
    `https://huid.manakonline.in/MANAK/BIS_SamplingDetails?request_no=${toBase64Ascii('119549468')}&job_no=${toBase64Ascii('134947894')}`,
  )
  assert.equal(pageJobNotUrlJob.requestNumber, '119549468')
  assert.equal(pageJobNotUrlJob.jobNumber, '128947894')
  assert.equal(pageJobNotUrlJob.rows.length, 2)
  assert.equal(pageJobNotUrlJob.rows[1]?.tagId, '2')
  assert.equal(pageJobNotUrlJob.rows[1]?.samples, 'Yes')

  const pendentByItem = mustExtract(
    `<p>Sampling Method</p><p>cutting</p>
     <p>Job Number</p><p>128954324</p>
     <table>
       <tr><th>S.No.</th><th>Tag ID</th><th>Item Type</th><th>Material Type</th><th>Samples</th></tr>
       <tr><td colspan="5">Lot Number : 1 (2 Items,1 samples)</td></tr>
       <tr><td>1</td><td>5</td><td>pendent</td><td>Gold</td><td>Yes</td></tr>
       <tr><td>2</td><td>4</td><td>pendent</td><td>Gold</td><td>No</td></tr>
     </table>`,
    `https://huid.manakonline.in/MANAK/BIS_SamplingDetails?request_no=${toBase64Ascii('119553461')}&job_no=${toBase64Ascii('999999999')}`,
  )
  assert.equal(pendentByItem.jobNumber, '128954324')
  assert.equal(pendentByItem.requestNumber, '119553461')
  const pendentMatch = matchSamplingImport(
    pendentByItem,
    [
      qm({ id: 'bali', requestNo: '119553461', item: 'Bali' }),
      qm({ id: 'pendent-1', requestNo: '119553461', item: 'pendent' }),
      qm({ id: 'locket', requestNo: '119553461', item: 'Locket' }),
      qm({ id: 'other-pendent', requestNo: '119549468', item: 'pendent', jobCardNo: '128947895' }),
    ],
    [{ requestNo: '119553461' }],
  )
  assert.equal(pendentMatch.ok, true)
  if (pendentMatch.ok) {
    const yesRow = pendentMatch.proposals.find((proposal) => proposal.tagId === '5')
    const noRow = pendentMatch.proposals.find((proposal) => proposal.tagId === '4')
    assert.equal(yesRow?.selectedId, 'pendent-1')
    assert.equal(yesRow?.willWrite, true)
    assert.equal(yesRow?.proposedJobNumber, '128954324')
    assert.equal(yesRow?.proposedTagId, '5')
    assert.equal(noRow?.selectedId, null)
    assert.equal(noRow?.willWrite, false)
    assert.equal(noRow?.status, 'unmatched')
  }

  const ignoredHost = extractSamplingDetails(
    documentOf(
      `<table>
         <tr><th>Item Type</th><th>Tag ID</th><th>Samples</th></tr>
         <tr><td>Ring</td><td>3</td><td>Yes</td></tr>
       </table>`,
      `https://evil.example/MANAK/BIS_SamplingDetails?request_no=${toBase64Ascii(requestFromUrl)}&job_no=${toBase64Ascii(jobFromUrl)}`,
    ),
  )
  assert.equal(ignoredHost.ok, false)
  if (!ignoredHost.ok) assert.match(ignoredHost.error, /Request Number was not found/)
}

{
  const columnOnly = mustExtract(
    `<table>
      <tr><th>Request Number</th><th>Job Number</th><th>Item Type</th><th>Tag ID</th><th>Samples</th></tr>
      <tr><td>${REQUEST}</td><td>${JOB}</td><td>Chain</td><td>8</td><td>Yes</td></tr>
    </table>`,
  )
  assert.equal(columnOnly.jobNumber, JOB)
  assert.equal(columnOnly.requestNumber, REQUEST)
}

{
  const hidden = samplingHtml(rowHtml({ n: '1', item: 'Ring', tag: '3', samples: 'Yes' }), {
    tail: '<div style="display:none"><table><tr><td>Job Number</td><td>555555555</td></tr></table></div>',
  })
  const read = mustExtract(hidden)
  assert.equal(read.jobNumber, JOB)
}

{
  const { mem, port } = memory()
  mem.session = false
  const applied = await applyConfirmedSamplingImport(
    { extracted: mustExtract(samplingHtml(rowHtml({ n: '1', item: 'Ring', tag: '3', samples: 'Yes' }))) },
    port,
  )
  assert.equal(applied.code, 'SESSION_EXPIRED')
  assert.equal(applied.persisted, false)
  assert.equal(mem.writes, 0)
  assert.equal(mem.flushes, 0)
}

const source = mustExtract(samplingHtml(rowHtml({ n: '1', item: 'Ring', tag: '3', samples: 'Yes' })))

{
  const offline = memory()
  offline.mem.failFlush = { ok: false, message: 'Failed to fetch' }
  const failed = await applyConfirmedSamplingImport({ extracted: source }, offline.port)
  assert.equal(failed.code, 'PERSIST_FAILED')
  assert.equal(failed.persisted, false)
  assert.match(failed.summary, /Nothing was saved/)
  assert.equal(offline.mem.writes, 1)
  assert.equal(offline.mem.rows[0]?.jobCardNo, '')
  assert.equal(offline.mem.rows[0]?.sampleTagId, '')
  assert.equal(offline.mem.rows[0]?.jobCardSaved, false)
  assert.equal(offline.mem.requestJob, 'KEEP')

  const expired = memory()
  expired.mem.failFlush = { ok: false, status: 401, message: 'Your session has expired or is invalid. Please sign in again.' }
  const session = await applyConfirmedSamplingImport({ extracted: source }, expired.port)
  assert.equal(session.code, 'SESSION_EXPIRED')
  assert.equal(expired.mem.rows[0]?.jobCardNo, '')

  const corrupt = memory()
  corrupt.mem.corruptId = 'ring-a'
  const verified = await applyConfirmedSamplingImport({ extracted: source }, corrupt.port)
  assert.equal(verified.code, 'VERIFY_FAILED')
  assert.equal(verified.persisted, false)
  assert.match(verified.summary, /Nothing was saved/)
  assert.equal(corrupt.mem.rows[0]?.jobCardNo, 'OTHER')
  assert.equal(corrupt.mem.rows[0]?.sampleTagId, '')
  assert.equal(corrupt.mem.requestJob, 'KEEP')
  assert.equal(corrupt.mem.writes, 1)
}

{
  const { mem, port } = memory()
  mem.ready = false
  const applied = await applyConfirmedSamplingImport(
    { extracted: mustExtract(samplingHtml(rowHtml({ n: '1', item: 'Ring', tag: '3', samples: 'Yes' }))) },
    port,
  )
  assert.equal(applied.code, 'NOT_READY')
  assert.equal(mem.writes, 0)
}

{
  const jobOnly = mustExtract(samplingHtml(rowHtml({ n: '1', item: 'Ring', tag: '1', samples: 'No' })))
  const unrelated = memory()
  unrelated.mem.failFlush = { ok: false, message: 'Failed to fetch' }
  unrelated.mem.duringFlush = (state) => {
    const row = state.rows[0] as ShrijaSamplingRow & { sampleWeightText?: string }
    row.sampleTagId = '77'
    row.sampleWeightText = '0.374'
    row.samplingMethod = 'Drill'
  }
  const failed = await applyConfirmedSamplingImport({ extracted: jobOnly }, unrelated.port)
  const row = unrelated.mem.rows[0] as ShrijaSamplingRow & { sampleWeightText?: string }
  assert.equal(failed.code, 'PERSIST_FAILED')
  assert.equal(failed.persisted, false)
  assert.equal(unrelated.mem.writes, 1)
  assert.equal(row.jobCardNo, '')
  assert.equal(row.sampleTagId, '77')
  assert.equal(row.sampleWeightText, '0.374')
  assert.equal(row.samplingMethod, 'Drill')

  const imported = memory()
  imported.mem.failFlush = { ok: false, message: 'Failed to fetch' }
  imported.mem.duringFlush = (state) => {
    const row = state.rows[0] as ShrijaSamplingRow & { sampleWeightText?: string }
    row.jobCardNo = 'USER-JOB'
    row.sampleWeightText = '0.374'
    state.requestJob = 'USER-JOB'
  }
  const kept = await applyConfirmedSamplingImport({ extracted: source }, imported.port)
  const keptRow = imported.mem.rows[0] as ShrijaSamplingRow & { sampleWeightText?: string }
  assert.equal(kept.code, 'PERSIST_FAILED')
  assert.equal(kept.persisted, false)
  assert.equal(keptRow.jobCardNo, 'USER-JOB')
  assert.equal(keptRow.sampleTagId, '')
  assert.equal(keptRow.sampleWeightText, '0.374')
  assert.equal(imported.mem.requestJob, 'USER-JOB')

  const otherFields = memory()
  otherFields.mem.failFlush = { ok: false, message: 'Failed to fetch' }
  otherFields.mem.duringFlush = (state) => {
    const row = state.rows[0] as ShrijaSamplingRow & { sampleWeightText?: string; cornet?: number }
    row.sampleWeightText = '0.374'
    row.samplingMethod = 'Drill'
    row.cornet = 4
  }
  const restored = await applyConfirmedSamplingImport({ extracted: source }, otherFields.port)
  const restoredRow = otherFields.mem.rows[0] as ShrijaSamplingRow & { sampleWeightText?: string; cornet?: number }
  assert.equal(restored.persisted, false)
  assert.equal(restoredRow.jobCardNo, '')
  assert.equal(restoredRow.sampleTagId, '')
  assert.equal(restoredRow.sampleWeightText, '0.374')
  assert.equal(restoredRow.samplingMethod, 'Drill')
  assert.equal(restoredRow.cornet, 4)
}

{
  const saved = await applyConfirmedSamplingImport({ extracted: source }, memory().port)
  assert.equal(saved.persisted, true, saved.summary)
  assert.equal(saved.written[0]?.jobCardNo, JOB)
  assert.equal(saved.written[0]?.sampleTagId, '3')
  const affected = {
    id: 'ring-a',
    jobCardNo: 'DRAFT',
    sampleTagId: 'draft-tag',
    sampleWeightText: '.374',
    samplingMethod: 'Drill',
    cornet: 1.2,
    dirty: true,
    checked: false,
    co: 'keep',
  }
  const unrelated = {
    id: 'other',
    jobCardNo: '',
    sampleTagId: '',
    sampleWeightText: '1.250',
    samplingMethod: 'Scrap',
    cornet: 2,
    dirty: true,
    checked: true,
  }
  const merged = mergePersistedSamplingRows([affected, unrelated], saved.written)
  assert.equal(merged[1], unrelated)
  assert.notEqual(merged[0], affected)
  assert.equal(merged[0].jobCardNo, JOB)
  assert.equal(merged[0].sampleTagId, '3')
  assert.equal(merged[0].jobCardSaved, true)
  assert.equal(merged[0].sampleWeightText, '.374')
  assert.equal(merged[0].samplingMethod, 'Drill')
  assert.equal(merged[0].cornet, 1.2)
  assert.equal(merged[0].dirty, true)
  assert.equal(merged[0].co, 'keep')
  assert.equal(merged[1].sampleWeightText, '1.250')
  assert.equal(merged[1].dirty, true)
}

{
  const approved = { extracted: source, resolutions: [], overwriteRowKeys: [] as string[] }
  const hash = await hashConfirmationPayload(approved)
  const otherHash = await hashConfirmationPayload({ ...approved, overwriteRowKeys: ['row:1'] })
  assert.notEqual(hash, otherHash)
  const tickets = createConfirmationStore()
  const mismatched = await sealConfirmation(tickets, approved, otherHash, 1_000)
  assert.equal(mismatched.ok, false)
  assert.equal(tickets.consume(hash, 1_000).code, 'MISSING')

  assert.equal((await sealConfirmation(tickets, approved, hash, 1_000)).ok, true)
  const fresh = tickets.consume(hash, 1_000 + 29_999)
  assert.equal(fresh.ok, true)
  assert.equal(tickets.consume(hash, 1_000 + 29_999).code, 'MISSING')

  assert.equal((await sealConfirmation(tickets, approved, hash, 2_000)).ok, true)
  const expired = await handleSamplingApplyMessage(
    hash,
    async (got) => tickets.consume(got, 2_000 + 30_000),
    memory().port,
  )
  assert.equal(expired.code, 'REJECTED')
  assert.equal(expired.persisted, false)
  assert.equal(tickets.consume(hash, 2_000 + 30_000).code, 'MISSING')

  const body = {
    extracted: source,
    resolutions: [{ rowKey: 'row:1', shrijaId: 'ring-a' }],
    overwriteRowKeys: [] as string[],
  }
  const bodyHash = await hashConfirmationPayload(body)
  assert.equal((await sealConfirmation(tickets, body, bodyHash, 3_000)).ok, true)
  body.overwriteRowKeys.push('row:1')
  body.resolutions[0].shrijaId = 'other-row'
  const sealed = tickets.consume(bodyHash, 3_000)
  assert.equal(sealed.ok, true)
  if (sealed.ok) {
    assert.deepEqual(sealed.payload.overwriteRowKeys, [])
    assert.equal(sealed.payload.resolutions[0]?.shrijaId, 'ring-a')
  }

  const moved = memory()
  const movedHash = await hashConfirmationPayload(approved)
  assert.equal((await sealConfirmation(tickets, approved, movedHash, 4_000)).ok, true)
  const drifted = {
    ...moved.port,
    readRow: (id: string) => {
      const row = moved.port.readRow(id)
      if (!row) return null
      return { ...row, jobCardNo: 'CHANGED' }
    },
  }
  const rejected = await handleSamplingApplyMessage(
    movedHash,
    async (got) => tickets.consume(got, 4_000),
    drifted,
  )
  assert.equal(rejected.code, 'REJECTED')
  assert.match(rejected.summary, /Nothing was saved/)
  assert.equal(rejected.persisted, false)
  assert.equal(moved.mem.writes, 0)
  assert.equal(moved.mem.rows[0]?.jobCardNo, '')
}

{
  const popupSender = {
    id: SAMPLING_EXTENSION_ID,
    url: `chrome-extension://${SAMPLING_EXTENSION_ID}/popup.html`,
  }
  const confirmMessage = {
    source: 'shrija-sampling-import',
    version: 1,
    type: 'CONFIRM_IMPORT',
  }
  const consumeMessage = {
    source: 'shrija-sampling-import',
    version: 1,
    type: 'CONSUME_IMPORT',
    hash: 'ab'.repeat(32),
  }
  assert.equal(isPopupSender(popupSender, SAMPLING_EXTENSION_ID), true)
  assert.equal(acceptPopupConfirmation(confirmMessage, popupSender, SAMPLING_EXTENSION_ID), true)
  assert.equal(
    acceptPopupConfirmation(
      confirmMessage,
      { ...popupSender, tab: { id: 4 }, url: 'https://shrija-web-software.vercel.app/qm-request-list' },
      SAMPLING_EXTENSION_ID,
    ),
    false,
  )
  assert.equal(
    isPopupSender(
      { id: SAMPLING_EXTENSION_ID, url: `chrome-extension://${SAMPLING_EXTENSION_ID}/background.js` },
      SAMPLING_EXTENSION_ID,
    ),
    false,
  )
  assert.equal(acceptPopupConfirmation(confirmMessage, popupSender, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'), false)
  assert.equal(
    acceptExternalConsume(consumeMessage, { url: 'https://shrija-web-software.vercel.app/qm-request-list' }),
    true,
  )
  assert.equal(acceptExternalConsume(consumeMessage, { url: 'http://localhost:5173/qm-request-list' }), true)
  assert.equal(acceptExternalConsume(consumeMessage, { origin: 'http://127.0.0.1:4173' }), true)
  assert.equal(acceptExternalConsume(confirmMessage, { url: 'https://shrija-web-software.vercel.app/qm-request-list' }), false)
  assert.equal(isAllowedConsumeSender({ url: 'https://huid.manakonline.in/sampling' }), false)
  assert.equal(isAllowedConsumeSender({ url: 'https://evil.example/qm-request-list' }), false)
  assert.equal(acceptExternalConsume(consumeMessage, { url: 'https://huid.manakonline.in/sampling' }), false)
}

async function replyToApply(
  options: NonNullable<Parameters<typeof installSamplingImportBridge>[1]>,
  payload: unknown,
  requestId: string,
) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'http://localhost:5173/qm-request-list',
  })
  const win = dom.window as unknown as Window
  const stop = installSamplingImportBridge(() => {}, { ...options, target: win })
  try {
    return await new Promise<{ persisted?: boolean; code?: string; ok?: boolean }>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`no sampling reply for ${requestId}`)), 2000)
      const onMessage = (event: MessageEvent) => {
        const data = event.data as { direction?: string; requestId?: string; payload?: { persisted?: boolean; code?: string; ok?: boolean } }
        if (!data || data.direction !== 'response' || data.requestId !== requestId) return
        clearTimeout(timer)
        win.removeEventListener('message', onMessage)
        resolve(data.payload || {})
      }
      win.addEventListener('message', onMessage)
      win.dispatchEvent(
        new win.MessageEvent('message', {
          data: {
            source: 'shrija-sampling-import',
            version: 1,
            direction: 'request',
            requestId,
            action: 'apply',
            payload,
          },
          origin: win.location.origin,
          source: win,
        }),
      )
    })
  } finally {
    stop()
    dom.window.close()
  }
}

{
  let consumeCalls = 0
  const forged = memory()
  const forgedReply = await replyToApply(
    {
      port: forged.port,
      consume: async () => {
        consumeCalls += 1
        return { ok: false, code: 'MISSING' }
      },
    },
    {
      extracted: source,
      resolutions: [{ rowKey: 'row:1', shrijaId: 'ring-a' }],
      overwriteRowKeys: ['row:1'],
    },
    'forged-apply-01',
  )
  assert.equal(forgedReply.code, 'REJECTED')
  assert.equal(forgedReply.persisted, false)
  assert.equal(consumeCalls, 0)
  assert.equal(forged.mem.writes, 0)
  assert.equal(forged.mem.rows[0]?.jobCardNo, '')

  const unknown = memory()
  const unknownReply = await replyToApply(
    {
      port: unknown.port,
      consume: async () => ({ ok: false, code: 'MISSING' }),
    },
    {
      hash: 'ab'.repeat(32),
      extracted: source,
      overwriteRowKeys: ['row:1'],
    },
    'forged-apply-02',
  )
  assert.equal(unknownReply.code, 'REJECTED')
  assert.equal(unknownReply.persisted, false)
  assert.equal(unknown.mem.writes, 0)

  const approved = { extracted: source, resolutions: [], overwriteRowKeys: [] as string[] }
  const hash = await hashConfirmationPayload(approved)
  const tickets = createConfirmationStore()
  assert.equal((await sealConfirmation(tickets, approved, hash, 8_000)).ok, true)
  const genuine = memory()
  const genuineReply = await replyToApply(
    {
      port: genuine.port,
      consume: async (got) => tickets.consume(got, 8_000),
    },
    {
      hash,
      extracted: { jobNumber: '000000001', requestNumber: REQUEST },
      overwriteRowKeys: ['row:9'],
      resolutions: [{ rowKey: 'row:9', shrijaId: 'missing' }],
    },
    'genuine-apply1',
  )
  assert.equal(genuineReply.persisted, true, JSON.stringify(genuineReply))
  assert.equal(genuine.mem.rows[0]?.jobCardNo, JOB)
  assert.equal(genuine.mem.rows[0]?.sampleTagId, '3')
  assert.equal(genuine.mem.flushes, 1)
  const replay = await replyToApply(
    {
      port: genuine.port,
      consume: async (got) => tickets.consume(got, 8_100),
    },
    { hash, extracted: source, overwriteRowKeys: ['row:1'] },
    'genuine-replay1',
  )
  assert.equal(replay.code, 'REJECTED')
  assert.equal(replay.persisted, false)
  assert.equal(genuine.mem.flushes, 1)
  assert.equal(genuine.mem.rows[0]?.sampleTagId, '3')

  const conflict = mustExtract(samplingHtml(rowHtml({ n: '1', item: 'Chain', tag: '3', samples: 'Yes' })))
  const conflictPayload = { extracted: conflict, resolutions: [], overwriteRowKeys: [] as string[] }
  const conflictHash = await hashConfirmationPayload(conflictPayload)
  const overwriteHash = await hashConfirmationPayload({ ...conflictPayload, overwriteRowKeys: ['row:1'] })
  assert.notEqual(conflictHash, overwriteHash)
  const conflictTickets = createConfirmationStore()
  assert.equal((await sealConfirmation(conflictTickets, conflictPayload, conflictHash, 9_000)).ok, true)
  const blocked = memory({
    rows: [qm({ id: 'chain-1', item: 'Chain', sampleTagId: '9', jobCardNo: '999' })],
  })
  const blockedReply = await replyToApply(
    {
      port: blocked.port,
      consume: async (got) => conflictTickets.consume(got, 9_000),
    },
    { hash: conflictHash, overwriteRowKeys: ['row:1'], extracted: conflict },
    'overwrite-swap-1',
  )
  assert.equal(blockedReply.persisted, false)
  assert.equal(blockedReply.code, 'NOTHING_TO_WRITE')
  assert.equal(blocked.mem.writes, 0)
  assert.equal(blocked.mem.rows[0]?.sampleTagId, '9')
  assert.equal(blocked.mem.rows[0]?.jobCardNo, '999')
  const swapped = await handleSamplingApplyMessage(
    overwriteHash,
    async (got) => conflictTickets.consume(got, 9_000),
    blocked.port,
  )
  assert.equal(swapped.code, 'REJECTED')
  assert.equal(blocked.mem.writes, 0)
}

const voucher = parseVoucherText(
  `AHC UID Receipt Voucher
Request Number: ${REQUEST}
Receipt Number: 28358861
Item Category: Ring
Quantity: 1
Total Item Category Weight: 4.5
Declared Purity: 22K916
`,
  'voucher.pdf',
)
assert.equal(voucher.lines[0]?.jobCardNo, '')
assert.equal(voucher.lines[0]?.requestNo, REQUEST)

for (const relative of [
  'src/samplingImport/samplingImportCore.ts',
  'src/samplingImport/applySamplingImport.ts',
  'src/samplingImport/importConfirmation.ts',
  'tools/shrija-sampling-import/popup.js',
  'tools/shrija-sampling-import/content-manak.js',
  'tools/shrija-sampling-import/content-shrija.js',
  'tools/shrija-sampling-import/background.js',
  'tools/shrija-sampling-import/dist/sampling-core.js',
  'tools/shrija-sampling-import/dist/confirmation.js',
  'tools/shrija-sampling-import/dist/content-manak.js',
  'tools/shrija-sampling-import/dist/popup.js',
  'tools/shrija-sampling-import/dist/background.js',
]) {
  const text = readFileSync(join(root, relative), 'utf8')
  assert.equal(text.includes(JOB), false, relative)
  assert.equal(text.includes('28358861'), false, relative)
}

const applySource = readFileSync(join(root, 'src/samplingImport/applySamplingImport.ts'), 'utf8')
assert.match(applySource, /flushStoreNow/)
assert.match(applySource, /updateRoughSheetRow/)
assert.match(applySource, /setScopedRequestJobCardNo/)
assert.match(applySource, /handleSamplingApplyMessage/)
assert.match(applySource, /restoreScopedRoughSheetFields/)
assert.match(applySource, /store\.getAll\(\)/)
assert.doesNotMatch(applySource, /payload\.extracted/)
assert.doesNotMatch(applySource, /parseVoucherText|updateRoughSheetStatus|saveManualRequest/)

const qmSource = readFileSync(join(root, 'src/pages/QMRequestList.tsx'), 'utf8')
assert.match(qmSource, /installSamplingImportBridge/)
assert.match(qmSource, /Job Card No is mandatory/)
const samplingHandler = qmSource.slice(
  qmSource.indexOf('onSamplingImport.current'),
  qmSource.indexOf('useEffect(() => installSamplingImportBridge'),
)
assert.match(samplingHandler, /mergePersistedSamplingRows/)
assert.match(samplingHandler, /result\.persisted/)
assert.equal(samplingHandler.includes('reload('), false)

const storeSource = readFileSync(join(root, 'src/data/store.ts'), 'utf8')
const restoreStart = storeSource.indexOf('restoreScopedRoughSheetFields')
const restoreFn = storeSource.slice(restoreStart, storeSource.indexOf('updateRoughSheetStatus', restoreStart))
assert.equal(restoreFn.includes('findRequestByNo'), false)

const popupHtml = readFileSync(join(root, 'tools/shrija-sampling-import/popup.html'), 'utf8')
assert.match(popupHtml, /src="dist\/popup\.js"/)
assert.equal(popupHtml.includes('type="module"'), false)
const popupSource = readFileSync(join(root, 'tools/shrija-sampling-import/dist/popup.js'), 'utf8')
assert.equal(/^import /m.test(popupSource), false)
const applySend = popupSource.slice(popupSource.indexOf("type: 'APPLY'"), popupSource.indexOf("type: 'APPLY'") + 180)
assert.match(applySend, /hash/)
assert.equal(applySend.includes('extracted'), false)
assert.equal(applySend.includes('overwriteRowKeys'), false)
assert.match(popupSource, /CONFIRM_IMPORT/)

const contentSource = readFileSync(join(root, 'tools/shrija-sampling-import/content-shrija.js'), 'utf8')
assert.match(contentSource, /payload\?\.hash/)
assert.equal(contentSource.includes('extracted'), false)
assert.match(contentSource, /sender\?\.id !== chrome\.runtime\.id/)

const backgroundSource = readFileSync(join(root, 'tools/shrija-sampling-import/dist/background.js'), 'utf8')
assert.match(backgroundSource, /acceptPopupConfirmation/)
assert.match(backgroundSource, /acceptExternalConsume/)
assert.equal(backgroundSource.includes('postMessage'), false)
assert.equal(/^import /m.test(backgroundSource), false)

const manifest = JSON.parse(readFileSync(join(root, 'tools/shrija-sampling-import/manifest.json'), 'utf8'))
assert.deepEqual(manifest.permissions, ['activeTab', 'scripting'])
assert.match(popupSource, /chrome\.scripting\.executeScript/)
assert.deepEqual(manifest.host_permissions, [
  'https://huid.manakonline.in/*',
  'https://shrija-web-software.vercel.app/*',
  'http://localhost:*/*',
  'http://127.0.0.1:*/*',
])
assert.deepEqual(manifest.externally_connectable.matches, [
  'https://shrija-web-software.vercel.app/*',
  'http://localhost:*/*',
  'http://127.0.0.1:*/*',
])
assert.equal(manifest.background.service_worker, 'dist/background.js')
assert.equal(manifest.background.type, undefined)
assert.deepEqual(
  manifest.content_scripts.map((script) => script.js),
  [['dist/content-manak.js'], ['content-shrija.js']],
)
assert.equal(manifest.content_scripts.some((script) => script.type === 'module'), false)
const manakBundle = readFileSync(join(root, 'tools/shrija-sampling-import/dist/content-manak.js'), 'utf8')
assert.equal(/^import /m.test(manakBundle), false)
assert.match(manakBundle, /function extractSamplingDetails/)
assert.equal(contentSource.includes('import '), false)
const derivedId = [...createHash('sha256').update(Buffer.from(manifest.key, 'base64')).digest().subarray(0, 16)]
  .map((byte) => String.fromCharCode(97 + (byte >> 4), 97 + (byte & 15)))
  .join('')
assert.equal(derivedId, SAMPLING_EXTENSION_ID)

const bundled = await import('../tools/shrija-sampling-import/dist/sampling-core.js')
const bundledExtract = bundled.extractSamplingDetails(documentOf(screenshot))
assert.equal(bundledExtract.ok, true)
assert.equal(bundledExtract.jobNumber, extractedScreenshot.jobNumber)
assert.equal(bundledExtract.rows[0].tagId, extractedScreenshot.rows[0].tagId)

const bundledConfirmation = await import('../tools/shrija-sampling-import/dist/confirmation.js')
const confirmationSample = { extracted: { ok: true, requestNumber: '1' }, resolutions: [], overwriteRowKeys: [] }
assert.equal(
  await bundledConfirmation.hashConfirmationPayload(confirmationSample),
  await hashConfirmationPayload(confirmationSample),
)
assert.equal(bundledConfirmation.SAMPLING_EXTENSION_ID, SAMPLING_EXTENSION_ID)

console.log('sampling import selftest passed')
