/**
 * Shrija → Manak AUTO fill — explicit Phase 1 / Phase 2.
 * Phase 1: post Sample Drawn + Save, post Button Weight + Save, then M1.
 * Does not click/focus weight fields (that opens BIS Web Serial).
 * User clicks Save Initial Weight.
 * Phase 2: M2 only (Job + Lot), same posted-value path. User clicks Save Cornet Weight.
 * No Save Initial / Save Cornet auto-click. No timing wait. No M2 continuation after Phase 1.
 */
const KEY = 'shrija-manak-fire-assay-sheet'
const M2_PENDING_KEY = 'shrija-manak-m2-pending'
const FLOW_KEY = 'shrija-manak-fill-flow'
const DONE_KEY = 'shrija-manak-fill-done'
const P1_RESUME_KEY = 'shrija-manak-phase1-resume'

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
  stopTimers()
  await storageRemove([M2_PENDING_KEY, FLOW_KEY, DONE_KEY])
}

function readSelectedLot() {
  const sel = MF?.findLotSelect?.(document)
  if (!sel) return { text: '', lot: null, jobCard: '' }
  let opt = sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex] : null
  let text = (opt?.text || opt?.label || '').trim()
  let parsed = MF.parseLotOptionText(text)
  if (parsed.lot == null && !parsed.jobCard) {
    const byVal = Array.from(sel.options).find((o) => o.selected) || null
    text = (byVal?.text || sel.value || '').trim()
    parsed = MF.parseLotOptionText(text)
  }
  if (parsed.lot == null && !parsed.jobCard) {
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

function btnStyle(bg) {
  return {
    background: bg,
    color: '#fff',
    padding: '10px 14px',
    borderRadius: '10px',
    font: '700 12px/1.35 system-ui,sans-serif',
    boxShadow: '0 8px 24px rgba(0,0,0,.28)',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
  }
}

function ensureStatusBadge() {
  if (!extAlive()) {
    stopTimers()
    return
  }
  let wrap = document.getElementById('shrija-manak-auto-status')
  if (!wrap) {
    wrap = document.createElement('div')
    wrap.id = 'shrija-manak-auto-status'
    Object.assign(wrap.style, {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: 999999,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      maxWidth: '300px',
    })

    const p1 = document.createElement('button')
    p1.id = 'shrija-manak-phase1'
    p1.type = 'button'
    Object.assign(p1.style, btnStyle('#15803d'))
    p1.title = 'Fill Sample Drawn + Save, Button Weight + Save, then M1. Does not open serial port. Does not click Save Initial Weight. Does not fill M2.'
    p1.addEventListener('click', () => runPhase1())

    const p2 = document.createElement('button')
    p2.id = 'shrija-manak-phase2'
    p2.type = 'button'
    Object.assign(p2.style, btnStyle('#1d4ed8'))
    p2.title = 'Fill M2 / cornet after assaying for the selected Job + Lot. Does not open serial port. Does not click Save Cornet.'
    p2.addEventListener('click', () => runPhase2())

    wrap.appendChild(p1)
    wrap.appendChild(p2)
    document.body.appendChild(wrap)
  }

  const p1 = document.getElementById('shrija-manak-phase1')
  const p2 = document.getElementById('shrija-manak-phase2')
  try {
    chrome.storage.local.get([KEY], (data) => {
      if (!extAlive() || chrome.runtime.lastError) return
      const sheet = data[KEY]
      const fs = sheet?.sheetNo || '?'
      const lot = MF ? readSelectedLot() : { lot: null, jobCard: '' }
      const lotBit = lot.lot != null ? ` · Lot ${lot.lot}` : ''
      if (sheet) {
        if (p1) {
          p1.style.background = '#15803d'
          p1.textContent = `Auto FS-${fs} — Phase 1${lotBit}`
        }
        if (p2) {
          p2.style.background = '#1d4ed8'
          p2.textContent = `Auto FS-${fs} — Phase 2${lotBit}`
        }
      } else {
        if (p1) {
          p1.style.background = '#b45309'
          p1.textContent = 'Auto FS — Phase 1 · No sheet'
        }
        if (p2) {
          p2.style.background = '#b45309'
          p2.textContent = 'Auto FS — Phase 2 · No sheet'
        }
      }
    })
  } catch {
    stopTimers()
  }
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

async function currentSheet() {
  return (await storageGet([KEY]))[KEY]
}

function requireSelectedLot() {
  const lot = readSelectedLot()
  if (lot.lot == null && !lot.jobCard) {
    showToast('Shrija AUTO: pehle Lot No select karo')
    return null
  }
  return lot
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
    const lot = requireSelectedLot()
    if (!lot) return
    const drawn = requiredDrawnForStrips(sheet, lot.text, lot.lot)
    const result = await MF.fillPhase1(sheet, lot.text, {
      document,
      lot: lot.lot,
      jobCard: lot.jobCard,
      drawn,
      activationWaitMs: 5500,
      startAt: resumeOpts.startAt || 'sample',
      onBeforeSampleSaveClick: async () => {
        await storageSet({
          [P1_RESUME_KEY]: {
            stage: 'button',
            lot: lot.lot,
            jobCard: lot.jobCard,
            drawn,
            selectText: lot.text,
            ts: Date.now(),
          },
        })
      },
      onBeforeButtonSaveClick: async () => {
        await storageSet({
          [P1_RESUME_KEY]: {
            stage: 'm1',
            lot: lot.lot,
            jobCard: lot.jobCard,
            drawn,
            selectText: lot.text,
            ts: Date.now(),
          },
        })
      },
    })
    if (!result?.ok) {
      await storageRemove([P1_RESUME_KEY])
      showToast(`Shrija Phase 1: ${result?.message || result?.error || 'failed'}`)
      return
    }
    await storageRemove([P1_RESUME_KEY])
    showToast('Phase 1 complete — Save Initial Weight manually', 8000)
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
  if (Date.now() - Number(resume.ts) > 25000) {
    await storageRemove([P1_RESUME_KEY])
    return
  }
  const lot = MF ? readSelectedLot() : { lot: null, jobCard: '' }
  if (lot.lot == null && !lot.jobCard) return
  if (resume.lot != null && lot.lot != null && Number(resume.lot) !== Number(lot.lot)) {
    await storageRemove([P1_RESUME_KEY])
    return
  }
  if (resume.jobCard && lot.jobCard && String(resume.jobCard) !== String(lot.jobCard)) {
    await storageRemove([P1_RESUME_KEY])
    return
  }
  await runPhase1({ startAt: resume.stage })
}

async function runPhase2() {
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
    const pending = (await storageGet([M2_PENDING_KEY]))[M2_PENDING_KEY]
    if (MF.ignoreM2Pending(pending, lot.jobCard, lot.lot) && pending?.m2Values) {
      await storageRemove([M2_PENDING_KEY])
    }
    const result = await MF.fillPhase2(sheet, lot.text, {
      document,
      lot: lot.lot,
      jobCard: lot.jobCard,
      activationWaitMs: 5500,
    })
    if (!result?.ok) {
      showToast(`Shrija Phase 2: ${result?.message || result?.error || 'Job + Lot match nahi'}`)
      return
    }
    showToast('Phase 2 complete — Save Cornet Weight manually', 8000)
    ensureStatusBadge()
  } finally {
    window.__shrijaFilling = false
  }
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

const onAssayPage = /Samplingweighting|Fire Assaying|Sample Drawn|Assaying Sheet/i.test(
  `${location.href} ${document.body?.innerText || ''}`,
)

if (onAssayPage) {
  if (!MF) showToast('Shrija AUTO: manak-fill-lib load fail — Reload')
  void disableLegacyAutoM2()
  setTimeout(ensureStatusBadge, 600)
  setTimeout(() => {
    void tryResumePhase1()
  }, 900)
  window.__shrijaBadgeTimer = setInterval(() => {
    if (!extAlive()) return stopTimers()
    ensureStatusBadge()
  }, 4000)
}
