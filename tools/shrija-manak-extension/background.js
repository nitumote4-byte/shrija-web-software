const KEY = 'shrija-manak-fire-assay-sheet'

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'SHRIJA_MANAK_FIRE_ASSAY' && msg.sheet) {
    chrome.storage.local.set({ [KEY]: msg.sheet }, () => sendResponse({ ok: true }))
    return true
  }
  if (msg?.type === 'GET_SHRIJA_MANAK_SHEET') {
    chrome.storage.local.get([KEY], (data) => sendResponse({ sheet: data[KEY] || null }))
    return true
  }
  return false
})

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'SHRIJA_FILL_MANAK_NOW' })
  } catch {
    /* page may not have content script */
  }
})
