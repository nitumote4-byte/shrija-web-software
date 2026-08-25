/**
 * Fire Assay job-card / lot uniqueness — lot-qualified ids, not job alone.
 * Run: npx --yes tsx scripts/fire-assay-job-card.selftest.ts
 */
import {
  findDuplicateLotQualifiedJob,
  lotQualifiedJobKey,
  parseLotJobCard,
  baseJobCardNumberFromRaw,
} from '../src/data/fireAssayJobCard.ts'
import { simulatedPairAssayFineness } from '../src/data/fireAssayBis.ts'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

function assertEq(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

type Row = { key: string; jobCardNo: string; lotNo?: number }

function pairRows(entries: [string, string][]): Row[] {
  const rows: Row[] = []
  entries.forEach(([a, b], i) => {
    const lot = parseLotJobCard(a || b).lotNo || i + 1
    rows.push({ key: `p${i}-a`, jobCardNo: a, lotNo: lot })
    rows.push({ key: `p${i}-b`, jobCardNo: b, lotNo: lot })
  })
  return rows
}

// --- Parse / unique key ---
{
  assertEq(parseLotJobCard('1_123').jobCard, '123', 'parse 1_123 job')
  assertEq(parseLotJobCard('1_123').lotNo, 1, 'parse 1_123 lot')
  assertEq(parseLotJobCard('2_123').jobCard, '123', 'parse 2_123 job')
  assertEq(parseLotJobCard('2_123').lotNo, 2, 'parse 2_123 lot')
  assertEq(lotQualifiedJobKey('1_123'), '123_1', 'key 1_123')
  assertEq(lotQualifiedJobKey('2_123'), '123_2', 'key 2_123')
  assertEq(lotQualifiedJobKey('1_124'), '124_1', 'key 1_124')
  assertEq(lotQualifiedJobKey('1-8080132061'), '8080132061_1', 'hyphen format')
  assertEq(lotQualifiedJobKey('127087789'), '127087789_0', 'plain Manak job card')
}

// --- 1. same job, different lots accepted: 1_123 + 2_123 ---
{
  const rows = pairRows([
    ['1_123', '1_123'],
    ['2_123', '2_123'],
  ])
  assertEq(
    findDuplicateLotQualifiedJob('2_123', rows[2].key, rows),
    null,
    '1. 1_123 + 2_123 accepted',
  )
  assertEq(
    findDuplicateLotQualifiedJob('1_123', rows[0].key, rows),
    null,
    '1. re-check first lot still unique vs second',
  )
}

// --- 2. same job, same lot rejected: 1_123 + 1_123 on different pairs ---
{
  const rows = pairRows([
    ['1_123', '1_123'],
    ['1_123', '1_123'],
  ])
  const dup = findDuplicateLotQualifiedJob('1_123', rows[2].key, rows)
  assert(dup, '2. 1_123 + 1_123 rejected')
  assertEq(dup!.key, rows[0].key, '2. duplicate points at first pair')
}

// --- 3. three lots accepted: 1_123 + 2_123 + 3_123 ---
{
  const rows = pairRows([
    ['1_123', '1_123'],
    ['2_123', '2_123'],
    ['3_123', '3_123'],
  ])
  assertEq(findDuplicateLotQualifiedJob('1_123', rows[0].key, rows), null, '3. lot1 ok')
  assertEq(findDuplicateLotQualifiedJob('2_123', rows[2].key, rows), null, '3. lot2 ok')
  assertEq(findDuplicateLotQualifiedJob('3_123', rows[4].key, rows), null, '3. lot3 ok')
}

// --- 4. different jobs accepted: 1_123 + 1_124 ---
{
  const rows = pairRows([
    ['1_123', '1_123'],
    ['1_124', '1_124'],
  ])
  assertEq(
    findDuplicateLotQualifiedJob('1_124', rows[2].key, rows),
    null,
    '4. 1_123 + 1_124 accepted',
  )
}

// --- 5. existing valid formats continue working ---
{
  assertEq(parseLotJobCard('1_8080132061').jobCard, '8080132061', '5. long job card')
  assertEq(parseLotJobCard('1_8080132061').lotNo, 1, '5. long job lot')
  assertEq(parseLotJobCard('2/127087789').lotNo, 2, '5. slash separator')
  assertEq(lotQualifiedJobKey('2/127087789'), '127087789_2', '5. slash key')
  const rows = pairRows([
    ['1_8080132061', '1_8080132061'],
    ['2_8080132061', '2_8080132061'],
  ])
  assertEq(
    findDuplicateLotQualifiedJob('2_8080132061', rows[2].key, rows),
    null,
    '5. long multi-lot accepted',
  )
  // Pair partner may share the exact same id
  assertEq(
    findDuplicateLotQualifiedJob('1_8080132061', rows[0].key, rows),
    null,
    '5. pair partner share allowed',
  )
}

// --- exact duplicate of 2_123 ---
{
  const rows = pairRows([
    ['2_123', '2_123'],
    ['2_123', '2_123'],
  ])
  assert(findDuplicateLotQualifiedJob('2_123', rows[2].key, rows), '2_123 + 2_123 rejected')
}

// --- Model C: job-level F* from base job card (not lot) ---
{
  assertEq(baseJobCardNumberFromRaw('1_123'), 123, 'base job from 1_123')
  assertEq(baseJobCardNumberFromRaw('2_123'), 123, 'base job from 2_123')
  assertEq(baseJobCardNumberFromRaw('3_123'), 123, 'base job from 3_123')
  assertEq(baseJobCardNumberFromRaw('1_124'), 124, 'base job from 1_124')
  const sheet = 1
  const f123a = simulatedPairAssayFineness('750', sheet, baseJobCardNumberFromRaw('1_123'))
  const f123b = simulatedPairAssayFineness('750', sheet, baseJobCardNumberFromRaw('2_123'))
  const f123c = simulatedPairAssayFineness('750', sheet, baseJobCardNumberFromRaw('3_123'))
  const f124 = simulatedPairAssayFineness('750', sheet, baseJobCardNumberFromRaw('1_124'))
  assertEq(f123a, f123b, 'job F*: 1_123 == 2_123')
  assertEq(f123a, f123c, 'job F*: 1_123 == 3_123')
  assert(f123a !== f124, 'job F*: 123 != 124')
}

console.log('fire-assay-job-card.selftest: all passed')
