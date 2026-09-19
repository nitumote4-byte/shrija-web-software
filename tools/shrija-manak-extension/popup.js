function isManakUrl(url) {
  return /manakonline\.in|newmanak\.uat\.dcservices\.in/i.test(String(url || ''))
}

function isExtensionsManagerUrl(url) {
  return /^(chrome|edge):\/\/extensions/i.test(String(url || ''))
}

function setStatus(text, kind) {
  const el = document.getElementById('status')
  el.textContent = text || ''
  el.className = kind || ''
}

function setLicStatus(text, kind) {
  const el = document.getElementById('lic-status')
  el.textContent = text || ''
  el.className = kind || ''
}

async function activeTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  return tabs[0] || null
}

async function callOnManakTab(tabId, fn, args) {
  const results = await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    func: fn,
    args,
  })
  return (results || []).map((r) => r.result).find((r) => r && !r.skip) || { skip: true }
}

function readLotInPage() {
  const fn = globalThis.__shrijaGetSelectedLot
  if (typeof fn !== 'function') return { skip: true }
  return fn()
}

function deleteInPage(jobCard, lotNum) {
  const fn = globalThis.__shrijaDeleteFilledAssay
  if (typeof fn !== 'function') return { skip: true }
  return fn(jobCard, lotNum)
}

let licenseOk = false

function paintLicense(status) {
  licenseOk = !!(status && status.ok)
  const badge = document.getElementById('lic-badge')
  const meta = document.getElementById('lic-meta')
  const activateBox = document.getElementById('lic-activate')
  const activeBox = document.getElementById('lic-active')
  const form = document.getElementById('form')
  const lockNote = document.getElementById('lock-note')
  const del = document.getElementById('del')
  const job = document.getElementById('job')
  const lot = document.getElementById('lot')

  badge.className = 'badge ' + (licenseOk ? 'ok' : status?.code === 'EXPIRED' ? 'warn' : 'err')
  badge.textContent = licenseOk
    ? 'Active'
    : status?.code === 'EXPIRED'
      ? 'Expired'
      : status?.code === 'INVALID'
        ? 'Invalid'
        : 'Inactive'

  if (licenseOk) {
    const days =
      status.daysLeft == null ? '—' : status.daysLeft === 1 ? '1 day' : `${status.daysLeft} days`
    meta.innerHTML = `Key <strong>${maskKey(status.key)}</strong> · <strong>${days}</strong> left`
    activateBox.hidden = true
    activeBox.hidden = false
    form.classList.remove('locked')
    lockNote.classList.remove('show')
    del.disabled = false
    job.disabled = false
    lot.disabled = false
    setLicStatus('License active.', 'ok')
  } else {
    meta.textContent = status?.reason || 'Activate karke Delete tools unlock karo.'
    activateBox.hidden = false
    activeBox.hidden = true
    form.classList.add('locked')
    lockNote.classList.add('show')
    del.disabled = true
    job.disabled = true
    lot.disabled = true
    if (status?.code === 'EXPIRED') setLicStatus(status.reason, 'warn')
    else if (status?.code === 'INVALID') setLicStatus(status.reason, 'err')
    else setLicStatus('')
  }
}

async function refreshLicense() {
  const status = await loadLicenseStatus()
  paintLicense(status)
  return status
}

async function loadSelectedLot() {
  const tab = await activeTab()
  const form = document.getElementById('form')
  const help = document.getElementById('help')
  const deletePanel = document.getElementById('delete-panel')
  const licensePanel = document.getElementById('license-panel')
  if (isExtensionsManagerUrl(tab?.url)) {
    form.style.display = 'none'
    deletePanel.style.display = 'none'
    licensePanel.style.display = 'none'
    help.style.display = 'block'
    return
  }
  help.style.display = 'none'
  form.style.display = 'block'
  deletePanel.style.display = 'block'
  licensePanel.style.display = 'block'
  if (!licenseOk) {
    setStatus('License pehle activate karo.', 'warn')
    return
  }
  if (!tab?.id || !isManakUrl(tab.url)) {
    setStatus('Pehle Manak assay page kholo.', 'err')
    return
  }
  try {
    const res = await callOnManakTab(tab.id, readLotInPage, [])
    if (res?.jobCard) document.getElementById('job').value = res.jobCard
    if (res?.lot != null && res.lot !== '') document.getElementById('lot').value = String(res.lot)
    if (res?.jobCard || res?.lot != null) {
      setStatus(`Portal lot: ${res.lot ?? '—'} / ${res.jobCard || '—'}`)
    } else {
      setStatus('Lot select karke Delete dabao.')
    }
  } catch {
    setStatus('Manak page reload karke phir try karo.', 'err')
  }
}

document.getElementById('lic-activate-btn').addEventListener('click', async () => {
  const key = document.getElementById('lic-key').value
  const btn = document.getElementById('lic-activate-btn')
  btn.disabled = true
  setLicStatus('Activate ho raha hai…')
  try {
    const status = await activateLicense(key)
    paintLicense(status)
    if (status.ok) {
      document.getElementById('lic-key').value = ''
      await loadSelectedLot()
    } else {
      setLicStatus(status.reason || 'Activate fail.', 'err')
    }
  } finally {
    btn.disabled = false
  }
})

document.getElementById('lic-deactivate-btn').addEventListener('click', async () => {
  const status = await clearLicense()
  paintLicense(status)
  setStatus('License pehle activate karo.', 'warn')
})

document.getElementById('form').addEventListener('submit', async (e) => {
  e.preventDefault()
  if (!licenseOk) {
    setStatus('License pehle activate karo.', 'warn')
    return
  }
  const jobCard = String(document.getElementById('job').value || '').trim()
  const lotNum = String(document.getElementById('lot').value || '').trim()
  const tab = await activeTab()
  if (!tab?.id || !isManakUrl(tab.url)) {
    setStatus('Pehle Manak assay page kholo.', 'err')
    return
  }
  const btn = document.getElementById('del')
  btn.disabled = true
  setStatus('Delete chal raha hai…')
  try {
    const res = await callOnManakTab(tab.id, deleteInPage, [jobCard, lotNum])
    if (res?.ok) setStatus(res.message || 'Fields empty ho gayi.', 'ok')
    else setStatus(res?.message || 'Delete nahi hua. Job + Lot check karo.', 'err')
  } catch {
    setStatus('Manak page reload karke phir try karo.', 'err')
  } finally {
    btn.disabled = !licenseOk
  }
})

async function boot() {
  try {
    const man = chrome.runtime.getManifest()
    document.getElementById('ext-ver').textContent = `v${man.version || ''}`
  } catch {
    /* ignore */
  }
  await refreshLicense()
  await loadSelectedLot()
}

void boot()
