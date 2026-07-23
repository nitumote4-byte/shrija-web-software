/**
 * Fills Manak Online Fire Assaying Sheet from the last Shrija Create Sheet payload.
 * Matches labels used on huid.manakonline.in Fire Assaying Sheet.
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

function parseLot(jobCardNo) {
  const m = /^(\d+)\s*[_\-/]\s*(\d+)$/.exec(String(jobCardNo || '').trim())
  if (m) return { lot: Number(m[1]), card: m[2] }
  return { lot: 1, card: String(jobCardNo || '').trim() }
}

function fillSheet(sheet) {
  if (!sheet) {
    alert('No Shrija fire assay sheet found. Create Sheet in Shrija first.')
    return false
  }

  // Sampling details (first job pair)
  const first = sheet.rows?.[0]
  if (first) {
    const drawn = findByLabel(/Sample Drawn Weight/i)
    const button = findByLabel(/Button Weight/i)
    setInput(drawn, first.sampleDrawn)
    setInput(button, first.sampleDrawn)
  }

  // CG / strip grid — best-effort by column order on Manak table
  const cg = sheet.cg || {}
  const stripRows = sheet.rows || []
  // Use first two strip rows + CG from header
  const m1s = [
    stripRows[0]?.sampleWeight,
    stripRows[1]?.sampleWeight,
    cg.cg1,
    cg.cg2,
  ]
  const silvers = [
    stripRows[0]?.silver,
    stripRows[1]?.silver,
    cg.silverCg1,
    cg.silverCg2,
  ]
  const coppers = [0, 0, cg.copperCg1, cg.copperCg2]
  const leads = [
    stripRows[0]?.lead || 4,
    stripRows[1]?.lead || 4,
    cg.leadCg1 || 4,
    cg.leadCg2 || 4,
  ]
  const m2s = [
    stripRows[0]?.wotgcaa,
    stripRows[1]?.wotgcaa,
    cg.wotgcaa1,
    cg.wotgcaa2,
  ]

  // Fill by placeholder / nearby headers when possible
  const m1Inputs = Array.from(document.querySelectorAll('input')).filter((el) =>
    /m1|initial weight|sample/i.test(
      `${el.name || ''} ${el.id || ''} ${el.placeholder || ''} ${el.getAttribute('aria-label') || ''}`,
    ),
  )
  m1Inputs.slice(0, 4).forEach((el, i) => setInput(el, m1s[i]))

  // Fallback: sequential numeric inputs under fire assay table
  const table = document.querySelector('table')
  if (table) {
    const inputs = Array.from(table.querySelectorAll('input')).filter(
      (el) => !el.disabled && el.type !== 'hidden',
    )
    // Heuristic layout: each of 4 rows has M1, Ag, Cu, Pb, M2
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
  setInput(findByLabel(/Strip1\s*\(W1\)|Strip\s*1/i), stripRows[0]?.fineness)
  setInput(findByLabel(/Strip2\s*\(W2\)|Strip\s*2/i), stripRows[1]?.fineness)
  setInput(findByLabel(/Mean Fineness/i), stripRows[1]?.meanFineness || stripRows[0]?.meanFineness)

  // Try select lot dropdown if job card present
  if (first?.jobCardNo) {
    const { lot, card } = parseLot(first.jobCardNo)
    const sel = findByLabel(/Lot No/i)
    if (sel && sel.tagName === 'SELECT') {
      const opts = Array.from(sel.options)
      const match =
        opts.find((o) => o.text.includes(`Lot ${lot}`) && o.text.includes(card)) ||
        opts.find((o) => o.text.includes(card)) ||
        opts.find((o) => o.text.includes(`Lot ${lot}`))
      if (match) {
        sel.value = match.value
        sel.dispatchEvent(new Event('change', { bubbles: true }))
      }
    }
  }

  console.info('[Shrija] Manak fire assay fill attempted', sheet.sheetNo, sheet.purity)
  return true
}

function runFill() {
  chrome.storage.local.get([KEY], (data) => {
    const ok = fillSheet(data[KEY])
    if (ok) {
      const n = document.createElement('div')
      n.textContent = 'Shrija: Fire assay fields filled (review & Save on Manak)'
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
  })
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'SHRIJA_FILL_MANAK_NOW') runFill()
})

// Auto-run when Fire Assaying Sheet page is detected
if (/Fire Assaying|assaying|cornet|HUID/i.test(document.body?.innerText || '')) {
  setTimeout(runFill, 1200)
}
