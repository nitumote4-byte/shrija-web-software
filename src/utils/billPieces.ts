/**
 * Party statement PCS is the hallmarked count saved on that bill (`lines.hm`).
 * Same-day rough sheets for other requests must not be added in.
 */
export function hallmarkedPiecesOnInvoice(
  inv: {
    lines?: { hm?: number }[]
    requestNo: string
  },
  data: {
    requests: { requestNo: string; pieces?: number; partyId?: string; date?: string }[]
    roughSheets: {
      requestNo?: string
      partyId?: string
      date?: string
      pic?: number
      rejectPic?: number
    }[]
  },
) {
  if (inv.lines?.length) {
    return inv.lines.reduce((sum, line) => sum + (Number(line.hm) || 0), 0)
  }
  const req = data.requests.find((r) => r.requestNo === inv.requestNo)
  const rough = data.roughSheets.filter(
    (row) =>
      row.requestNo === inv.requestNo ||
      (!row.requestNo && req && row.partyId === req.partyId && row.date === req.date),
  )
  const fromRough = rough.reduce(
    (sum, row) => sum + Math.max(0, (Number(row.pic) || 0) - (Number(row.rejectPic) || 0)),
    0,
  )
  if (fromRough) return fromRough
  return req?.pieces || 0
}
