/**
 * Vendor-only: mint extension popup license keys.
 * Usage: node tools/shrija-manak-extension/mint-license-key.mjs [seed] [days]
 * Example: node tools/shrija-manak-extension/mint-license-key.mjs CLIENT01 365
 *
 * Checksum must stay identical to license.js.
 */
const LICENSE_SALT = 'shrija-manak-ext-v1'

function computeCheck(a, b, c) {
  const raw = `${LICENSE_SALT}|${a}${b}${c}`
  let h = 2166136261
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i)
    h = Math.imul(h, 16777615)
  }
  return (h >>> 0).toString(16).toUpperCase().padStart(8, '0').slice(0, 4)
}

function seedToHex(seedHex) {
  const raw = String(seedHex || Date.now().toString(16)).toUpperCase()
  const hexOnly = raw.replace(/[^A-F0-9]/g, '')
  if (hexOnly.length >= 8) return hexOnly
  // Non-hex client codes (e.g. DEMO01) → stable hex via FNV
  let h = 2166136261
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i)
    h = Math.imul(h, 16777615)
  }
  return (h >>> 0).toString(16).toUpperCase().padStart(8, '0')
}

function mintLicenseKey(seedHex, durationDays) {
  const seed = seedToHex(seedHex).padStart(12, '0')
  const a = seed.slice(0, 4)
  const days = Math.max(1, Math.min(730, Number(durationDays) || 365))
  const b = days.toString(16).toUpperCase().padStart(4, '0')
  const c = seed.slice(4, 8) || 'A1B2'
  const check = computeCheck(a, b, c)
  return `SHRIJA-${a}-${b}-${c}-${check}`
}

const seed = process.argv[2] || Date.now().toString(16)
const days = Number(process.argv[3] || 365)
const key = mintLicenseKey(seed, days)
console.log(key)
console.error(`# days=${days} seed=${seed}`)
