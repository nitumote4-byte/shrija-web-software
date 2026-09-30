/**
 * Runtime MAINTENANCE_MODE parsing. No database and no HTTP server.
 * Run: npm --prefix server test
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isMaintenanceModeEnabled } from './maintenanceMode.js'

function env(value?: string): NodeJS.ProcessEnv {
  return value === undefined ? {} : { MAINTENANCE_MODE: value }
}

describe('maintenance mode flag', () => {
  it('stays off when unset or not an explicit on token', () => {
    assert.equal(isMaintenanceModeEnabled(env()), false)
    for (const value of ['', 'false', '0', 'off', 'no', 'enabled', 'yes please']) {
      assert.equal(isMaintenanceModeEnabled(env(value)), false, value)
    }
  })

  it('turns on only for 1, true, yes, or on', () => {
    for (const value of ['1', 'true', 'TRUE', ' yes ', 'on', 'On']) {
      assert.equal(isMaintenanceModeEnabled(env(value)), true, value)
    }
  })
})
