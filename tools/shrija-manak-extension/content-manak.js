/**
 * Manak Online Fire Assaying Sheet filler (Gold Shark–style).
 *
 * Official Manak steps:
 * 1) Sampling Details → Sample Drawn Wt → Save, Button Wt → Save
 * 2) Fire Assaying Details → M1 + Silver + Copper + Lead → Save (Initial Weight)
 * 3) Wait until Manak timing completes (M2 unlocks)
 * 4) Fill M2 (cornet) → Save (Cornet Weight)
 *
 * URL example: /MANAK/SamplingweightingDeatils?...
 */
const KEY = 'shrija-manak-fire-assay-sheet'
const M2_PENDING_KEY = 'shrija-manak-m2-pending'

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function setNativeValue(el, value) {
  if (!el || value == null || value === '') return false
  const v = String(value)
  try {
    el.removeAttribute('readonly')
    if (el.disabled) el.disabled = false
  } catch {
    /* ignore */
  }
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const desc = Object.getOwnPropertyDescriptor(proto, 'value')
  el.focus()
  if (desc && desc.set) desc.set.call(el, v)
  else el.value = v
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
  el.dispatchEvent(new Event('blur', { bubbles: true }))
  el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }))
  // ASP.NET often listens to propertychange
  try {
    el.dispatchEvent(new Event('propertychange', { bubbles: true }))
  } catch {
    /* ignore */
  }
  return true
}

function findInputByIdName(re) {
  return (
    allControls().find((el) => {
      if (!/INPUT|TEXTAREA|SELECT/.test(el.tagName)) return false
      return re.test(`${el.id || ''} ${el.name || ''} ${el.className || ''}`)
    }) || null
  )
}

function visible(el) {
  if (!el) return false
  const s = window.getComputedStyle(el)
  return s.display !== 'none' && s.visibility !== 'hidden' && el.offsetParent !== null
}

function allControls() {
  return Array.from(
    document.querySelectorAll('input, select, textarea, button, a'),
  ).filter(visible)
}

function textOf(el) {
  return `${el.value || ''} ${el.textContent || ''} ${el.title || ''} ${el.getAttribute('aria-label') || ''}`
    .replace(/\s+/g, ' ')
    .trim()
}

function clickByText(re) {
  const nodes = allControls().filter((el) => {
    const tag = el.tagName
    if (tag === 'INPUT') {
      const t = (el.type || '').toLowerCase()
      return t === 'button' || t === 'submit' || t === 'image'
    }
    return tag === 'BUTTON' || tag === 'A' || el.getAttribute('role') === 'button'
  })
  const btn = nodes.find((el) => re.test(textOf(el)))
  if (!btn) return false
  btn.click()
  return true
}

/** Find input closest to a label / header matching regex */
function findInputByLabel(labelRe) {
  const candidates = Array.from(
    document.querySelectorAll('label, td, th, span, div, b, strong, font'),
  ).filter((n) => labelRe.test((n.textContent || '').replace(/\s+/g, ' ').trim()))

  for (const node of candidates) {
    const direct =
      node.querySelector('input:not([type="hidden"]), select, textarea') ||
      (node.nextElementSibling &&
      /INPUT|SELECT|TEXTAREA/.test(node.nextElementSibling.tagName)
        ? node.nextElementSibling
        : null)
    if (direct && visible(direct)) return direct

    const parent = node.closest('td, tr, div, table, fieldset, form') || node.parentElement
    if (!parent) continue
    const input = parent.querySelector('input:not([type="hidden"]), select, textarea')
    if (input && visible(input)) return input
  }

  // name/id heuristics
  const byName = allControls().find((el) => {
    if (!/INPUT|TEXTAREA|SELECT/.test(el.tagName)) return false
    const id = `${el.id || ''} ${el.name || ''} ${el.placeholder || ''}`
    return labelRe.test(id)
  })
  return byName || null
}

function findSaveNear(labelRe) {
  const labelNodes = Array.from(
    document.querySelectorAll('label, td, th, span, div, b, strong'),
  ).filter((n) => labelRe.test((n.textContent || '').replace(/\s+/g, ' ').trim()))

  for (const node of labelNodes) {
    const scope =
      node.closest('td, tr, div.form-group, div.row, fieldset, table') || node.parentElement
    if (!scope) continue
    const btn = Array.from(
      scope.querySelectorAll('input[type="button"], input[type="submit"], button, a'),
    ).find((el) => /save/i.test(textOf(el)) && !/initial|cornet/i.test(textOf(el)))
    if (btn) return btn
  }
  return null
}

function parseLotOptionText(text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim()
  const m = /Lot\s*(\d+)\s*[:：]?\s*(\d+)?/i.exec(t)
  if (!m) return { lot: null, jobCard: '' }
  return { lot: Number(m[1]), jobCard: m[2] || '' }
}

function parseShrijaJob(jobCardNo) {
  const t = String(jobCardNo || '').trim()
  const m = /^(\d+)\s*[_\-/]\s*(\d+)$/.exec(t)
  if (m) return { lot: Number(m[1]), card: m[2] }
  if (/^\d{6,}$/.test(t)) return { lot: 0, card: t }
  return { lot: 0, card: t }
}

function resolveStripRows(sheet, preferredLot, selectText) {
  const filled = (sheet.rows || []).filter((r) => r.jobCardNo || r.manakJobCard)
  const fromView = (sheet.viewRows || []).filter((r) => r.jobCardNo || r.manakJobCard)
  const allRows = filled.length ? filled : fromView
  const fromOpt = parseLotOptionText(selectText)
  const lotNum = preferredLot != null ? Number(preferredLot) : fromOpt.lot
  const jobCard = fromOpt.jobCard || ''

  if (jobCard) {
    const byCard = allRows.filter((r) => {
      const card = String(r.manakJobCard || parseShrijaJob(r.jobCardNo).card || '')
      return card === jobCard || String(r.jobCardNo).includes(jobCard)
    })
    if (byCard.length >= 2) return { rows: byCard.slice(0, 2), lotNum: byCard[0].lotNo, jobCard }
    if (byCard.length === 1) {
      const lot = byCard[0].lotNo
      const pair = allRows.filter((r) => Number(r.lotNo) === Number(lot))
      if (pair.length >= 2) return { rows: pair.slice(0, 2), lotNum: lot, jobCard }
      return { rows: byCard, lotNum: lot, jobCard }
    }
  }

  if (lotNum != null && !Number.isNaN(lotNum)) {
    const byLot = allRows.filter((r) => Number(r.lotNo) === Number(lotNum))
    if (byLot.length >= 2) return { rows: byLot.slice(0, 2), lotNum, jobCard }
    const byPrefix = allRows.filter((r) => parseShrijaJob(r.jobCardNo).lot === Number(lotNum))
    if (byPrefix.length >= 2) return { rows: byPrefix.slice(0, 2), lotNum, jobCard }
  }

  // Fallback: first filled pair so fill still runs if Lot text parse fails
  if (allRows.length >= 2) {
    const lot = allRows[0].lotNo || 1
    const pair = allRows.filter((r) => Number(r.lotNo) === Number(lot))
    if (pair.length >= 2) return { rows: pair.slice(0, 2), lotNum: lot, jobCard }
    return { rows: allRows.slice(0, 2), lotNum: lot, jobCard }
  }

  return { rows: [], lotNum, jobCard }
}

/** Locate assay table column inputs by header keywords (4 rows: Strip1, Strip2, C1, C2). */
function columnInputs(headerRe) {
  const tables = Array.from(document.querySelectorAll('table'))
  for (const table of tables) {
    const headers = Array.from(table.querySelectorAll('th, thead td, tr:first-child td'))
    let col = -1
    headers.forEach((h, i) => {
      if (headerRe.test((h.textContent || '').replace(/\s+/g, ' '))) col = i
    })
    if (col < 0) continue

    const bodyRows = Array.from(table.querySelectorAll('tr')).filter((tr) => {
      const t = (tr.textContent || '').replace(/\s+/g, ' ')
      return /Strip\s*1|Strip\s*2|C1|C2|Check\s*Gold/i.test(t)
    })
    if (bodyRows.length < 2) continue

    const inputs = []
    for (const tr of bodyRows.slice(0, 4)) {
      const cells = Array.from(tr.querySelectorAll('td'))
      const cell = cells[col] || cells.find((c) => c.querySelector('input'))
      const input = cell?.querySelector('input:not([type="hidden"])')
      inputs.push(input || null)
    }
    if (inputs.filter(Boolean).length >= 2) return inputs
  }
  return []
}

function collectAssayInputs() {
  // Prefer header-based columns
  let m1 = columnInputs(/Initial weight|M1/i)
  let silver = columnInputs(/Weight of Silver|Silver/i)
  let copper = columnInputs(/Weight of Copper|Copper/i)
  let lead = columnInputs(/Weight of Lead|Lead/i)
  let m2 = columnInputs(/cornet after|M2/i)

  // Fallback: first big table with many inputs — group by row
  if (m1.filter(Boolean).length < 2) {
    const table = Array.from(document.querySelectorAll('table')).find((t) =>
      /Strip\s*1|Check\s*Gold|Fire Assaying/i.test(t.textContent || ''),
    )
    if (table) {
      const rows = Array.from(table.querySelectorAll('tr')).filter((tr) =>
        /Strip|C1|C2|Check/i.test(tr.textContent || ''),
      )
      const grid = rows.slice(0, 4).map((tr) =>
        Array.from(tr.querySelectorAll('input:not([type="hidden"])')),
      )
      m1 = grid.map((g) => g[0] || null)
      silver = grid.map((g) => g[1] || null)
      copper = grid.map((g) => g[2] || null)
      lead = grid.map((g) => g[3] || null)
      m2 = grid.map((g) => g[4] || null)
    }
  }

  return { m1, silver, copper, lead, m2 }
}

function showToast(msg, ms = 6000) {
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
    maxWidth: '360px',
  })
  document.body.appendChild(n)
  setTimeout(() => n.remove(), ms)
}

function isM2Unlocked(m2Inputs) {
  return m2Inputs.some((el) => el && !el.disabled && !el.readOnly)
}

async function fillM2AndSave(m2Values) {
  const { m2 } = collectAssayInputs()
  if (!isM2Unlocked(m2)) return false
  m2.forEach((el, i) => setNativeValue(el, m2Values[i]))
  await delay(400)
  const ok =
    clickByText(/Save\s*\(?\s*Cornet\s*Weight\s*\)?/i) ||
    clickByText(/Cornet\s*Weight/i)
  showToast(ok ? 'Shrija: M2 filled + Save (Cornet Weight)' : 'Shrija: M2 filled (click Save Cornet Weight)')
  return true
}

function watchM2Unlock(m2Values) {
  chrome.storage.local.set({
    [M2_PENDING_KEY]: { m2Values, at: Date.now() },
  })
  if (window.__shrijaM2Timer) clearInterval(window.__shrijaM2Timer)
  let tries = 0
  window.__shrijaM2Timer = setInterval(async () => {
    tries += 1
    const done = await fillM2AndSave(m2Values)
    if (done || tries > 180) {
      // ~6 min @ 2s
      clearInterval(window.__shrijaM2Timer)
      window.__shrijaM2Timer = null
      if (done) chrome.storage.local.remove(M2_PENDING_KEY)
    }
  }, 2000)
}

async function fillInitialPhase(sheet, preferredLot, selectText) {
  const resolved = resolveStripRows(sheet, preferredLot, selectText)
  if (!resolved.rows.length) {
    showToast('Shrija: no matching Job/Lot in Create Sheet payload')
    return false
  }

  const stripRows = resolved.rows
  const first = stripRows[0]
  const cg = sheet.cg || {}

  // ——— Step 1: Sampling Details ———
  const drawn = first?.sampleDrawn
  const sampleDrawnEl =
    findInputByLabel(/Sample Drawn Weight/i) ||
    findInputByLabel(/Sample Drawn/i) ||
    findInputByIdName(/sampledrawn|sample_drawn|txtSampleDrawn|SampleDrawn/i)
  const buttonWtEl =
    findInputByLabel(/Button Weight/i) ||
    findInputByIdName(/buttonweight|button_weight|txtButton|ButtonWeight/i)

  setNativeValue(sampleDrawnEl, drawn)
  await delay(400)
  const saveDrawn = findSaveNear(/Sample Drawn/i)
  if (saveDrawn) saveDrawn.click()
  else clickByText(/^Save$/i)
  await delay(900)

  setNativeValue(buttonWtEl, drawn)
  await delay(400)
  const saveBtn = findSaveNear(/Button Weight/i)
  if (saveBtn) saveBtn.click()
  else clickByText(/^Save$/i)
  await delay(1000)

  // ——— Step 2: Initial weights (NOT M2 yet) ———
  const m1s = [stripRows[0]?.sampleWeight, stripRows[1]?.sampleWeight, cg.cg1, cg.cg2]
  const silvers = [stripRows[0]?.silver, stripRows[1]?.silver, cg.silverCg1, cg.silverCg2]
  const coppers = [0, 0, cg.copperCg1, cg.copperCg2]
  const leads = [
    stripRows[0]?.lead || 4,
    stripRows[1]?.lead || 4,
    cg.leadCg1 || 4,
    cg.leadCg2 || 4,
  ]
  const m2s = [stripRows[0]?.wotgcaa, stripRows[1]?.wotgcaa, cg.wotgcaa1, cg.wotgcaa2]

  const cols = collectAssayInputs()
  for (let i = 0; i < 4; i++) {
    setNativeValue(cols.m1[i], m1s[i])
    setNativeValue(cols.silver[i], silvers[i])
    setNativeValue(cols.copper[i], coppers[i])
    setNativeValue(cols.lead[i], leads[i])
  }

  // Deltas (if editable before cornet save)
  setNativeValue(findInputByLabel(/Avg\.?\s*Delta/i), cg.avgDelta)
  setNativeValue(findInputByLabel(/Delta\s*1/i), cg.delta1)
  setNativeValue(findInputByLabel(/Delta\s*2/i), cg.delta2)

  await delay(500)
  const savedInit =
    clickByText(/Save\s*\(?\s*Initial\s*Weight\s*\)?/i) ||
    clickByText(/Initial\s*Weight/i)

  showToast(
    savedInit
      ? `Shrija: Lot ${resolved.lotNum || ''} sampling + initial weight saved. Wait for Manak timing — M2 will auto-fill.`
      : `Shrija: initial fields filled. Click Save (Initial Weight), wait timing, M2 auto-fills.`,
    8000,
  )

  // ——— Step 3: M2 after timing ———
  // Never force-fill locked M2; wait until unlocked
  if (isM2Unlocked(cols.m2)) {
    await fillM2AndSave(m2s)
  } else {
    watchM2Unlock(m2s)
  }

  return true
}

function currentLotContext() {
  const lotSel =
    findInputByLabel(/Lot No/i) ||
    Array.from(document.querySelectorAll('select')).find((s) =>
      /Lot/i.test(s.options?.[1]?.text || s.id || s.name || ''),
    )
  if (lotSel && lotSel.tagName === 'SELECT') {
    const text = lotSel.options[lotSel.selectedIndex]?.text || ''
    const parsed = parseLotOptionText(text)
    return { text, ...parsed }
  }
  return { text: '', lot: null, jobCard: '' }
}

function getStoredSheet() {
  return new Promise((resolve) => {
    chrome.storage.local.get([KEY], (data) => resolve(data[KEY] || null))
  })
}

function askPasteSheet() {
  const raw = window.prompt(
    'Shrija sheet chrome.storage mein nahi mila.\n\nShrija Create Sheet ke baad clipboard pe JSON copy hota hai — yahan PASTE karke OK dabao:',
  )
  if (!raw || !raw.trim()) return null
  try {
    const sheet = JSON.parse(raw.trim())
    if (!sheet || typeof sheet !== 'object') return null
    chrome.storage.local.set({ [KEY]: sheet, [`${KEY}-at`]: Date.now(), [`${KEY}-src`]: 'paste' })
    return sheet
  } catch {
    showToast('Shrija: JSON paste galat hai')
    return null
  }
}

async function resolveSheet(allowPaste) {
  let sheet = await getStoredSheet()
  if (!sheet && allowPaste) sheet = askPasteSheet()
  return sheet
}

async function runFill(preferredLot, selectText) {
  const sheet = await resolveSheet(true)
  if (!sheet) {
    showToast('No Shrija sheet — Create Sheet → green badge "Extension OK" dikhe, phir Fill. Ya Fill pe paste JSON.')
    return
  }
  if (!/Fire Assaying|Sampling|Sample Drawn|cornet|M1|Assaying Sheet/i.test(document.body?.innerText || '')) {
    return
  }
  const ctx = currentLotContext()
  const text = selectText || ctx.text
  const parsed = parseLotOptionText(text)
  const lot = preferredLot ?? parsed.lot ?? ctx.lot
  if (lot == null && !parsed.jobCard && !ctx.jobCard) {
    showToast('Shrija: pehle Lot No select karo')
    return
  }
  await fillInitialPhase(sheet, lot, text)
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'SHRIJA_FILL_MANAK_NOW') runFill()
})

function bindLotChange() {
  document.querySelectorAll('select').forEach((sel) => {
    if (sel.dataset.shrijaBound) return
    const probe = `${sel.id || ''} ${sel.name || ''} ${(sel.closest('td,div,tr')?.textContent || '').slice(0, 60)}`
    if (!/Lot/i.test(probe) && !/Lot\s*\d+/i.test(sel.options?.[1]?.text || '')) return
    sel.dataset.shrijaBound = '1'
    sel.addEventListener('change', () => {
      const opt = sel.options[sel.selectedIndex]
      const parsed = parseLotOptionText(opt?.text || '')
      runFill(parsed.lot, opt?.text || '')
    })
  })
}

function resumePendingM2() {
  chrome.storage.local.get([M2_PENDING_KEY], async (data) => {
    const pending = data[M2_PENDING_KEY]
    if (!pending?.m2Values) return
    if (Date.now() - (pending.at || 0) > 30 * 60 * 1000) {
      chrome.storage.local.remove(M2_PENDING_KEY)
      return
    }
    const ok = await fillM2AndSave(pending.m2Values)
    if (!ok) watchM2Unlock(pending.m2Values)
    else chrome.storage.local.remove(M2_PENDING_KEY)
  })
}

const onAssayPage = /Fire Assaying|Samplingweighting|Sample Drawn|Assaying Sheet/i.test(
  `${location.href} ${document.body?.innerText || ''}`,
)

if (onAssayPage) {
  setTimeout(bindLotChange, 600)
  setTimeout(bindLotChange, 2000)
  setTimeout(resumePendingM2, 1500)
  setTimeout(ensureFillButton, 1000)
}

function refreshHint(hint) {
  chrome.storage.local.get([KEY], (data) => {
    const sheet = data[KEY]
    const n = sheet?.rows?.length || sheet?.viewRows?.length || 0
    if (n) {
      hint.textContent = `Sheet FS-${sheet.sheetNo || '?'} · ${n} rows · Lot select + Fill`
      hint.style.background = 'rgba(21,128,61,.95)'
    } else {
      hint.textContent = 'No sheet — Create Sheet (green badge) ya Load Sheet paste'
      hint.style.background = 'rgba(15,39,68,.92)'
    }
  })
}

function ensureFillButton() {
  if (document.getElementById('shrija-manak-fill-btn')) return
  const wrap = document.createElement('div')
  wrap.id = 'shrija-manak-fill-btn'
  Object.assign(wrap.style, {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    zIndex: 999999,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    alignItems: 'flex-end',
  })
  const hint = document.createElement('div')
  hint.textContent = 'Create Sheet ke baad Lot select karke yahan click'
  Object.assign(hint.style, {
    background: 'rgba(15,39,68,.92)',
    color: '#fff',
    font: '600 11px/1.3 system-ui,sans-serif',
    padding: '6px 10px',
    borderRadius: '8px',
    maxWidth: '240px',
  })
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.textContent = 'Shrija: Fill Fire Assay'
  Object.assign(btn.style, {
    background: '#0f2744',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    padding: '12px 16px',
    font: '700 13px/1.2 system-ui,sans-serif',
    cursor: 'pointer',
    boxShadow: '0 8px 24px rgba(0,0,0,.28)',
  })
  btn.addEventListener('click', () => runFill())
  const loadBtn = document.createElement('button')
  loadBtn.type = 'button'
  loadBtn.textContent = 'Load Sheet (paste JSON)'
  Object.assign(loadBtn.style, {
    background: '#1d4ed8',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    padding: '8px 12px',
    font: '700 11px/1.2 system-ui,sans-serif',
    cursor: 'pointer',
  })
  loadBtn.addEventListener('click', async () => {
    const sheet = askPasteSheet()
    if (sheet) {
      showToast(`Sheet loaded · FS-${sheet.sheetNo || '?'} — ab Lot select + Fill`)
      refreshHint(hint)
    }
  })
  wrap.appendChild(hint)
  wrap.appendChild(btn)
  wrap.appendChild(loadBtn)
  document.body.appendChild(wrap)

  refreshHint(hint)
  setInterval(() => refreshHint(hint), 2000)
}

document.addEventListener('change', (e) => {
  const t = e.target
  if (!t || t.tagName !== 'SELECT') return
  const opt = t.options[t.selectedIndex]
  const parsed = parseLotOptionText(opt?.text || '')
  if (parsed.lot != null || parsed.jobCard) runFill(parsed.lot, opt?.text || '')
})
