/**
 * Shrija → Manak AUTO fill (no Fill / Load buttons).
 * Stepped for ASP.NET postback: sample Save → reload → button Save → reload → assay.
 */
const KEY = 'shrija-manak-fire-assay-sheet'
const M2_PENDING_KEY = 'shrija-manak-m2-pending'
const FLOW_KEY = 'shrija-manak-fill-flow'

const MF = globalThis.ManakFill
if (!MF) console.error('[Shrija] manak-fill-lib.js missing — reload extension')

function showToast(msg, ms = 7000) {
  const n = document.createElement('div')
  n.textContent = msg
  Object.assign(n.style, {
    position: 'fixed',
    top: '12px',
    right: '12px',
    zIndex: 999999,
    background: '#0f2744',
    color: '#fff',
    padding: '10px 14px',
    borderRadius: '8px',
    font: '600 13px/1.35 system-ui,sans-serif',
    boxShadow: '0 8px 24px rgba(0,0,0,.25)',
    maxWidth: '380px',
  })
  document.body.appendChild(n)
  setTimeout(() => n.remove(), ms)
}

function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve))
}
function storageSet(obj) {
  return new Promise((resolve) => chrome.storage.local.set(obj, resolve))
}
function storageRemove(keys) {
  return new Promise((resolve) => chrome.storage.local.remove(keys, resolve))
}

function ensureStatusBadge() {
  let el = document.getElementById('shrija-manak-auto-status')
  if (!el) {
    el = document.createElement('div')
    el.id = 'shrija-manak-auto-status'
    Object.assign(el.style, {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: 999999,
      background: '#15803d',
      color: '#fff',
      padding: '10px 14px',
      borderRadius: '10px',
      font: '700 12px/1.35 system-ui,sans-serif',
      boxShadow: '0 8px 24px rgba(0,0,0,.28)',
      maxWidth: '280px',
    })
    document.body.appendChild(el)
  }
  chrome.storage.local.get([KEY], (data) => {
    const sheet = data[KEY]
    const n = sheet?.rows?.length || sheet?.viewRows?.length || 0
    if (n) {
      el.style.background = '#15803d'
      el.textContent = `AUTO · FS-${sheet.sheetNo || '?'} · ${n} rows — sirf Lot select karo`
    } else {
      el.style.background = '#b45309'
      el.textContent = 'AUTO · No sheet — Shrija Create Sheet pehle'
    }
  })
}

function watchM2Unlock(m2Values) {
  chrome.storage.local.set({ [M2_PENDING_KEY]: { m2Values, at: Date.now() } })
  if (window.__shrijaM2Timer) clearInterval(window.__shrijaM2Timer)
  let tries = 0
  window.__shrijaM2Timer = setInterval(async () => {
    tries += 1
    const cols = MF.collectAssayInputs(document)
    const open = cols.m2.some((el) => el && !el.disabled && !el.readOnly)
    if (open) {
      cols.m2.forEach((el, i) => MF.setNativeValue(el, m2Values[i]))
      await MF.delay(300)
      MF.clickByText(/Save\s*\(?\s*Cornet\s*Weight\s*\)?/i, document)
      showToast('Shrija AUTO: M2 + Cornet Save')
      clearInterval(window.__shrijaM2Timer)
      window.__shrijaM2Timer = null
      chrome.storage.local.remove(M2_PENDING_KEY)
    } else if (tries > 180) {
      clearInterval(window.__shrijaM2Timer)
      window.__shrijaM2Timer = null
    }
  }, 2000)
}

function resolveFromSheet(sheet, selectText, lot) {
  return MF.resolveStripRows(sheet, lot, selectText)
}

async function stepSampleDrawn(sheet, flow) {
  const resolved = resolveFromSheet(sheet, flow.selectText, flow.lot)
  if (!resolved.rows.length) return showToast('Shrija AUTO: lot match nahi')
  const drawn = Number(resolved.rows[0]?.sampleDrawn || 0)
  if (!(drawn > 0)) return showToast('Shrija AUTO: Sample Drawn 0')

  const { sampleDrawn } = MF.findSamplingInputs(document)
  if (!sampleDrawn) return showToast('Shrija AUTO: Sample Drawn field nahi mila')

  if (!MF.setNativeValue(sampleDrawn, drawn)) {
    return showToast('Shrija AUTO: Sample Drawn set fail (galat field block)')
  }

  await storageSet({
    [FLOW_KEY]: { ...flow, step: 'button', drawn, at: Date.now() },
  })
  showToast('Shrija AUTO: Sample Drawn → Save…')
  const btn = MF.findSaveBeside(sampleDrawn)
  if (btn) btn.click()
  else showToast('Shrija AUTO: Sample Drawn Save button nahi mila')

  // If no postback, continue after short wait
  await MF.delay(1500)
  const still = (await storageGet([FLOW_KEY]))[FLOW_KEY]
  if (still?.step === 'button') await stepButtonWeight(sheet, still)
}

async function stepButtonWeight(sheet, flow) {
  const drawn = Number(flow.drawn || 0)
  const { sampleDrawn, buttonWt } = MF.findSamplingInputs(document)
  if (sampleDrawn && Number(sampleDrawn.value) === 0 && drawn) {
    MF.setNativeValue(sampleDrawn, drawn)
  }
  if (!buttonWt) return showToast('Shrija AUTO: Button Weight field nahi mila')
  if (!MF.setNativeValue(buttonWt, drawn)) return showToast('Shrija AUTO: Button Weight set fail')

  await storageSet({
    [FLOW_KEY]: { ...flow, step: 'assay', at: Date.now() },
  })
  showToast('Shrija AUTO: Button Weight → Save…')
  const btn = MF.findSaveBeside(buttonWt)
  if (btn) btn.click()
  else showToast('Shrija AUTO: Button Weight Save nahi mila')

  await MF.delay(1500)
  const still = (await storageGet([FLOW_KEY]))[FLOW_KEY]
  if (still?.step === 'assay') await stepAssay(sheet, still)
}

async function stepAssay(sheet, flow) {
  const resolved = resolveFromSheet(sheet, flow.selectText, flow.lot)
  if (!resolved.rows.length) return showToast('Shrija AUTO: assay lot match nahi')

  const { sampleDrawn, buttonWt } = MF.findSamplingInputs(document)
  const sd = Number(sampleDrawn?.value || 0)
  const bw = Number(buttonWt?.value || 0)
  const drawn = Number(flow.drawn || 0)
  if (sd <= 0 && drawn) MF.setNativeValue(sampleDrawn, drawn)
  if (bw <= 0 && drawn) MF.setNativeValue(buttonWt, drawn)

  // Re-check — Manak blocks initial save if sampling empty
  const sd2 = Number(MF.findSamplingInputs(document).sampleDrawn?.value || 0)
  const bw2 = Number(MF.findSamplingInputs(document).buttonWt?.value || 0)
  if (sd2 <= 0 && bw2 <= 0) {
    showToast('Shrija AUTO: Sampling abhi 0 — pehle Sample/Button Save hona chahiye')
    await storageSet({ [FLOW_KEY]: { ...flow, step: 'sample', at: Date.now() } })
    return
  }

  const stripRows = resolved.rows
  const cg = sheet.cg || {}
  const m1s = [stripRows[0]?.sampleWeight, stripRows[1]?.sampleWeight, cg.cg1, cg.cg2]
  const silvers = [stripRows[0]?.silver, stripRows[1]?.silver, cg.silverCg1, cg.silverCg2]
  const coppers = [0, 0, cg.copperCg1 ?? 0, cg.copperCg2 ?? 0]
  const leads = [
    stripRows[0]?.lead || 4,
    stripRows[1]?.lead || 4,
    cg.leadCg1 || 4,
    cg.leadCg2 || 4,
  ]
  const m2s = [stripRows[0]?.wotgcaa, stripRows[1]?.wotgcaa, cg.wotgcaa1, cg.wotgcaa2]

  const cols = MF.collectAssayInputs(document)
  let filledM1 = 0
  for (let i = 0; i < 4; i++) {
    if (MF.setNativeValue(cols.m1[i], m1s[i])) filledM1 += 1
    MF.setNativeValue(cols.silver[i], silvers[i])
    MF.setNativeValue(cols.copper[i], coppers[i])
    MF.setNativeValue(cols.lead[i], leads[i])
  }

  await storageRemove(FLOW_KEY)
  await MF.delay(400)
  const saved =
    MF.clickByText(/Save\s*\(?\s*Initial\s*Weight\s*\)?/i, document) ||
    MF.clickByText(/Initial\s*Weight/i, document)

  const m2Open = cols.m2.some((el) => el && !el.disabled && !el.readOnly)
  if (m2Open) {
    cols.m2.forEach((el, i) => MF.setNativeValue(el, m2s[i]))
    await MF.delay(300)
    MF.clickByText(/Save\s*\(?\s*Cornet\s*Weight\s*\)?/i, document)
    showToast(`Shrija AUTO: complete · M1 ${filledM1}/4 + M2`)
  } else {
    watchM2Unlock(m2s)
    showToast(
      saved
        ? `Shrija AUTO: M1 ${filledM1}/4 saved · timing wait → M2 auto`
        : `Shrija AUTO: M1 ${filledM1}/4 filled · Initial Save check karo`,
      9000,
    )
  }
  ensureStatusBadge()
}

async function runAutoFill(selectText, preferredLot) {
  if (window.__shrijaFilling) return
  window.__shrijaFilling = true
  try {
    const sheet = (await storageGet([KEY]))[KEY]
    if (!sheet) {
      showToast('Shrija AUTO: pehle Create Sheet (Shrija app)')
      ensureStatusBadge()
      return
    }
    const parsed = MF.parseLotOptionText(selectText || '')
    if (parsed.lot == null && !parsed.jobCard) return

    const flow = {
      step: 'sample',
      selectText,
      lot: preferredLot ?? parsed.lot,
      jobCard: parsed.jobCard,
      at: Date.now(),
    }
    await stepSampleDrawn(sheet, flow)
  } finally {
    window.__shrijaFilling = false
  }
}

async function resumeFlow() {
  const data = await storageGet([FLOW_KEY, KEY, M2_PENDING_KEY])
  if (data[M2_PENDING_KEY]?.m2Values) watchM2Unlock(data[M2_PENDING_KEY].m2Values)

  const flow = data[FLOW_KEY]
  const sheet = data[KEY]
  if (!flow || !sheet) return
  if (Date.now() - (flow.at || 0) > 8 * 60 * 1000) {
    await storageRemove(FLOW_KEY)
    return
  }

  // Re-bind lot text if dropdown still has selection
  const sel = MF.findLotSelect(document)
  if (sel && sel.selectedIndex > 0) {
    flow.selectText = sel.options[sel.selectedIndex]?.text || flow.selectText
  }

  showToast(`Shrija AUTO resume: ${flow.step}`)
  if (flow.step === 'button') await stepButtonWeight(sheet, flow)
  else if (flow.step === 'assay') await stepAssay(sheet, flow)
  else if (flow.step === 'sample') await stepSampleDrawn(sheet, flow)
}

function bindLotAuto() {
  const sel = MF.findLotSelect(document)
  if (!sel || sel.dataset.shrijaAutoBound) return
  sel.dataset.shrijaAutoBound = '1'
  sel.addEventListener('change', () => {
    const opt = sel.options[sel.selectedIndex]
    const text = (opt?.text || '').trim()
    const parsed = MF.parseLotOptionText(text)
    if (parsed.lot == null && !parsed.jobCard) return
    runAutoFill(text, parsed.lot)
  })
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'SHRIJA_FILL_MANAK_NOW') {
    const sel = MF.findLotSelect(document)
    const text = sel?.options?.[sel.selectedIndex]?.text || ''
    runAutoFill(text)
  }
})

const onAssayPage = /Samplingweighting|Fire Assaying|Sample Drawn|Assaying Sheet/i.test(
  `${location.href} ${document.body?.innerText || ''}`,
)

if (onAssayPage && MF) {
  setTimeout(bindLotAuto, 400)
  setTimeout(bindLotAuto, 1500)
  setTimeout(bindLotAuto, 4000)
  setTimeout(ensureStatusBadge, 500)
  setInterval(ensureStatusBadge, 2500)
  // Resume after ASP.NET Save postback BEFORE auto-firing on existing lot
  setTimeout(resumeFlow, 900)

  setTimeout(() => {
    // Only auto-start from existing lot if no pending flow
    chrome.storage.local.get([FLOW_KEY], (d) => {
      if (d[FLOW_KEY]) return
      const sel = MF.findLotSelect(document)
      if (!sel || sel.selectedIndex <= 0) return
      const text = sel.options[sel.selectedIndex]?.text || ''
      const parsed = MF.parseLotOptionText(text)
      if (parsed.lot != null || parsed.jobCard) runAutoFill(text, parsed.lot)
    })
  }, 2200)
}
