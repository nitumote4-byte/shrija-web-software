/**
 * Scheduled-maintenance notice validation. No database.
 * Run: npm --prefix server test
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { sanitizeScheduledMaintenanceDraft } from './scheduledMaintenanceNotice.js'

describe('scheduled maintenance notice', () => {
  it('keeps the administrator message and normalises the clock', () => {
    const parsed = sanitizeScheduledMaintenanceDraft({
      enabled: true,
      date: '2026-09-30',
      startTime: '09:30:00',
      endTime: '13:00',
      messageEn: '  Records will be unavailable.  ',
      messageHi: '  अभिलेख उपलब्ध नहीं रहेंगे।  ',
    })
    assert.equal(parsed.ok, true)
    if (!parsed.ok) return
    assert.equal(parsed.draft.messageEn, 'Records will be unavailable.')
    assert.equal(parsed.draft.messageHi, 'अभिलेख उपलब्ध नहीं रहेंगे।')
    assert.equal(parsed.draft.startTime, '09:30')
    assert.equal(parsed.draft.enabled, true)
  })

  it('requires a date and time window before a notice can be published', () => {
    const parsed = sanitizeScheduledMaintenanceDraft({
      enabled: true,
      date: '',
      startTime: '',
      endTime: '',
      messageEn: '',
      messageHi: '',
    })
    assert.equal(parsed.ok, false)
    if (parsed.ok) return
    assert.equal(parsed.error, 'Enter a valid maintenance date.')
  })

  it('rejects an end time that is not later than the start time', () => {
    const parsed = sanitizeScheduledMaintenanceDraft({
      enabled: true,
      date: '2026-09-30',
      startTime: '18:00',
      endTime: '09:00',
      messageEn: '',
      messageHi: '',
    })
    assert.equal(parsed.ok, false)
    if (parsed.ok) return
    assert.equal(parsed.error, 'End time must be later than the start time.')
  })
})
