/**
 * Pure Manak Fire Assay fill helpers (no chrome.*).
 * Loaded before content-manak.js in the extension; also used by Node tests.
 */
(function (root) {
  const ManakFill = {}

  ManakFill.delay = (ms) => new Promise((r) => setTimeout(r, ms))

  ManakFill.isUnsafeTarget = function isUnsafeTarget(el) {
    if (!el || !/INPUT|TEXTAREA/.test(el.tagName)) return true
    const t = (el.type || '').toLowerCase()
    if (t === 'hidden' || t === 'button' || t === 'submit' || t === 'checkbox' || t === 'radio') return true
    const idCls = `${el.id || ''} ${el.className || ''} ${el.name || ''} ${el.placeholder || ''}`
    if (/select2|chosen|combobox|autocomplete|purity|ddlPurity|Declared/i.test(idCls)) return true
    if (el.getAttribute('role') === 'combobox') return true
    const nearEl = el.closest('td, th, tr, label') || el.parentElement
    const near = (nearEl?.textContent || '').replace(/\s+/g, ' ').slice(0, 200)
    if (/Declared\s*Purity/i.test(near) && !/Sample\s*Drawn|Button\s*Weight/i.test(near)) return true
    return false
  }

  ManakFill.setNativeValue = function setNativeValue(el, value) {
    if (!el || value == null || value === '') return false
    if (ManakFill.isUnsafeTarget(el)) return false
    const v = String(value)
    try {
      el.removeAttribute('readonly')
      el.removeAttribute('disabled')
      if (el.disabled) el.disabled = false
      el.readOnly = false
    } catch {
      /* ignore */
    }
    const proto = el.tagName === 'TEXTAREA' ? root.HTMLTextAreaElement.prototype : root.HTMLInputElement.prototype
    const desc = Object.getOwnPropertyDescriptor(proto, 'value')
    try {
      el.focus()
    } catch {
      /* ignore */
    }
    try {
      el.select?.()
    } catch {
      /* ignore */
    }
    if (desc && desc.set) desc.set.call(el, v)
    else el.value = v
    try {
      el.setAttribute('value', v)
    } catch {
      /* ignore */
    }
    el.dispatchEvent(new root.Event('input', { bubbles: true }))
    el.dispatchEvent(new root.Event('change', { bubbles: true }))
    el.dispatchEvent(new root.KeyboardEvent('keyup', { bubbles: true }))
    el.dispatchEvent(new root.Event('blur', { bubbles: true }))
    try {
      if (root.jQuery) root.jQuery(el).val(v).trigger('input').trigger('change').trigger('blur')
    } catch {
      /* ignore */
    }
    return Math.abs(Number(el.value) - Number(v)) < 0.001 || String(el.value) === v
  }

  /**
   * Manak Fire Assaying Details: manual typing often blocked — balance sends
   * keyboard-wedge scan. Simulate char-by-char key events into the focused field.
   */
  ManakFill.setByScanWeight = async function setByScanWeight(el, value) {
    if (!el || value == null || value === '') return false
    if (ManakFill.isUnsafeTarget(el)) return false
    const num = Number(value)
    if (!(num > 0) && num !== 0) return false
    const text = Number.isInteger(num) ? String(num) : Number(num).toFixed(3)

    try {
      el.removeAttribute('readonly')
      el.removeAttribute('disabled')
      el.readOnly = false
      if (el.disabled) el.disabled = false
    } catch {
      /* ignore */
    }

    try {
      el.focus()
      el.click?.()
    } catch {
      /* ignore */
    }
    await ManakFill.delay(60)

    // Clear existing (Ctrl+A / select + delete)
    try {
      el.select?.()
    } catch {
      /* ignore */
    }
    const proto = el.tagName === 'TEXTAREA' ? root.HTMLTextAreaElement.prototype : root.HTMLInputElement.prototype
    const desc = Object.getOwnPropertyDescriptor(proto, 'value')
    if (desc && desc.set) desc.set.call(el, '')
    else el.value = ''
    el.dispatchEvent(new root.Event('input', { bubbles: true }))

    let built = ''
    for (const ch of text) {
      const code = ch.charCodeAt(0)
      const keyOpts = {
        key: ch,
        code: ch === '.' ? 'Period' : `Digit${ch}`,
        keyCode: code,
        which: code,
        bubbles: true,
        cancelable: true,
      }
      el.dispatchEvent(new root.KeyboardEvent('keydown', keyOpts))
      el.dispatchEvent(new root.KeyboardEvent('keypress', keyOpts))
      built += ch
      if (desc && desc.set) desc.set.call(el, built)
      else el.value = built
      el.dispatchEvent(new root.Event('input', { bubbles: true }))
      el.dispatchEvent(new root.KeyboardEvent('keyup', keyOpts))
      await ManakFill.delay(25)
    }

    // Many scale wedges end with Enter
    const enterOpts = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }
    el.dispatchEvent(new root.KeyboardEvent('keydown', enterOpts))
    el.dispatchEvent(new root.KeyboardEvent('keypress', enterOpts))
    el.dispatchEvent(new root.KeyboardEvent('keyup', enterOpts))
    el.dispatchEvent(new root.Event('change', { bubbles: true }))
    el.dispatchEvent(new root.Event('blur', { bubbles: true }))

    try {
      if (root.jQuery) root.jQuery(el).val(el.value).trigger('input').trigger('change')
    } catch {
      /* ignore */
    }

    await ManakFill.delay(80)
    return Math.abs(Number(el.value) - num) < 0.05 || String(el.value).includes(String(Math.floor(num)))
  }

  /** Prefer scan simulation (Fire Assaying); fall back to native set.
   *  opts.skipIfFilled — don't overwrite field that already has a weight (>0).
   *  opts.force — overwrite anyway (badge retry).
   */
  ManakFill.forceSetWeight = async function forceSetWeight(el, value, attempts = 3, opts = {}) {
    if (!el) return false
    const v = Number(value)
    if (!(v > 0)) return false
    const cur = Number(el.value || 0)
    if (!opts.force && opts.skipIfFilled !== false && cur > 0.01) {
      // Already filled — keep Manak/user value
      return true
    }
    for (let i = 0; i < attempts; i++) {
      const okScan = await ManakFill.setByScanWeight(el, v)
      if (okScan) return true
      const formatted = Number.isInteger(v) ? String(v) : v.toFixed(3)
      ManakFill.setNativeValue(el, formatted)
      await ManakFill.delay(150)
      if (Math.abs(Number(el.value) - v) < 0.05) return true
    }
    return Math.abs(Number(el.value) - v) < 0.05
  }

  ManakFill.shortText = function shortText(el) {
    const own = Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent || '')
      .join('')
      .replace(/\s+/g, ' ')
      .trim()
    if (own) return own
    const t = (el.textContent || '').replace(/\s+/g, ' ').trim()
    return t.length <= 90 ? t : ''
  }

  ManakFill.visible = function visible(el) {
    if (!el) return false
    if (el.offsetParent === null && el.tagName !== 'BODY') {
      // jsdom often has offsetParent null — treat connected inputs as visible in tests
      if (typeof el.getBoundingClientRect === 'function') {
        try {
          const r = el.getBoundingClientRect()
          if (r && (r.width || r.height)) return true
        } catch {
          /* ignore */
        }
      }
      if (el.isConnected !== false && /INPUT|SELECT|TEXTAREA|BUTTON/.test(el.tagName)) return true
    }
    try {
      const s = root.getComputedStyle?.(el)
      if (s && (s.display === 'none' || s.visibility === 'hidden')) return false
    } catch {
      /* ignore */
    }
    return true
  }

  ManakFill.parseLotOptionText = function parseLotOptionText(text) {
    const t = String(text || '').replace(/\s+/g, ' ').trim()
    if (/^select|^--/i.test(t)) return { lot: null, jobCard: '' }
    const m = /Lot\s*(\d+)\s*[:：]\s*(\d+)/i.exec(t) || /Lot\s*(\d+)\s*[:：]?\s*(\d+)?/i.exec(t)
    if (!m) {
      const bare = /^(\d{6,})$/.exec(t)
      if (bare) return { lot: null, jobCard: bare[1] }
      return { lot: null, jobCard: '' }
    }
    return { lot: Number(m[1]), jobCard: m[2] || '' }
  }

  ManakFill.parseShrijaJob = function parseShrijaJob(jobCardNo) {
    const t = String(jobCardNo || '').trim()
    const m = /^(\d+)\s*[_\-/]\s*(\d+)$/.exec(t)
    if (m) return { lot: Number(m[1]), card: m[2] }
    if (/^\d{6,}$/.test(t)) return { lot: 0, card: t }
    return { lot: 0, card: t }
  }

  ManakFill.resolveStripRows = function resolveStripRows(sheet, preferredLot, selectText) {
    const filled = (sheet.rows || []).filter((r) => r.jobCardNo || r.manakJobCard)
    const fromView = (sheet.viewRows || []).filter((r) => r.jobCardNo || r.manakJobCard)
    const allRows = filled.length ? filled : fromView
    const fromOpt = ManakFill.parseLotOptionText(selectText)
    const lotNum = preferredLot != null ? Number(preferredLot) : fromOpt.lot
    const jobCard = fromOpt.jobCard || ''

    if (jobCard) {
      const byCard = allRows.filter((r) => {
        const card = String(r.manakJobCard || ManakFill.parseShrijaJob(r.jobCardNo).card || '')
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
      const byPrefix = allRows.filter((r) => ManakFill.parseShrijaJob(r.jobCardNo).lot === Number(lotNum))
      if (byPrefix.length >= 2) return { rows: byPrefix.slice(0, 2), lotNum, jobCard }
    }

    if (allRows.length >= 2) {
      const lot = allRows[0].lotNo || 1
      const pair = allRows.filter((r) => Number(r.lotNo) === Number(lot))
      if (pair.length >= 2) return { rows: pair.slice(0, 2), lotNum: lot, jobCard }
      return { rows: allRows.slice(0, 2), lotNum: lot, jobCard }
    }

    return { rows: [], lotNum, jobCard }
  }

  /**
   * Input that comes AFTER this label in document order (same row OK).
   * Never use "first input in row" — Sample Drawn + Button Weight share one row on Manak.
   */
  ManakFill.inputAfterLabel = function inputAfterLabel(labelEl) {
    if (!labelEl) return null
    const anchor = labelEl.closest('td, th, label, span, div') || labelEl

    // 1) Following sibling cells
    let sib = anchor.nextElementSibling
    for (let i = 0; i < 8 && sib; i++) {
      const tip = (sib.textContent || '').replace(/\s+/g, ' ')
      // Stop if we hit the other sampling label cell
      if (
        /Sample Drawn Weight|Button Weight/i.test(tip) &&
        tip.length < 80 &&
        !sib.querySelector('input:not([type="hidden"])')
      ) {
        break
      }
      const inp =
        sib.tagName === 'INPUT'
          ? sib
          : sib.querySelector?.('input:not([type="hidden"]):not([type="button"]):not([type="submit"])')
      if (inp && ManakFill.visible(inp) && !ManakFill.isUnsafeTarget(inp)) return inp
      sib = sib.nextElementSibling
    }

    // 2) First weight input that follows the label in the row/container
    const row = anchor.closest('tr, .row, .form-group, table, fieldset') || anchor.parentElement
    if (row) {
      const inputs = Array.from(
        row.querySelectorAll('input:not([type="hidden"]):not([type="button"]):not([type="submit"])'),
      ).filter((el) => ManakFill.visible(el) && !ManakFill.isUnsafeTarget(el))
      for (const inp of inputs) {
        const pos = anchor.compareDocumentPosition(inp)
        if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return inp
      }
    }
    return null
  }

  ManakFill.findLabelNode = function findLabelNode(labelRe, root) {
    const scope = root || document
    const nodes = Array.from(scope.querySelectorAll('td, th, label, span, b, strong, font, div, p'))
    let best = null
    for (const n of nodes) {
      const t = ManakFill.shortText(n)
      if (!t || !labelRe.test(t)) continue
      // Prefer shorter exact labels over big wrappers
      if (!best || t.length < ManakFill.shortText(best).length) best = n
    }
    return best
  }

  /** Exact label → nearest following input (Manak Sampling side-by-side layout safe). */
  ManakFill.findInputBesideExactLabel = function findInputBesideExactLabel(labelRe, root) {
    const label = ManakFill.findLabelNode(labelRe, root)
    if (!label) return null
    return ManakFill.inputAfterLabel(label)
  }

  ManakFill.findSamplingInputs = function findSamplingInputs(doc) {
    const document = doc || root.document
    let section = null
    const tables = Array.from(document.querySelectorAll('table, fieldset, div'))
    for (const t of tables) {
      const text = (t.textContent || '').replace(/\s+/g, ' ')
      if (/Sample Drawn Weight/i.test(text) && /Button Weight/i.test(text) && text.length < 8000) {
        section = t
        break
      }
    }
    const rootEl = section || document

    let sampleDrawn =
      ManakFill.findInputBesideExactLabel(/Sample Drawn Weight/i, rootEl) ||
      ManakFill.findInputBesideExactLabel(/^Sample Drawn/i, rootEl)
    let buttonWt = ManakFill.findInputBesideExactLabel(/Button Weight/i, rootEl)

    // Same-row fallback: left input = Sample Drawn, right = Button Weight
    if (sampleDrawn && buttonWt && sampleDrawn === buttonWt) {
      const row = sampleDrawn.closest('tr, .row, div') || sampleDrawn.parentElement
      const inputs = Array.from(
        row.querySelectorAll('input:not([type="hidden"]):not([type="button"]):not([type="submit"])'),
      ).filter((el) => ManakFill.visible(el) && !ManakFill.isUnsafeTarget(el))
      if (inputs.length >= 2) {
        sampleDrawn = inputs[0]
        buttonWt = inputs[1]
      } else {
        buttonWt = null
      }
    }

    // If only one found, try pair from shared row
    if (sampleDrawn && !buttonWt) {
      const row = sampleDrawn.closest('tr, .row, div')
      const inputs = row
        ? Array.from(
            row.querySelectorAll('input:not([type="hidden"]):not([type="button"]):not([type="submit"])'),
          ).filter((el) => ManakFill.visible(el) && !ManakFill.isUnsafeTarget(el))
        : []
      if (inputs.length >= 2 && inputs[0] === sampleDrawn) buttonWt = inputs[1]
    }
    if (buttonWt && !sampleDrawn) {
      const row = buttonWt.closest('tr, .row, div')
      const inputs = row
        ? Array.from(
            row.querySelectorAll('input:not([type="hidden"]):not([type="button"]):not([type="submit"])'),
          ).filter((el) => ManakFill.visible(el) && !ManakFill.isUnsafeTarget(el))
        : []
      if (inputs.length >= 2 && inputs[1] === buttonWt) sampleDrawn = inputs[0]
    }

    // Final: never treat Button field as Sample
    if (sampleDrawn && buttonWt && sampleDrawn === buttonWt) buttonWt = null

    return {
      sampleDrawn: sampleDrawn && !ManakFill.isUnsafeTarget(sampleDrawn) ? sampleDrawn : null,
      buttonWt: buttonWt && !ManakFill.isUnsafeTarget(buttonWt) ? buttonWt : null,
      section,
    }
  }

  ManakFill.findSaveBeside = function findSaveBeside(input) {
    if (!input) return null
    const row = input.closest('tr') || input.parentElement
    const scopes = [row, row?.parentElement, input.closest('table')].filter(Boolean)
    for (const scope of scopes) {
      const btn = Array.from(scope.querySelectorAll('input[type="button"], input[type="submit"], button')).find(
        (el) => {
          const t = `${el.value || ''} ${el.textContent || ''}`.trim()
          return /^save$/i.test(t) || (/^save$/i.test(t.replace(/\s+/g, '')))
        },
      )
      if (btn) return btn
      const btn2 = Array.from(scope.querySelectorAll('input[type="button"], input[type="submit"], button')).find(
        (el) => {
          const t = `${el.value || ''} ${el.textContent || ''}`
          return /save/i.test(t) && !/initial|cornet|huid/i.test(t)
        },
      )
      if (btn2) return btn2
    }
    return null
  }

  ManakFill.findLotSelect = function findLotSelect(doc) {
    const document = doc || root.document
    const selects = Array.from(document.querySelectorAll('select'))
    const byOptions = selects.find((s) =>
      Array.from(s.options || []).some((o) => /Lot\s*\d+/i.test(String(o.text || o.value || ''))),
    )
    return byOptions || selects.find((s) => /lot/i.test(`${s.id || ''} ${s.name || ''}`)) || null
  }

  /**
   * Assay table: locate by Strip 1 / Fire Assaying, map columns by header text.
   * Returns { m1:[4], silver:[4], copper:[4], lead:[4], m2:[4] }
   */
  ManakFill.collectAssayInputs = function collectAssayInputs(doc) {
    const document = doc || root.document
    const table = Array.from(document.querySelectorAll('table')).find((t) => {
      const tx = t.textContent || ''
      return /Strip\s*1/i.test(tx) && /Initial weight|M1/i.test(tx) && /Silver/i.test(tx)
    })
    if (!table) return { m1: [], silver: [], copper: [], lead: [], m2: [] }

    const headerRow =
      Array.from(table.querySelectorAll('tr')).find((tr) =>
        /Initial weight|M1/i.test(tr.textContent || '') && /Silver/i.test(tr.textContent || ''),
      ) || table.querySelector('tr')

    const headerCells = Array.from(headerRow.querySelectorAll('th, td'))
    const colOf = (re) => {
      let idx = -1
      headerCells.forEach((c, i) => {
        const t = (c.textContent || '').replace(/\s+/g, ' ')
        if (re.test(t)) idx = i
      })
      return idx
    }

    const iM1 = colOf(/Initial weight|\bM1\b/i)
    const iAg = colOf(/Weight of Silver|\bSilver\b/i)
    const iCu = colOf(/Weight of Copper|\bCopper\b/i)
    const iPb = colOf(/Weight of Lead|\bLead\b/i)
    const iM2 = colOf(/cornet after|\bM2\b/i)

    const bodyRows = Array.from(table.querySelectorAll('tr')).filter((tr) => {
      const t = (tr.textContent || '').replace(/\s+/g, ' ')
      return /Strip\s*1|Strip\s*2|C1\s*\(|C2\s*\(|Check\s*Gold/i.test(t)
    })

    // Stable order: Strip1, Strip2, C1, C2
    const ordered = []
    for (const re of [/Strip\s*1/i, /Strip\s*2/i, /C1\s*\(|C1\b/i, /C2\s*\(|C2\b/i]) {
      const row = bodyRows.find((tr) => re.test(tr.textContent || '') && !ordered.includes(tr))
      if (row) ordered.push(row)
    }
    while (ordered.length < 4 && bodyRows[ordered.length]) ordered.push(bodyRows[ordered.length])

    const pick = (tr, col) => {
      if (!tr || col < 0) return null
      const cells = Array.from(tr.querySelectorAll('td'))
      const cell = cells[col]
      if (!cell) {
        // fallback: nth input in row
        const inputs = Array.from(tr.querySelectorAll('input')).filter((el) => !ManakFill.isUnsafeTarget(el))
        return inputs[col > 0 ? col - 1 : 0] || null
      }
      return (
        Array.from(cell.querySelectorAll('input')).find((el) => !ManakFill.isUnsafeTarget(el)) || null
      )
    }

    // If header indices look wrong, fall back to input order per row
    const useFallback = iM1 < 0 || iAg < 0
    if (useFallback) {
      const grid = ordered.map((tr) =>
        Array.from(tr.querySelectorAll('input')).filter((el) => !ManakFill.isUnsafeTarget(el)),
      )
      return {
        m1: grid.map((g) => g[0] || null),
        silver: grid.map((g) => g[1] || null),
        copper: grid.map((g) => g[2] || null),
        lead: grid.map((g) => g[3] || null),
        m2: grid.map((g) => g[4] || null),
      }
    }

    return {
      m1: ordered.map((tr) => pick(tr, iM1)),
      silver: ordered.map((tr) => pick(tr, iAg)),
      copper: ordered.map((tr) => pick(tr, iCu)),
      lead: ordered.map((tr) => pick(tr, iPb)),
      m2: ordered.map((tr) => pick(tr, iM2)),
    }
  }

  ManakFill.clickByText = function clickByText(re, doc) {
    const document = doc || root.document
    const nodes = Array.from(document.querySelectorAll('input[type="button"], input[type="submit"], button, a'))
    const btn = nodes.find((el) => re.test(`${el.value || ''} ${el.textContent || ''}`.replace(/\s+/g, ' ')))
    if (!btn) return false
    btn.click()
    return true
  }

  /**
   * Fill sampling + assay fields for one lot (does not depend on chrome).
   * opts.clickSave — default true
   * opts.afterSampling — optional async hook (for postback simulation)
   */
  ManakFill.fillLot = async function fillLot(sheet, selectText, opts = {}) {
    const document = opts.document || root.document
    const clickSave = opts.clickSave !== false
    const resolved = ManakFill.resolveStripRows(sheet, opts.lot, selectText)
    if (!resolved.rows.length) return { ok: false, error: 'no_matching_lot' }

    const stripRows = resolved.rows
    const drawn = Number(stripRows[0]?.sampleDrawn || 0)
    if (!(drawn > 0)) return { ok: false, error: 'sample_drawn_zero' }

    const { sampleDrawn, buttonWt } = ManakFill.findSamplingInputs(document)
    if (!sampleDrawn) return { ok: false, error: 'sample_drawn_field_missing' }
    if (!buttonWt) return { ok: false, error: 'button_weight_field_missing' }

    // Declared purity must stay untouched
    const purity = document.querySelector('#declaredPurity, [name*="Purity"], .select2-search__field')

    if (!ManakFill.setNativeValue(sampleDrawn, drawn)) return { ok: false, error: 'sample_drawn_set_failed' }
    if (clickSave) {
      const s1 = ManakFill.findSaveBeside(sampleDrawn)
      if (s1) s1.click()
    }
    if (typeof opts.afterSampleSave === 'function') await opts.afterSampleSave()

    if (!ManakFill.setNativeValue(buttonWt, drawn)) return { ok: false, error: 'button_weight_set_failed' }
    if (clickSave) {
      const s2 = ManakFill.findSaveBeside(buttonWt)
      if (s2) s2.click()
    }
    if (typeof opts.afterButtonSave === 'function') await opts.afterButtonSave()

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

    const cols = ManakFill.collectAssayInputs(document)
    let filledM1 = 0
    for (let i = 0; i < 4; i++) {
      if (ManakFill.setNativeValue(cols.m1[i], m1s[i])) filledM1 += 1
      ManakFill.setNativeValue(cols.silver[i], silvers[i])
      ManakFill.setNativeValue(cols.copper[i], coppers[i])
      ManakFill.setNativeValue(cols.lead[i], leads[i])
    }

    if (clickSave) {
      ManakFill.clickByText(/Save\s*\(?\s*Initial\s*Weight\s*\)?/i, document) ||
        ManakFill.clickByText(/Initial\s*Weight/i, document)
    }

    // M2 only if unlocked
    const m2Open = cols.m2.some((el) => el && !el.disabled && !el.readOnly)
    if (m2Open) {
      cols.m2.forEach((el, i) => ManakFill.setNativeValue(el, m2s[i]))
      if (clickSave) {
        ManakFill.clickByText(/Save\s*\(?\s*Cornet\s*Weight\s*\)?/i, document)
      }
    }

    const purityVal = purity && 'value' in purity ? purity.value : null
    return {
      ok: true,
      filledM1,
      drawn,
      lotNum: resolved.lotNum,
      jobCard: resolved.jobCard,
      sampleDrawnValue: sampleDrawn.value,
      buttonWtValue: buttonWt.value,
      m1Values: cols.m1.map((el) => el?.value),
      silverValues: cols.silver.map((el) => el?.value),
      purityUntouched: purityVal == null || purityVal === '' || purityVal === '916',
      m2Pending: !m2Open,
      m2Values: m2s,
    }
  }

  root.ManakFill = ManakFill
  if (typeof module !== 'undefined' && module.exports) module.exports = ManakFill
})(typeof globalThis !== 'undefined' ? globalThis : window)
