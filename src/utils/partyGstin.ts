/** Existing Add Party GST error copy — kept when a non-empty value fails validation. */
export const PARTY_GSTIN_ERROR = 'Enter a valid 15-digit GST Number'

const FAKE_GSTIN_PLACEHOLDERS = [
  'NA',
  'NOT APPLICABLE',
  'UNREGISTERED',
  '000000000000000',
]

/**
 * GSTIN is optional. Blank / whitespace-only is valid.
 * If a value is present, keep the existing rule: trimmed length must be 15.
 */
export function validatePartyGstin(value: string): string | null {
  const gstin = value.trim()
  if (!gstin) return null
  if (gstin.length !== 15) return PARTY_GSTIN_ERROR
  return null
}

/** Persist a genuine blank string — never a placeholder GSTIN. */
export function normalizePartyGstin(value: string): string {
  return value.trim().toUpperCase()
}

export function isFakeGstinPlaceholder(value: string): boolean {
  return FAKE_GSTIN_PLACEHOLDERS.includes(value.trim().toUpperCase())
}

/** Registered-parties table / party register: blank GST shows an em dash. */
export function displayPartyGstin(gstin: string | undefined | null): string {
  return gstin || '—'
}

/** Billing / invoice challan: blank party GSTIN is an empty string, not a fake value. */
export function invoicePartyGstin(party: { gstin?: string } | null | undefined): string {
  return party?.gstin || ''
}
