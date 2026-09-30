/**
 * Bilingual scheduled-maintenance notice.
 * Does not cover Maintenance Mode or the 503 screen.
 * Run: npx tsx --tsconfig ./tsconfig.app.json scripts/scheduled-maintenance-notice.selftest.ts
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement, act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { JSDOM } from 'jsdom'
import { ScheduledMaintenanceNoticeCard } from '../src/components/ScheduledMaintenanceNotice.tsx'
import {
  DEFAULT_MAINTENANCE_MESSAGE_EN,
  DEFAULT_MAINTENANCE_MESSAGE_HI,
  formatMaintenanceDate,
  formatMaintenanceTimeRange,
  presentScheduledMaintenance,
  sanitizeScheduledMaintenanceDraft,
  SCHEDULED_MAINTENANCE_COPY,
  type ScheduledMaintenanceDraft,
} from '../src/scheduledMaintenanceNotice.ts'

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..')

function draft(partial: Partial<ScheduledMaintenanceDraft> = {}): ScheduledMaintenanceDraft {
  return {
    enabled: true,
    date: '2026-09-30',
    startTime: '09:30',
    endTime: '13:00',
    messageEn: '',
    messageHi: '',
    ...partial,
  }
}

function installDom() {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'http://localhost/',
  })
  const { window } = dom
  Object.defineProperty(globalThis, 'window', { value: window, configurable: true })
  Object.defineProperty(globalThis, 'document', { value: window.document, configurable: true })
  Object.defineProperty(globalThis, 'HTMLElement', { value: window.HTMLElement, configurable: true })
  Object.defineProperty(globalThis, 'SVGElement', { value: window.SVGElement, configurable: true })
  Object.defineProperty(globalThis, 'Node', { value: window.Node, configurable: true })
  Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true })
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  return window.document.getElementById('root')!
}

async function render(node: ReactNode): Promise<{ container: HTMLElement; unmount: () => Promise<void> }> {
  const rootEl = installDom()
  const root: Root = createRoot(rootEl)
  await act(async () => {
    root.render(node)
  })
  return {
    container: rootEl,
    unmount: async () => {
      await act(async () => {
        root.unmount()
      })
    },
  }
}

const during = new Date('2026-09-30T10:00:00+05:30')
const after = new Date('2026-09-30T13:01:00+05:30')

console.log('scheduled-maintenance: bilingual schedule')

assert.equal(formatMaintenanceDate('2026-09-30'), '30 September 2026')
assert.equal(formatMaintenanceDate('2026-10-05'), '05 October 2026')
assert.equal(formatMaintenanceTimeRange('09:30', '13:00'), '09:30 AM – 01:00 PM')
assert.equal(SCHEDULED_MAINTENANCE_COPY.titleEn, 'Scheduled Maintenance')
assert.equal(SCHEDULED_MAINTENANCE_COPY.titleHi, 'निर्धारित रखरखाव')
assert.equal(SCHEDULED_MAINTENANCE_COPY.thanksEn, 'Thank you for your cooperation.')
assert.equal(SCHEDULED_MAINTENANCE_COPY.thanksHi, 'आपके सहयोग के लिए धन्यवाद।')

const shown = presentScheduledMaintenance(draft(), during)
assert.ok(shown)
assert.equal(shown.dateLabel, '30 September 2026')
assert.equal(shown.timeLabel, '09:30 AM – 01:00 PM')
assert.equal(shown.messageEn, DEFAULT_MAINTENANCE_MESSAGE_EN)
assert.equal(shown.messageHi, DEFAULT_MAINTENANCE_MESSAGE_HI)
assert.equal(/[A-Za-z]/.test(DEFAULT_MAINTENANCE_MESSAGE_HI), false)
assert.equal(/[\u0900-\u097F]/.test(DEFAULT_MAINTENANCE_MESSAGE_EN), false)

const customEn = 'The hallmarking centre application will be unavailable while records are updated.'
const customHi = 'अभिलेख अद्यतन के दौरान हॉलमार्किंग केन्द्र का अनुप्रयोग उपलब्ध नहीं रहेगा।'
const custom = presentScheduledMaintenance(
  draft({ messageEn: `  ${customEn}  `, messageHi: customHi }),
  during,
)
assert.ok(custom)
assert.equal(custom.messageEn, customEn)
assert.equal(custom.messageHi, customHi)
assert.equal(custom.messageEn.includes(DEFAULT_MAINTENANCE_MESSAGE_EN), false)

assert.equal(presentScheduledMaintenance(draft({ enabled: false }), during), null)
assert.equal(presentScheduledMaintenance(draft(), after), null)
assert.ok(presentScheduledMaintenance(draft({ enabled: false }), during, { preview: true }))

const istWindow = draft({ date: '2026-10-15', startTime: '10:00', endTime: '14:00' })
const atEndIst = new Date('2026-10-15T08:30:00.000Z')
const afterEndIst = new Date('2026-10-15T08:30:01.000Z')
const atEnd = presentScheduledMaintenance(istWindow, atEndIst)
assert.ok(atEnd)
assert.equal(atEnd.dateLabel, '15 October 2026')
assert.equal(atEnd.timeLabel, '10:00 AM – 02:00 PM')
assert.equal(presentScheduledMaintenance(istWindow, afterEndIst), null)
assert.equal(presentScheduledMaintenance(istWindow, new Date('2026-10-15T14:00:00.000Z')), null)

const unpublished = sanitizeScheduledMaintenanceDraft({
  enabled: true,
  date: '',
  startTime: '',
  endTime: '',
  messageEn: '',
  messageHi: '',
})
assert.equal(unpublished.ok, false)
const hiddenDraft = sanitizeScheduledMaintenanceDraft({
  enabled: false,
  date: '',
  startTime: '',
  endTime: '',
  messageEn: '',
  messageHi: '',
})
assert.equal(hiddenDraft.ok, true)

const badOrder = sanitizeScheduledMaintenanceDraft(draft({ startTime: '15:00', endTime: '09:00' }))
assert.equal(badOrder.ok, false)
const badDate = sanitizeScheduledMaintenanceDraft(draft({ date: '2026-13-40' }))
assert.equal(badDate.ok, false)
const withSeconds = sanitizeScheduledMaintenanceDraft(draft({ startTime: '09:30:00', endTime: '13:00:00' }))
assert.equal(withSeconds.ok, true)
if (withSeconds.ok) {
  assert.equal(withSeconds.draft.startTime, '09:30')
  assert.equal(withSeconds.draft.endTime, '13:00')
}

const casual = /\b(bhai|yaar|pls|plz|guys|ho jayega|band rahega|nahi hoga)\b/i
for (const file of [
  'server/src/scheduledMaintenanceNotice.ts',
  'src/components/ScheduledMaintenanceNotice.tsx',
  'src/components/ScheduledMaintenanceAdmin.tsx',
]) {
  const src = readFileSync(join(rootDir, file), 'utf8')
  assert.equal(casual.test(src), false, file)
  assert.equal(src.includes('dangerouslySetInnerHTML'), false, file)
}

console.log('scheduled-maintenance: shared card')

const view = await render(
  createElement(ScheduledMaintenanceNoticeCard, {
    notice: custom!,
  }),
)
const text = view.container.textContent || ''
assert.ok(text.includes('Scheduled Maintenance'))
assert.ok(text.includes('निर्धारित रखरखाव'))
assert.ok(text.includes('Date'))
assert.ok(text.includes('दिनांक'))
assert.ok(text.includes('Time'))
assert.ok(text.includes('समय'))
assert.ok(text.includes('Notice'))
assert.ok(text.includes('सूचना'))
assert.ok(text.includes('30 September 2026'))
assert.ok(text.includes('09:30 AM – 01:00 PM'))
assert.ok(text.includes(customEn))
assert.ok(text.includes(customHi))
assert.equal(text.includes(DEFAULT_MAINTENANCE_MESSAGE_EN), false)
assert.ok(text.includes('Thank you for your cooperation.'))
assert.ok(text.includes('आपके सहयोग के लिए धन्यवाद।'))
assert.equal(view.container.querySelector('[lang="en"]') instanceof Object, true)
assert.equal(view.container.querySelector('[lang="hi"]') instanceof Object, true)
await view.unmount()

console.log('scheduled-maintenance: existing maintenance mode untouched')

const httpConfig = readFileSync(join(rootDir, 'src/errors/httpErrorConfig.ts'), 'utf8')
assert.ok(httpConfig.includes("title: 'Service Temporarily Unavailable'"))
assert.equal(httpConfig.includes('निर्धारित रखरखाव'), false)

const errorPage = readFileSync(join(rootDir, 'src/components/ErrorPage.tsx'), 'utf8')
assert.equal(errorPage.includes('निर्धारित रखरखाव'), false)

const maintenanceMode = readFileSync(join(rootDir, 'server/src/maintenanceMode.ts'), 'utf8')
assert.equal(maintenanceMode.includes('scheduled'), false)
assert.equal(maintenanceMode.includes('निर्धारित'), false)

const appSrc = readFileSync(join(rootDir, 'src/App.tsx'), 'utf8')
assert.ok(appSrc.includes('<ErrorPage status={503} />'))
assert.ok(appSrc.includes('readMaintenanceMode'))
assert.equal(appSrc.includes('ScheduledMaintenance'), false)

const loginSrc = readFileSync(join(rootDir, 'src/pages/Login.tsx'), 'utf8')
const layoutSrc = readFileSync(join(rootDir, 'src/components/Layout.tsx'), 'utf8')
assert.ok(loginSrc.includes('ScheduledMaintenanceNoticeCard'))
assert.ok(layoutSrc.includes('ScheduledMaintenanceNoticeCard'))
assert.ok(layoutSrc.includes('header-notifications'))

const serverIndex = readFileSync(join(rootDir, 'server/src/index.ts'), 'utf8')
assert.ok(serverIndex.includes("app.get('/api/maintenance'"))
assert.ok(serverIndex.includes('res.json({ maintenance: isMaintenanceModeEnabled() })'))
assert.ok(serverIndex.includes("app.get('/api/scheduled-maintenance'"))

console.log('scheduled-maintenance: ok')
