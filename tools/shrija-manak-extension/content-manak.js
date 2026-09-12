/**
 * Shrija → Manak AUTO fill — lot select runs Phase 1 or Phase 2 (no buttons).
 * Phase 1: Sample Drawn + Button Weight + M1, then Save Initial. Strict Job Card + Lot.
 * Phase 2: M2 only (same Job + Lot), then Save Cornet Weight — when M1 is already saved.
 * Does not click/focus weight fields (that opens BIS Web Serial).
 */
const KEY = 'shrija-manak-fire-assay-sheet'
const M2_PENDING_KEY = 'shrija-manak-m2-pending'
const FLOW_KEY = 'shrija-manak-fill-flow'
const DONE_KEY = 'shrija-manak-fill-done'
const P1_RESUME_KEY = 'shrija-manak-phase1-resume'
const P1_COOLDOWN_KEY = 'shrija-manak-phase1-cooldown'
/** Only blocks Phase 2 on Save-Initial postback reload — not a user lot click. */
const P1_COOLDOWN_MS = 12000
/** Cap while navigator.userActivation.isActive. Missing API uses minWaitMs, not this cap. */
const SERIAL_WAIT_MS = 5500
const POSTBACK_WAIT_MS = 600
const POSTBACK_TIMEOUT_MS = 8000

const MF = globalThis.ManakFill
if (!MF) console.error('[Shrija] manak-fill-lib.js missing — reload extension')

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

/** Discard leftover auto-M2 state from older extension builds. Never resume it. */
async function disableLegacyAutoM2() {
  await storageRemove([M2_PENDING_KEY, FLOW_KEY, DONE_KEY])
}

function readSelectedLot() {
  const sel = MF?.findLotSelect?.(document)
  if (!sel) return { text: '', lot: null, jobCard: '' }
  return { ...MF.readSelectedLotFromSelect(sel, document), sel }
}

function cooldownMap() {
  try {
    return JSON.parse(sessionStorage.getItem(P1_COOLDOWN_KEY) || '{}') || {}
  } catch {
    return {}
  }
}

function markPhase1Cooldown(jobCard, lot) {
  if (!jobCard || lot == null) return
  const map = cooldownMap()
  map[`${jobCard}:${lot}`] = Date.now()
  try {
    sessionStorage.setItem(P1_COOLDOWN_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

function inPhase1Cooldown(jobCard, lot) {
  const at = Number(cooldownMap()[`${jobCard}:${lot}`] || 0)
  return at > 0 && Date.now() - at < P1_COOLDOWN_MS
}

function ensureStatusBadge() {
  if (!extAlive()) {
    stopTimers()
    return
  }
  document.getElementById('shrija-manak-phase1')?.remove()
  document.getElementById('shrija-manak-phase2')?.remove()
  let wrap = document.getElementById('shrija-manak-auto-status')
  if (!wrap) {
    wrap = document.createElement('div')
    wrap.id = 'shrija-manak-auto-status'
    Object.assign(wrap.style, {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: 999999,
      maxWidth: '280px',
    })
    const label = document.createElement('div')
    label.id = 'shrija-manak-auto-label'
    Object.assign(label.style, {
      background: '#0f2744',
      color: '#fff',
      padding: '10px 14px',
      borderRadius: '10px',
      font: '700 12px/1.35 system-ui,sans-serif',
    })
    wrap.appendChild(label)
    document.body.appendChild(wrap)
  }
  document.getElementById('shrija-manak-delete-panel')?.remove()
  const label = document.getElementById('shrija-manak-auto-label')
  if (!label) return
  try {
    chrome.storage.local.get([KEY], (data) => {
      if (!extAlive() || chrome.runtime.lastError) return
      const sheet = data[KEY]
      const fs = sheet?.sheetNo || '?'
      const lot = MF ? readSelectedLot() : { lot: null, jobCard: '' }
      const lotBit =
        lot.lot != null && lot.jobCard ? ` · Lot ${lot.lot} · ${lot.jobCard}` : ' · lot select karo'
      const lastErr = window.__shrijaLastFillError
      wrap.style.cursor = 'pointer'
      wrap.title = 'Click karke fill dubara chalao'
      if (wrap.getAttribute('data-shrija-retry') !== '1') {
        wrap.setAttribute('data-shrija-retry', '1')
        wrap.addEventListener('click', () => {
          if (window.__shrijaFilling) return
          window.__shrijaLastFillError = ''
          showToast('Shrija AUTO: fill retry…', 2500)
          void runLotAutoFill('change')
        })
      }
      if (window.__shrijaFilling) {
        label.style.background = '#1d4ed8'
        label.textContent = `Shrija AUTO FS-${fs} · filling${lotBit}`
      } else if (lastErr) {
        label.style.background = '#b45309'
        label.textContent = `Shrija AUTO FS-${fs}${lotBit} · ${lastErr}`
      } else if (sheet) {
        label.style.background = '#15803d'
        label.textContent = `Shrija AUTO FS-${fs}${lotBit}`
      } else {
        label.style.background = '#b45309'
        label.textContent = 'Shrija AUTO · Create Sheet pehle'
      }
    })
  } catch {
    stopTimers()
  }
}

function parseDeleteTarget(jobRaw, lotRaw) {
  const jobText = String(jobRaw || '').trim()
  const lotText = String(lotRaw || '').trim()
  const parsed = MF.parseShrijaJob(jobText)
  const jobCard = parsed.card || jobText.replace(/\D/g, '')
  let lotNum = Number(lotText)
  if (!Number.isFinite(lotNum) || lotNum <= 0) lotNum = Number(parsed.lot) || NaN
  return { jobCard, lotNum }
}

async function selectPortalLot(jobCard, lotNum) {
  const sel = MF.findLotSelect(document)
  const opt = MF.findLotOption(document, jobCard, lotNum)
  if (!sel || !opt) return false
  window.__shrijaSuppressLotAuto = true
  opt.selected = true
  sel.value = opt.value
  sel.dispatchEvent(new Event('change', { bubbles: true }))
  try {
    await MF.waitForWeightPostback({
      document,
      postbackWaitMs: POSTBACK_WAIT_MS,
      postbackTimeoutMs: POSTBACK_TIMEOUT_MS,
    })
  } catch {
    /* ignore */
  }
  return MF.selectedMatchesJobLot(readSelectedLot(), jobCard, lotNum)
}

async function runDeleteFilledAssay(jobRaw, lotRaw) {
  if (!extAlive() || !MF) {
    return { ok: false, skip: true, message: 'Extension ready nahi.' }
  }
  if (!MF.findLotSelect(document) && !MF.collectAssayInputs(document).m1?.length) {
    return { skip: true }
  }
  if (window.__shrijaFilling) {
    const message = 'Shrija: pehle fill complete hone do'
    showToast(message)
    return { ok: false, message }
  }
  const { jobCard, lotNum } = parseDeleteTarget(jobRaw, lotRaw)
  if (!jobCard || !Number.isFinite(lotNum) || lotNum <= 0) {
    const message = 'Shrija Delete: Job card + Lot number dono chahiye'
    showToast(message)
    return { ok: false, message }
  }
  window.__shrijaFilling = true
  window.__shrijaSuppressLotAuto = true
  try {
    let selected = readSelectedLot()
    if (!MF.selectedMatchesJobLot(selected, jobCard, lotNum)) {
      const ok = await selectPortalLot(jobCard, lotNum)
      selected = readSelectedLot()
      if (!ok && !MF.selectedMatchesJobLot(selected, jobCard, lotNum)) {
        const message = `Shrija Delete: portal pe Lot ${lotNum} : ${jobCard} nahi mila`
        showToast(message)
        return { ok: false, message }
      }
    }
    const result = MF.clearAssayFields(document)
    if (!result.ok) {
      const message = 'Shrija Delete: koi field empty nahi hui'
      showToast(message)
      return { ok: false, message }
    }
    const message = `Shrija Delete: Lot ${lotNum} / ${jobCard} — ${result.cleared} fields empty. Ab dubara bhar sakte ho.`
    showToast(message, 9000)
    ensureStatusBadge()
    return { ok: true, cleared: result.cleared, message }
  } finally {
    window.__shrijaFilling = false
    setTimeout(() => {
      window.__shrijaSuppressLotAuto = false
    }, 2500)
  }
}

globalThis.__shrijaGetSelectedLot = function () {
  if (!MF?.findLotSelect?.(document)) return { skip: true }
  const lot = readSelectedLot()
  return { skip: false, jobCard: lot.jobCard || '', lot: lot.lot, text: lot.text || '' }
}

globalThis.__shrijaDeleteFilledAssay = runDeleteFilledAssay

function resolveFromSheet(sheet, selectText, lot, jobCard) {
  return MF.resolvePhaseStripRows(sheet, selectText, { lot, jobCard })
}

/** Sample Drawn / Button must be ≥ 2× max strip M1 so Manak accepts strip weights (fineness stays correct). */
function requiredDrawnForStrips(sheet, selectText, lot, jobCard) {
  const resolved = resolveFromSheet(sheet, selectText, lot, jobCard)
  const s1 = Number(resolved.rows[0]?.sampleWeight || 0)
  const s2 = Number(resolved.rows[1]?.sampleWeight || 0)
  const fromSheet = Number(resolved.rows[0]?.sampleDrawn || 0)
  const need = Math.max(s1, s2) * 2 + 0.002
  return Number(Math.max(fromSheet, need).toFixed(3))
}

async function currentSheet() {
  return (await storageGet([KEY]))[KEY]
}

function requireSelectedLot(resumeOpts = {}) {
  let lot = readSelectedLot()
  if (lot.lot == null && !lot.jobCard && (resumeOpts.lot != null || resumeOpts.jobCard)) {
    const sel = MF?.findLotSelect?.(document)
    if (sel) {
      const opt = Array.from(sel.options).find((o) => {
        const t = String(o.text || o.value || '')
        if (resumeOpts.jobCard && t.includes(String(resumeOpts.jobCard))) return true
        return false
      })
      if (opt) {
        opt.selected = true
        sel.value = opt.value
        sel.dispatchEvent(new Event('change', { bubbles: true }))
        lot = readSelectedLot()
      }
    }
    if (lot.lot == null && !lot.jobCard) {
      lot = { lot: resumeOpts.lot, jobCard: resumeOpts.jobCard || '', text: resumeOpts.selectText || '' }
    }
  }
  if (lot.lot == null && !lot.jobCard) {
    if (!resumeOpts.quiet) showToast('Shrija AUTO: pehle Lot No select karo')
    return null
  }
  return lot
}

async function waitForLotForm(lot, tries = 12) {
  const want = String(lot?.jobCard || '')
  for (let i = 0; i < tries; i++) {
    const current = readSelectedLot()
    if (want && String(current.jobCard || '') === want && MF.lotContextMatches(current, document)) {
      return current
    }
    if (typeof MF.delay === 'function') await MF.delay(400)
  }
  const last = readSelectedLot()
  if (want && String(last.jobCard || '') === want && MF.lotContextMatches(last, document)) return last
  return null
}

async function runPhase1(resumeOpts = {}) {
  if (!extAlive() || !MF) return
  if (window.__shrijaFilling) return
  window.__shrijaFilling = true
  try {
    await disableLegacyAutoM2()
    const sheet = await currentSheet()
    if (!sheet) {
      showToast('Shrija AUTO: pehle Create Sheet')
      return
    }
    const lot = requireSelectedLot(resumeOpts)
    if (!lot) return
    if (lot.lot == null || !lot.jobCard) {
      showToast('Shrija Phase 1: Job Card + Lot dono chahiye')
      return
    }
    const ready = await waitForLotForm(lot)
    if (!ready) {
      showToast(
        `Shrija Phase 1: form pe dusra job hai, Lot ${lot.lot}:${lot.jobCard} nahi. Clubbed lot load hone do.`,
      )
      return
    }
    const drawn = requiredDrawnForStrips(sheet, ready.text, ready.lot, ready.jobCard)
    MF.prepareScaleBypass(document)
    const result = await MF.fillPhase1(sheet, ready.text, {
      document,
      lot: ready.lot,
      jobCard: ready.jobCard,
      drawn,
      activationWaitMs: resumeOpts.activationWaitMs != null ? resumeOpts.activationWaitMs : SERIAL_WAIT_MS,
      postbackWaitMs: POSTBACK_WAIT_MS,
      postbackTimeoutMs: POSTBACK_TIMEOUT_MS,
      fillAssay: true,
      clickSaveInitial: true,
      startAt: resumeOpts.stage || resumeOpts.startAt || 'sample',
      onBeforeSampleSaveClick: async () => {
        await storageSet({
          [P1_RESUME_KEY]: {
            stage: 'button',
            lot: ready.lot,
            jobCard: ready.jobCard,
            drawn,
            selectText: ready.text,
            ts: Date.now(),
          },
        })
      },
      onBeforeButtonSaveClick: async () => {
        await storageSet({
          [P1_RESUME_KEY]: {
            stage: 'm1',
            lot: ready.lot,
            jobCard: ready.jobCard,
            drawn,
            selectText: ready.text,
            ts: Date.now(),
          },
        })
      },
    })
    if (!result?.ok) {
      await storageRemove([P1_RESUME_KEY])
      const message = result?.message || result?.error || 'failed'
      window.__shrijaLastFillError = String(message).slice(0, 80)
      showToast(`Shrija Phase 1: ${message}`, 12000)
      ensureStatusBadge()
      return
    }
    await storageRemove([P1_RESUME_KEY])
    window.__shrijaLastFillError = ''
    markPhase1Cooldown(ready.jobCard, ready.lot)
    showToast('Phase 1 complete — Assay weights filled & Initial Weight saved automatically!', 9000)
    ensureStatusBadge()
  } finally {
    window.__shrijaFilling = false
  }
}

async function tryResumePhase1() {
  if (!extAlive() || !MF) return
  const data = await storageGet([P1_RESUME_KEY])
  const resume = data[P1_RESUME_KEY]
  if (!resume?.stage || !resume.ts) return
  if (Date.now() - Number(resume.ts) > 30000) {
    await storageRemove([P1_RESUME_KEY])
    return
  }
  const current = readSelectedLot()
  if (current.jobCard && resume.jobCard && String(current.jobCard) !== String(resume.jobCard)) {
    await storageRemove([P1_RESUME_KEY])
    return
  }
  await runPhase1(resume)
}

async function runPhase2(resumeOpts = {}) {
  if (!extAlive() || !MF) return
  if (window.__shrijaFilling) return
  window.__shrijaFilling = true
  try {
    await disableLegacyAutoM2()
    const sheet = await currentSheet()
    if (!sheet) {
      showToast('Shrija AUTO: pehle Create Sheet')
      return
    }
    const lot = requireSelectedLot()
    if (!lot) return
    if (lot.lot == null || !lot.jobCard) {
      showToast('Shrija Phase 2: Job Card + Lot dono chahiye')
      return
    }
    const ready = await waitForLotForm(lot)
    if (!ready) {
      showToast(
        `Shrija Phase 2: form pe dusra job hai, Lot ${lot.lot}:${lot.jobCard} nahi. Clubbed lot load hone do.`,
      )
      return
    }
    const pending = (await storageGet([M2_PENDING_KEY]))[M2_PENDING_KEY]
    if (MF.ignoreM2Pending(pending, ready.jobCard, ready.lot) && pending?.m2Values) {
      await storageRemove([M2_PENDING_KEY])
    }
    const result = await MF.fillPhase2(sheet, ready.text, {
      document,
      lot: ready.lot,
      jobCard: ready.jobCard,
      activationWaitMs: resumeOpts.activationWaitMs != null ? resumeOpts.activationWaitMs : SERIAL_WAIT_MS,
      postbackWaitMs: POSTBACK_WAIT_MS,
      postbackTimeoutMs: POSTBACK_TIMEOUT_MS,
      clickSaveCornet: true,
    })
    if (!result?.ok) {
      const message = result?.message || result?.error || 'Job + Lot match nahi'
      window.__shrijaLastFillError = String(message).slice(0, 80)
      showToast(`Shrija Phase 2: ${message}`, 12000)
      ensureStatusBadge()
      return
    }
    window.__shrijaLastFillError = ''
    if (result.clickedSaveCornet) {
      showToast('Phase 2 complete — Cornet Weight saved automatically!', 9000)
    } else {
      showToast('Phase 2: M2 fill ho gaya. Save (Cornet Weight) ab manual click karein.', 9000)
    }
    ensureStatusBadge()
  } finally {
    window.__shrijaFilling = false
  }
}

function scheduleLotAutoFill(reason) {
  if (window.__shrijaLotAutoTimer) clearTimeout(window.__shrijaLotAutoTimer)
  window.__shrijaLotAutoTimer = setTimeout(() => {
    void runLotAutoFill(reason)
  }, reason === 'load' ? 1400 : 700)
}

async function runLotAutoFill(reason) {
  if (!extAlive() || !MF || window.__shrijaFilling) return
  if (window.__shrijaSuppressLotAuto) return
  if (window.__shrijaLotAutoRunning) return
  window.__shrijaLotAutoRunning = true
  try {
  const sheet = await currentSheet()
  const lot = readSelectedLot()
  if (lot.lot == null || !lot.jobCard) return
  if (!sheet) {
    if (reason === 'change') showToast('Shrija AUTO: pehle Create Sheet')
    return
  }
  try {
    await MF.waitUntilSerialGestureExpired({
      document,
      activationWaitMs: SERIAL_WAIT_MS,
      minWaitMs: reason === 'change' ? 1500 : 0,
    })
    await MF.waitForWeightPostback({
      document,
      postbackWaitMs: POSTBACK_WAIT_MS,
      postbackTimeoutMs: POSTBACK_TIMEOUT_MS,
    })
  } catch {
    /* ignore */
  }
  if (window.__shrijaFilling) return
  const lot2 = readSelectedLot()
  if (lot2.lot == null || !lot2.jobCard) return
  const readyLot = await waitForLotForm(lot2)
  if (!readyLot) {
    window.__shrijaLastFillError = 'form load nahi hua'
    showToast(`Shrija AUTO: Lot ${lot2.lot}:${lot2.jobCard} form load nahi hua — fill skip`, 8000)
    ensureStatusBadge()
    return
  }
  let stage = MF.detectAssayFillStage(document)
  if (stage === 'unknown' || stage === 'done') {
    if (typeof MF.delay === 'function') await MF.delay(400)
    await MF.waitForWeightPostback({
      document,
      postbackWaitMs: 200,
      postbackTimeoutMs: POSTBACK_TIMEOUT_MS,
    })
    stage = MF.detectAssayFillStage(document)
  }
  if (stage === 'done') {
    if (reason === 'change') showToast('Shrija AUTO: M2 pehle se filled hai — skip', 5000)
    return
  }
  if (stage === 'unknown') {
    window.__shrijaLastFillError = 'form fields nahi mile'
    showToast('Shrija AUTO: Sample/M1 fields nahi mile. Badge click karke retry karo.', 8000)
    ensureStatusBadge()
    return
  }
  // Postback after Phase 1 Save Initial looks like Phase 2 (M1 filled, M2 empty).
  // Automatic load/retry must skip during cooldown. A user lot click or badge
  // retry (reason === 'change') still runs immediately.
  if (MF.shouldSkipPhase2DuringCooldown(stage, reason, inPhase1Cooldown(readyLot.jobCard, readyLot.lot))) return
  ensureStatusBadge()
  if (stage === 'phase1') {
    showToast(`Shrija AUTO Phase 1 · Lot ${readyLot.lot} · ${readyLot.jobCard}`, 4000)
    await runPhase1({ quiet: true, activationWaitMs: 0 })
    return
  }
  if (stage === 'phase2') {
    showToast(`Shrija AUTO Phase 2 · Lot ${readyLot.lot} · ${readyLot.jobCard}`, 4000)
    await runPhase2({ activationWaitMs: 0 })
  }
  } finally {
    window.__shrijaLotAutoRunning = false
  }
}

function bindLotAutoFill() {
  const sel = MF?.findLotSelect?.(document)
  if (!sel || sel.getAttribute('data-shrija-lot-auto') === '1') return
  sel.setAttribute('data-shrija-lot-auto', '1')
  sel.addEventListener('change', () => scheduleLotAutoFill('change'))
}

try {
  chrome.runtime.onMessage.addListener((msg) => {
    if (!extAlive()) return
    if (msg?.type === 'SHRIJA_FILL_MANAK_NOW') runPhase1()
    if (msg?.type === 'SHRIJA_FILL_MANAK_PHASE1') runPhase1()
    if (msg?.type === 'SHRIJA_FILL_MANAK_PHASE2') runPhase2()
  })
} catch {
  /* ignore */
}

function attachPortalBypassListeners() {
  if (!MF) return
  try {
    MF.prepareScaleBypass(document)
  } catch {
    /* ignore */
  }
}

const onAssayPage = true

if (onAssayPage) {
  if (!MF) showToast('Shrija AUTO: manak-fill-lib load fail — Reload')
  void disableLegacyAutoM2()
  attachPortalBypassListeners()
  setTimeout(ensureStatusBadge, 600)
  setTimeout(() => {
    bindLotAutoFill()
    void tryResumePhase1()
    scheduleLotAutoFill('load')
  }, 900)
  setTimeout(() => {
    if (!extAlive() || window.__shrijaFilling) return
    const lot = readSelectedLot()
    if (lot.lot == null || !lot.jobCard) return
    const stage = MF.detectAssayFillStage(document)
    if (stage !== 'phase1' && stage !== 'phase2') return
    // Must not use reason "change" — that bypasses Phase 1 cooldown and can
    // start Phase 2 / cornet save immediately after Save Initial.
    if (MF.shouldSkipPhase2DuringCooldown(stage, 'retry', inPhase1Cooldown(lot.jobCard, lot.lot))) return
    scheduleLotAutoFill('retry')
  }, 4000)
  window.__shrijaBadgeTimer = setInterval(() => {
    if (!extAlive()) return stopTimers()
    attachPortalBypassListeners()
    bindLotAutoFill()
    ensureStatusBadge()
  }, 3000)
}
