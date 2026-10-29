const MIN_SECRET_LENGTH = 32

/** Retired in-source fallbacks and example-file placeholders. Not live secrets. */
const PLACEHOLDERS = new Set([
  'shrija-dev-secret-change-in-production',
  'shrija-dev-license-master',
  'change-me-to-a-long-random-secret',
  'change-me-separate-from-jwt',
  'change-me-manak-encryption-key-not-jwt',
])

export const PRODUCTION_SECRET_NAMES = [
  'JWT_SECRET',
  'LICENSE_MASTER_SECRET',
  'MANAK_ENCRYPTION_KEY',
] as const

export type ProductionSecretName = (typeof PRODUCTION_SECRET_NAMES)[number]

export type ProductionSecretCheck =
  | { ok: true }
  | { ok: false; codes: string[] }

export function validateProductionSecrets(env: NodeJS.ProcessEnv): ProductionSecretCheck {
  const values = new Map<string, string>()
  const codes: string[] = []

  for (const name of PRODUCTION_SECRET_NAMES) {
    const value = String(env[name] ?? '').trim()
    values.set(name, value)
    if (!value) {
      codes.push(`${name}:missing`)
      continue
    }
    if (value.length < MIN_SECRET_LENGTH) codes.push(`${name}:short`)
    if (PLACEHOLDERS.has(value)) codes.push(`${name}:placeholder`)
  }

  const groups = new Map<string, string[]>()
  for (const name of PRODUCTION_SECRET_NAMES) {
    const value = values.get(name) ?? ''
    if (!value) continue
    const names = groups.get(value) ?? []
    names.push(name)
    groups.set(value, names)
  }
  for (const names of groups.values()) {
    if (names.length > 1) codes.push(`${names.join('+')}:shared`)
  }

  if (codes.length) return { ok: false, codes }
  return { ok: true }
}
