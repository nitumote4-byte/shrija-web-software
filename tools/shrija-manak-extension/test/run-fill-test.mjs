/**
 * Local test: Manak mock DOM + fillLot assertions (no Chrome, no live Manak).
 * Run: node tools/shrija-manak-extension/test/run-fill-test.mjs
 */
import { createRequire } from 'module'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { createRequire as nodeCreateRequire } from 'module'
import { spawnSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '../../..')
const requireRoot = nodeCreateRequire(join(root, 'package.json'))

async function loadJsdom() {
  try {
    return requireRoot('jsdom')
  } catch {
    console.log('Installing jsdom for test…')
    spawnSync('npm', ['install', 'jsdom', '--no-save'], { cwd: root, stdio: 'inherit', shell: true })
    return requireRoot('jsdom')
  }
}

const MOCK_HTML = `
<!DOCTYPE html>
<html><body>
  <h3>Job Card Details</h3>
  <table id="jobCard">
    <tr><td>Job Card Number</td><td>104736831</td></tr>
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
    </tr>
    <tr>
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
    wotgcaa2: 149.2,
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
  ],
}

function assert(cond, msg) {
  if (!cond) throw new Error('FAIL: ' + msg)
  console.log('  OK:', msg)
}

async function main() {
  const { JSDOM } = await loadJsdom()
  const libPath = join(__dirname, '../manak-fill-lib.js')
  const libCode = readFileSync(libPath, 'utf8')

  const dom = new JSDOM(MOCK_HTML, { runScripts: 'outside-only', url: 'https://huid.manakonline.in/MANAK/SamplingweightingDeatils' })
  const { window } = dom
  // Execute lib in window scope
  window.eval(libCode)
  const ManakFill = window.ManakFill
  assert(ManakFill, 'ManakFill loaded')

  // --- Unit: lot parse ---
  assert(ManakFill.parseLotOptionText('Lot 1:104736831').jobCard === '104736831', 'parse Lot 1:job')
  assert(ManakFill.parseLotOptionText('Select').lot == null, 'Select = no lot')

  // --- Sampling finders must NOT hit Declared Purity ---
  const samp = ManakFill.findSamplingInputs(window.document)
  assert(samp.sampleDrawn?.id === 'txtSampleDrawn', 'Sample Drawn = txtSampleDrawn')
  assert(samp.buttonWt?.id === 'txtButtonWeight', 'Button Weight = txtButtonWeight')
  assert(samp.sampleDrawn?.id !== 'declaredPurity', 'not Declared Purity')

  // --- Fill Lot 1 ---
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

  // --- Fill Lot 2 ---
  // reset sampling
  window.document.getElementById('txtSampleDrawn').value = '0'
  window.document.getElementById('txtButtonWeight').value = '0'
  const r2 = await ManakFill.fillLot(SAMPLE_SHEET, 'Lot 2:104736832', {
    document: window.document,
    clickSave: false,
    lot: 2,
  })
  assert(r2.ok, 'lot2 fill ok')
  assert(Number(r2.sampleDrawnValue) === 332.81, 'Lot2 Sample Drawn')
  assert(Number(r2.m1Values[0]) === 166.525, 'Lot2 M1 Strip1')

  console.log('\nALL TESTS PASSED')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
