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
   * Live Manak (huid.manakonline.in) opens Web Serial from PAGE JS when a weight
   * field is clicked/activated during a user-gesture window (Phase 1 button click).
   * The chooser says "huid.manakonline.in wants to connect to a serial port".
   * This extension never calls the Web Serial API — but click()/focus()/Enter on
   * those fields forwards the gesture to the portal's serial-port chooser handler.
   *
   * Legitimate path: assign the posted value without activating the field, then
   * click the existing Save. Wait until transient user activation has expired
   * so a Save handler cannot open the chooser either.
   */
  ManakFill.SCAN_WEIGHT_MODE = 'posted-value-no-serial-gesture'
  ManakFill.SERIAL_API_USED = false

  ManakFill.syncScanHiddenFields = function syncScanHiddenFields(el, value) {
    if (!el) return
    const v = String(value)
    const doc = el.ownerDocument || root.document
    const seen = new Set()
    const apply = (h) => {
      if (!h || seen.has(h) || h === el) return
      seen.add(h)
      h.value = v
      try {
        h.setAttribute('value', v)
      } catch {
        /* ignore */
      }
    }
    const id = el.id || ''
    const name = el.name || ''
    if (id && doc.getElementById) {
      apply(doc.getElementById(`hdn${id}`))
      apply(doc.getElementById(`${id}_hidden`))
      apply(doc.getElementById(`hdn${id.replace(/^txt/i, '')}`))
    }
    if (name) {
      try {
        apply(doc.querySelector(`input[type="hidden"][name="${name}"]`))
      } catch {
        /* ignore */
      }
    }
    const cell = el.closest?.('td, th') || el.parentElement
    if (cell) {
      Array.from(cell.querySelectorAll('input[type="hidden"]')).forEach(apply)
    }
  }

  /**
   * Assign a weight for ASP.NET postback WITHOUT activating the portal's
   * Web Serial path: no focus, no element.click(), no keydown/Enter.
   */
  ManakFill.setPostedWeight = function setPostedWeight(el, value) {
    if (!el || value == null || value === '') return false
    if (ManakFill.isUnsafeTarget(el)) return false
    const num = Number(value)
    if (!(num > 0) && num !== 0) return false
    const v = Number.isInteger(num) ? String(num) : Number(num).toFixed(3)
    try {
      el.removeAttribute('readonly')
      el.removeAttribute('disabled')
      el.readOnly = false
      if (el.disabled) el.disabled = false
    } catch {
      /* ignore */
    }
    const proto = el.tagName === 'TEXTAREA' ? root.HTMLTextAreaElement.prototype : root.HTMLInputElement.prototype
    const desc = Object.getOwnPropertyDescriptor(proto, 'value')
    if (desc && desc.set) desc.set.call(el, v)
    else el.value = v
    try {
      el.defaultValue = v
      el.setAttribute('value', v)
    } catch {
      /* ignore */
    }
    ManakFill.syncScanHiddenFields(el, v)
    el.dispatchEvent(new root.Event('input', { bubbles: true }))
    el.dispatchEvent(new root.Event('change', { bubbles: true }))
    try {
      if (root.jQuery) root.jQuery(el).val(v).trigger('input').trigger('change')
    } catch {
      /* ignore */
    }
    try {
      el.dataset.shrijaWeight = 'posted'
    } catch {
      /* ignore */
    }
    return Math.abs(Number(el.value) - num) < 0.05
  }

  /**
   * The serial chooser is only allowed while transient user activation is live.
   * Phase 1/2 buttons grant that window; wait it out before touching portal controls.
   */
  ManakFill.waitUntilSerialGestureExpired = async function waitUntilSerialGestureExpired(opts = {}) {
    const max = opts.activationWaitMs != null ? opts.activationWaitMs : 5500
    if (!(max > 0)) return 'skipped'
    const document = opts.document || root.document
    const nav = (document && document.defaultView && document.defaultView.navigator) || root.navigator
    const start = Date.now()
    try {
      if (!nav || !nav.userActivation) {
        await ManakFill.delay(max)
        return 'no-api'
      }
      while (nav.userActivation.isActive && Date.now() - start < max) {
        await ManakFill.delay(50)
      }
    } catch {
      /* ignore */
    }
    return 'cleared'
  }

  /** @deprecated Live Manak serial is triggered by field click/Enter. Use setPostedWeight. */
  ManakFill.setByScanWeight = async function setByScanWeight(el, value) {
    return ManakFill.setPostedWeight(el, value)
  }

  ManakFill.dispatchScanChar = function dispatchScanChar() {
    return false
  }

  ManakFill.forceSetWeight = async function forceSetWeight(el, value, attempts = 3, opts = {}) {
    if (!el) return false
    const v = Number(value)
    if (!(v > 0)) return false
    const cur = Number(el.value || 0)
    if (!opts.force && opts.skipIfFilled !== false && cur > 0.01) {
      return true
    }
    for (let i = 0; i < attempts; i++) {
      if (ManakFill.setPostedWeight(el, v)) return true
      await ManakFill.delay(80)
    }
    return Math.abs(Number(el.value) - v) < 0.05
  }

  /**
   * Wait for ASP.NET UpdatePanel / sampling Save postback — not BIS furnace timing.
   * Hook names: afterSampleSave | afterButtonSave
   */
  ManakFill.waitForWeightPostback = async function waitForWeightPostback(opts = {}, hookName) {
    if (hookName && typeof opts[hookName] === 'function') {
      await opts[hookName]()
      return 'hook'
    }
    const document = opts.document || root.document
    const win = (document && document.defaultView) || root
    try {
      const prm =
        win.Sys &&
        win.Sys.WebForms &&
        win.Sys.WebForms.PageRequestManager &&
        typeof win.Sys.WebForms.PageRequestManager.getInstance === 'function' &&
        win.Sys.WebForms.PageRequestManager.getInstance()
      if (prm && typeof prm.add_endRequest === 'function') {
        await new Promise((resolve) => {
          const ms = opts.postbackTimeoutMs != null ? opts.postbackTimeoutMs : 5000
          const t = setTimeout(resolve, ms)
          const handler = function () {
            try {
              prm.remove_endRequest(handler)
            } catch {
              /* ignore */
            }
            clearTimeout(t)
            resolve()
          }
          try {
            prm.add_endRequest(handler)
          } catch {
            clearTimeout(t)
            resolve()
          }
        })
        await ManakFill.delay(80)
        return 'updatepanel'
      }
    } catch {
      /* ignore */
    }
    const wait = opts.postbackWaitMs != null ? opts.postbackWaitMs : 400
    if (wait > 0) await ManakFill.delay(wait)
    return 'delay'
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

  ManakFill.sheetFilledRows = function sheetFilledRows(sheet) {
    const filled = (sheet.rows || []).filter((r) => r.jobCardNo || r.manakJobCard)
    const fromView = (sheet.viewRows || []).filter((r) => r.jobCardNo || r.manakJobCard)
    return filled.length ? filled : fromView
  }

  ManakFill.rowManakJob = function rowManakJob(r) {
    return String(r.manakJobCard || ManakFill.parseShrijaJob(r.jobCardNo).card || '')
  }

  ManakFill.rowMatchesJob = function rowMatchesJob(r, jobCard) {
    if (!jobCard) return false
    const want = String(jobCard)
    const card = ManakFill.rowManakJob(r)
    return card === want || String(r.jobCardNo || '').includes(want)
  }

  ManakFill.rowMatchesLot = function rowMatchesLot(r, lotNum) {
    if (lotNum == null || Number.isNaN(Number(lotNum))) return false
    const n = Number(lotNum)
    if (Number(r.lotNo) === n) return true
    return ManakFill.parseShrijaJob(r.jobCardNo).lot === n
  }

  /**
   * Strict Job Card + Lot lookup. Never falls back to first row / first lot / another job.
   * Used by Phase 2 (M2). Empty rows if either key is missing or no pair matches.
   */
  ManakFill.resolveStripRowsByJobAndLot = function resolveStripRowsByJobAndLot(sheet, jobCard, lotNum) {
    const allRows = ManakFill.sheetFilledRows(sheet)
    const card = String(jobCard || '').trim()
    const lot = lotNum != null && lotNum !== '' ? Number(lotNum) : NaN
    if (!card || Number.isNaN(lot)) {
      return { rows: [], lotNum: Number.isNaN(lot) ? null : lot, jobCard: card, error: 'job_and_lot_required' }
    }
    const pair = allRows.filter((r) => ManakFill.rowMatchesJob(r, card) && ManakFill.rowMatchesLot(r, lot))
    if (pair.length >= 2) return { rows: pair.slice(0, 2), lotNum: lot, jobCard: card }
    if (pair.length === 1) return { rows: pair, lotNum: lot, jobCard: card }
    return { rows: [], lotNum: lot, jobCard: card, error: 'no_matching_job_lot' }
  }

  /** Stale shrija-manak-m2-pending must never auto-apply to the current (or any) Job/Lot. */
  ManakFill.ignoreM2Pending = function ignoreM2Pending(_pending, _currentJob, _currentLot) {
    return true
  }

  ManakFill.resolveStripRows = function resolveStripRows(sheet, preferredLot, selectText) {
    const allRows = ManakFill.sheetFilledRows(sheet)
    const fromOpt = ManakFill.parseLotOptionText(selectText)
    const lotNum = preferredLot != null ? Number(preferredLot) : fromOpt.lot
    const jobCard = fromOpt.jobCard || ''

    // When both Job and Lot are known, use that pair — not the first two rows of the job.
    if (jobCard && lotNum != null && !Number.isNaN(Number(lotNum))) {
      const byBoth = ManakFill.resolveStripRowsByJobAndLot(sheet, jobCard, lotNum)
      if (byBoth.rows.length) return byBoth
    }

    if (jobCard) {
      const byCard = allRows.filter((r) => ManakFill.rowMatchesJob(r, jobCard))
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
    const isSave = (el) => {
      const t = `${el.value || ''} ${el.textContent || ''}`.replace(/\s+/g, ' ').trim()
      if (!t) return false
      if (/initial|cornet|huid/i.test(t)) return false
      return /^save$/i.test(t)
    }
    const following = (anchor, el) => {
      const pos = anchor.compareDocumentPosition(el)
      return Boolean(pos & Node.DOCUMENT_POSITION_FOLLOWING)
    }

    // 1) Immediate following siblings / next cells (Sample Drawn SAVE vs Button SAVE on the same row)
    let sib = input.nextElementSibling
    for (let i = 0; i < 8 && sib; i++) {
      if (isSave(sib)) return sib
      const inner = sib.querySelector?.('input[type="button"], input[type="submit"], button')
      if (inner && isSave(inner) && following(input, inner)) return inner
      const tip = (sib.textContent || '').replace(/\s+/g, ' ')
      if (/Button Weight|Sample Drawn/i.test(tip) && tip.length < 80 && !sib.querySelector('input[type="button"], button')) {
        // Hit the other sampling label — stop sibling walk; document-order search below still runs
        break
      }
      sib = sib.nextElementSibling
    }

    const row = input.closest('tr') || input.parentElement
    const scopes = [row, row?.parentElement, input.closest('table')].filter(Boolean)
    for (const scope of scopes) {
      const buttons = Array.from(scope.querySelectorAll('input[type="button"], input[type="submit"], button')).filter(
        isSave,
      )
      const next = buttons.find((btn) => following(input, btn))
      if (next) return next
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

    // Combined fillLot is Phase 1 only — never auto-fill M2 / Save Cornet.
    const purityVal = purity && 'value' in purity ? purity.value : null
    return {
      ok: true,
      phase: 1,
      filledM1,
      drawn,
      lotNum: resolved.lotNum,
      jobCard: resolved.jobCard,
      sampleDrawnValue: sampleDrawn.value,
      buttonWtValue: buttonWt.value,
      m1Values: cols.m1.map((el) => el?.value),
      silverValues: cols.silver.map((el) => el?.value),
      purityUntouched: purityVal == null || purityVal === '' || purityVal === '916',
      filledM2: false,
      clickedSaveInitial: Boolean(clickSave),
      clickedSaveCornet: false,
      m2Pending: false,
      m2Values: cols.m2.map((el) => el?.value),
    }
  }

  async function setPhaseWeight(el, value) {
    if (!el || value == null || value === '') return false
    return ManakFill.setPostedWeight(el, value)
  }

  function phase1Fail(error, message, extra = {}) {
    return {
      ok: false,
      phase: 1,
      error,
      message,
      filledM2: false,
      clickedSaveInitial: false,
      clickedSaveCornet: false,
      startedPhase2: false,
      ...extra,
    }
  }

  /**
   * Phase 1: post Sample Drawn + Save, post Button Weight + Save, then M1 / Silver / Copper / Lead.
   * Never activates weight fields (click/focus/Enter) — that opens BIS Web Serial.
   * Never fills M2. Never clicks Save Initial Weight or Save Cornet Weight.
   */
  ManakFill.fillPhase1 = async function fillPhase1(sheet, selectText, opts = {}) {
    const document = opts.document || root.document
    const startAt = opts.startAt || 'sample'
    const resolved = ManakFill.resolveStripRows(sheet, opts.lot, selectText)
    if (!resolved.rows.length) return phase1Fail('no_matching_lot', 'No matching Job + Lot')

    const stripRows = resolved.rows
    const drawn = Number(opts.drawn != null ? opts.drawn : stripRows[0]?.sampleDrawn || 0)
    if (!(drawn > 0)) return phase1Fail('sample_drawn_zero', 'Sample Drawn Weight was not accepted by BIS portal.')

    let { sampleDrawn, buttonWt } = ManakFill.findSamplingInputs(document)
    if (!sampleDrawn) return phase1Fail('sample_drawn_field_missing', 'Sample Drawn Weight was not accepted by BIS portal.')
    if (!buttonWt) return phase1Fail('button_weight_field_missing', 'Button Weight was not accepted by BIS portal.')
    if (sampleDrawn === buttonWt) return phase1Fail('sample_button_same_field', 'Sample Drawn Weight was not accepted by BIS portal.')

    let clickedSampleSave = false
    let clickedButtonSave = false

    await ManakFill.waitUntilSerialGestureExpired(opts)

    if (startAt === 'sample') {
      if (!ManakFill.setPostedWeight(sampleDrawn, drawn)) {
        return phase1Fail('sample_drawn_not_accepted', 'Sample Drawn Weight was not accepted by BIS portal.')
      }
      const s1 = ManakFill.findSaveBeside(sampleDrawn)
      if (!s1) {
        return phase1Fail('sample_drawn_save_missing', 'Sample Drawn Weight was not accepted by BIS portal.')
      }
      if (typeof opts.onBeforeSampleSaveClick === 'function') await opts.onBeforeSampleSaveClick()
      s1.click()
      clickedSampleSave = true
      await ManakFill.waitForWeightPostback(opts, 'afterSampleSave')
      const afterDrawn = ManakFill.findSamplingInputs(document)
      sampleDrawn = afterDrawn.sampleDrawn
      buttonWt = afterDrawn.buttonWt
      if (!sampleDrawn || Number(sampleDrawn.value) < 0.01) {
        return phase1Fail('sample_drawn_not_accepted', 'Sample Drawn Weight was not accepted by BIS portal.', {
          clickedSampleSave: true,
        })
      }
    } else if (startAt === 'button') {
      if (!sampleDrawn || Number(sampleDrawn.value) < 0.01) {
        return phase1Fail('sample_drawn_not_accepted', 'Sample Drawn Weight was not accepted by BIS portal.')
      }
    } else if (startAt === 'm1') {
      if (!sampleDrawn || Number(sampleDrawn.value) < 0.01) {
        return phase1Fail('sample_drawn_not_accepted', 'Sample Drawn Weight was not accepted by BIS portal.')
      }
      if (!buttonWt || Number(buttonWt.value) < 0.01) {
        return phase1Fail('button_weight_not_accepted', 'Button Weight was not accepted by BIS portal.')
      }
    }

    if (startAt === 'sample' || startAt === 'button') {
      if (!buttonWt) {
        const found = ManakFill.findSamplingInputs(document)
        buttonWt = found.buttonWt
        sampleDrawn = found.sampleDrawn || sampleDrawn
      }
      if (!buttonWt) {
        return phase1Fail('button_weight_field_missing', 'Button Weight was not accepted by BIS portal.', {
          clickedSampleSave,
        })
      }
      if (!ManakFill.setPostedWeight(buttonWt, drawn)) {
        return phase1Fail('button_weight_not_accepted', 'Button Weight was not accepted by BIS portal.', {
          clickedSampleSave,
        })
      }
      const s2 = ManakFill.findSaveBeside(buttonWt)
      if (!s2) {
        return phase1Fail('button_weight_save_missing', 'Button Weight was not accepted by BIS portal.', {
          clickedSampleSave,
        })
      }
      if (typeof opts.onBeforeButtonSaveClick === 'function') await opts.onBeforeButtonSaveClick()
      s2.click()
      clickedButtonSave = true
      await ManakFill.waitForWeightPostback(opts, 'afterButtonSave')
      const afterBtn = ManakFill.findSamplingInputs(document)
      sampleDrawn = afterBtn.sampleDrawn || sampleDrawn
      buttonWt = afterBtn.buttonWt || buttonWt
      if (!buttonWt || Number(buttonWt.value) < 0.01) {
        return phase1Fail('button_weight_not_accepted', 'Button Weight was not accepted by BIS portal.', {
          clickedSampleSave,
          clickedButtonSave: true,
        })
      }
    }

    const sampling = ManakFill.findSamplingInputs(document)
    sampleDrawn = sampling.sampleDrawn || sampleDrawn
    buttonWt = sampling.buttonWt || buttonWt

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
    const m1Names = ['M1 Strip 1', 'M1 Strip 2', 'Check Gold C1', 'Check Gold C2']
    const agNames = ['Silver Strip 1', 'Silver Strip 2', 'Silver C1', 'Silver C2']
    const cuNames = ['Copper Strip 1', 'Copper Strip 2', 'Copper C1', 'Copper C2']
    const pbNames = ['Lead Strip 1', 'Lead Strip 2', 'Lead C1', 'Lead C2']

    const cols = ManakFill.collectAssayInputs(document)
    const m2Before = cols.m2.map((el) => el?.value)
    let filledM1 = 0
    for (let i = 0; i < 4; i++) {
      if (!(await setPhaseWeight(cols.m1[i], m1s[i]))) {
        return phase1Fail('m1_set_failed', `${m1Names[i]} could not be filled.`, {
          failedField: m1Names[i],
          clickedSampleSave,
          clickedButtonSave,
        })
      }
      filledM1 += 1
      if (!(await setPhaseWeight(cols.silver[i], silvers[i]))) {
        return phase1Fail('silver_set_failed', `${agNames[i]} could not be filled.`, {
          failedField: agNames[i],
          clickedSampleSave,
          clickedButtonSave,
        })
      }
      if (Number(coppers[i]) > 0) {
        if (!(await setPhaseWeight(cols.copper[i], coppers[i]))) {
          return phase1Fail('copper_set_failed', `${cuNames[i]} could not be filled.`, {
            failedField: cuNames[i],
            clickedSampleSave,
            clickedButtonSave,
          })
        }
      } else if (cols.copper[i] && !ManakFill.setPostedWeight(cols.copper[i], coppers[i])) {
        return phase1Fail('copper_set_failed', `${cuNames[i]} could not be filled.`, {
          failedField: cuNames[i],
          clickedSampleSave,
          clickedButtonSave,
        })
      }
      if (!(await setPhaseWeight(cols.lead[i], leads[i]))) {
        return phase1Fail('lead_set_failed', `${pbNames[i]} could not be filled.`, {
          failedField: pbNames[i],
          clickedSampleSave,
          clickedButtonSave,
        })
      }
    }

    const m2After = cols.m2.map((el) => el?.value)
    const m2Unchanged = m2Before.every((v, i) => String(v ?? '') === String(m2After[i] ?? ''))

    return {
      ok: true,
      phase: 1,
      filledM1,
      drawn,
      lotNum: resolved.lotNum,
      jobCard: resolved.jobCard,
      sampleDrawnValue: sampleDrawn?.value,
      buttonWtValue: buttonWt?.value,
      m1Values: cols.m1.map((el) => el?.value),
      silverValues: cols.silver.map((el) => el?.value),
      copperValues: cols.copper.map((el) => el?.value),
      leadValues: cols.lead.map((el) => el?.value),
      filledM2: false,
      m2Unchanged,
      m2Values: m2After,
      clickedSampleSave,
      clickedButtonSave,
      clickedSaveInitial: false,
      clickedSaveCornet: false,
      startedPhase2: false,
      usedScanForSample: false,
      usedScanForButton: false,
      usedPostedWeight: true,
    }
  }

  /**
   * Phase 2: M2 / cornet after assaying only, resolved by Job Card + Lot.
   * Same posted-value path as Phase 1 — no field click/Enter (no serial chooser).
   * Never fills Phase 1 fields. Never clicks Save Cornet Weight.
   */
  ManakFill.fillPhase2 = async function fillPhase2(sheet, selectText, opts = {}) {
    const document = opts.document || root.document
    const fromOpt = ManakFill.parseLotOptionText(selectText)
    const lotNum = opts.lot != null && opts.lot !== '' ? Number(opts.lot) : fromOpt.lot
    const jobCard = String(opts.jobCard || fromOpt.jobCard || '').trim()
    const resolved = ManakFill.resolveStripRowsByJobAndLot(sheet, jobCard, lotNum)
    if (!resolved.rows.length) {
      return { ok: false, phase: 2, error: resolved.error || 'no_matching_job_lot', lotNum, jobCard }
    }

    const stripRows = resolved.rows
    const cg = sheet.cg || {}
    const m2s = [stripRows[0]?.wotgcaa, stripRows[1]?.wotgcaa, cg.wotgcaa1, cg.wotgcaa2]
    const m2Names = ['M2 Strip 1', 'M2 Strip 2', 'M2 C1', 'M2 C2']
    const cols = ManakFill.collectAssayInputs(document)
    const m1Before = cols.m1.map((el) => el?.value)
    const silverBefore = cols.silver.map((el) => el?.value)

    await ManakFill.waitUntilSerialGestureExpired(opts)

    let filledM2 = 0
    for (let i = 0; i < 4; i++) {
      if (!cols.m2[i]) {
        return {
          ok: false,
          phase: 2,
          error: 'm2_field_missing',
          failedField: m2Names[i],
          message: `${m2Names[i]} input cannot be accepted.`,
          lotNum: resolved.lotNum,
          jobCard: resolved.jobCard,
          clickedSaveCornet: false,
        }
      }
      const ok = ManakFill.setPostedWeight(cols.m2[i], m2s[i])
      if (!ok) {
        return {
          ok: false,
          phase: 2,
          error: 'm2_not_accepted',
          failedField: m2Names[i],
          message: `${m2Names[i]} input cannot be accepted.`,
          lotNum: resolved.lotNum,
          jobCard: resolved.jobCard,
          clickedSaveCornet: false,
        }
      }
      filledM2 += 1
    }

    const m1After = cols.m1.map((el) => el?.value)
    const phase1Untouched =
      m1Before.every((v, i) => String(v ?? '') === String(m1After[i] ?? '')) &&
      silverBefore.every((v, i) => String(v ?? '') === String(cols.silver[i]?.value ?? ''))

    return {
      ok: true,
      phase: 2,
      filledM2,
      lotNum: resolved.lotNum,
      jobCard: resolved.jobCard,
      m2Intended: m2s,
      m2Values: cols.m2.map((el) => el?.value),
      m1Values: m1After,
      phase1Untouched,
      clickedSaveInitial: false,
      clickedSaveCornet: false,
      usedScanForM2: false,
      usedPostedWeight: true,
    }
  }

  root.ManakFill = ManakFill
  if (typeof module !== 'undefined' && module.exports) module.exports = ManakFill
})(typeof globalThis !== 'undefined' ? globalThis : window)
