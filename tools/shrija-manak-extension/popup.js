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

async function loadSelectedLot() {
  const tab = await activeTab()
  const form = document.getElementById('form')
  const help = document.getElementById('help')
  if (isExtensionsManagerUrl(tab?.url)) {
    form.style.display = 'none'
    help.style.display = 'block'
    return
  }
  help.style.display = 'none'
  form.style.display = 'block'
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

document.getElementById('form').addEventListener('submit', async (e) => {
  e.preventDefault()
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
    btn.disabled = false
  }
})

void loadSelectedLot()
