/**
 * Runs in the PAGE main world (manifest world: MAIN + scripting.executeScript).
 * Isolated content scripts cannot see or override portal JS (isScaleCaptured, alert, __doPostBack).
 */
(function (window) {
  var document = window.document
  function lockTrue(name) {
    try {
      Object.defineProperty(window, name, {
        configurable: true,
        enumerable: true,
        get: function () {
          return true
        },
        set: function () {
          /* portal must not clear the scale flag */
        },
      })
    } catch (e) {
      try {
        window[name] = true
      } catch (e2) {
        /* ignore */
      }
    }
  }

  function applyGlobalScaleFlags() {
    lockTrue('isScaleCaptured')
    lockTrue('isCaptured')
    lockTrue('isScaleRead')
    lockTrue('scaleCaptured')
    lockTrue('isCornetCaptured')
    lockTrue('isM2Captured')
    lockTrue('isScanCaptured')
    lockTrue('isWeightCaptured')
    lockTrue('Page_IsValid')
    lockAlwaysTrueFn('Page_ClientValidate')
    lockAlwaysTrueFn('ValidatorOnSubmit')
    lockAlwaysTrueFn('ValidatorValidate')
    try {
      window.Page_BlockSubmit = false
      window.Page_ValidationActive = false
    } catch (e) {
      /* ignore */
    }
    if (Array.isArray(window.arrCaptured)) {
      for (let i = 0; i < window.arrCaptured.length; i++) window.arrCaptured[i] = true
    }
    if (window.scaleCapturedFlags && typeof window.scaleCapturedFlags === 'object') {
      for (const k in window.scaleCapturedFlags) window.scaleCapturedFlags[k] = true
    }
    if (window.capturedStatus && typeof window.capturedStatus === 'object') {
      for (const k in window.capturedStatus) window.capturedStatus[k] = true
    }
    try {
      Object.getOwnPropertyNames(window).forEach(function (n) {
        const v = window[n]
        if (!Array.isArray(v) || !/captur|scale|m2|cornet/i.test(n)) return
        for (let i = 0; i < v.length; i++) v[i] = true
      })
    } catch (e3) {
      /* ignore */
    }
  }

  function lockAlwaysTrueFn(name) {
    try {
      Object.defineProperty(window, name, {
        configurable: true,
        enumerable: true,
        get: function () {
          return function () {
            window.Page_IsValid = true
            window.Page_BlockSubmit = false
            return true
          }
        },
        set: function () {
          /* portal must not restore validators */
        },
      })
    } catch (e) {
      stubFn(window, name)
    }
  }

  function isFlagHidden(h) {
    const idName = `${h.id || ''} ${h.name || ''}`
    return /captur|scale|flag|valid|status|isscale|fromscale|readscale|isread|scanned|m2captur|capturedm2|cornetflag|hfcornet/i.test(idName)
  }

  function setCapturedFlagValue(h) {
    const v = String(h.value || '').trim()
    if (v === '0' || v === '1') h.value = '1'
    else h.value = 'True'
  }

  function isPortalSaveHandlerName(name) {
    return /^(checkforremarks|savecornetvalues|saveCornetValues|saveinitialvalues|saveInitialValues)$/i.test(
      String(name || ''),
    ) || /^save(cornet|initial)/i.test(String(name || ''))
  }

  function stubFn(obj, name) {
    if (!obj || typeof obj[name] !== 'function' || obj[name].__shrijaBypassed) return
    if (name === '__doPostBack' || name === 'WebForm_DoPostBackWithOptions') return
    if (isPortalSaveHandlerName(name)) return
    obj[name] = function () {
      window.Page_IsValid = true
      window.Page_BlockSubmit = false
      return true
    }
    obj[name].__shrijaBypassed = true
  }

  function disableAllValidators() {
    if (Array.isArray(window.Page_Validators)) {
      window.Page_Validators.forEach(function (v) {
        if (!v) return
        v.isvalid = true
        v.enabled = false
      })
    }
    window.Page_IsValid = true
    window.Page_BlockSubmit = false
    window.Page_ValidationActive = false
  }

  function neutralizeFormSubmit() {
    disableAllValidators()
    Array.prototype.forEach.call(document.forms || [], function (form) {
      try {
        form.onsubmit = function () {
          return true
        }
      } catch (e) {
        /* ignore */
      }
    })
  }

  function wrapDoPostBackWithOptions() {
    if (typeof window.WebForm_DoPostBackWithOptions !== 'function') return
    if (window.WebForm_DoPostBackWithOptions.__shrijaBypassed) return
    const orig = window.WebForm_DoPostBackWithOptions
    window.WebForm_DoPostBackWithOptions = function (options) {
      applyGlobalScaleFlags()
      window.Page_IsValid = true
      window.Page_BlockSubmit = false
      window.Page_ValidationActive = false
      if (options) {
        try {
          options.validation = false
        } catch (e) {
          /* ignore */
        }
      }
      return orig.apply(this, arguments)
    }
    window.WebForm_DoPostBackWithOptions.__shrijaBypassed = true
  }

  function wrapDoPostBack() {
    if (typeof window.__doPostBack !== 'function') return
    if (window.__doPostBack.__shrijaBypassed) return
    const orig = window.__doPostBack
    window.__doPostBack = function (eventTarget, eventArgument) {
      applyGlobalScaleFlags()
      neutralizeFormSubmit()
      return orig.apply(this, arguments)
    }
    window.__doPostBack.__shrijaBypassed = true
  }

  function overrideValidationFuncs() {
    applyGlobalScaleFlags()
    wrapDoPostBackWithOptions()
    wrapDoPostBack()

    if (typeof window.Page_ClientValidate === 'function' && !window.__shrijaPageValidateLocked) {
      try {
        Object.defineProperty(window, 'Page_ClientValidate', {
          configurable: true,
          enumerable: true,
          get: function () {
            return function () {
              window.Page_IsValid = true
              window.Page_BlockSubmit = false
              return true
            }
          },
          set: function () {
            /* ignore portal reassignment after UpdatePanel */
          },
        })
        window.__shrijaPageValidateLocked = true
      } catch (e) {
        stubFn(window, 'Page_ClientValidate')
      }
    }

    stubFn(window, 'ValidatorValidate')
    stubFn(window, 'ValidatorOnSubmit')
    stubFn(window, 'WebForm_OnSubmit')
    stubFn(window, 'Page_ClientValidate')

    if (Array.isArray(window.Page_Validators)) {
      window.Page_Validators.forEach(function (v) {
        if (!v) return
        v.isvalid = true
        v.enabled = false
      })
    }

    const names = [
      'validateScaleCaptured',
      'chkScaleCaptured',
      'checkScaleCaptured',
      'validateInitialWeight',
      'validateAssayForm',
      'checkInitialWeight',
      'ValidateSave',
      'validateInitial',
      'validateScaleWeight',
      'chkScaleWeight',
      'checkScale',
      'validateScale',
      'validateAssay',
      'chkAssay',
      'chkInitial',
      'chkScale',
      'ValidateForm',
      'validateSampleDrawn',
      'validateButtonWeight',
      'CheckScale',
      'checkScaleStatus',
      'IsScaleCaptured',
      'ValidateC1',
      'ValidateC2',
      'validateCheckGold',
      'chkCheckGold',
      'validateCG',
      'CheckGoldValidate',
      'validateCornet',
      'validateCornetWeight',
      'validateM2',
      'chkCornet',
      'chkM2',
      'checkCornet',
      'checkCornetWeight',
      'IsCornetCaptured',
      'isCornetCaptured',
      'CheckCornetWeight',
      'ValidateCornetWeight',
      'CheckM2',
      'ValidateM2',
      'ValidateScanWeight',
      'checkScanWeight',
    ]
    names.forEach(function (fn) {
      stubFn(window, fn)
    })

    try {
      Object.getOwnPropertyNames(window).forEach(function (n) {
        if (typeof window[n] !== 'function') return
        if (window[n].__shrijaBypassed) return
        if (isPortalSaveHandlerName(n)) return
        if (/^(WebForm_|Sys$|jQuery|\$|__doPostBack)/.test(n)) return
        if (!/^(validate|Validate|chk|Chk|check|Check|IsScale|isScale)/.test(n) && !/ScaleCaptured|InitialWeight|AssayForm|CheckGold|Cornet|M2/.test(n)) {
          return
        }
        stubFn(window, n)
      })
    } catch (e) {
      /* ignore */
    }
  }

  function markAllInputsCaptured() {
    applyGlobalScaleFlags()
    const inputs = document.querySelectorAll('input:not([type="hidden"])')
    inputs.forEach(function (el) {
      const idNameClass = `${el.id || ''} ${el.name || ''} ${el.className || ''} ${el.placeholder || ''}`
      if (!/txt|m1|m2|silver|copper|lead|initial|weight|sample|button|cg|check|cornet/i.test(idNameClass)) return
      const keepDisabled = /m2|cornet/i.test(idNameClass) && (el.disabled || el.hasAttribute('disabled'))
      try {
        if (!keepDisabled) {
          el.removeAttribute('readonly')
          el.removeAttribute('disabled')
          el.readOnly = false
          el.disabled = false
        }
      } catch (e) {
        /* ignore */
      }
      el.setAttribute('is-scale', 'true')
      el.setAttribute('is-captured', 'true')
      el.setAttribute('scale-captured', 'true')
      el.setAttribute('data-is-captured', 'true')
      el.setAttribute('data-scale-captured', 'true')
      el.setAttribute('data-scale', '1')
      el.setAttribute('data-source', 'scale')
      if (el.dataset) {
        el.dataset.isCaptured = 'true'
        el.dataset.scaleCaptured = 'true'
        el.dataset.scale = '1'
        el.dataset.source = 'scale'
      }
      const cell = el.closest && el.closest('td, th, tr')
      if (!cell) return
      cell.querySelectorAll('input[type="hidden"]').forEach(function (h) {
        h.setAttribute('is-captured', 'true')
        if (h.dataset) h.dataset.isCaptured = 'true'
        const raw = String(h.value || '').trim()
        if (isFlagHidden(h) || /^(0|1|true|false|yes|no)$/i.test(raw)) setCapturedFlagValue(h)
        else if (el.value && Number(el.value) > 0) h.value = el.value
      })
    })

    document.querySelectorAll('input[type="hidden"]').forEach(function (h) {
      if (!isFlagHidden(h)) return
      h.setAttribute('is-captured', 'true')
      if (h.dataset) h.dataset.isCaptured = 'true'
      setCapturedFlagValue(h)
    })
  }

  function sourceOfOnclick(btn) {
    const attr = btn.getAttribute && btn.getAttribute('onclick')
    if (attr) return attr
    if (typeof btn.onclick === 'function') {
      try {
        return Function.prototype.toString.call(btn.onclick)
      } catch (e) {
        return ''
      }
    }
    return ''
  }

  function postbackFromSource(src) {
    if (!src) return null
    const m =
      /__doPostBack\s*\(\s*'([^']*)'\s*,\s*'([^']*)'\s*\)/.exec(src) ||
      /__doPostBack\s*\(\s*"([^"]*)"\s*,\s*"([^"]*)"\s*\)/.exec(src) ||
      /WebForm_PostBackOptions\s*\(\s*'([^']*)'\s*,\s*'([^']*)'/.exec(src) ||
      /WebForm_PostBackOptions\s*\(\s*"([^"]*)"\s*,\s*"([^"]*)"/.exec(src)
    if (!m) return null
    return { target: m[1], arg: m[2] }
  }

  function forceBarePostback(btn) {
    if (!btn) return null
    const src = sourceOfOnclick(btn) + ' ' + ((btn.getAttribute && btn.getAttribute('href')) || '')
    const pb = postbackFromSource(src)
    let target = pb && pb.target
    if (!target || /shrija/i.test(String(target))) {
      target = btn.name && !/^shrija/i.test(String(btn.name)) ? btn.name : ''
    }
    const arg = (pb && pb.arg) || ''
    if (!target) return null
    const call = `__doPostBack('${target}','${arg}')`
    try {
      btn.setAttribute('onclick', call)
    } catch (e) {
      /* ignore */
    }
    if (btn.getAttribute && /javascript/i.test(btn.getAttribute('href') || '')) {
      try {
        btn.setAttribute('href', 'javascript:' + call)
      } catch (e2) {
        /* ignore */
      }
    }
    btn.onclick = function () {
      window.Page_IsValid = true
      window.Page_BlockSubmit = false
      window.Page_ValidationActive = false
      if (typeof window.__doPostBack === 'function') window.__doPostBack(target, arg)
      return true
    }
    return { target: target, arg: arg }
  }

  function stripScaleCheckFromOnclick(btn) {
    if (!btn) return
    const src = sourceOfOnclick(btn)
    if (!src) return
    if (!/unauthorized|scale|captured|validate|CheckScale|isScale|isCaptured|Page_ClientValidate|WebForm_DoPostBackWithOptions|cornet|m2/i.test(src)) {
      return
    }
    const pb = postbackFromSource(src)
    if (!pb) return
    const call = `__doPostBack('${pb.target}','${pb.arg}')`
    try {
      btn.setAttribute('onclick', call)
    } catch (e) {
      /* ignore */
    }
    btn.onclick = function () {
      window.Page_IsValid = true
      window.Page_BlockSubmit = false
      window.Page_ValidationActive = false
      if (typeof window.__doPostBack === 'function') window.__doPostBack(pb.target, pb.arg)
      return true
    }
  }

  function isJsCornetSave(btn) {
    if (!btn) return false
    const id = String(btn.id || '')
    const src = sourceOfOnclick(btn) + ' ' + ((btn.getAttribute && btn.getAttribute('href')) || '')
    if (/^savecornetvalues$/i.test(id)) return true
    if (/checkforremarks/i.test(src)) return true
    return false
  }

  function markScanInputsCaptured() {
    document.querySelectorAll('input.scan-input, input.weightCls, input[id^="num_cornet_weight"]').forEach(function (el) {
      try {
        el.setAttribute('is-captured', 'true')
        el.setAttribute('scale-captured', 'true')
        el.setAttribute('scanned', 'true')
        el.setAttribute('data-scanned', 'true')
        el.setAttribute('data-source', 'scale')
        if (el.dataset) {
          el.dataset.isCaptured = 'true'
          el.dataset.scaleCaptured = 'true'
          el.dataset.scanned = 'true'
          el.dataset.source = 'scale'
        }
      } catch (e) {
        /* ignore */
      }
    })
  }

  function ensureRemarksFilled() {
    const nodes = document.querySelectorAll('textarea, input[type="text"]')
    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i]
      const idn = `${el.id || ''} ${el.name || ''} ${el.className || ''} ${el.placeholder || ''}`
      if (!/remark/i.test(idn)) continue
      if (/scan-input|weightCls|num_cornet_weight/i.test(idn)) continue
      if (!String(el.value || '').trim()) {
        el.value = 'NA'
      }
    }
  }

  function findSaveInitialBtn() {
    const nodes = Array.from(document.querySelectorAll('input[type="button"], input[type="submit"], button, a'))
    return (
      nodes.find(function (el) {
        const t = `${el.value || ''} ${el.textContent || ''}`.replace(/\s+/g, ' ').trim()
        return /Save\s*\(\s*Initial\s*Weight\s*\)/i.test(t) || /Save\s*\(?\s*Initial\s*Weight\s*\)?/i.test(t)
      }) || null
    )
  }

  function prepareScale() {
    applyGlobalScaleFlags()
    overrideValidationFuncs()
    markAllInputsCaptured()
    markScanInputsCaptured()
    document.querySelectorAll('input[type="button"], input[type="submit"], button, a').forEach(function (el) {
      const t = `${el.value || ''} ${el.textContent || ''}`
      if (isJsCornetSave(el)) return
      if (/Save/i.test(t) && /Initial\s*Weight|Cornet|after\s*assay/i.test(t)) forceBarePostback(el)
      else if (/Save/i.test(t)) stripScaleCheckFromOnclick(el)
    })
  }

  function enablePortalControl(el) {
    if (!el) return
    try {
      el.disabled = false
      el.readOnly = false
      el.removeAttribute('disabled')
      el.removeAttribute('readonly')
      el.removeAttribute('aria-disabled')
      if (el.classList) {
        el.classList.remove('disabled', 'aspNetDisabled')
      }
      if (el.style) {
        el.style.pointerEvents = 'auto'
        if (el.style.display === 'none') el.style.display = ''
        if (el.style.visibility === 'hidden') el.style.visibility = 'visible'
      }
    } catch (e) {
      /* ignore */
    }
  }

  function findSaveCornetBtn() {
    const byId = document.getElementById('savecornetvalues')
    if (byId) return byId
    const nodes = Array.from(
      document.querySelectorAll('input[type="button"], input[type="submit"], input[type="image"], button, a'),
    )
    return (
      nodes.find(function (el) {
        const t = `${el.value || ''} ${el.textContent || ''}`.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
        const idn = `${el.id || ''} ${el.name || ''} ${el.className || ''}`
        if (/^savecornetvalues$/i.test(el.id || '')) return true
        if (/initial/i.test(t) && !/cornet/i.test(t)) return false
        if (/Save/i.test(t) && /Cornet/i.test(t)) return true
        if (/Save/i.test(t) && /after\s*assay/i.test(t)) return true
        if (/btnSaveCornet|SaveCornet|btnCornet|CornetWeight|btnSaveM2/i.test(idn)) return true
        return false
      }) || null
    )
  }

  function clickPortalSaveInPage(btn, doneAttr) {
    prepareScale()
    neutralizeFormSubmit()
    if (!btn) return false
    const pb = forceBarePostback(btn)
    let target = pb && pb.target
    const arg = (pb && pb.arg) || ''
    if (!target || /shrija/i.test(String(target))) {
      target = btn.name && !/^shrija/i.test(String(btn.name)) ? btn.name : ''
    }
    window.Page_IsValid = true
    window.Page_BlockSubmit = false
    window.Page_ValidationActive = false
    if (target && typeof window.__doPostBack === 'function') {
      try {
        window.__doPostBack(target, arg)
        if (doneAttr) document.documentElement.setAttribute(doneAttr, '1')
        return true
      } catch (e) {
        /* fall through to click */
      }
    }
    try {
      btn.click()
      if (doneAttr) document.documentElement.setAttribute(doneAttr, '1')
      return true
    } catch (e) {
      return false
    }
  }

  function clickSaveInitialInPage(btn) {
    if (!btn) btn = findSaveInitialBtn()
    return clickPortalSaveInPage(btn, 'data-shrija-save-initial-done')
  }

  function isSafeCornetPostback(btn) {
    if (!btn) return false
    if (isJsCornetSave(btn)) return true
    const src = sourceOfOnclick(btn) + ' ' + ((btn.getAttribute && btn.getAttribute('href')) || '')
    if (/__doPostBack|WebForm_DoPostBackWithOptions/.test(src)) return true
    if (btn.name && !/^shrija/i.test(String(btn.name)) && !btn.disabled && !/aspNetDisabled/.test(btn.className || '')) {
      return true
    }
    return false
  }

  function clickJsCornetSave(btn) {
    applyGlobalScaleFlags()
    overrideValidationFuncs()
    markAllInputsCaptured()
    markScanInputsCaptured()
    ensureRemarksFilled()
    window.Page_IsValid = true
    window.Page_BlockSubmit = false
    window.Page_ValidationActive = false
    try {
      if (typeof window.checkforremarks === 'function' && !window.checkforremarks.__shrijaBypassed) {
        window.checkforremarks()
      } else if (btn) {
        btn.click()
      } else {
        return false
      }
      document.documentElement.setAttribute('data-shrija-save-cornet-done', '1')
      return true
    } catch (e) {
      return false
    }
  }

  function clickSaveCornetInPage(btn) {
    window.__shrijaSwallowAlerts = true
    if (!btn) btn = findSaveCornetBtn()
    if (!btn) return false
    if (isJsCornetSave(btn)) {
      return clickJsCornetSave(btn)
    }
    if (!isSafeCornetPostback(btn)) {
      document.documentElement.setAttribute('data-shrija-save-cornet-done', 'skip')
      return false
    }
    return clickPortalSaveInPage(btn, 'data-shrija-save-cornet-done')
  }

  function installAlertBypass() {
    if (!window.__shrijaNativeAlert) {
      window.__shrijaNativeAlert = window.alert
      window.__shrijaNativeConfirm = window.confirm
    }
    window.alert = function alertProxy(msg) {
      if (window.__shrijaSwallowAlerts) return true
      const text = String(msg || '')
      if (/unauthorized|weighing|scale|scan|weight|captured|cornet|direct|check gold|m2|weigh/i.test(text)) {
        return true
      }
      if (typeof window.__shrijaNativeAlert === 'function') {
        return window.__shrijaNativeAlert.apply(this, arguments)
      }
    }
    window.confirm = function confirmProxy(msg) {
      if (window.__shrijaSwallowAlerts) return true
      const text = String(msg || '')
      if (/unauthorized|weighing|scale|scan|weight|captured|cornet|direct|check gold|m2|weigh/i.test(text)) {
        return true
      }
      if (typeof window.__shrijaNativeConfirm === 'function') {
        return window.__shrijaNativeConfirm.apply(this, arguments)
      }
      return true
    }
  }
  installAlertBypass()

  if (!window.__shrijaBypassInjected) {
    window.__shrijaBypassInjected = true

    document.addEventListener(
      'shrija-prepare-scale',
      function () {
        prepareScale()
      },
      true,
    )

    document.addEventListener(
      'shrija-save-initial',
      function () {
        const id = document.documentElement.getAttribute('data-shrija-save-initial')
        const btn = (id && document.getElementById(id)) || findSaveInitialBtn()
        clickSaveInitialInPage(btn)
      },
      true,
    )

    document.addEventListener(
      'shrija-save-cornet',
      function () {
        const id = document.documentElement.getAttribute('data-shrija-save-cornet')
        const btn =
          (id && document.getElementById(id)) ||
          document.querySelector('[data-shrija-role="save-cornet"]') ||
          findSaveCornetBtn()
        if (typeof window.__shrijaBypassAndSubmitCornetWeight === 'function') {
          window.__shrijaBypassAndSubmitCornetWeight(btn)
        } else {
          clickSaveCornetInPage(btn)
        }
      },
      true,
    )

    document.addEventListener(
      'click',
      function (e) {
        const el = e.target && e.target.closest ? e.target.closest('input, button, a') : e.target
        if (!el) return
        const t = `${el.value || ''} ${el.textContent || ''}`.replace(/\s+/g, ' ').trim()
        if (!/Save/i.test(t)) return
        prepareScale()
        if (isJsCornetSave(el)) return
        if (/Initial\s*Weight|Cornet|after\s*assay/i.test(t)) forceBarePostback(el)
        else if (/Save/i.test(t)) stripScaleCheckFromOnclick(el)
      },
      true,
    )

    ;['change', 'blur', 'input', 'focusout'].forEach(function (evtName) {
      document.addEventListener(
        evtName,
        function (e) {
          applyGlobalScaleFlags()
          const el = e.target
          if (!el || el.tagName !== 'INPUT') return
          const idNameClass = `${el.id || ''} ${el.name || ''} ${el.className || ''} ${el.placeholder || ''}`
          if (!/txt|m1|m2|silver|copper|lead|initial|weight|sample|button|cg|check|cornet/i.test(idNameClass)) return
          el.setAttribute('is-captured', 'true')
          el.setAttribute('scale-captured', 'true')
          el.setAttribute('data-source', 'scale')
        },
        true,
      )
    })

    window.__shrijaPrepareTimer = setInterval(prepareScale, 800)
  }

  prepareScale()

  function hookEndRequest() {
    try {
      const prm =
        window.Sys &&
        window.Sys.WebForms &&
        window.Sys.WebForms.PageRequestManager &&
        typeof window.Sys.WebForms.PageRequestManager.getInstance === 'function' &&
        window.Sys.WebForms.PageRequestManager.getInstance()
      if (prm && !prm.__shrijaHooked && typeof prm.add_endRequest === 'function') {
        prm.__shrijaHooked = true
        prm.add_endRequest(function () {
          prepareScale()
        })
        if (typeof prm.add_beginRequest === 'function') {
          prm.add_beginRequest(function () {
            prepareScale()
          })
        }
      }
    } catch (e) {
      /* ignore */
    }
  }
  hookEndRequest()
  if (!window.__shrijaEndRequestTimer) {
    window.__shrijaEndRequestTimer = setInterval(hookEndRequest, 1500)
  }

  window.__shrijaPrepareScale = prepareScale
  window.__shrijaBypassAndSubmitInitialWeight = function (btn) {
    return clickSaveInitialInPage(btn)
  }
  window.__shrijaTriggerBypassSaveInitial = window.__shrijaBypassAndSubmitInitialWeight
  window.__shrijaBypassAndSubmitCornetWeight = function (btn) {
    return clickSaveCornetInPage(btn)
  }
  window.__shrijaTriggerBypassSaveCornet = window.__shrijaBypassAndSubmitCornetWeight
})(typeof globalThis !== 'undefined' && globalThis.document ? globalThis : this)
