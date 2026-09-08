const KEY = 'shrija-manak-fire-assay-sheet'

function isFireSheetUrl(url) {
  const u = String(url || '')
  if (!u || /^(chrome|edge|about|devtools):/i.test(u)) return false
  if (/manakonline\.in|newmanak\.uat\.dcservices\.in/i.test(u)) {
    return /Samplingweighting|SamplingWeighting|assayingAH|Assaying|FireAssay|fire-assay/i.test(u)
  }
  if (/vercel\.app|localhost|127\.0\.0\.1/i.test(u)) {
    return /create-fire-assay|view-fire-assay/i.test(u)
  }
  return false
}

function injectShrija(tabId) {
  chrome.scripting
    .executeScript({
      target: { tabId },
      files: ['content-shrija.js'],
    })
    .catch(() => {})
}

/** Page CSP blocks <script src="chrome-extension://…">. world:MAIN does not. */
function injectManakMainWorld(tabId) {
  chrome.scripting
    .executeScript({
      target: { tabId, allFrames: true },
      world: 'MAIN',
      files: ['main-world-bypass.js'],
    })
    .catch(() => {})
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'SHRIJA_MANAK_FIRE_ASSAY' && msg.sheet) {
    chrome.storage.local.set({ [KEY]: msg.sheet, [`${KEY}-at`]: Date.now() }, () =>
      sendResponse({ ok: true }),
    )
    return true
  }
  if (msg?.type === 'GET_SHRIJA_MANAK_SHEET') {
    chrome.storage.local.get([KEY], (data) => sendResponse({ sheet: data[KEY] || null }))
    return true
  }
  if (msg?.type === 'SHRIJA_INJECT_MAIN_WORLD') {
    const tabId = sender?.tab?.id
    if (tabId) injectManakMainWorld(tabId)
    sendResponse({ ok: true })
    return false
  }
  if (msg?.type === 'SHRIJA_MAIN_CLICK_SAVE') {
    const tabId = sender?.tab?.id
    const role = msg.role === 'initial' ? 'initial' : 'cornet'
    if (!tabId) {
      sendResponse({ ok: false })
      return false
    }
    chrome.scripting
      .executeScript({
        target: { tabId, allFrames: true },
        world: 'MAIN',
        files: ['main-world-bypass.js'],
      })
      .then(() =>
        chrome.scripting.executeScript({
          target: { tabId, allFrames: true },
          world: 'MAIN',
          func: (which) => {
            try {
              if (which === 'cornet' && typeof window.__shrijaBypassAndSubmitCornetWeight === 'function') {
                return Boolean(window.__shrijaBypassAndSubmitCornetWeight())
              }
              if (which === 'initial' && typeof window.__shrijaBypassAndSubmitInitialWeight === 'function') {
                return Boolean(window.__shrijaBypassAndSubmitInitialWeight())
              }
              return false
            } catch {
              return false
            }
          },
          args: [role],
        }),
      )
      .then((results) => {
        const ok = Boolean(results && results.some((r) => r && r.result))
        sendResponse({ ok })
      })
      .catch(() => sendResponse({ ok: false }))
    return true
  }
  return false
})

function injectIfFireSheet(tabId, url) {
  if (!tabId || !isFireSheetUrl(url)) return
  if (/vercel\.app|localhost|127\.0\.0\.1/i.test(url)) injectShrija(tabId)
  if (/manakonline\.in|newmanak\.uat\.dcservices\.in/i.test(url)) injectManakMainWorld(tabId)
}

function onInstalledOrStartup() {
  chrome.tabs.query(
    {
      url: [
        'https://huid.manakonline.in/*',
        'https://newmanak.uat.dcservices.in/*',
        'https://*.vercel.app/*',
        'http://localhost/*',
        'http://127.0.0.1/*',
      ],
    },
    (tabs) => {
      for (const tab of tabs) injectIfFireSheet(tab.id, tab.url)
    },
  )
}

chrome.runtime.onInstalled.addListener(onInstalledOrStartup)
chrome.runtime.onStartup.addListener(onInstalledOrStartup)

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status !== 'complete') return
  injectIfFireSheet(tabId, tab.url || info.url)
})
