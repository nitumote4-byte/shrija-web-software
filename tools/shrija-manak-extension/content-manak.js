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

function fillSheet(sheet, preferredLot) {
  if (!sheet) {
    alert('No Shrija fire assay sheet found. Create Sheet in Shrija first.')
    return false
  }

  const lotSel = findByLabel(/Lot No/i)
  let lotNum = preferredLot
  if (lotSel && lotSel.tagName === 'SELECT') {
    const opt = lotSel.options[lotSel.selectedIndex]
    const m = /Lot\s*(\d+)/i.exec(opt?.text || '')
    if (m) lotNum = Number(m[1])
  }

  const allRows = sheet.rows || []
  const lotRows = lotNum
    ? allRows.filter((r) => Number(r.lotNo) === Number(lotNum))
    : allRows.slice(0, 2)
  const stripRows = lotRows.length >= 2 ? lotRows.slice(0, 2) : allRows.slice(0, 2)
  const first = stripRows[0]

  if (first) {
    const drawn = findByLabel(/Sample Drawn Weight/i)
    const button = findByLabel(/Button Weight/i)
    setInput(drawn, first.sampleDrawn)
    setInput(button, first.sampleDrawn)
  }

  const cg = sheet.cg || {}
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

  const m1Inputs = Array.from(document.querySelectorAll('input')).filter((el) =>
    /m1|initial weight|sample/i.test(
      `${el.name || ''} ${el.id || ''} ${el.placeholder || ''} ${el.getAttribute('aria-label') || ''}`,
    ),
  )
  m1Inputs.slice(0, 4).forEach((el, i) => setInput(el, m1s[i]))

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
  setInput(findByLabel(/Strip1\s*\(W1\)|Strip\s*1/i), stripRows[0]?.fineness)
  setInput(findByLabel(/Strip2\s*\(W2\)|Strip\s*2/i), stripRows[1]?.fineness)
  setInput(
    findByLabel(/Mean Fineness/i),
    stripRows[1]?.meanFineness || stripRows[0]?.meanFineness,
  )

  console.info('[Shrija] Manak fill lot', lotNum, sheet.sheetNo, sheet.purity)
  return true
}

function runFill(preferredLot) {
  chrome.storage.local.get([KEY], (data) => {
    const ok = fillSheet(data[KEY], preferredLot)
    if (ok) {
      const n = document.createElement('div')
      n.textContent = 'Shrija: Fire assay fields filled for selected Lot (review & Save)'
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

function bindLotChange() {
  const sel = findByLabel(/Lot No/i)
  if (!sel || sel.dataset.shrijaBound) return
  sel.dataset.shrijaBound = '1'
  sel.addEventListener('change', () => {
    const opt = sel.options[sel.selectedIndex]
    const m = /Lot\s*(\d+)/i.exec(opt?.text || '')
    runFill(m ? Number(m[1]) : undefined)
  })
}

if (/Fire Assaying|assaying|cornet|HUID|Lot No/i.test(document.body?.innerText || '')) {
  setTimeout(() => {
    bindLotChange()
    runFill()
  }, 1200)
}

document.addEventListener('change', (e) => {
  const t = e.target
  if (!t || t.tagName !== 'SELECT') return
  const label = (t.closest('td,div,label')?.textContent || '') + (t.parentElement?.textContent || '')
  if (/Lot\s*No/i.test(label) || /Lot\s*\d+/i.test(t.options?.[t.selectedIndex]?.text || '')) {
    const opt = t.options[t.selectedIndex]
    const m = /Lot\s*(\d+)/i.exec(opt?.text || '')
    runFill(m ? Number(m[1]) : undefined)
  }
})
