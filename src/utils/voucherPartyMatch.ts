/**
 * Party ↔ ASC/AHC voucher identity.
 *
 * License number is the primary identifier.
 * Jeweller name is supporting only (truncated names are expected on vouchers).
 *
 * Extraction is additive and does not change item-line parsing.
 */

export type VoucherPartyIdentity = {
  jewellerName: string
  licenseNo: string
}

export type VoucherPartyVerdictStatus = 'valid' | 'warning' | 'wrong_party'

export type VoucherPartyVerdictReason =
  | 'license_match'
  | 'license_match_truncated_name'
  | 'license_match_name_differs'
  | 'license_mismatch'
  | 'both_mismatch'
  | 'missing_license'
  | 'no_identity'

export type VoucherPartyVerdict = {
  status: VoucherPartyVerdictStatus
  reason: VoucherPartyVerdictReason
  /** When false, voucher rows must not be mapped onto the selected party. */
  allowAutoMap: boolean
  licenseMatch: boolean
  nameMatch: boolean
}

export const PARTY_VERIFY_FAILED_TITLE = 'Party Verification Failed'
export const PARTY_VERIFY_FAILED_MESSAGE =
  'The selected party does not match the uploaded ASC voucher. License number verification failed. Please verify the selected party and voucher.'

export const PARTY_VERIFY_REQUIRED_TITLE = 'Party Verification Required'
export const PARTY_VERIFY_REQUIRED_MESSAGE =
  'License number is missing on the selected party or the uploaded voucher. Please verify the party and voucher before continuing.'

export const PARTY_NAME_DIFFERS_TITLE = 'Jeweller Name Differs'
export const PARTY_NAME_DIFFERS_MESSAGE =
  'License number matches the selected party. The jeweller name on the voucher differs. Please confirm the party is correct.'

const NAME_STOP =
  /\s+(?:Licen[cs]e\s*(?:No\.?|Number|#)|CML\b|Item\s*Categor|GSTN|Address|Material|Request|Receipt|Quantity|Declared|Observed)\b/i

/** Harmless formatting only — does not strip hyphens or other identity characters. */
export function normalizeLicenseNo(value: string): string {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase()
}

export function normalizePartyName(value: string): string {
  return String(value ?? '')
    .trim()
    .replace(/[&]/g, ' and ')
    .replace(/[.,'"()/]/g, ' ')
    .replace(/\s+/g, ' ')
    .toUpperCase()
}

/**
 * Secondary name check. Treats a truncated voucher name as matching when it is
 * a prefix of the party name (or vice versa), after normalization.
 */
export function namesSupportMatch(partyName: string, voucherName: string): boolean {
  const party = normalizePartyName(partyName)
  const voucher = normalizePartyName(voucherName)
  if (!party || !voucher) return false
  if (party === voucher) return true

  const shorter = party.length <= voucher.length ? party : voucher
  const longer = party.length <= voucher.length ? voucher : party
  if (shorter.length < 6) return false
  return longer.startsWith(`${shorter} `)
}

export function extractVoucherPartyIdentity(text: string): VoucherPartyIdentity {
  const raw = String(text ?? '')

  let jewellerName = ''
  const nameMatch = /Jewellers?\s+Name\s*[:-]?\s*(.+)/i.exec(raw)
  if (nameMatch?.[1]) {
    jewellerName = nameMatch[1].split(NAME_STOP)[0]?.trim().replace(/\s+/g, ' ') ?? ''
  }

  let licenseNo = ''
  const licenseMatch =
    /Licen[cs]e\s*(?:No\.?|Number|#)\s*[:-]?\s*([A-Za-z0-9][A-Za-z0-9/-]*)/i.exec(raw) ||
    /\bCML\s*(?:No\.?|Number|#)\s*[:-]?\s*([A-Za-z0-9][A-Za-z0-9/-]*)/i.exec(raw)
  if (licenseMatch?.[1]) licenseNo = licenseMatch[1].trim()

  return { jewellerName, licenseNo }
}

export function verifyVoucherParty(
  party: { name: string; licenseNo: string },
  voucher: VoucherPartyIdentity,
): VoucherPartyVerdict {
  const partyLicense = normalizeLicenseNo(party.licenseNo)
  const voucherLicense = normalizeLicenseNo(voucher.licenseNo)
  const nameMatch = namesSupportMatch(party.name, voucher.jewellerName)
  const hasVoucherIdentity = Boolean(voucherLicense || normalizePartyName(voucher.jewellerName))

  if (!hasVoucherIdentity) {
    return {
      status: 'valid',
      reason: 'no_identity',
      allowAutoMap: true,
      licenseMatch: false,
      nameMatch: false,
    }
  }

  if (!partyLicense || !voucherLicense) {
    return {
      status: 'warning',
      reason: 'missing_license',
      allowAutoMap: false,
      licenseMatch: false,
      nameMatch,
    }
  }

  const licenseMatch = partyLicense === voucherLicense

  if (licenseMatch) {
    if (nameMatch || !normalizePartyName(voucher.jewellerName)) {
      const truncated =
        nameMatch &&
        normalizePartyName(party.name) !== normalizePartyName(voucher.jewellerName)
      return {
        status: 'valid',
        reason: truncated ? 'license_match_truncated_name' : 'license_match',
        allowAutoMap: true,
        licenseMatch: true,
        nameMatch,
      }
    }
    return {
      status: 'warning',
      reason: 'license_match_name_differs',
      allowAutoMap: true,
      licenseMatch: true,
      nameMatch: false,
    }
  }

  return {
    status: 'wrong_party',
    reason: nameMatch ? 'license_mismatch' : 'both_mismatch',
    allowAutoMap: false,
    licenseMatch: false,
    nameMatch,
  }
}

export function noticeForVerdict(
  verdict: VoucherPartyVerdict,
): { kind: 'error' | 'warning'; title: string; message: string; beep: boolean } | null {
  if (verdict.status === 'wrong_party') {
    return {
      kind: 'error',
      title: PARTY_VERIFY_FAILED_TITLE,
      message: PARTY_VERIFY_FAILED_MESSAGE,
      beep: true,
    }
  }
  if (verdict.reason === 'missing_license') {
    return {
      kind: 'warning',
      title: PARTY_VERIFY_REQUIRED_TITLE,
      message: PARTY_VERIFY_REQUIRED_MESSAGE,
      beep: false,
    }
  }
  if (verdict.reason === 'license_match_name_differs') {
    return {
      kind: 'warning',
      title: PARTY_NAME_DIFFERS_TITLE,
      message: PARTY_NAME_DIFFERS_MESSAGE,
      beep: false,
    }
  }
  return null
}
