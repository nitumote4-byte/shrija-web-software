import { getHttpErrorConfig, resolveHttpErrorStatus } from './httpErrorConfig'

/**
 * Explicit user-facing application messages that may appear in the UI.
 * Anything not listed (or matching a known safe template) is replaced with
 * the HTTP status catalog message — safe by default.
 */
export const SAFE_USER_FACING_MESSAGES: readonly string[] = [
  // Auth / login / password
  'Invalid username or password',
  'Username and password are required',
  'Username is required',
  'Password is required',
  'Incorrect password',
  'Current password is incorrect',
  'New password must be different from the current password',
  'Password is too long',
  'This password is too common. Choose a different one.',
  'Password must not contain the username',
  'Invalid or expired password reset link.',
  'Password reset by email is not available. Contact your centre administrator.',
  'You must change your password before continuing',
  'Authentication required',
  'Invalid or expired token',
  'Too many attempts. Please try again in 15 minutes.',

  // Access / licence / centre
  'Admin access required',
  'This centre is suspended',
  'Licence expired',
  'Licence expired. Activate a new licence key to continue.',
  'Centre not found',
  'User not found',
  'Not found',
  'Not allowed for this centre',
  'This role cannot access centre data',
  'Only centre admin can activate a licence',
  'licenceKey is required',
  'Invalid licence key',
  'This licence key is already used by another centre',
  'Only a centre administrator can replace the full store',
  'Off-site users cannot update firm-wide centre details',
  'Off-Site users cannot be In Lab — lab stays at Main Centre',
  'You cannot remove your own login while signed in',
  'Invalid users payload',
  'Invalid input',
  'Invalid tenant ID',
  'A centre with this name already exists',
  'This admin username is already used by another centre. Choose a different username.',
  'Failed to create centre',
  'Failed to activate licence',
  'Too many licence requests',
  'Too many admin requests',
  'Invalid master secret',
  'masterSecret is required',

  // Store / conflict
  'Store was updated elsewhere',
  'baseRev is required for store writes',
  'baseRev must be a non-negative number',
  'body.data object required',
  'value required',

  // Letterhead
  'Letterhead image is required',
  'Unsupported file. Use PNG, JPG, or WebP',
  'Image type does not match the file contents',
  'Image file is too small or invalid',
  'Letterhead must be 2 MB or smaller',
  'Image dimensions are required',
  'centre_id mismatch — use the authenticated centre',
]

/**
 * Login / Access Management usernames are free-text in Zod (min 1), but real
 * values are simple identifiers (e.g. qm_a, reception). Captured values must
 * match this grammar — never arbitrary prose or secret-like blobs.
 */
const SAFE_USERNAME_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/

/** Centre / outlet ids: `main` or `osc-…` / similar alphanumeric ids (no path/URL chars). */
const SAFE_CENTRE_ID = /^(?:main|[A-Za-z][A-Za-z0-9_-]{0,63})$/

/** Operational period canonical name from parsePeriodName: e.g. 2026-27 */
const SAFE_PERIOD_NAME = /^(20\d{2})-(\d{2})$/

/** Letterhead dimension pair: e.g. 200×40 (U+00D7 multiplication sign). */
const SAFE_DIMENSION_PAIR = /^([1-9]\d{0,4})×([1-9]\d{0,4})$/

/** Exact application-generated Other Services item validation suffixes. */
const SAFE_ITEM_MESSAGES = new Set([
  'description is required',
  'quantity must be a positive integer',
  'rate must be zero or greater',
  'product / item name is required',
  'unit must be Gram (g) or Kilogram (kg)',
  'weight / quantity must be greater than zero',
  'rate per KG must be zero or greater',
])

function isSafeUsernameId(value: string): boolean {
  return SAFE_USERNAME_ID.test(value)
}

function isSafeCentreId(value: string): boolean {
  return SAFE_CENTRE_ID.test(value)
}

function isSafePeriodName(value: string): boolean {
  const m = SAFE_PERIOD_NAME.exec(value)
  if (!m) return false
  const startYear = Number(m[1])
  const endYy = Number(m[2])
  return (startYear + 1) % 100 === endYy
}

function isSafeDimensionPair(value: string): boolean {
  return SAFE_DIMENSION_PAIR.test(value)
}

function isSafePositiveInt(value: string, maxDigits = 6): boolean {
  if (!new RegExp(`^[1-9]\\d{0,${maxDigits - 1}}$`).test(value)) return false
  const n = Number(value)
  return Number.isFinite(n) && Number.isInteger(n) && n > 0
}

type TemplateMatcher = (text: string) => boolean

/** Parameterized templates: fixed trusted prose + field-specific validated captures. */
const SAFE_USER_FACING_TEMPLATE_MATCHERS: readonly TemplateMatcher[] = [
  (text) => {
    const m = /^Password must be at least (\d{1,3}) characters$/.exec(text)
    return Boolean(m && isSafePositiveInt(m[1], 3))
  },
  (text) => {
    const m =
      /^Current password and a new password \(min (\d{1,3}) characters\) are required$/.exec(text)
    return Boolean(m && isSafePositiveInt(m[1], 3))
  },
  (text) => {
    const m = /^A new password \(min (\d{1,3}) characters\) is required$/.exec(text)
    return Boolean(m && isSafePositiveInt(m[1], 3))
  },
  (text) => {
    const m =
      /^Username "([A-Za-z0-9][A-Za-z0-9_-]{0,63})" is already used by another centre\. Choose a different username\.$/.exec(
        text,
      )
    return Boolean(m && isSafeUsernameId(m[1]))
  },
  (text) => {
    const m = /^Licence allows max (\d{1,4}) users \(trying to save (\d{1,4})\)$/.exec(text)
    return Boolean(m && isSafePositiveInt(m[1], 4) && isSafePositiveInt(m[2], 4))
  },
  (text) => {
    const m =
      /^Unknown centre \/ outlet "(main|[A-Za-z][A-Za-z0-9_-]{0,63})" for this tenant$/.exec(text)
    return Boolean(m && isSafeCentreId(m[1]))
  },
  (text) => {
    const m =
      /^Set a password for "([A-Za-z0-9][A-Za-z0-9_-]{0,63})" \(placeholder cannot be used for a new or renamed user\)$/.exec(
        text,
      )
    return Boolean(m && isSafeUsernameId(m[1]))
  },
  (text) => {
    const m =
      /^Image must be between ([1-9]\d{0,4}×[1-9]\d{0,4}) and ([1-9]\d{0,4}×[1-9]\d{0,4}) pixels$/.exec(
        text,
      )
    return Boolean(m && isSafeDimensionPair(m[1]) && isSafeDimensionPair(m[2]))
  },
  (text) => {
    const m = /^Item ([1-9]\d{0,3}): (.+)$/.exec(text)
    if (!m || !isSafePositiveInt(m[1], 4)) return false
    return SAFE_ITEM_MESSAGES.has(m[2])
  },
  (text) => {
    const m = /^Period (20\d{2}-\d{2}) already exists\.$/.exec(text)
    return Boolean(m && isSafePeriodName(m[1]))
  },
]

const SAFE_MESSAGE_SET = new Set(SAFE_USER_FACING_MESSAGES.map((m) => m.trim()))

/** True when the string is an explicitly approved end-user message. */
export function isAllowlistedSafeUserMessage(text: string): boolean {
  const value = text.trim()
  if (!value) return false
  if (SAFE_MESSAGE_SET.has(value)) return true
  return SAFE_USER_FACING_TEMPLATE_MATCHERS.some((match) => match(value))
}

/**
 * True when text must not be shown in the UI.
 * Safe-by-default: anything not allowlisted is treated as unsafe.
 */
export function isSensitiveErrorText(text: string): boolean {
  const value = text.trim()
  if (!value) return false
  if (isAllowlistedSafeUserMessage(value)) return false
  return true
}

/**
 * Safe user-facing copy for an HTTP status.
 * Unknown statuses fall back to the 500 configuration.
 */
export function getSafeUserFacingMessage(status: number): string {
  return getHttpErrorConfig(status).safeMessage
}

/**
 * Choose a message for ApiRequestError / toasts without exposing internals.
 *
 * Policy:
 * - 5xx / unknown status → always catalog message
 * - 4xx → preserve ONLY allowlisted application messages
 * - anything else → catalog message for that status
 */
export function toSafeApiErrorMessage(status: number, raw?: string | null): string {
  const resolved = resolveHttpErrorStatus(status)
  const safe = getSafeUserFacingMessage(resolved)
  if (status !== resolved || status >= 500) return safe
  const trimmed = typeof raw === 'string' ? raw.trim() : ''
  if (!trimmed) return safe
  if (isAllowlistedSafeUserMessage(trimmed)) return trimmed
  return safe
}

export { resolveHttpErrorStatus, getHttpErrorConfig }
