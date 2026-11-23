/**
 * Party statement PCS comes from the bill's own HM lines.
 * Run: npx --yes tsx scripts/bill-pieces.selftest.ts
 */
import { hallmarkedPiecesOnInvoice } from '../src/utils/billPieces.ts'

function assertEq(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`[bill-pieces] ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

const sameDayOtherBill = {
  requests: [
    { requestNo: 'RQ-A', pieces: 40, partyId: 'p1', date: '2026-10-27' },
    { requestNo: 'RQ-B', pieces: 225, partyId: 'p1', date: '2026-10-27' },
  ],
  roughSheets: [
    { requestNo: 'RQ-A', partyId: 'p1', date: '2026-10-27', pic: 40, rejectPic: 2 },
    { requestNo: 'RQ-B', partyId: 'p1', date: '2026-10-27', pic: 225, rejectPic: 0 },
  ],
}

assertEq(
  hallmarkedPiecesOnInvoice(
    {
      requestNo: 'RQ-A',
      lines: [
        { hm: 20 },
        { hm: 18 },
      ],
    },
    sameDayOtherBill,
  ),
  38,
  'saved bill HM lines are used, same-day other request is ignored',
)

assertEq(
  hallmarkedPiecesOnInvoice({ requestNo: 'RQ-A', lines: [] }, sameDayOtherBill),
  38,
  'bill without lines falls back to that request only (pic minus reject)',
)

assertEq(
  hallmarkedPiecesOnInvoice(
    { requestNo: 'RQ-MISSING' },
    { requests: [{ requestNo: 'RQ-MISSING', pieces: 12 }], roughSheets: [] },
  ),
  12,
  'no rough sheet uses the request piece count',
)

console.log('bill-pieces.selftest: all checks passed')
