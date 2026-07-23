/**
 * Shrija → Manak AUTO fill (no Fill / Load buttons).
 * Stepped for ASP.NET postback: sample Save → reload → button Save → reload → assay.
 */
const KEY = 'shrija-manak-fire-assay-sheet'
const M2_PENDING_KEY = 'shrija-manak-m2-pending'
const FLOW_KEY = 'shrija-manak-fill-flow'
const DONE_KEY = 'shrija-manak-fill-done'

const MF = globalThis.ManakFill
if (!MF) console.error('[Shrija] manak-fill-lib.js missing — reload extension')

/** True while this content-script can still talk to the extension (false after Reload). */
function extAlive() {
  try {
    return Boolean(chrome?.runtime?.id)
  } catch {
    return false
  }
}

function showToast(msg, ms = 7000) {
  try {
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
  } catch {
    /* ignore */
  }
}

function storageGet(keys) {
  return new Promise((resolve) => {
    if (!extAlive()) return resolve({})
    try {
      chrome.storage.local.get(keys, (data) => {
        if (chrome.runtime.lastError) return resolve({})
        resolve(data || {})
      })
    } catch {
      resolve({})
    }
  })
}
function storageSet(obj) {
  return new Promise((resolve) => {
    if (!extAlive()) return resolve()
    try {
      chrome.storage.local.set(obj, () => {
        void chrome.runtime.lastError
        resolve()
      })
    } catch {
      resolve()
    }
  })
}
function storageRemove(keys) {
  return new Promise((resolve) => {
    if (!extAlive()) return resolve()
    try {
      chrome.storage.local.remove(keys, () => {
        void chrome.runtime.lastError
        resolve()
      })
    } catch {
      resolve()
    }
  })
}

function stopTimers() {
  if (window.__shrijaM2Timer) {
    clearInterval(window.__shrijaM2Timer)
    window.__shrijaM2Timer = null
  }
  if (window.__shrijaBadgeTimer) {
    clearInterval(window.__shrijaBadgeTimer)
    window.__shrijaBadgeTimer = null
  }
  if (window.__shrijaWatchTimer) {
    clearInterval(window.__shrijaWatchTimer)
    window.__shrijaWatchTimer = null
  }
}

function readSelectedLot() {
  const sel = MF?.findLotSelect?.(document)
  if (!sel) return { text: '', lot: null, jobCard: '' }
  // Prefer any option whose text looks like Lot N:job (even if selectedIndex quirky)
  let opt = sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex] : null
  let text = (opt?.text || opt?.label || '').trim()
  let parsed = MF.parseLotOptionText(text)
  if (parsed.lot == null && !parsed.jobCard) {
    // Sometimes "Select" is index 0 but value already set; scan selected option by value
    const byVal = Array.from(sel.options).find((o) => o.selected) || null
    text = (byVal?.text || sel.value || '').trim()
    parsed = MF.parseLotOptionText(text)
  }
  if (parsed.lot == null && !parsed.jobCard) {
    // Match page job card number to an option
    const body = (document.body?.innerText || '').replace(/\s+/g, ' ')
    const m = /Job\s*Card\s*(?:Number|No\.?)\s*[:：]?\s*(\d{6,})/i.exec(body)
    if (m) {
      const hit = Array.from(sel.options).find((o) => String(o.text || '').includes(m[1]))
      if (hit) {
        text = (hit.text || '').trim()
        parsed = MF.parseLotOptionText(text)
      }
    }
  }
  return { text, ...parsed, sel }
}

function samplingStillEmpty() {
  const { sampleDrawn, buttonWt } = MF.findSamplingInputs(document)
  const sd = Number(sampleDrawn?.value || 0)
  const bw = Number(buttonWt?.value || 0)
  return sd <= 0 && bw <= 0
}

function ensureStatusBadge() {
  if (!extAlive()) {
    stopTimers()
    return
  }
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
      cursor: 'pointer',
    })
    el.title = 'Click = force fill again (overwrite)'
    el.addEventListener('click', () => {
      const lot = readSelectedLot()
      if (lot.lot == null && !lot.jobCard) {
        showToast('Shrija AUTO: pehle Lot No select karo')
        return
      }
      window.__shrijaForceFill = true
      storageRemove(DONE_KEY)
      storageRemove(FLOW_KEY)
      runAutoFill(lot.text, lot.lot, { force: true })
    })
    document.body.appendChild(el)
  }
  try {
    chrome.storage.local.get([KEY], (data) => {
      if (!extAlive() || chrome.runtime.lastError) return
      const sheet = data[KEY]
      const n = sheet?.rows?.length || sheet?.viewRows?.length || 0
      const lot = MF ? readSelectedLot() : { lot: null }
      if (n) {
        el.style.background = '#15803d'
        el.textContent =
          lot.lot != null
            ? `AUTO · FS-${sheet.sheetNo || '?'} · Lot ${lot.lot} — select Lot once / click=retry`
            : `AUTO · FS-${sheet.sheetNo || '?'} · ${n} rows — Lot select karo`
      } else {
        el.style.background = '#b45309'
        el.textContent = 'AUTO · No sheet — Shrija Create Sheet pehle'
      }
    })
  } catch {
    stopTimers()
  }
}

/**
 * Only resume mid-flow after ASP.NET Save postback.
 * Does NOT start a new fill (that was causing continuous hard fill + Lot blocked).
 */
async function watchdogTick() {
  if (!extAlive() || !MF || window.__shrijaFilling) return
  if (document.activeElement && /SELECT|INPUT|TEXTAREA/i.test(document.activeElement.tagName)) {
    // User is selecting Lot / typing — don't steal focus
    return
  }
  const data = await storageGet([FLOW_KEY, DONE_KEY])
  const flow = data[FLOW_KEY]
  if (!flow) return
  if (Date.now() - (flow.at || 0) > 8 * 60 * 1000) {
    await storageRemove(FLOW_KEY)
    return
  }
  // Don't fight a completed lot
  const lot = readSelectedLot()
  const lotKey = `${lot.lot || ''}:${lot.jobCard || lot.text || ''}`
  if (data[DONE_KEY]?.lotKey === lotKey && data[DONE_KEY]?.ok) return

  await resumeFlow()
}

function markLotDone(lotKey) {
  return storageSet({
    [DONE_KEY]: { lotKey, ok: true, at: Date.now() },
  })
}

function resolveFromSheet(sheet, selectText, lot) {
  return MF.resolveStripRows(sheet, lot, selectText)
}

/** Sample Drawn / Button must be ≥ 2× max strip M1 so Manak accepts strip weights (fineness stays correct). */
function requiredDrawnForStrips(sheet, selectText, lot) {
  const resolved = resolveFromSheet(sheet, selectText, lot)
  const s1 = Number(resolved.rows[0]?.sampleWeight || 0)
  const s2 = Number(resolved.rows[1]?.sampleWeight || 0)
  const fromSheet = Number(resolved.rows[0]?.sampleDrawn || 0)
  const need = Math.max(s1, s2) * 2 + 0.002
  return Number(Math.max(fromSheet, need).toFixed(3))
}

async function stepSampleDrawn(sheet, flow) {
  const resolved = resolveFromSheet(sheet, flow.selectText, flow.lot)
  if (!resolved.rows.length) return showToast('Shrija AUTO: lot match nahi')
  const force = Boolean(flow.force || window.__shrijaForceFill)
  const drawn = requiredDrawnForStrips(sheet, flow.selectText, flow.lot)
  if (!(drawn > 0)) return showToast('Shrija AUTO: Sample Drawn 0 sheet mein')

  let { sampleDrawn, buttonWt } = MF.findSamplingInputs(document)
  if (!sampleDrawn) return showToast('Shrija AUTO: Sample Drawn field nahi mila')
  if (buttonWt && sampleDrawn === buttonWt) {
    return showToast('Shrija AUTO: Sample/Button same field — stop')
  }

  const sdCur = Number(sampleDrawn.value || 0)
  if (!force && sdCur > 0.01) {
    showToast(`Shrija AUTO: Sample Drawn already ${sdCur} — keep`)
  } else {
    const ok = await MF.forceSetWeight(sampleDrawn, drawn, 3, { force: true })
    sampleDrawn = MF.findSamplingInputs(document).sampleDrawn || sampleDrawn
    if (!(Number(sampleDrawn?.value || 0) > 0)) {
      return showToast('Shrija AUTO: Sample Drawn set fail')
    }
  }

  await storageSet({ [FLOW_KEY]: { ...flow, step: 'button', drawn, force, at: Date.now() } })
  showToast(`Shrija AUTO: 1/2 Sample Drawn ${Number(sampleDrawn.value)} → Save…`)
  await MF.delay(350)
  const btn = MF.findSaveBeside(sampleDrawn)
  if (btn) btn.click()
  await MF.delay(2200)
  if (!extAlive()) return

  let sdAfter = Number(MF.findSamplingInputs(document).sampleDrawn?.value || 0)
  if (!(sdAfter > 0)) {
    await MF.forceSetWeight(MF.findSamplingInputs(document).sampleDrawn, drawn, 3, { force: true })
    sdAfter = Number(MF.findSamplingInputs(document).sampleDrawn?.value || 0)
  }
  if (!(sdAfter > 0)) {
    showToast('Shrija AUTO: Sample Drawn still 0 after Save — stop (no Button fill)')
    return
  }
  await stepButtonWeight(sheet, { ...flow, step: 'button', drawn, force })
}

async function stepButtonWeight(sheet, flow) {
  const drawn = Number(flow.drawn || 0)
  const force = Boolean(flow.force || window.__shrijaForceFill)
  let { sampleDrawn, buttonWt } = MF.findSamplingInputs(document)
  let sd = Number(sampleDrawn?.value || 0)
  if (!(sd > 0)) {
    await storageSet({ [FLOW_KEY]: { ...flow, step: 'sample', drawn, force, at: Date.now() } })
    return stepSampleDrawn(sheet, { ...flow, step: 'sample', drawn, force })
  }
  if (!buttonWt || buttonWt === sampleDrawn) return showToast('Shrija AUTO: Button field missing')

  const btnVal = Math.min(drawn > 0 ? drawn : sd, sd)
  const bwCur = Number(buttonWt.value || 0)
  if (!force && bwCur > 0.01) {
    showToast(`Shrija AUTO: Button Weight already ${bwCur} — keep`)
  } else {
    showToast(`Shrija AUTO: 2/2 Button Weight…`)
    await MF.forceSetWeight(buttonWt, btnVal, 3, { force: true })
    buttonWt = MF.findSamplingInputs(document).buttonWt || buttonWt
    sd = Number(MF.findSamplingInputs(document).sampleDrawn?.value || 0)
    const bw = Number(buttonWt?.value || 0)
    if (!(bw > 0) || bw > sd + 0.001) {
      return showToast(`Shrija AUTO: Button blocked (bw=${bw}, sd=${sd})`)
    }
  }

  await storageSet({ [FLOW_KEY]: { ...flow, step: 'assay', drawn, force, at: Date.now() } })
  showToast('Shrija AUTO: Button Weight → Save…')
  await MF.delay(350)
  const btn = MF.findSaveBeside(buttonWt)
  if (btn) btn.click()
  await MF.delay(2200)
  if (!extAlive()) return
  const still = (await storageGet([FLOW_KEY]))[FLOW_KEY]
  if (still?.step === 'assay') await stepAssay(sheet, still)
}

async function stepAssay(sheet, flow) {
  const resolved = resolveFromSheet(sheet, flow.selectText, flow.lot)
  if (!resolved.rows.length) return showToast('Shrija AUTO: assay lot match nahi')
  const force = Boolean(flow.force || window.__shrijaForceFill)
  const opts = { force, skipIfFilled: !force }

  const again = MF.findSamplingInputs(document)
  if (Number(again.sampleDrawn?.value || 0) <= 0 && Number(again.buttonWt?.value || 0) <= 0) {
    showToast('Shrija AUTO: Sampling empty — stop')
    return
  }

  const stripRows = resolved.rows
  const cg = sheet.cg || {}
  // Exact sheet weights (no clamp) — Sample/Button already raised to fit strips
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
  const fillOrder = [2, 3, 0, 1]
  const cols = MF.collectAssayInputs(document)
  let filledM1 = 0

  async function fillAssayRow(i) {
    if (await MF.forceSetWeight(cols.m1[i], m1s[i], 3, opts)) filledM1 += 1
    await MF.delay(100)
    await MF.forceSetWeight(cols.silver[i], silvers[i], 3, opts)
    await MF.delay(60)
    if (Number(coppers[i]) > 0) await MF.forceSetWeight(cols.copper[i], coppers[i], 3, opts)
    await MF.forceSetWeight(cols.lead[i], leads[i], 3, opts)
    await MF.delay(80)
  }

  showToast('Shrija AUTO: Check Gold C1/C2…')
  await fillAssayRow(2)
  await fillAssayRow(3)
  showToast('Shrija AUTO: Strip 1/2…')
  await fillAssayRow(0)
  await fillAssayRow(1)

  await storageRemove(FLOW_KEY)
  await MF.delay(400)
  const saved =
    MF.clickByText(/Save\s*\(?\s*Initial\s*Weight\s*\)?/i, document) ||
    MF.clickByText(/Initial\s*Weight/i, document)

  const lot = readSelectedLot()
  const lotKey = `${flow.lot || lot.lot || ''}:${flow.jobCard || lot.jobCard || flow.selectText || ''}`

  const m2Open = cols.m2.some((el) => el && !el.disabled && !el.readOnly)
  if (m2Open) {
    for (const i of fillOrder) {
      await MF.forceSetWeight(cols.m2[i], m2s[i], 3, opts)
      await MF.delay(100)
    }
    await MF.delay(250)
    MF.clickByText(/Save\s*\(?\s*Cornet\s*Weight\s*\)?/i, document)
    await markLotDone(lotKey)
    window.__shrijaForceFill = false
    showToast(`Shrija AUTO: DONE · M1 ${filledM1}/4 + M2 — Lot free`)
  } else {
    watchM2Unlock(m2s, lotKey, opts)
    showToast(
      saved
        ? `Shrija AUTO: Initial saved (${filledM1}/4) · wait timing → M2 once`
        : `Shrija AUTO: Assay filled (${filledM1}/4) · Save Initial check`,
      8000,
    )
  }
  ensureStatusBadge()
}

function watchM2Unlock(m2Values, lotKey, opts = {}) {
  if (!extAlive()) return
  chrome.storage.local.set({ [M2_PENDING_KEY]: { m2Values, lotKey, at: Date.now() } })
  if (window.__shrijaM2Timer) clearInterval(window.__shrijaM2Timer)
  let tries = 0
  window.__shrijaM2Timer = setInterval(async () => {
    if (!extAlive()) {
      stopTimers()
      return
    }
    tries += 1
    try {
      const cols = MF.collectAssayInputs(document)
      const open = cols.m2.some((el) => el && !el.disabled && !el.readOnly)
      if (!open) {
        if (tries > 180) {
          clearInterval(window.__shrijaM2Timer)
          window.__shrijaM2Timer = null
        }
        return
      }
      // Already filled?
      const already = cols.m2.filter((el) => Number(el?.value || 0) > 0.01).length >= 2
      if (!already || opts.force) {
        for (let i = 0; i < m2Values.length; i++) {
          await MF.forceSetWeight(cols.m2[i], m2Values[i], 3, opts)
          await MF.delay(80)
        }
        await MF.delay(250)
        MF.clickByText(/Save\s*\(?\s*Cornet\s*Weight\s*\)?/i, document)
      }
      clearInterval(window.__shrijaM2Timer)
      window.__shrijaM2Timer = null
      await storageRemove(M2_PENDING_KEY)
      if (lotKey) await markLotDone(lotKey)
      window.__shrijaForceFill = false
      showToast('Shrija AUTO: M2 DONE — stopped')
    } catch {
      stopTimers()
    }
  }, 2500)
}

async function runAutoFill(selectText, preferredLot, opts = {}) {
  if (!extAlive() || !MF) return
  if (window.__shrijaFilling) return
  window.__shrijaFilling = true
  try {
    const force = Boolean(opts.force || window.__shrijaForceFill)
    const sheet = (await storageGet([KEY]))[KEY]
    if (!sheet) {
      showToast('Shrija AUTO: pehle Create Sheet')
      return
    }
    let text = selectText || ''
    let parsed = MF.parseLotOptionText(text)
    if (parsed.lot == null && !parsed.jobCard) {
      const lot = readSelectedLot()
      text = lot.text
      parsed = { lot: lot.lot, jobCard: lot.jobCard }
    }
    if (parsed.lot == null && !parsed.jobCard) {
      showToast('Shrija AUTO: Lot No select karo')
      return
    }
    const lotKey = `${preferredLot ?? parsed.lot}:${parsed.jobCard || text}`
    const done = (await storageGet([DONE_KEY]))[DONE_KEY]
    if (!force && done?.lotKey === lotKey && done?.ok) {
      showToast('Shrija AUTO: is Lot pe pehle fill ho chuka — badge click = dubara')
      return
    }
    await stepSampleDrawn(sheet, {
      step: 'sample',
      selectText: text,
      lot: preferredLot ?? parsed.lot,
      jobCard: parsed.jobCard,
      force,
      at: Date.now(),
    })
  } finally {
    window.__shrijaFilling = false
  }
}

async function resumeFlow() {
  if (!extAlive() || !MF || window.__shrijaFilling) return
  const data = await storageGet([FLOW_KEY, KEY, M2_PENDING_KEY, DONE_KEY])
  if (data[M2_PENDING_KEY]?.m2Values && !window.__shrijaM2Timer) {
    watchM2Unlock(data[M2_PENDING_KEY].m2Values, data[M2_PENDING_KEY].lotKey, { skipIfFilled: true })
  }
  const flow = data[FLOW_KEY]
  const sheet = data[KEY]
  if (!flow || !sheet) return
  if (Date.now() - (flow.at || 0) > 8 * 60 * 1000) {
    await storageRemove(FLOW_KEY)
    return
  }
  const lot = readSelectedLot()
  if (lot.text) flow.selectText = lot.text
  window.__shrijaFilling = true
  try {
    showToast(`Shrija AUTO resume: ${flow.step}`)
    if (flow.step === 'button') await stepButtonWeight(sheet, flow)
    else if (flow.step === 'assay') await stepAssay(sheet, flow)
    else if (flow.step === 'sample') await stepSampleDrawn(sheet, flow)
  } finally {
    window.__shrijaFilling = false
  }
}

function bindLotAuto() {
  if (!MF || !extAlive()) return
  const sel = MF.findLotSelect(document)
  if (!sel || sel.dataset.shrijaAutoBound) return
  sel.dataset.shrijaAutoBound = '1'
  // Let user open dropdown freely — only fill after change settles
  sel.addEventListener('change', () => {
    if (!extAlive()) return
    setTimeout(() => {
      const lot = readSelectedLot()
      if (lot.lot == null && !lot.jobCard) return
      window.__shrijaForceFill = false
      runAutoFill(lot.text, lot.lot, { force: false })
    }, 400)
  })
}

try {
  chrome.runtime.onMessage.addListener((msg) => {
    if (!extAlive()) return
    if (msg?.type === 'SHRIJA_FILL_MANAK_NOW') {
      const lot = readSelectedLot()
      runAutoFill(lot.text, lot.lot, { force: true })
    }
  })
} catch {
  /* ignore */
}

const onAssayPage = /Samplingweighting|Fire Assaying|Sample Drawn|Assaying Sheet/i.test(
  `${location.href} ${document.body?.innerText || ''}`,
)

if (onAssayPage) {
  if (!MF) showToast('Shrija AUTO: manak-fill-lib load fail — Reload')
  setTimeout(bindLotAuto, 500)
  setTimeout(bindLotAuto, 2000)
  setTimeout(ensureStatusBadge, 600)
  window.__shrijaBadgeTimer = setInterval(() => {
    if (!extAlive()) return stopTimers()
    ensureStatusBadge()
  }, 4000)
  // Only resume unfinished Save postback — never spam new fills
  setTimeout(resumeFlow, 1000)
  window.__shrijaWatchTimer = setInterval(() => {
    if (!extAlive()) return stopTimers()
    watchdogTick()
  }, 5000)
}
