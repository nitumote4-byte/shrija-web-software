import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { validateProductionSecrets } from './productionSecrets.js'

function codes(env: NodeJS.ProcessEnv): string[] {
  const result = validateProductionSecrets(env)
  return result.ok ? [] : result.codes
}

describe('production secret policy', () => {
  it('accepts three distinct long secrets', () => {
    const result = validateProductionSecrets({
      JWT_SECRET: 'a'.repeat(32),
      LICENSE_MASTER_SECRET: 'b'.repeat(32),
      MANAK_ENCRYPTION_KEY: 'c'.repeat(32),
    })
    assert.equal(result.ok, true)
  })

  it('reports missing, short, placeholder, and shared secrets by code', () => {
    assert.deepEqual(
      codes({}),
      ['JWT_SECRET:missing', 'LICENSE_MASTER_SECRET:missing', 'MANAK_ENCRYPTION_KEY:missing'],
    )
    assert.deepEqual(codes({
      JWT_SECRET: 'too-short',
      LICENSE_MASTER_SECRET: 'b'.repeat(32),
      MANAK_ENCRYPTION_KEY: 'c'.repeat(32),
    }), ['JWT_SECRET:short'])
    assert.deepEqual(codes({
      JWT_SECRET: 'shrija-dev-secret-change-in-production',
      LICENSE_MASTER_SECRET: 'change-me-separate-from-jwt',
      MANAK_ENCRYPTION_KEY: 'change-me-manak-encryption-key-not-jwt',
    }), [
      'JWT_SECRET:placeholder',
      'LICENSE_MASTER_SECRET:short',
      'LICENSE_MASTER_SECRET:placeholder',
      'MANAK_ENCRYPTION_KEY:placeholder',
    ])
    assert.deepEqual(codes({
      JWT_SECRET: 's'.repeat(40),
      LICENSE_MASTER_SECRET: 's'.repeat(40),
      MANAK_ENCRYPTION_KEY: 'c'.repeat(32),
    }), ['JWT_SECRET+LICENSE_MASTER_SECRET:shared'])
  })
})
