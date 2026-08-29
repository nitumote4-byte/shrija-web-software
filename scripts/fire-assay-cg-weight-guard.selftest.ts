/**
 * Fire Assay Create Sheet — refuse persist when CG Weight is missing/invalid.
 * Run: npx --yes tsx scripts/fire-assay-cg-weight-guard.selftest.ts
 */
import {
  hasAvailableCgWeightForSheet,
  isValidCgWeightValue,
} from '../src/data/cgWeightAvailability.ts'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

function assertEq(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

// --- CASE A / C: missing or non-valid CG is unavailable ---
{
  assertEq(isValidCgWeightValue(undefined), false, 'A. undefined is not a CG weight')
  assertEq(isValidCgWeightValue(null), false, 'C. null is not a CG weight')
  assertEq(isValidCgWeightValue(''), false, 'C. empty string is not a CG weight')
  assertEq(isValidCgWeightValue(0), false, 'C. zero is not a CG weight')
  assertEq(isValidCgWeightValue(NaN), false, 'C. NaN is not a CG weight')
  assertEq(hasAvailableCgWeightForSheet(undefined, undefined), false, 'A. no CG1/CG2 → unavailable')
  assertEq(hasAvailableCgWeightForSheet(0, 0), false, 'C. 0/0 must not be treated as available')
  assertEq(hasAvailableCgWeightForSheet(null, ''), false, 'C. null/empty → unavailable')
  assert(
    !hasAvailableCgWeightForSheet(undefined, 0),
    'C. missing+zero must not allow sheet creation',
  )
}

// --- CASE B: a real unused/selected CG mass is available ---
{
  assertEq(isValidCgWeightValue(149.102), true, 'B. 149.102 is a valid CG weight')
  assertEq(hasAvailableCgWeightForSheet(149.102, undefined), true, 'B. CG1 alone is enough')
  assertEq(hasAvailableCgWeightForSheet(undefined, 149.08), true, 'B. CG2 alone is enough')
  assertEq(hasAvailableCgWeightForSheet(149.102, 149.08), true, 'B. both valid → available')
}

console.log('fire-assay-cg-weight-guard.selftest.ts: all assertions passed')
