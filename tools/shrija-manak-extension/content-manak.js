/**
 * Fills Manak Online Fire Assaying Sheet from Shrija Create Sheet payload.
 * Matches Lot dropdown text like "Lot 1:127087789" to rows with job 1_127087789.
 */
const KEY = 'shrija-manak-fire-assay-sheet'

function setInput(el, value) {
  if (!el || value == null || value === '') return
  const v = String(value)
  el.focus()
  el.value = v
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
  el.blur()
}

function findByLabel(textRe) {
  const labels = Array.from(document.querySelectorAll('label, td, th, span, div'))
  for (const node of labels) {
    const t = (node.textContent || '').replace(/\s+/g, ' ').trim()
    if (!textRe.test(t)) continue
    const input =
      node.querySelector('input, select, textarea') ||
      node.parentElement?.querySelector('input, select, textarea') ||
      node.nextElementSibling?.querySelector?.('input, select, textarea') ||
      (node.nextElementSibling?.matches?.('input, select, textarea')
        ? node.nextElementSibling
        : null)
    if (input) return input
  }
  return null
}

/** Parse Manak lot option: "Lot 1:127087789" | "Lot 1 : 127087789" | "Lot 1" */
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
  const allRows = sheet.rows || []
  const fromOpt = parseLotOptionText(selectText)
  const lotNum = preferredLot != null ? Number(preferredLot) : fromOpt.lot
  const jobCard = fromOpt.jobCard || ''

  // 1) Match Manak job card number (most accurate)
  if (jobCard) {
    const byCard = allRows.filter((r) => {
      const card = String(r.manakJobCard || parseShrijaJob(r.jobCardNo).card || '')
      return card === jobCard || String(r.jobCardNo).includes(jobCard)
    })
    if (byCard.length >= 2) return { rows: byCard.slice(0, 2), lotNum: byCard[0].lotNo, jobCard }
    if (byCard.length === 1) {
      // find pair with same lotNo
      const lot = byCard[0].lotNo
      const pair = allRows.filter((r) => Number(r.lotNo) === Number(lot))
      if (pair.length >= 2) return { rows: pair.slice(0, 2), lotNum: lot, jobCard }
    }
  }

  // 2) Match by lot number from dropdown / preference
  if (lotNum != null && !Number.isNaN(lotNum)) {
    const byLot = allRows.filter((r) => Number(r.lotNo) === Number(lotNum))
    if (byLot.length >= 2) return { rows: byLot.slice(0, 2), lotNum, jobCard }
    const byPrefix = allRows.filter((r) => parseShrijaJob(r.jobCardNo).lot === Number(lotNum))
    if (byPrefix.length >= 2) return { rows: byPrefix.slice(0, 2), lotNum, jobCard }
  }

  return { rows: [], lotNum, jobCard }
}

function fillSheet(sheet, preferredLot, selectText) {
  if (!sheet) {
    alert('No Shrija fire assay sheet found. Create Sheet in Shrija after filling Job Card Nos.')
    return false
  }

  let selText = selectText || ''
  if (!selText) {
    const lotSel = findByLabel(/Lot No/i)
    if (lotSel && lotSel.tagName === 'SELECT') {
      selText = lotSel.options[lotSel.selectedIndex]?.text || ''
    }
  }

  const resolved = resolveStripRows(sheet, preferredLot, selText)
  if (!resolved.rows.length) {
    console.warn('[Shrija] No matching lot/job rows for', selText, preferredLot)
    return false
  }

  const stripRows = resolved.rows
  const first = stripRows[0]
  const cg = sheet.cg || {}

  if (first) {
    setInput(findByLabel(/Sample Drawn Weight/i), first.sampleDrawn)
    setInput(findByLabel(/Button Weight/i), first.sampleDrawn)
  }

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

  const table = document.querySelector('table')
  if (table) {
    const inputs = Array.from(table.querySelectorAll('input')).filter(
      (el) => !el.disabled && el.type !== 'hidden',
    )
    let idx = 0
    for (let row = 0; row < 4; row++) {
      if (inputs[idx]) setInput(inputs[idx++], m1s[row])
      if (inputs[idx]) setInput(inputs[idx++], silvers[row])
      if (inputs[idx]) setInput(inputs[idx++], coppers[row])
      if (inputs[idx]) setInput(inputs[idx++], leads[row])
      if (inputs[idx]) setInput(inputs[idx++], m2s[row])
    }
  }

  setInput(findByLabel(/Avg\.?\s*Delta/i), cg.avgDelta)
  setInput(findByLabel(/Delta\s*1/i), cg.delta1)
  setInput(findByLabel(/Delta\s*2/i), cg.delta2)
  setInput(findByLabel(/Strip1\s*\(W1\)|Fineness.*Strip\s*1/i), stripRows[0]?.fineness)
  setInput(findByLabel(/Strip2\s*\(W2\)|Fineness.*Strip\s*2/i), stripRows[1]?.fineness)
  setInput(
    findByLabel(/Mean Fineness/i),
    stripRows[1]?.meanFineness || stripRows[0]?.meanFineness,
  )

  console.info('[Shrija] Filled lot', resolved.lotNum, 'job', resolved.jobCard || first?.manakJobCard)
  return true
}

function showToast(msg) {
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
    font: '600 13px/1.3 system-ui,sans-serif',
    boxShadow: '0 8px 24px rgba(0,0,0,.25)',
  })
  document.body.appendChild(n)
  setTimeout(() => n.remove(), 4500)
}

function runFill(preferredLot, selectText) {
  chrome.storage.local.get([KEY], (data) => {
    const sheet = data[KEY]
    if (!sheet) return
    // Wait until a Lot is selected (Gold Shark behaviour)
    const lotSel = findByLabel(/Lot No/i)
    const text =
      selectText ||
      (lotSel && lotSel.tagName === 'SELECT'
        ? lotSel.options[lotSel.selectedIndex]?.text || ''
        : '')
    const parsed = parseLotOptionText(text)
    if (preferredLot == null && !parsed.lot && !parsed.jobCard) {
      return
    }
    const ok = fillSheet(sheet, preferredLot ?? parsed.lot, text)
    if (ok) {
      showToast(
        `Shrija: filled Lot ${preferredLot || parsed.lot || ''} ${parsed.jobCard || ''}`.trim(),
      )
    }
  })
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'SHRIJA_FILL_MANAK_NOW') runFill()
})

function bindLotChange() {
  document.querySelectorAll('select').forEach((sel) => {
    if (sel.dataset.shrijaBound) return
    const probe = `${sel.id || ''} ${sel.name || ''} ${sel.getAttribute('aria-label') || ''}`
    const nearby = (sel.closest('td,div,tr,label')?.textContent || '').slice(0, 80)
    if (!/Lot/i.test(probe + nearby) && !/Lot\s*\d+/i.test(sel.options?.[1]?.text || '')) return
    sel.dataset.shrijaBound = '1'
    sel.addEventListener('change', () => {
      const opt = sel.options[sel.selectedIndex]
      const parsed = parseLotOptionText(opt?.text || '')
      runFill(parsed.lot, opt?.text || '')
    })
  })
}

// Bind lot dropdown; fill only after Lot No is chosen (not on blind page load)
if (/Fire Assaying|assaying|Lot No|HUID/i.test(document.body?.innerText || '')) {
  setTimeout(bindLotChange, 800)
  setTimeout(bindLotChange, 2000)
}

document.addEventListener('change', (e) => {
  const t = e.target
  if (!t || t.tagName !== 'SELECT') return
  const opt = t.options[t.selectedIndex]
  const parsed = parseLotOptionText(opt?.text || '')
  if (parsed.lot != null || parsed.jobCard) {
    runFill(parsed.lot, opt?.text || '')
  }
})
