/**
 * Local test: Manak mock DOM + Phase 1 / Phase 2 fill (no Chrome, no live Manak).
 * Run: node tools/shrija-manak-extension/test/run-fill-test.mjs
 */
import { createRequire } from 'module'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '../../..')
const requireRoot = createRequire(join(root, 'package.json'))

const MOCK_HTML = `
<!DOCTYPE html>
<html><body>
  <div id="pageHeader">Job Card Number: 127935258 Clubbed with: 127935264, 127935269</div>
  <h3>Job Card Details</h3>
  <table id="jobCard">
    <tr><td>Job Card Number</td><td id="sectionJob">104736831</td></tr>
    <tr><td>Material Category</td><td>Gold</td></tr>
    <tr>
      <td>Declared Purity</td>
      <td><input id="declaredPurity" type="text" value="916" /></td>
    </tr>
    <tr>
      <td>Lot No. : Job No.</td>
      <td>
        <select id="ddlLot">
          <option value="">Select</option>
          <option value="1">Lot 1:104736831</option>
          <option value="2">Lot 2:104736832</option>
          <option value="3">Lot 1:123456789</option>
          <option value="4">Lot 2:123456789</option>
          <option value="5">Lot 1:127765196</option>
          <option value="6">Lot 1:127765197</option>
        </select>
      </td>
    </tr>
  </table>

  <h3>Sampling Details</h3>
  <table id="sampling">
    <tr>
      <td>Sample Drawn Weight (Mg)</td>
      <td><input id="txtSampleDrawn" type="text" value="0" /></td>
      <td><input type="button" value="Save" id="btnSaveDrawn" /></td>
      <td>Button Weight (Mg)</td>
      <td><input id="txtButtonWeight" type="text" value="0" /></td>
      <td><input type="button" value="Save" id="btnSaveButton" /></td>
    </tr>
  </table>

  <h3>Fire Assaying Details</h3>
  <table id="assay">
    <tr>
      <th>Sample Type</th>
      <th>Initial weight of sample (mg) M1</th>
      <th>Weight of Silver (mg)</th>
      <th>Weight of Copper (mg)</th>
      <th>Weight of Lead (gm)</th>
      <th>Weight of cornet after assaying (mg) M2</th>
    </tr>
    <tr>
      <td>Strip 1</td>
      <td><input class="m1" value="0" /></td>
      <td><input class="ag" value="0" /></td>
      <td><input class="cu" value="0" /></td>
      <td><input class="pb" value="0" /></td>
      <td><input class="m2" value="0" disabled readonly /></td>
    </tr>
    <tr>
      <td>Strip 2</td>
      <td><input class="m1" value="0" /></td>
      <td><input class="ag" value="0" /></td>
      <td><input class="cu" value="0" /></td>
      <td><input class="pb" value="0" /></td>
      <td><input class="m2" value="0" disabled readonly /></td>
    </tr>
    <tr>
      <td>C1(Check Gold)</td>
      <td><input class="m1" value="0" /></td>
      <td><input class="ag" value="0" /></td>
      <td><input class="cu" value="0" /></td>
      <td><input class="pb" value="0" /></td>
      <td><input class="m2" value="0" disabled readonly /></td>
    </tr>
    <tr>
      <td>C2(Check Gold)</td>
      <td><input class="m1" value="0" /></td>
      <td><input class="ag" value="0" /></td>
      <td><input class="cu" value="0" /></td>
      <td><input class="pb" value="0" /></td>
      <td><input class="m2" value="0" disabled readonly /></td>
    </tr>
  </table>
  <input type="button" value="Save (Initial Weight)" id="btnInit" />
  <input type="button" value="Save (Cornet Weight)" id="btnCornet" />
</body></html>
`

const SAMPLE_SHEET = {
  version: 1,
  source: 'shrija-hallmark-suite',
  sheetNo: '1',
  purity: '916',
  shift: 'Day',
  cg: {
    cg1: 150.2,
    cg2: 149.8,
    silverCg1: 342,
    silverCg2: 341.8,
    copperCg1: 1.454,
    copperCg2: 14.424,
    leadCg1: 4,
    leadCg2: 4,
    wotgcaa1: 149.2,
    wotgcaa2: 148.8,
  },
  rows: [
    {
      lotNo: 1,
      jobCardNo: '1_104736831',
      manakJobCard: '104736831',
      sampleDrawn: 333.07,
      sampleWeight: 166.655,
      silver: 373.3,
      lead: 4,
      wotgcaa: 152.686,
      fineness: 916.18,
      meanFineness: 0,
    },
    {
      lotNo: 1,
      jobCardNo: '1_104736831',
      manakJobCard: '104736831',
      sampleDrawn: 333.07,
      sampleWeight: 166.415,
      silver: 373.3,
      lead: 4,
      wotgcaa: 152.416,
      fineness: 915.879,
      meanFineness: 916.029,
    },
    {
      lotNo: 2,
      jobCardNo: '1_104736832',
      manakJobCard: '104736832',
      sampleDrawn: 332.81,
      sampleWeight: 166.525,
      silver: 373.3,
      lead: 4,
      wotgcaa: 152.577,
      fineness: 916.241,
      meanFineness: 0,
    },
    {
      lotNo: 2,
      jobCardNo: '1_104736832',
      manakJobCard: '104736832',
      sampleDrawn: 332.81,
      sampleWeight: 166.285,
      silver: 373.3,
      lead: 4,
      wotgcaa: 152.307,
      fineness: 915.94,
      meanFineness: 916.091,
    },
    {
      lotNo: 1,
      jobCardNo: '1_123456789',
      manakJobCard: '123456789',
      sampleDrawn: 330.1,
      sampleWeight: 165.1,
      silver: 373.3,
      lead: 4,
      wotgcaa: 111.111,
    },
    {
      lotNo: 1,
      jobCardNo: '1_123456789',
      manakJobCard: '123456789',
      sampleDrawn: 330.1,
      sampleWeight: 165.0,
      silver: 373.3,
      lead: 4,
      wotgcaa: 111.222,
    },
    {
      lotNo: 2,
      jobCardNo: '2_123456789',
      manakJobCard: '123456789',
      sampleDrawn: 331.2,
      sampleWeight: 165.5,
      silver: 373.3,
      lead: 4,
      wotgcaa: 222.111,
    },
    {
      lotNo: 2,
      jobCardNo: '2_123456789',
      manakJobCard: '123456789',
      sampleDrawn: 331.2,
      sampleWeight: 165.4,
      silver: 373.3,
      lead: 4,
      wotgcaa: 222.222,
    },
    {
      lotNo: 1,
      jobCardNo: '1_127765196',
      manakJobCard: '127765196',
      sampleDrawn: 334,
      sampleWeight: 167,
      silver: 373.3,
      lead: 4,
      wotgcaa: 101.001,
    },
    {
      lotNo: 1,
      jobCardNo: '1_127765196',
      manakJobCard: '127765196',
      sampleDrawn: 334,
      sampleWeight: 166.9,
      silver: 373.3,
      lead: 4,
      wotgcaa: 101.002,
    },
    {
      lotNo: 1,
      jobCardNo: '1_127765197',
      manakJobCard: '127765197',
      sampleDrawn: 335,
      sampleWeight: 167.5,
      silver: 373.3,
      lead: 4,
      wotgcaa: 202.001,
    },
    {
      lotNo: 1,
      jobCardNo: '1_127765197',
      manakJobCard: '127765197',
      sampleDrawn: 335,
      sampleWeight: 167.4,
      silver: 373.3,
      lead: 4,
      wotgcaa: 202.002,
    },
  ],
}

function assert(cond, msg) {
  if (!cond) throw new Error('FAIL: ' + msg)
  console.log('  OK:', msg)
}

function m2Inputs(doc) {
  return Array.from(doc.querySelectorAll('#assay .m2'))
}

function m1Inputs(doc) {
  return Array.from(doc.querySelectorAll('#assay .m1'))
}

function resetAssay(doc) {
  doc.getElementById('txtSampleDrawn').value = '0'
  doc.getElementById('txtButtonWeight').value = '0'
  for (const el of doc.querySelectorAll('#assay input')) {
    el.value = '0'
  }
  for (const el of m2Inputs(doc)) {
    el.disabled = true
    el.readOnly = true
  }
}

function attachSerialChooserOnClick(el, bucket) {
  el.addEventListener('click', () => {
    bucket.count += 1
    el.dataset.serialChooser = '1'
  })
}

/** Live BIS: clicking a weight field (with user activation) opens Web Serial. */
function wirePortalSerialOnWeightClick(doc) {
  const bucket = { count: 0 }
  attachSerialChooserOnClick(doc.getElementById('txtSampleDrawn'), bucket)
  attachSerialChooserOnClick(doc.getElementById('txtButtonWeight'), bucket)
  for (const el of doc.querySelectorAll('#assay input')) {
    attachSerialChooserOnClick(el, bucket)
  }
  return bucket
}

function trackClicks(doc) {
  const counts = { initial: 0, cornet: 0, sampleSave: 0, buttonSave: 0 }
  doc.getElementById('btnInit').addEventListener('click', () => {
    counts.initial += 1
  })
  doc.getElementById('btnCornet').addEventListener('click', () => {
    counts.cornet += 1
  })
  doc.getElementById('btnSaveDrawn').addEventListener('click', () => {
    counts.sampleSave += 1
  })
  doc.getElementById('btnSaveButton').addEventListener('click', () => {
    counts.buttonSave += 1
  })
  return counts
}

async function main() {
  const { JSDOM } = requireRoot('jsdom')
  const libPath = join(__dirname, '../manak-fill-lib.js')
  const libCode = readFileSync(libPath, 'utf8')

  const dom = new JSDOM(MOCK_HTML, {
    runScripts: 'outside-only',
    url: 'https://huid.manakonline.in/MANAK/SamplingweightingDeatils',
  })
  const { window } = dom
  window.eval(libCode)
  const ManakFill = window.ManakFill
  assert(ManakFill, 'ManakFill loaded')
  const nativeWaitSerial = ManakFill.waitUntilSerialGestureExpired
  ManakFill.delay = () => Promise.resolve()
  ManakFill.waitUntilSerialGestureExpired = async () => 'skipped'
  assert(ManakFill.SERIAL_API_USED === false, 'TEST 15 SERIAL_API_USED is false')
  assert(!/navigator\s*\.\s*serial/.test(libCode), 'TEST 15 lib has no navigator.serial')
  assert(!/\.requestPort\s*\(/.test(libCode), 'TEST 15 lib has no requestPort() call')
  const manakSrc = readFileSync(join(__dirname, '../content-manak.js'), 'utf8')
  assert(!/navigator\s*\.\s*serial/.test(manakSrc), 'TEST 15 content-manak has no navigator.serial')
  assert(!/\.requestPort\s*\(/.test(manakSrc), 'TEST 15 content-manak has no requestPort() call')

  const clicks = trackClicks(window.document)

  // --- Unit: lot parse ---
  assert(ManakFill.parseLotOptionText('Lot 1:104736831').jobCard === '104736831', 'parse Lot 1:job')
  assert(ManakFill.parseLotOptionText('Select').lot == null, 'Select = no lot')

  // --- Sampling finders must NOT hit Declared Purity ---
  const samp = ManakFill.findSamplingInputs(window.document)
  assert(samp.sampleDrawn?.id === 'txtSampleDrawn', 'Sample Drawn = txtSampleDrawn')
  assert(samp.buttonWt?.id === 'txtButtonWeight', 'Button Weight = txtButtonWeight')
  assert(samp.sampleDrawn !== samp.buttonWt, 'Sample ≠ Button (same-row layout)')
  assert(samp.sampleDrawn?.id !== 'declaredPurity', 'not Declared Purity')
  assert(ManakFill.findSaveBeside(samp.sampleDrawn)?.id === 'btnSaveDrawn', 'Sample Drawn SAVE is btnSaveDrawn')
  assert(ManakFill.findSaveBeside(samp.buttonWt)?.id === 'btnSaveButton', 'Button Weight SAVE is btnSaveButton')
  assert(
    ManakFill.findSaveBeside(samp.sampleDrawn) !== ManakFill.findSaveBeside(samp.buttonWt),
    'Sample SAVE ≠ Button SAVE',
  )

  resetAssay(window.document)
  assert(ManakFill.detectAssayFillStage(window.document) === 'phase1', 'empty assay form is Phase 1')
  m1Inputs(window.document)[0].value = '166.655'
  m1Inputs(window.document)[1].value = '166.415'
  assert(ManakFill.detectAssayFillStage(window.document) === 'phase2', 'M1 filled M2 empty is Phase 2')
  m2Inputs(window.document)[0].value = '152.686'
  m2Inputs(window.document)[1].value = '152.416'
  assert(ManakFill.detectAssayFillStage(window.document) === 'done', 'M2 filled is done')
  window.document.getElementById('txtSampleDrawn').value = '333.07'
  window.document.getElementById('txtButtonWeight').value = '333.07'
  const serialClear = wirePortalSerialOnWeightClick(window.document)
  const wiped = ManakFill.clearAssayFields(window.document)
  assert(wiped.ok, 'clearAssayFields ok')
  assert(Number(window.document.getElementById('txtSampleDrawn').value) === 0, 'delete empties Sample Drawn')
  assert(Number(m1Inputs(window.document)[0].value) === 0, 'delete empties M1')
  assert(Number(m2Inputs(window.document)[0].value) === 0, 'delete empties M2')
  assert(window.document.getElementById('declaredPurity').value === '916', 'delete does not touch Declared Purity')
  assert(serialClear.count === 0, 'delete does not click weight fields')
  assert(
    ManakFill.selectedMatchesJobLot({ lot: 2, jobCard: '104736831' }, '104736831', 2) === true,
    'Job + Lot match is strict',
  )
  assert(
    ManakFill.selectedMatchesJobLot({ lot: 1, jobCard: '104736831' }, '104736831', 2) === false,
    'wrong lot does not match',
  )
  const lotOpt = ManakFill.findLotOption(window.document, '104736831', 1)
  assert(lotOpt && /104736831/.test(lotOpt.text), 'finds Lot 1:104736831 option')
  resetAssay(window.document)

  const manakAutoSrc = readFileSync(join(__dirname, '../content-manak.js'), 'utf8')
  const popupHtml = readFileSync(join(__dirname, '../popup.html'), 'utf8')
  assert(/scheduleLotAutoFill/.test(manakAutoSrc), 'lot select schedules auto fill')
  assert(/detectAssayFillStage/.test(manakAutoSrc), 'auto fill uses stage detect')
  assert(/__shrijaDeleteFilledAssay/.test(manakAutoSrc), 'delete is exposed for extension popup')
  assert(/id="del"/.test(popupHtml), 'delete button lives in extension popup')
  assert(/clearAssayFields/.test(manakAutoSrc), 'delete uses clearAssayFields')

  window.document.getElementById('txtButtonWeight').value = '999'
  window.document.getElementById('txtSampleDrawn').value = '0'
  const samp2 = ManakFill.findSamplingInputs(window.document)
  assert(samp2.sampleDrawn?.id === 'txtSampleDrawn', 'still maps Sample Drawn after wrong values')
  assert(samp2.buttonWt?.id === 'txtButtonWeight', 'still maps Button Weight')

  const idleProgress = window.document.createElement('div')
  idleProgress.id = 'ctl00_UpdateProgress1'
  idleProgress.className = 'UpdateProgress'
  window.document.body.appendChild(idleProgress)
  assert(ManakFill.isPortalPostbackBusy(window.document) === false, 'idle UpdateProgress wrapper is not busy')
  idleProgress.setAttribute('style', 'display:block')
  assert(ManakFill.isPortalPostbackBusy(window.document) === true, 'display:block UpdateProgress is busy')
  idleProgress.setAttribute('style', 'display:none')
  idleProgress.style.display = 'none'
  assert(ManakFill.isPortalPostbackBusy(window.document) === false, 'display:none UpdateProgress is not busy')
  idleProgress.remove()

  assert(!/P1_COOLDOWN_MS = 180000/.test(manakAutoSrc), '3-minute Phase 2 cooldown removed')
  assert(/reason === 'load'/.test(manakAutoSrc), 'Phase 2 cooldown only skips postback reload')
  assert(/activationWaitMs: 0/.test(manakAutoSrc), 'lot auto-fill does not wait serial twice')

  const delayCalls = []
  const origDelay = ManakFill.delay
  ManakFill.delay = (ms) => {
    delayCalls.push(ms)
    return Promise.resolve()
  }
  ManakFill.waitUntilSerialGestureExpired = nativeWaitSerial
  const serialWait = await ManakFill.waitUntilSerialGestureExpired({
    document: window.document,
    activationWaitMs: 5500,
  })
  ManakFill.delay = origDelay
  ManakFill.waitUntilSerialGestureExpired = async () => 'skipped'
  assert(serialWait === 'no-api' || serialWait === 'cleared' || serialWait === 'skipped', 'serial wait returns')
  if (serialWait === 'no-api') {
    assert(delayCalls[0] <= 400, 'no userActivation API does not sleep 5.5s')
  }

  // --- Legacy fillLot mapping (Lot 1 / Lot 2 unique jobs) ---
  resetAssay(window.document)
  const lotSel = window.document.getElementById('ddlLot')
  lotSel.value = '1'
  lotSel.selectedIndex = 1
  const optText = lotSel.options[1].text

  const result = await ManakFill.fillLot(SAMPLE_SHEET, optText, {
    document: window.document,
    clickSave: true,
    lot: 1,
  })

  assert(result.ok, 'fillLot ok: ' + (result.error || ''))
  assert(Number(result.sampleDrawnValue) === 333.07, 'Sample Drawn = 333.07')
  assert(Number(result.buttonWtValue) === 333.07, 'Button Weight = 333.07')
  assert(Number(result.m1Values[0]) === 166.655, 'M1 Strip1 = 166.655')
  assert(Number(result.m1Values[1]) === 166.415, 'M1 Strip2 = 166.415')
  assert(Number(result.m1Values[2]) === 150.2, 'M1 C1 = cg1')
  assert(Number(result.silverValues[0]) === 373.3, 'Silver Strip1')
  assert(window.document.getElementById('declaredPurity').value === '916', 'Declared Purity untouched (916)')
  assert(result.filledM2 === false, 'fillLot does not fill M2')

  resetAssay(window.document)
  const r2 = await ManakFill.fillLot(SAMPLE_SHEET, 'Lot 2:104736832', {
    document: window.document,
    clickSave: false,
    lot: 2,
  })
  assert(r2.ok, 'lot2 fill ok')
  assert(Number(r2.sampleDrawnValue) === 332.81, 'Lot2 Sample Drawn')
  assert(Number(r2.m1Values[0]) === 166.525, 'Lot2 M1 Strip1')

  // ========== TEST 1: Phase 1 fills initial fields, not M2 ==========
  resetAssay(window.document)
  for (const el of m2Inputs(window.document)) {
    el.disabled = false
    el.readOnly = false
    el.value = '0'
  }
  const beforeInit = clicks.initial
  const beforeCornet = clicks.cornet
  const beforeSampleSave = clicks.sampleSave
  const beforeButtonSave = clicks.buttonSave
  const serialBucket = wirePortalSerialOnWeightClick(window.document)
  const phase1Order = []
  window.document.getElementById('btnSaveDrawn').addEventListener('click', () => phase1Order.push('sample-save'))
  window.document.getElementById('btnSaveButton').addEventListener('click', () => phase1Order.push('button-save'))
  m1Inputs(window.document).forEach((el) => {
    el.addEventListener('input', () => {
      if (!phase1Order.includes('m1')) phase1Order.push('m1')
    })
  })
  const p1 = await ManakFill.fillPhase1(SAMPLE_SHEET, 'Lot 1:104736831', {
    document: window.document,
    lot: 1,
    postbackWaitMs: 0,
    activationWaitMs: 0,
  })
  assert(p1.ok, 'TEST 1 Phase 1 ok')
  assert(Number(p1.sampleDrawnValue) === 333.07, 'TEST 1 Sample Drawn')
  assert(Number(p1.buttonWtValue) === 333.07, 'TEST 1 Button Weight')
  assert(Number(p1.m1Values[0]) === 166.655, 'TEST 1 M1 Strip 1')
  assert(Number(p1.m1Values[1]) === 166.415, 'TEST 1 M1 Strip 2')
  assert(Number(p1.m1Values[2]) === 150.2, 'TEST 1 C1')
  assert(Number(p1.m1Values[3]) === 149.8, 'TEST 1 C2')
  assert(Number(p1.silverValues[0]) === 373.3, 'TEST 1 Silver')
  assert(Number(p1.copperValues[2]) === 1.454, 'TEST 1 Copper C1')
  assert(Number(p1.leadValues[0]) === 4, 'TEST 1 Lead')
  assert(p1.filledM2 === false, 'TEST 1 filledM2 false')
  assert(p1.startedPhase2 === false, 'TEST 10 Phase 1 did not start Phase 2')
  assert(p1.clickedSampleSave === true, 'TEST Sample Drawn SAVE clicked')
  assert(p1.clickedButtonSave === true, 'TEST Button Weight SAVE clicked')
  assert(clicks.sampleSave === beforeSampleSave + 1, 'TEST Sample Drawn SAVE click count')
  assert(clicks.buttonSave === beforeButtonSave + 1, 'TEST Button Weight SAVE click count')
  assert(phase1Order.indexOf('sample-save') >= 0, 'TEST order recorded Sample Drawn SAVE')
  assert(phase1Order.indexOf('button-save') >= 0, 'TEST order recorded Button Weight SAVE')
  assert(phase1Order.indexOf('m1') >= 0, 'TEST order recorded M1 fill')
  assert(
    phase1Order.indexOf('sample-save') < phase1Order.indexOf('button-save'),
    'TEST Sample Drawn SAVE before Button Weight SAVE',
  )
  assert(
    phase1Order.indexOf('button-save') < phase1Order.indexOf('m1'),
    'TEST M1 filled only AFTER Sample Drawn + Button Weight saves',
  )
  assert(serialBucket.count === 0, 'TEST 15/16 Phase 1 did not click weight inputs (no serial chooser)')
  assert(p1.usedPostedWeight === true, 'TEST Phase 1 used posted-value path')
  assert(p1.usedScanForSample === false, 'TEST Phase 1 did not use scan gesture on Sample Drawn')
  for (const el of m2Inputs(window.document)) {
    assert(Number(el.value || 0) === 0, 'TEST 1 M2 left empty')
  }

  assert(p1.clickedSaveInitial === true, 'TEST 1 Phase 1 clicked Save Initial Weight with scale bypass')
  assert(clicks.initial === beforeInit + 1, 'TEST 1 Save Initial Weight clicked')
  assert(clicks.cornet === beforeCornet, 'TEST 1 Save Cornet not clicked during Phase 1')

  // ========== TEST 3 + 4: Phase 2 fills only M2, then Save Cornet with bypass ==========
  const m1Snapshot = m1Inputs(window.document).map((el) => el.value)
  const beforeCornet2 = clicks.cornet
  const p2 = await ManakFill.fillPhase2(SAMPLE_SHEET, 'Lot 1:104736831', {
    document: window.document,
    lot: 1,
    jobCard: '104736831',
    activationWaitMs: 0,
    postbackWaitMs: 0,
  })
  assert(p2.ok, 'TEST 3 Phase 2 ok')
  assert(Number(p2.m2Values[0]) === 152.686, 'TEST 3 M2 Strip 1')
  assert(Number(p2.m2Values[1]) === 152.416, 'TEST 3 M2 Strip 2')
  assert(Number(p2.m2Values[2]) === 149.2, 'TEST 3 M2 C1')
  assert(Number(p2.m2Values[3]) === 148.8, 'TEST 3 M2 C2')
  assert(
    m1Inputs(window.document).every((el, i) => el.value === m1Snapshot[i]),
    'TEST 3 Phase 2 did not change M1',
  )
  assert(p2.clickedSaveCornet === true, 'TEST 4 Phase 2 clicked Save Cornet Weight with scale bypass')
  assert(clicks.cornet === beforeCornet2 + 1, 'TEST 4 Save Cornet Weight clicked')
  assert(clicks.initial === beforeInit + 1, 'TEST 4 Save Initial still not extra-clicked by Phase 2')

  // ========== TEST 5–9: Job + Lot M2 mapping ==========
  const jobALot1 = ManakFill.resolveStripRowsByJobAndLot(SAMPLE_SHEET, '123456789', 1)
  assert(Number(jobALot1.rows[0]?.wotgcaa) === 111.111, 'TEST 5 Job A Lot 1 strip 1 M2')
  assert(Number(jobALot1.rows[1]?.wotgcaa) === 111.222, 'TEST 5 Job A Lot 1 strip 2 M2')

  resetAssay(window.document)
  for (const el of m2Inputs(window.document)) {
    el.disabled = false
    el.readOnly = false
  }
  const a1 = await ManakFill.fillPhase2(SAMPLE_SHEET, 'Lot 1:123456789', {
    document: window.document,
    lot: 1,
    jobCard: '123456789',
    activationWaitMs: 0,
    clickSaveCornet: false,
  })
  assert(a1.ok, 'TEST 5 fill ok')
  assert(Number(a1.m2Values[0]) === 111.111, 'TEST 5 filled Job A Lot 1 M2 strip 1')
  assert(Number(a1.m2Values[1]) === 111.222, 'TEST 5 filled Job A Lot 1 M2 strip 2')

  resetAssay(window.document)
  for (const el of m2Inputs(window.document)) {
    el.disabled = false
    el.readOnly = false
  }
  const a2 = await ManakFill.fillPhase2(SAMPLE_SHEET, 'Lot 2:123456789', {
    document: window.document,
    lot: 2,
    jobCard: '123456789',
    activationWaitMs: 0,
    clickSaveCornet: false,
  })
  assert(a2.ok, 'TEST 6 fill ok')
  assert(Number(a2.m2Values[0]) === 222.111, 'TEST 6 Job A Lot 2 M2 strip 1')
  assert(Number(a2.m2Values[1]) === 222.222, 'TEST 6 Job A Lot 2 M2 strip 2')
  assert(Number(a2.m2Values[0]) !== 111.111, 'TEST 8 Lot 2 M2 is not Lot 1 strip 1')
  assert(Number(a2.m2Values[1]) !== 111.222, 'TEST 8 Lot 2 M2 is not Lot 1 strip 2')

  resetAssay(window.document)
  for (const el of m2Inputs(window.document)) {
    el.disabled = false
    el.readOnly = false
  }
  const b1 = await ManakFill.fillPhase2(SAMPLE_SHEET, 'Lot 1:127765197', {
    document: window.document,
    lot: 1,
    jobCard: '127765197',
    activationWaitMs: 0,
    clickSaveCornet: false,
  })
  assert(b1.ok, 'TEST 7 fill ok')
  assert(Number(b1.m2Values[0]) === 202.001, 'TEST 7 Job B Lot 1 M2 strip 1')
  assert(Number(b1.m2Values[1]) === 202.002, 'TEST 7 Job B Lot 1 M2 strip 2')
  assert(Number(b1.m2Values[0]) !== 101.001, 'TEST 9 Job B M2 is not Job A')

  const jobAFromB = ManakFill.resolveStripRowsByJobAndLot(SAMPLE_SHEET, '127765196', 1)
  assert(Number(jobAFromB.rows[0]?.wotgcaa) === 101.001, 'TEST 9 Job 127765196 Lot 1 stays A1')
  assert(jobAFromB.rows[0]?.manakJobCard === '127765196', 'TEST 9 resolver job card')

  const wrongFallback = ManakFill.resolveStripRowsByJobAndLot(SAMPLE_SHEET, '123456789', 99)
  assert(wrongFallback.rows.length === 0, 'missing lot does not fall back to first pair')
  assert(wrongFallback.error === 'no_matching_job_lot', 'missing lot error')

  const noKeys = ManakFill.resolveStripRowsByJobAndLot(SAMPLE_SHEET, '', 1)
  assert(noKeys.rows.length === 0, 'lot-only lookup rejected for Phase 2')
  assert(noKeys.error === 'job_and_lot_required', 'job and lot required')

  // Same job, two lots: live Phase 1 is strict Job + Lot (same helper as Phase 2)
  const p1lot2 = ManakFill.resolvePhaseStripRows(SAMPLE_SHEET, 'Lot 2:123456789', { lot: 2, jobCard: '123456789' })
  assert(Number(p1lot2.rows[0]?.wotgcaa) === 222.111, 'Phase 1 resolver Lot 2 of same job')
  assert(Number(p1lot2.rows[0]?.sampleWeight) === 165.5, 'Phase 1 resolver Lot 2 M1')

  const p1MissingLot = await ManakFill.fillPhase1(SAMPLE_SHEET, 'Lot 2:104736831', {
    document: window.document,
    lot: 2,
    jobCard: '104736831',
    activationWaitMs: 0,
    postbackWaitMs: 0,
  })
  assert(p1MissingLot.ok === false, 'Phase 1 does not fill Lot 1 data onto Lot 2')
  assert(p1MissingLot.error === 'no_matching_job_lot', 'Phase 1 missing lot is no_matching_job_lot')

  resetAssay(window.document)
  const p1SameJobLot2 = await ManakFill.fillPhase1(SAMPLE_SHEET, 'Lot 2:123456789', {
    document: window.document,
    lot: 2,
    jobCard: '123456789',
    activationWaitMs: 0,
    postbackWaitMs: 0,
  })
  assert(p1SameJobLot2.ok, 'Phase 1 same-job Lot 2 ok')
  assert(Number(p1SameJobLot2.m1Values[0]) === 165.5, 'Phase 1 Lot 2 M1 is not Lot 1')
  assert(Number(p1SameJobLot2.m1Values[0]) !== 165.1, 'Phase 1 Lot 2 M1 is not Job A Lot 1 strip')

  // ========== TEST 11: global M2 pending cannot auto-apply ==========
  const stalePending = { m2Values: [111.111, 111.222, 149.2, 148.8], lotKey: '1:123456789' }
  assert(
    ManakFill.ignoreM2Pending(stalePending, '123456789', 2) === true,
    'TEST 11 ignore pending for another lot',
  )
  assert(
    ManakFill.ignoreM2Pending(stalePending, '127765197', 1) === true,
    'TEST 11 ignore pending for another job',
  )
  assert(ManakFill.ignoreM2Pending(null, '123456789', 1) === true, 'TEST 11 ignore empty pending')

  // ========== Serial chooser must not be triggered by weight-field click ==========
  resetAssay(window.document)
  const serial2 = wirePortalSerialOnWeightClick(window.document)
  ManakFill.setPostedWeight(window.document.getElementById('txtSampleDrawn'), 333.07)
  assert(Number(window.document.getElementById('txtSampleDrawn').value) === 333.07, 'posted Sample Drawn value')
  assert(serial2.count === 0, 'setPostedWeight does not click Sample Drawn')

  const postedP1 = await ManakFill.fillPhase1(SAMPLE_SHEET, 'Lot 1:104736831', {
    document: window.document,
    lot: 1,
    clickSaveInitial: false,
    postbackWaitMs: 0,
    activationWaitMs: 0,
  })
  assert(postedP1.ok, 'posted-value Phase 1 ok')
  assert(Number(postedP1.sampleDrawnValue) === 333.07, 'posted Sample Drawn survives Save')
  assert(Number(postedP1.buttonWtValue) === 333.07, 'posted Button Weight survives Save')
  assert(serial2.count === 0, 'TEST 16 Phase 1 Save path did not click weight fields')
  assert(window.document.getElementById('txtSampleDrawn').dataset.shrijaWeight === 'posted', 'Sample Drawn posted')
  assert(postedP1.clickedSaveInitial === false, 'posted Phase 1 still does not click Save Initial')

  resetAssay(window.document)
  let leakedInitial = 0
  const leakInit = () => {
    leakedInitial += 1
  }
  window.document.addEventListener('shrija-trigger-bypass-save', leakInit)
  window.document.getElementById('btnInit').addEventListener('click', leakInit)
  const beforeSample = clicks.sampleSave
  const beforeButton = clicks.buttonSave
  const beforeInitial = clicks.initial
  let preparedScale = 0
  window.document.addEventListener('shrija-prepare-scale', () => {
    preparedScale += 1
  })
  const samplingSaveP1 = await ManakFill.fillPhase1(SAMPLE_SHEET, 'Lot 1:104736831', {
    document: window.document,
    lot: 1,
    clickSaveInitial: false,
    postbackWaitMs: 0,
    activationWaitMs: 0,
  })
  assert(samplingSaveP1.ok, 'sampling Save path ok')
  assert(clicks.sampleSave === beforeSample + 1, 'Sample Drawn SAVE still clicked once')
  assert(clicks.buttonSave === beforeButton + 1, 'Button Weight SAVE still clicked once')
  assert(clicks.initial === beforeInitial, 'sampling Save did not click Save Initial')
  assert(leakedInitial === 0, 'sampling Save does not dispatch Save Initial bypass')
  assert(preparedScale > 0, 'scale prepare event fired before sampling Save')
  window.document.getElementById('btnSaveDrawn').setAttribute(
    'onclick',
    "if(!isScaleCaptured){alert('unauthorized weighing scale');return false;} __doPostBack('ctl00$btnSaveDrawn','')",
  )
  ManakFill.stripInlineScaleCheck(window.document.getElementById('btnSaveDrawn'))
  assert(
    !/unauthorized|isScaleCaptured/.test(window.document.getElementById('btnSaveDrawn').getAttribute('onclick') || ''),
    'inline scale check stripped from Sample Drawn SAVE',
  )
  assert(
    /__doPostBack/.test(window.document.getElementById('btnSaveDrawn').getAttribute('onclick') || ''),
    'Sample Drawn SAVE postback kept after strip',
  )

  const c1Row = window.document.querySelector('#assay tr:nth-child(4)')
  const extraTd = window.document.createElement('td')
  const extra = window.document.createElement('input')
  extra.id = 'txtCertifiedCg'
  extra.readOnly = true
  extra.value = '0'
  extraTd.appendChild(extra)
  c1Row.insertBefore(extraTd, c1Row.children[1])
  const colsCg = ManakFill.collectAssayInputs(window.document)
  assert(colsCg.m1[2]?.className === 'm1', 'C1 extra certified input is not used as M1')
  extraTd.remove()

  const c1M1 = window.document.querySelector('#assay tr:nth-child(4) .m1')
  const flag = window.document.createElement('input')
  flag.type = 'hidden'
  flag.id = 'hfScaleCapturedC1'
  flag.value = 'False'
  c1M1.parentElement.appendChild(flag)
  ManakFill.setPostedWeight(c1M1, 150.2)
  assert(flag.value === 'True' || flag.value === '1', 'C1 scale-captured hidden is True/1, not the weight')
  assert(Number(c1M1.value) === 150.2, 'C1 M1 weight stays 150.2')
  flag.remove()

  resetAssay(window.document)
  for (const el of m2Inputs(window.document)) {
    el.disabled = false
    el.readOnly = false
    el.value = '0'
  }
  const serialM2 = wirePortalSerialOnWeightClick(window.document)
  const postedP2 = await ManakFill.fillPhase2(SAMPLE_SHEET, 'Lot 1:104736831', {
    document: window.document,
    lot: 1,
    jobCard: '104736831',
    activationWaitMs: 0,
    postbackWaitMs: 0,
  })
  assert(postedP2.ok, 'Phase 2 posted fill ok')
  assert(postedP2.usedScanForM2 === false, 'Phase 2 did not use scan gesture')
  assert(postedP2.usedPostedWeight === true, 'Phase 2 used posted-value path')
  assert(Number(postedP2.m2Values[0]) === 152.686, 'Phase 2 posted M2 strip 1')
  assert(serialM2.count === 0, 'TEST 16 Phase 2 did not click M2 inputs')
  assert(postedP2.clickedSaveCornet === true, 'Phase 2 clicked Save Cornet with scale bypass')

  const altCornet = window.document.createElement('input')
  altCornet.type = 'button'
  altCornet.value = 'Save (Weight of cornet after assaying)'
  window.document.body.appendChild(altCornet)
  assert(ManakFill.isCornetSaveButton(altCornet) === true, 'matches Save (Weight of cornet after assaying)')
  altCornet.remove()
  const liveCornet = window.document.createElement('button')
  liveCornet.type = 'button'
  liveCornet.id = 'savecornetvalues'
  liveCornet.className = 'btn btn-primary-new button1'
  liveCornet.setAttribute('onclick', 'checkforremarks();')
  liveCornet.textContent = 'Save (Cornet Weight)'
  assert(ManakFill.isCornetSaveButton(liveCornet) === true, 'matches live savecornetvalues button')
  window.document.body.appendChild(liveCornet)
  assert(ManakFill.findSaveCornetButton(window.document)?.id === 'savecornetvalues', 'finds savecornetvalues by id')
  liveCornet.remove()
  assert(ManakFill.findSaveCornetButton(window.document)?.id === 'btnCornet', 'classic Cornet button still found')
  const disabledCornet = window.document.getElementById('btnCornet')
  disabledCornet.disabled = true
  disabledCornet.className = 'aspNetDisabled'
  const beforeDisabledClick = clicks.cornet
  assert(await ManakFill.clickSaveCornetWeight(window.document) === true, 'disabled Cornet Save still clicked')
  assert(clicks.cornet === beforeDisabledClick + 1, 'disabled Cornet Save click counted')
  disabledCornet.disabled = false
  disabledCornet.className = ''

  disabledCornet.setAttribute(
    'onclick',
    "if(!IsCornetCaptured()){alert('unauthorized weighing scale');return false;} __doPostBack('ctl00$btnSaveCornet','')",
  )
  ManakFill.forceBarePostback(disabledCornet)
  assert(
    !/IsCornetCaptured|unauthorized/.test(disabledCornet.getAttribute('onclick') || ''),
    'Cornet Save onclick validation stripped',
  )
  assert(/__doPostBack/.test(disabledCornet.getAttribute('onclick') || ''), 'Cornet Save postback kept')
  disabledCornet.removeAttribute('onclick')

  const srcLib = libCode
  assert(!/\.requestPort\s*\(/.test(srcLib), 'TEST 15 lib has no requestPort() after fill helpers')
  assert(!/navigator\s*\.\s*serial/.test(srcLib), 'TEST 15 lib still has no navigator.serial')
  assert(
    /dispatchEvent\(new root\.Event\('shrija-save-cornet'/.test(srcLib),
    'Phase 2 dispatches MAIN-world cornet save like Phase 1',
  )

  const bypassCode = readFileSync(join(__dirname, '../main-world-bypass.js'), 'utf8')
  const bypassDom = new JSDOM(
    `<!DOCTYPE html><html><body>
      <form id="form1" method="post">
        <input type="hidden" name="__VIEWSTATE" value="/wEP" />
        <input type="hidden" id="__EVENTTARGET" name="__EVENTTARGET" value="" />
        <input type="hidden" id="__EVENTARGUMENT" name="__EVENTARGUMENT" value="" />
        <input type="button" id="btnCornet" name="ctl00$btnSaveCornet" value="Save (Cornet Weight)"
          onclick="if(!isScaleCaptured){alert('scan weight');return false;} __doPostBack('ctl00$btnSaveCornet','')" />
      </form>
    </body></html>`,
    { url: 'https://huid.manakonline.in/assay', runScripts: 'outside-only' },
  )
  const { window: bw } = bypassDom
  let portalValidation = 0
  let submitted = 0
  bw.theForm = bw.document.getElementById('form1')
  bw.isScaleCaptured = false
  bw.document.getElementById('form1').onsubmit = function () {
    return false
  }
  bw.__doPostBack = function (t) {
    const form = bw.document.getElementById('form1')
    if (form.onsubmit && form.onsubmit() === false) {
      portalValidation += 1
      return
    }
    bw.document.getElementById('__EVENTTARGET').value = t
    form.submit()
  }
  bw.HTMLFormElement.prototype.submit = function () {
    submitted += 1
  }
  bw.eval(bypassCode)
  const cornetOk = bw.__shrijaBypassAndSubmitCornetWeight()
  assert(cornetOk === true, 'MAIN cornet save returns true')
  assert(submitted === 1, 'Cornet save uses portal __doPostBack then theForm.submit')
  assert(portalValidation === 0, 'onsubmit validators were neutralized')
  assert(bw.isScaleCaptured === true, 'scale flags stay locked true')
  assert(
    bw.document.getElementById('__EVENTTARGET').value === 'ctl00$btnSaveCornet',
    'EVENTTARGET is Cornet UniqueID',
  )
  if (bw.__shrijaPrepareTimer) bw.clearInterval(bw.__shrijaPrepareTimer)
  if (bw.__shrijaEndRequestTimer) bw.clearInterval(bw.__shrijaEndRequestTimer)
  bypassDom.window.close()

  const liveBypassDom = new JSDOM(
    `<!DOCTYPE html><html><body>
      <form id="form1" method="post">
        <input type="hidden" name="__VIEWSTATE" value="/wEP" />
        <input id="num_cornet_weightM11" name="num_cornet_weightM11" class="form-control weightCls scan-input" value="0" />
        <input id="averagedelta1" name="num_cornet_weight_goldM11" class="form-control weightValidation" value="" />
        <input id="num_cornet_weightM12" name="num_cornet_weightM12" class="form-control weightCls scan-input" value="0" />
        <input id="num_cornet_weight_goldM11" name="num_cornet_weight_goldM11" class="form-control weightCls scan-input" value="0" />
        <input id="delta11" name="num_cornet_weight_goldM11" class="form-control weightValidation" value="" />
        <input id="num_cornet_weight_goldM12" name="num_cornet_weight_goldM12" class="form-control weightCls scan-input" value="0" />
        <input id="delta22" name="num_cornet_weightM12" class="form-control weightValidation" value="" />
        <input id="txtremarks" name="txtremarks" type="text" value="" />
        <button type="button" id="savecornetvalues" class="btn btn-primary-new button1" onclick="checkforremarks();">Save (Cornet Weight)</button>
      </form>
    </body></html>`,
    { url: 'https://huid.manakonline.in/assay', runScripts: 'outside-only' },
  )
  const { window: lw } = liveBypassDom
  let remarksCalled = 0
  let livePosted = 0
  lw.checkforremarks = function () {
    remarksCalled += 1
  }
  lw.__doPostBack = function () {
    livePosted += 1
  }
  lw.eval(bypassCode)
  assert(typeof lw.checkforremarks === 'function', 'live checkforremarks stays a function')
  assert(lw.checkforremarks.__shrijaBypassed !== true, 'checkforremarks is not stubbed as a validator')
  assert(lw.document.getElementById('savecornetvalues').getAttribute('onclick') === 'checkforremarks();', 'onclick stays checkforremarks')
  const liveOk = lw.__shrijaBypassAndSubmitCornetWeight()
  assert(liveOk === true, 'live Cornet save returns true')
  assert(remarksCalled === 1, 'live Cornet save calls checkforremarks')
  assert(livePosted === 0, 'live Cornet save does not invent __doPostBack')
  assert(lw.document.getElementById('txtremarks').value === 'NA', 'empty remarks filled before save')
  if (lw.__shrijaPrepareTimer) lw.clearInterval(lw.__shrijaPrepareTimer)
  if (lw.__shrijaEndRequestTimer) lw.clearInterval(lw.__shrijaEndRequestTimer)
  liveBypassDom.window.close()

  const namedDom = new JSDOM(
    `<!DOCTYPE html><html><body>
      <select id="ddlLot"><option value="1">Lot 1:104736831</option></select>
      <input id="num_cornet_weightM11" class="form-control weightCls scan-input" value="0" />
      <input id="averagedelta1" name="num_cornet_weight_goldM11" value="" />
      <input id="num_cornet_weightM12" class="form-control weightCls scan-input" value="0" />
      <input id="num_cornet_weight_goldM11" class="form-control weightCls scan-input" value="0" />
      <input id="delta11" value="" />
      <input id="num_cornet_weight_goldM12" class="form-control weightCls scan-input" value="0" />
      <button type="button" id="savecornetvalues" onclick="checkforremarks();">Save (Cornet Weight)</button>
    </body></html>`,
    { url: 'https://huid.manakonline.in/assay', runScripts: 'outside-only' },
  )
  namedDom.window.eval(libCode)
  const NamedFill = namedDom.window.ManakFill
  NamedFill.delay = () => Promise.resolve()
  NamedFill.waitUntilSerialGestureExpired = async () => 'skipped'
  const namedCols = NamedFill.collectAssayInputs(namedDom.window.document)
  assert(namedCols.m2[0]?.id === 'num_cornet_weightM11', 'named M2 strip 1')
  assert(namedCols.m2[1]?.id === 'num_cornet_weightM12', 'named M2 strip 2')
  assert(namedCols.m2[2]?.id === 'num_cornet_weight_goldM11', 'named M2 C1 is goldM11 id not averagedelta')
  assert(namedCols.m2[3]?.id === 'num_cornet_weight_goldM12', 'named M2 C2')
  const namedP2 = await NamedFill.fillPhase2(SAMPLE_SHEET, 'Lot 1:104736831', {
    document: namedDom.window.document,
    lot: 1,
    jobCard: '104736831',
    activationWaitMs: 0,
    postbackWaitMs: 0,
  })
  assert(namedP2.ok, 'named-id Phase 2 ok')
  assert(Number(namedDom.window.document.getElementById('num_cornet_weightM11').value) === 152.686, 'fills M11 not delta')
  assert(namedDom.window.document.getElementById('averagedelta1').value === '', 'does not fill averagedelta')
  assert(namedDom.window.document.getElementById('delta11').value === '', 'does not fill delta11')
  namedDom.window.close()

  // Clubbed jobs: header parent must not steal Lot 1 of another job
  const clubbedHtml = `
    <div>Job Card Number: 127935258 Clubbed with: 127935264, 127935269</div>
    <table id="jobCard">
      <tr><td>Job Card Number</td><td id="sectionJob">127935269</td></tr>
      <tr>
        <td>Lot No. : Job No.</td>
        <td>
          <select id="ddlLot">
            <option value="">Select</option>
            <option value="1">Lot 1:127935258</option>
            <option value="2">Lot 1:127935264</option>
            <option value="3" selected>Lot 1:127935269</option>
          </select>
        </td>
      </tr>
    </table>
    <table id="assay">
      <tr><th>Sample Type</th><th>Initial weight M1</th><th>Silver</th><th>Copper</th><th>Lead</th><th>cornet M2</th></tr>
      <tr><td>Strip 1</td><td><input class="m1" value="164.81" /></td><td><input class="ag" value="0" /></td><td><input class="cu" value="0" /></td><td><input class="pb" value="0" /></td><td><input class="m2" value="0" /></td></tr>
      <tr><td>Strip 2</td><td><input class="m1" value="164.57" /></td><td><input class="ag" value="0" /></td><td><input class="cu" value="0" /></td><td><input class="pb" value="0" /></td><td><input class="m2" value="0" /></td></tr>
      <tr><td>C1(Check Gold)</td><td><input class="m1" value="149.6" /></td><td><input class="ag" value="0" /></td><td><input class="cu" value="0" /></td><td><input class="pb" value="0" /></td><td><input class="m2" value="0" /></td></tr>
      <tr><td>C2(Check Gold)</td><td><input class="m1" value="149.798" /></td><td><input class="ag" value="0" /></td><td><input class="cu" value="0" /></td><td><input class="pb" value="0" /></td><td><input class="m2" value="0" /></td></tr>
    </table>
  `
  const clubbedSheet = {
    ...SAMPLE_SHEET,
    rows: [
      {
        lotNo: 1,
        jobCardNo: '1_127935258',
        manakJobCard: '127935258',
        sampleDrawn: 333.41,
        sampleWeight: 164.81,
        silver: 373.3,
        lead: 4,
        wotgcaa: 151.396,
      },
      {
        lotNo: 1,
        jobCardNo: '1_127935258',
        manakJobCard: '127935258',
        sampleDrawn: 333.41,
        sampleWeight: 164.57,
        silver: 373.3,
        lead: 4,
        wotgcaa: 151.146,
      },
      {
        lotNo: 1,
        jobCardNo: '1_127935269',
        manakJobCard: '127935269',
        sampleDrawn: 332.89,
        sampleWeight: 164.394,
        silver: 373.3,
        lead: 4,
        wotgcaa: 150.76,
      },
      {
        lotNo: 1,
        jobCardNo: '1_127935269',
        manakJobCard: '127935269',
        sampleDrawn: 332.89,
        sampleWeight: 164.153,
        silver: 373.3,
        lead: 4,
        wotgcaa: 150.51,
      },
    ],
  }
  const clubbedDom = new JSDOM(`<!DOCTYPE html><html><body>${clubbedHtml}</body></html>`, {
    url: 'https://huid.manakonline.in/MANAK/SamplingweightingDeatils',
    runScripts: 'outside-only',
  })
  clubbedDom.window.eval(libCode)
  const ClubFill = clubbedDom.window.ManakFill
  ClubFill.delay = () => Promise.resolve()
  ClubFill.waitUntilSerialGestureExpired = async () => 'skipped'
  const clubDoc = clubbedDom.window.document
  assert(ClubFill.readJobCardBesideLot(clubDoc) === '127935269', 'clubbed Job Card section is 269 not header 258')
  const clubLot = ClubFill.readSelectedLotFromSelect(clubDoc.getElementById('ddlLot'), clubDoc)
  assert(clubLot.jobCard === '127935269', 'selected lot job is 269')
  assert(clubLot.lot === 1, 'clubbed lots share Lot 1')
  assert(ClubFill.lotContextMatches(clubLot, clubDoc) === true, '269 form matches selected 269')
  assert(
    ClubFill.lotContextMatches({ lot: 1, jobCard: '127935258' }, clubDoc) === false,
    'parent 258 does not match 269 form',
  )
  assert(ManakFill.readJobCardBesideLot(window.document) === '104736831', 'main mock Job Card is section not header')
  const staleM1 = ClubFill.collectAssayInputs(clubDoc)
  const rows269 = ClubFill.resolveStripRowsByJobAndLot(clubbedSheet, '127935269', 1).rows
  assert(rows269[0].sampleWeight === 164.394, 'sheet M1 for 269')
  assert(ClubFill.displayedM1MatchesJob(staleM1, rows269) === false, '258 M1 on 269 form is a mismatch')
  const blockedP2 = await ClubFill.fillPhase2(clubbedSheet, 'Lot 1:127935269', {
    document: clubDoc,
    lot: 1,
    jobCard: '127935269',
    activationWaitMs: 0,
    clickSaveCornet: false,
    postbackWaitMs: 0,
  })
  assert(blockedP2.ok === false, 'Phase 2 blocked when M1 belongs to another clubbed job')
  assert(blockedP2.error === 'm1_mismatch_wrong_job', 'Phase 2 error is m1_mismatch_wrong_job')
  assert(Number(clubDoc.querySelector('#assay .m2').value) === 0, 'wrong-job M2 was not written')
  clubDoc.querySelectorAll('#assay .m1')[0].value = '164.394'
  clubDoc.querySelectorAll('#assay .m1')[1].value = '164.153'
  const okP2 = await ClubFill.fillPhase2(clubbedSheet, 'Lot 1:127935269', {
    document: clubDoc,
    lot: 1,
    jobCard: '127935269',
    activationWaitMs: 0,
    clickSaveCornet: false,
    postbackWaitMs: 0,
  })
  assert(okP2.ok, 'Phase 2 fills 269 after M1 matches')
  assert(Number(okP2.m2Values[0]) === 150.76, 'Phase 2 M2 is 269 not 258')
  assert(Number(okP2.m2Values[1]) === 150.51, 'Phase 2 M2 strip 2 is 269')
  assert(/readSelectedLotFromSelect/.test(manakSrc), 'content-manak reads lot from the select')
  assert(!/includes\(m\[1\]\)/.test(manakSrc), 'content-manak does not map header job onto a lot option')
  assert(/m1_mismatch_wrong_job/.test(libCode), 'lib guards clubbed M1 mismatch')
  assert(/waitForLotForm/.test(manakSrc), 'content-manak waits for Job Card section')
  clubbedDom.window.close()

  console.log('\nALL TESTS PASSED')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
