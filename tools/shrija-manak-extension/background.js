const KEY = 'shrija-manak-fire-assay-sheet'

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
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
  return false
})

/** Ensure Shrija bridge script is injected on Vercel tabs (Create Sheet sync). */
function injectShrija(tabId) {
  chrome.scripting
    .executeScript({
      target: { tabId },
      files: ['content-shrija.js'],
    })
    .catch(() => {})
}

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status !== 'complete' || !tab.url) return
  if (/vercel\.app|localhost|127\.0\.0\.1/i.test(tab.url)) injectShrija(tabId)
})

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return
  if (tab.url && /vercel\.app|localhost/i.test(tab.url)) injectShrija(tab.id)
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'SHRIJA_FILL_MANAK_NOW' })
  } catch {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'SHRIJA_SYNC_SHEET_NOW' })
    } catch {
      /* ignore */
    }
  }
})
