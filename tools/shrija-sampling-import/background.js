import {
  acceptExternalConsume,
  acceptPopupConfirmation,
  sealConfirmation,
  createConfirmationStore,
} from './dist/confirmation.js'

const tickets = createConfirmationStore()

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.source !== 'shrija-sampling-import' || message.type !== 'CONFIRM_IMPORT') return
  if (!acceptPopupConfirmation(message, sender, chrome.runtime.id)) {
    sendResponse({ ok: false, code: 'UNVERIFIED_SENDER' })
    return
  }
  sealConfirmation(tickets, message.payload, message.hash, Date.now())
    .then((sealed) => {
      sendResponse(sealed.ok ? { ok: true } : { ok: false, code: sealed.code })
    })
    .catch(() => {
      sendResponse({ ok: false, code: 'REJECTED' })
    })
  return true
})

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (!acceptExternalConsume(message, sender)) {
    sendResponse({ ok: false, code: 'REJECTED' })
    return
  }
  const hash = typeof message.hash === 'string' ? message.hash : ''
  sendResponse(tickets.consume(hash, Date.now()))
})
