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
        for (let i = 0; i < m2Values.length; i++) {
          await MF.forceSetWeight(cols.m2[i], m2Values[i])
          await MF.delay(100)
        }
        await MF.delay(300)
        MF.clickByText(/Save\s*\(?\s*Cornet\s*Weight\s*\)?/i, document)
        showToast('Shrija AUTO: M2 scan-fill + Cornet Save')
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
  if (!(drawn > 0)) return showToast('Shrija AUTO: Sample Drawn 0 sheet mein')

  let { sampleDrawn, buttonWt } = MF.findSamplingInputs(document)
  if (!sampleDrawn) return showToast('Shrija AUTO: Sample Drawn field nahi mila')
  if (buttonWt && sampleDrawn === buttonWt) {
    return showToast('Shrija AUTO: Sample/Button same field detect — layout fix fail')
  }

  // Clear Button Weight first so Manak never validates Button > Sample
  if (buttonWt && Number(buttonWt.value) > 0) {
    MF.setNativeValue(buttonWt, '0')
    await MF.delay(100)
  }

  const ok = await MF.forceSetWeight(sampleDrawn, drawn)
  sampleDrawn = MF.findSamplingInputs(document).sampleDrawn || sampleDrawn
  const sd = Number(sampleDrawn?.value || 0)
  if (!ok || !(sd > 0)) {
    return showToast(`Shrija AUTO: Sample Drawn set nahi hua (abhi ${sd})`)
  }

  // Double-check we did NOT write into Button Weight by mistake
  buttonWt = MF.findSamplingInputs(document).buttonWt
  if (buttonWt && Math.abs(Number(buttonWt.value) - drawn) < 0.02 && Math.abs(sd - drawn) > 0.02) {
    showToast('Shrija AUTO: galat field (Button) pe likha — swap fix…')
    MF.setNativeValue(buttonWt, '0')
    await MF.forceSetWeight(sampleDrawn, drawn)
  }

  await storageSet({
    [FLOW_KEY]: { ...flow, step: 'button', drawn, at: Date.now() },
  })
  showToast(`Shrija AUTO: 1/2 Sample Drawn ${Number(sampleDrawn.value)} → Save…`)
  await MF.delay(300)
  const btn = MF.findSaveBeside(sampleDrawn)
  if (btn) btn.click()
  else showToast('Shrija AUTO: Sample Drawn Save nahi mila')

  await MF.delay(2200)
  if (!extAlive()) return

  // Only continue to Button if Sample Drawn still > 0 (or re-set after postback)
  const after = MF.findSamplingInputs(document)
  let sdAfter = Number(after.sampleDrawn?.value || 0)
  if (!(sdAfter > 0)) {
    await MF.forceSetWeight(after.sampleDrawn, drawn)
    sdAfter = Number(MF.findSamplingInputs(document).sampleDrawn?.value || 0)
  }
  if (!(sdAfter > 0)) {
    showToast('Shrija AUTO: Sample Drawn Save ke baad bhi 0 — Button Weight nahi bharenge')
    await storageSet({ [FLOW_KEY]: { ...flow, step: 'sample', drawn, at: Date.now() } })
    return
  }

  await stepButtonWeight(sheet, { ...flow, step: 'button', drawn })
}

async function stepButtonWeight(sheet, flow) {
  const drawn = Number(flow.drawn || 0)
  let { sampleDrawn, buttonWt } = MF.findSamplingInputs(document)

  if (buttonWt && sampleDrawn && sampleDrawn === buttonWt) {
    return showToast('Shrija AUTO: Sample/Button fields confused — stop')
  }

  let sd = Number(sampleDrawn?.value || 0)
  if (!(sd > 0)) {
    showToast('Shrija AUTO: Sample Drawn pehle — Button wait…')
    if (sampleDrawn) await MF.forceSetWeight(sampleDrawn, drawn)
    sd = Number(MF.findSamplingInputs(document).sampleDrawn?.value || 0)
    if (!(sd > 0)) {
      await storageSet({ [FLOW_KEY]: { ...flow, step: 'sample', drawn, at: Date.now() } })
      return stepSampleDrawn(sheet, { ...flow, step: 'sample', drawn })
    }
  }

  // HARD RULE: never write Button while Sample Drawn is 0
  if (!(sd > 0)) {
    return showToast('Shrija AUTO: Sample Drawn 0 — Button Weight SKIP')
  }

  buttonWt = MF.findSamplingInputs(document).buttonWt
  if (!buttonWt) return showToast('Shrija AUTO: Button Weight field nahi mila')
  if (sampleDrawn && buttonWt === sampleDrawn) {
    return showToast('Shrija AUTO: Button field = Sample field — skip')
  }

  const btnVal = Math.min(drawn > 0 ? drawn : sd, sd)
  showToast(`Shrija AUTO: 2/2 Button Weight (after Sample ${sd})…`)
  const okBtn = await MF.forceSetWeight(buttonWt, btnVal)
  buttonWt = MF.findSamplingInputs(document).buttonWt || buttonWt
  const bw = Number(buttonWt?.value || 0)
  // Re-read sample — must still be > button
  sd = Number(MF.findSamplingInputs(document).sampleDrawn?.value || 0)
  if (!okBtn || !(bw > 0)) {
    return showToast(`Shrija AUTO: Button Weight set fail (bw=${bw})`)
  }
  if (!(sd > 0) || bw > sd + 0.001) {
    MF.setNativeValue(buttonWt, '0')
    return showToast(`Shrija AUTO: Blocked Button ${bw} > Sample ${sd}`)
  }

  await storageSet({
    [FLOW_KEY]: { ...flow, step: 'assay', drawn, at: Date.now() },
  })
  showToast(`Shrija AUTO: Button Weight ${bw} → Save…`)
  await MF.delay(300)
  const btn = MF.findSaveBeside(buttonWt)
  if (btn) btn.click()
  else showToast('Shrija AUTO: Button Weight Save nahi mila')

  await MF.delay(2200)
  if (!extAlive()) return
  const still = (await storageGet([FLOW_KEY]))[FLOW_KEY]
  if (still?.step === 'assay') await stepAssay(sheet, still)
}

async function stepAssay(sheet, flow) {
  const resolved = resolveFromSheet(sheet, flow.selectText, flow.lot)
  if (!resolved.rows.length) return showToast('Shrija AUTO: assay lot match nahi')

  const { sampleDrawn, buttonWt } = MF.findSamplingInputs(document)
  const drawn = Number(flow.drawn || 0)
  if (Number(sampleDrawn?.value || 0) <= 0 && drawn) await MF.forceSetWeight(sampleDrawn, drawn)
  if (Number(buttonWt?.value || 0) <= 0 && drawn) await MF.forceSetWeight(buttonWt, drawn)

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
  // Manak rule: Strip M1 cannot be more than half of Button Weight
  const buttonWtNow = Number(MF.findSamplingInputs(document).buttonWt?.value || drawn || 0)
  const maxStripM1 = buttonWtNow > 0 ? buttonWtNow / 2 - 0.001 : Infinity
  const clampStrip = (w) => {
    const n = Number(w) || 0
    if (!(n > 0)) return n
    if (!(maxStripM1 < Infinity)) return n
    return Math.min(n, maxStripM1)
  }

  // Index: 0=Strip1, 1=Strip2, 2=C1, 3=C2
  const m1s = [
    clampStrip(stripRows[0]?.sampleWeight),
    clampStrip(stripRows[1]?.sampleWeight),
    cg.cg1,
    cg.cg2,
  ]
  const silvers = [stripRows[0]?.silver, stripRows[1]?.silver, cg.silverCg1, cg.silverCg2]
  const coppers = [0, 0, cg.copperCg1 ?? 0, cg.copperCg2 ?? 0]
  const leads = [
    stripRows[0]?.lead || 4,
    stripRows[1]?.lead || 4,
    cg.leadCg1 || 4,
    cg.leadCg2 || 4,
  ]
  const m2s = [stripRows[0]?.wotgcaa, stripRows[1]?.wotgcaa, cg.wotgcaa1, cg.wotgcaa2]

  // Manak order: Check Gold (C1/C2) FIRST, then Strip 1 / Strip 2
  const fillOrder = [2, 3, 0, 1]

  showToast('Shrija AUTO: pehle Check Gold (C1/C2), phir Strip 1/2…')

  const cols = MF.collectAssayInputs(document)
  let filledM1 = 0

  async function fillAssayRow(i) {
    if (await MF.forceSetWeight(cols.m1[i], m1s[i])) filledM1 += 1
    await MF.delay(120)
    await MF.forceSetWeight(cols.silver[i], silvers[i])
    await MF.delay(80)
    if (Number(coppers[i]) > 0) {
      await MF.forceSetWeight(cols.copper[i], coppers[i])
      await MF.delay(80)
    }
    await MF.forceSetWeight(cols.lead[i], leads[i])
    await MF.delay(120)
  }

  // 1) C1 then C2
  showToast('Shrija AUTO: Check Gold C1…')
  await fillAssayRow(2)
  showToast('Shrija AUTO: Check Gold C2…')
  await fillAssayRow(3)
  // 2) Strip 1 then Strip 2 (M1 capped ≤ half Button Weight)
  showToast(`Shrija AUTO: Strip 1/2 (max M1 ${maxStripM1 < Infinity ? maxStripM1.toFixed(3) : '—'})…`)
  await fillAssayRow(0)
  await fillAssayRow(1)

  await storageRemove(FLOW_KEY)
  await MF.delay(400)
  const saved =
    MF.clickByText(/Save\s*\(?\s*Initial\s*Weight\s*\)?/i, document) ||
    MF.clickByText(/Initial\s*Weight/i, document)

  const m2Open = cols.m2.some((el) => el && !el.disabled && !el.readOnly)
  if (m2Open) {
    showToast('Shrija AUTO: M2 — C1/C2 phir Strips…')
    for (const i of fillOrder) {
      await MF.forceSetWeight(cols.m2[i], m2s[i])
      await MF.delay(120)
    }
    await MF.delay(300)
    MF.clickByText(/Save\s*\(?\s*Cornet\s*Weight\s*\)?/i, document)
    showToast(`Shrija AUTO: complete · M1 ${filledM1}/4 + M2`)
  } else {
    // Keep M2 pending in CG-first order
    const m2Ordered = fillOrder.map((i) => m2s[i])
    // watchM2Unlock expects [s1,s2,c1,c2] index order — keep original m2s array
    watchM2Unlock(m2s)
    showToast(
      saved
        ? `Shrija AUTO: CG→Strip filled (${filledM1}/4) + Initial Save · timing → M2`
        : `Shrija AUTO: CG→Strip filled (${filledM1}/4) · Initial Save check`,
      9000,
    )
    void m2Ordered
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
  // Soft-catch Manak validation while we still fix Sample Drawn first
  try {
    const _alert = window.alert.bind(window)
    window.alert = function (msg) {
      const m = String(msg || '')
      if (/Button Weight can not be more than Sample Drawn/i.test(m)) {
        showToast('Manak: Sample Drawn pehle Save — AUTO retry…')
        window.__shrijaFillOnce = null
        setTimeout(() => watchdogTick(), 600)
        return
      }
      return _alert(msg)
    }
  } catch {
    /* ignore */
  }
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
