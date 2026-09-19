/**
 * Extension popup license only — not used by Manak fill automation.
 * Key format: SHRIJA-XXXX-XXXX-XXXX-XXXX (last segment = checksum).
 */
const LICENSE_STORAGE_KEY = 'shrija-ext-license'
const LICENSE_SALT = 'shrija-manak-ext-v1'

function normalizeLicenseKey(key) {
  return String(key || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
}

function licenseParts(key) {
  const n = normalizeLicenseKey(key)
  const m = /^SHRIJA-([A-F0-9]{4})-([A-F0-9]{4})-([A-F0-9]{4})-([A-F0-9]{4})$/.exec(n)
  if (!m) return null
  return { full: n, a: m[1], b: m[2], c: m[3], check: m[4] }
}

/** Lightweight non-crypto checksum (popup-only; not security-critical crypto). */
function computeCheck(a, b, c) {
  const raw = `${LICENSE_SALT}|${a}${b}${c}`
  let h = 2166136261
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i)
    h = Math.imul(h, 16777615)
  }
  return (h >>> 0).toString(16).toUpperCase().padStart(8, '0').slice(0, 4)
}

function isValidLicenseKeyFormat(key) {
  const p = licenseParts(key)
  if (!p) return false
  return p.check === computeCheck(p.a, p.b, p.c)
}

/** Days encoded in middle hex: 1–730 (default 365 if 0). */
function durationDaysFromKey(key) {
  const p = licenseParts(key)
  if (!p) return 365
  const n = parseInt(p.b, 16) % 731
  return n === 0 ? 365 : n
}

function daysLeftFrom(expiresAt) {
  if (!expiresAt) return null
  const ms = new Date(expiresAt).getTime() - Date.now()
  return Math.ceil(ms / 86400000)
}

function evaluateLicense(record) {
  if (!record || !record.key) {
    return {
      ok: false,
      code: 'MISSING',
      status: 'inactive',
      key: null,
      activatedAt: null,
      expiresAt: null,
      daysLeft: null,
      reason: 'License key activate karo',
    }
  }
  if (!isValidLicenseKeyFormat(record.key)) {
    return {
      ok: false,
      code: 'INVALID',
      status: 'invalid',
      key: record.key,
      activatedAt: record.activatedAt || null,
      expiresAt: record.expiresAt || null,
      daysLeft: null,
      reason: 'License key invalid hai',
    }
  }
  const daysLeft = daysLeftFrom(record.expiresAt)
  if (daysLeft != null && daysLeft < 0) {
    return {
      ok: false,
      code: 'EXPIRED',
      status: 'expired',
      key: record.key,
      activatedAt: record.activatedAt || null,
      expiresAt: record.expiresAt || null,
      daysLeft,
      reason: 'License expire ho gayi',
    }
  }
  return {
    ok: true,
    code: 'OK',
    status: 'active',
    key: record.key,
    activatedAt: record.activatedAt || null,
    expiresAt: record.expiresAt || null,
    daysLeft,
    reason: null,
  }
}

function maskKey(key) {
  const n = normalizeLicenseKey(key)
  if (n.length < 14) return n || '—'
  return `${n.slice(0, 10)}••••${n.slice(-4)}`
}

function storageGet(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (data) => resolve(data || {}))
  })
}

function storageSet(obj) {
  return new Promise((resolve) => {
    chrome.storage.local.set(obj, () => resolve())
  })
}

function storageRemove(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.remove(keys, () => resolve())
  })
}

async function loadLicenseStatus() {
  const data = await storageGet([LICENSE_STORAGE_KEY])
  return evaluateLicense(data[LICENSE_STORAGE_KEY] || null)
}

async function activateLicense(rawKey) {
  const key = normalizeLicenseKey(rawKey)
  if (!isValidLicenseKeyFormat(key)) {
    return {
      ok: false,
      code: 'INVALID',
      status: 'invalid',
      key: null,
      activatedAt: null,
      expiresAt: null,
      daysLeft: null,
      reason: 'Sahi format: SHRIJA-XXXX-XXXX-XXXX-XXXX',
    }
  }
  const days = durationDaysFromKey(key)
  const activatedAt = new Date().toISOString()
  const expiresAt = new Date(Date.now() + days * 86400000).toISOString()
  const record = { key, activatedAt, expiresAt, days }
  await storageSet({ [LICENSE_STORAGE_KEY]: record })
  return evaluateLicense(record)
}

async function clearLicense() {
  await storageRemove([LICENSE_STORAGE_KEY])
  return evaluateLicense(null)
}

/** Dev / ops helper: build a valid key (not shown in popup UI). */
function seedToHex(seedHex) {
  const raw = String(seedHex || Date.now().toString(16)).toUpperCase()
  const hexOnly = raw.replace(/[^A-F0-9]/g, '')
  if (hexOnly.length >= 8) return hexOnly
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
