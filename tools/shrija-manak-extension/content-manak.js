/**
 * Shrija → Manak AUTO fill (no Fill / Load buttons).
 * Stepped for ASP.NET postback: sample Save → reload → button Save → reload → assay.
 */
const KEY = 'shrija-manak-fire-assay-sheet'
const M2_PENDING_KEY = 'shrija-manak-m2-pending'
const FLOW_KEY = 'shrija-manak-fill-flow'

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
    el.title = 'Click = force AUTO fill now'
    el.addEventListener('click', () => {
      const lot = readSelectedLot()
      if (lot.lot == null && !lot.jobCard) {
        showToast('Shrija AUTO: pehle Lot No select karo')
        return
      }
      window.__shrijaFillOnce = null
      runAutoFill(lot.text, lot.lot)
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
            ? `AUTO · FS-${sheet.sheetNo || '?'} · Lot ${lot.lot} ready — filling… (click = retry)`
            : `AUTO · FS-${sheet.sheetNo || '?'} · ${n} rows — Lot select / click yahan`
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
 * Lot already selected (no change event) OR postback left fields at 0 —
 * keep trying until sampling fills or max attempts.
 */
async function watchdogTick() {
  if (!extAlive() || !MF || window.__shrijaFilling) return
  if (!/Fire Assaying|Sample Drawn|Samplingweighting/i.test(document.body?.innerText || '')) return

  const lot = readSelectedLot()
  if (lot.lot == null && !lot.jobCard) return
  if (!samplingStillEmpty()) return

  const data = await storageGet([KEY, FLOW_KEY])
  const sheet = data[KEY]
  if (!sheet) return

  // Stale flow while fields still empty → clear and restart
  const flow = data[FLOW_KEY]
  if (flow && Date.now() - (flow.at || 0) > 12_000 && samplingStillEmpty()) {
    await storageRemove(FLOW_KEY)
  } else if (flow) {
    // resume pending step
    await resumeFlow()
    return
  }

  const key = `${lot.text}|${lot.lot}|${lot.jobCard}`
  const now = Date.now()
  if (window.__shrijaFillOnce?.key === key && now - window.__shrijaFillOnce.at < 8000) return
  window.__shrijaFillOnce = { key, at: now }

  showToast(`Shrija AUTO: Lot detected → fill (${lot.text})`)
  await runAutoFill(lot.text, lot.lot)
}

function watchM2Unlock(m2Values) {
  if (!extAlive()) return
  chrome.storage.local.set({ [M2_PENDING_KEY]: { m2Values, at: Date.now() } })
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
      if (open) {
        cols.m2.forEach((el, i) => MF.setNativeValue(el, m2Values[i]))
        await MF.delay(300)
        MF.clickByText(/Save\s*\(?\s*Cornet\s*Weight\s*\)?/i, document)
        showToast('Shrija AUTO: M2 + Cornet Save')
        clearInterval(window.__shrijaM2Timer)
        window.__shrijaM2Timer = null
        await storageRemove(M2_PENDING_KEY)
      } else if (tries > 180) {
        clearInterval(window.__shrijaM2Timer)
        window.__shrijaM2Timer = null
      }
    } catch {
      stopTimers()
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

  await MF.delay(1500)
  if (!extAlive()) return
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
  if (!extAlive()) return
  const still = (await storageGet([FLOW_KEY]))[FLOW_KEY]
  if (still?.step === 'assay') await stepAssay(sheet, still)
}

async function stepAssay(sheet, flow) {
  const resolved = resolveFromSheet(sheet, flow.selectText, flow.lot)
  if (!resolved.rows.length) return showToast('Shrija AUTO: assay lot match nahi')

  const { sampleDrawn, buttonWt } = MF.findSamplingInputs(document)
  const drawn = Number(flow.drawn || 0)
  if (Number(sampleDrawn?.value || 0) <= 0 && drawn) MF.setNativeValue(sampleDrawn, drawn)
  if (Number(buttonWt?.value || 0) <= 0 && drawn) MF.setNativeValue(buttonWt, drawn)

  const again = MF.findSamplingInputs(document)
  const sd2 = Number(again.sampleDrawn?.value || 0)
  const bw2 = Number(again.buttonWt?.value || 0)
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
  if (!extAlive()) return
  if (!MF) {
    showToast('Shrija AUTO: fill library missing — extension Reload (2.0.2)')
    return
  }
  if (window.__shrijaFilling) return
  window.__shrijaFilling = true
  try {
    const sheet = (await storageGet([KEY]))[KEY]
    if (!sheet) {
      showToast('Shrija AUTO: pehle Create Sheet (Shrija app)')
      ensureStatusBadge()
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

    const flow = {
      step: 'sample',
      selectText: text,
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
  if (!extAlive() || !MF) return
  const data = await storageGet([FLOW_KEY, KEY, M2_PENDING_KEY])
  if (data[M2_PENDING_KEY]?.m2Values) watchM2Unlock(data[M2_PENDING_KEY].m2Values)

  const flow = data[FLOW_KEY]
  const sheet = data[KEY]
  if (!flow || !sheet) return
  if (Date.now() - (flow.at || 0) > 8 * 60 * 1000) {
    await storageRemove(FLOW_KEY)
    return
  }

  const lot = readSelectedLot()
  if (lot.text) flow.selectText = lot.text

  showToast(`Shrija AUTO resume: ${flow.step}`)
  if (flow.step === 'button') await stepButtonWeight(sheet, flow)
  else if (flow.step === 'assay') await stepAssay(sheet, flow)
  else if (flow.step === 'sample') await stepSampleDrawn(sheet, flow)
}

function bindLotAuto() {
  if (!MF || !extAlive()) return
  const sel = MF.findLotSelect(document)
  if (!sel) return
  if (!sel.dataset.shrijaAutoBound) {
    sel.dataset.shrijaAutoBound = '1'
    sel.addEventListener('change', () => {
      if (!extAlive()) return
      window.__shrijaFillOnce = null
      const lot = readSelectedLot()
      if (lot.lot == null && !lot.jobCard) return
      runAutoFill(lot.text, lot.lot)
    })
  }
}

try {
  chrome.runtime.onMessage.addListener((msg) => {
    if (!extAlive()) return
    if (msg?.type === 'SHRIJA_FILL_MANAK_NOW') {
      const lot = readSelectedLot()
      runAutoFill(lot.text, lot.lot)
    }
  })
} catch {
  /* context already dead */
}

const onAssayPage = /Samplingweighting|Fire Assaying|Sample Drawn|Assaying Sheet/i.test(
  `${location.href} ${document.body?.innerText || ''}`,
)

if (onAssayPage) {
  if (!MF) showToast('Shrija AUTO: manak-fill-lib load fail — Reload extension')
  setTimeout(bindLotAuto, 400)
  setTimeout(bindLotAuto, 1500)
  setTimeout(bindLotAuto, 4000)
  setTimeout(ensureStatusBadge, 500)
  window.__shrijaBadgeTimer = setInterval(() => {
    if (!extAlive()) {
      stopTimers()
      return
    }
    ensureStatusBadge()
  }, 2500)
  setTimeout(resumeFlow, 800)
  setTimeout(watchdogTick, 1200)
  setTimeout(watchdogTick, 2500)
  setTimeout(watchdogTick, 5000)
  window.__shrijaWatchTimer = setInterval(() => {
    if (!extAlive()) {
      stopTimers()
      return
    }
    watchdogTick()
  }, 3000)
}
