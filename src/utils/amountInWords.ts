/**
 * Indian-numbering amount-in-words for invoice display.
 * Uses the same 2-decimal rupee/paise convention as billing `money()`.
 * Does not change how Grand Total is calculated.
 */

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
]

const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function twoDigits(n: number): string {
  if (n < 20) return ONES[n]
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`.trim()
}

function threeDigits(n: number): string {
  if (n < 100) return twoDigits(n)
  return `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${twoDigits(n % 100)}` : ''}`.trim()
}

/** Convert a non-negative integer using Indian grouping (thousand / lakh / crore). */
export function integerToIndianWords(n: number): string {
  const value = Math.floor(Math.abs(n))
  if (value === 0) return ''
  if (value < 1000) return threeDigits(value)
  if (value < 100000) {
    const thousand = Math.floor(value / 1000)
    const rest = value % 1000
    return `${integerToIndianWords(thousand)} Thousand${rest ? ` ${integerToIndianWords(rest)}` : ''}`.trim()
  }
  if (value < 10000000) {
    const lakh = Math.floor(value / 100000)
    const rest = value % 100000
    return `${integerToIndianWords(lakh)} Lakh${rest ? ` ${integerToIndianWords(rest)}` : ''}`.trim()
  }
  const crore = Math.floor(value / 10000000)
  const rest = value % 10000000
  return `${integerToIndianWords(crore)} Crore${rest ? ` ${integerToIndianWords(rest)}` : ''}`.trim()
}

/**
 * Words for an invoice Grand Total (rupees + paise).
 * Example: 12500 → "Rupees Twelve Thousand Five Hundred Only"
 */
export function amountInIndianWords(amount: number): string {
  if (!Number.isFinite(amount)) return 'Rupees Zero Only'
  const totalPaise = Math.round(Math.abs(amount) * 100)
  const rupees = Math.floor(totalPaise / 100)
  const paise = totalPaise % 100
  const rupeeWords = integerToIndianWords(rupees)
  const paiseWords = integerToIndianWords(paise)

  if (!rupees && !paise) return 'Rupees Zero Only'
  if (!rupees) return `Rupees and ${paiseWords} Paise Only`
  if (!paise) return `Rupees ${rupeeWords} Only`
  return `Rupees ${rupeeWords} and ${paiseWords} Paise Only`
}

/** Company Profile city → invoice jurisdiction footer. Never hardcodes a city. */
export function jurisdictionFooter(city?: string | null): string {
  const c = String(city || '').trim()
  return c ? `Subject to ${c} Jurisdiction` : 'Subject to Jurisdiction'
}
