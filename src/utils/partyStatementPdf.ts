/** GoldShark-style Party Ledger HTML for print / share */

export type PartyLedgerRow = {
  jeweller: string
  type: string
  date: string
  pcs: number
  credit: number
  debit: number
  balance: number
  remarks: string
}

export type PartyLedgerDoc = {
  centreName: string
  centreAddress: string
  email: string
  gstin: string
  ledgerName: string
  ledgerAddress: string
  fromDate: string
  toDate: string
  rows: PartyLedgerRow[]
}

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function money2(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function statementFileBase(fromDate: string, toDate: string) {
  return `Statement_${fromDate}_to_${toDate}`
}

export function buildPartyLedgerHtml(doc: PartyLedgerDoc) {
  const bodyRows = doc.rows
    .map((r) => {
      const isTotal = r.type === 'Total'
      const isOpen = r.type.startsWith('Opening')
      const cls = isTotal ? 'total' : isOpen ? 'open' : ''
      const pcs = isTotal || r.pcs ? String(r.pcs) : ''
      return `<tr class="${cls}">
        <td>${escapeHtml(r.jeweller)}</td>
        <td>${escapeHtml(r.type)}</td>
        <td>${r.date ? escapeHtml(r.date) : ''}</td>
        <td class="num">${pcs}</td>
        <td class="num">${money2(r.credit)}</td>
        <td class="num">${money2(r.debit)}</td>
        <td class="num">${money2(r.balance)}</td>
        <td>${escapeHtml(r.remarks || '')}</td>
      </tr>`
    })
    .join('')

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>PARTY LEDGER</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 12px;
      font-family: "Segoe UI", Arial, sans-serif;
      color: #0f172a;
      background: #fff;
    }
    .head { text-align: center; position: relative; margin-bottom: 8px; }
    .head h1 { margin: 0 0 4px; font-size: 18px; letter-spacing: 0.02em; }
    .head .addr { font-size: 12px; color: #334155; line-height: 1.35; }
    .head .gst {
      position: absolute; right: 0; top: 0; font-size: 12px; font-weight: 700; color: #1e3a5f;
    }
    .title {
      text-align: center; color: #1e3a5f; font-size: 20px; font-weight: 800;
      margin: 10px 0 12px; letter-spacing: 0.04em;
    }
    .meta {
      display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
      border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px 14px; margin-bottom: 12px;
      font-size: 13px;
    }
    .meta strong { display: inline-block; min-width: 95px; color: #475569; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th {
      background: #1e3a5f; color: #fff; padding: 8px 6px; text-align: left;
      font-size: 11px; letter-spacing: 0.03em;
    }
    td { border-bottom: 1px solid #e2e8f0; padding: 6px; vertical-align: top; }
    tr:nth-child(even):not(.total):not(.open) td { background: #f8fafc; }
    tr.open td { background: #f1f5f9; font-weight: 600; }
    tr.total td { background: #dbeafe; font-weight: 700; border-top: 2px solid #94a3b8; }
    .num { text-align: right; white-space: nowrap; }
    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="head">
    <div class="gst">GST NO: ${escapeHtml(doc.gstin || '—')}</div>
    <h1>${escapeHtml(doc.centreName)}</h1>
    <div class="addr">${escapeHtml(doc.centreAddress || '—')}</div>
    <div class="addr">${escapeHtml(doc.email || '—')}</div>
  </div>
  <div class="title">PARTY LEDGER</div>
  <div class="meta">
    <div>
      <div><strong>Ledger Name:</strong> ${escapeHtml(doc.ledgerName)}</div>
      <div><strong>Address:</strong> ${escapeHtml(doc.ledgerAddress || '—')}</div>
    </div>
    <div>
      <div><strong>From Date:</strong> ${escapeHtml(doc.fromDate)}</div>
      <div><strong>To Date:</strong> ${escapeHtml(doc.toDate)}</div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>NAME OF JEWELLER</th>
        <th>TYPE</th>
        <th>DATE</th>
        <th>PCS</th>
        <th>CREDIT</th>
        <th>DEBIT</th>
        <th>BALANCE</th>
        <th>REMARKS</th>
      </tr>
    </thead>
    <tbody>${bodyRows}</tbody>
  </table>
</body>
</html>`
}

/** Opens print dialog — user can Save as PDF (GoldShark download flow). */
export function printPartyLedger(doc: PartyLedgerDoc) {
  const html = buildPartyLedgerHtml(doc)
  const w = window.open('', '_blank', 'width=1100,height=800')
  if (!w) return false
  w.document.write(html)
  w.document.close()
  w.onload = () => {
    setTimeout(() => {
      w.focus()
      w.print()
    }, 250)
  }
  return true
}

/** Build a File for Web Share API (HTML ledger — opens in browser / WhatsApp as attachment where supported). */
export function partyLedgerFile(doc: PartyLedgerDoc, fromDate: string, toDate: string) {
  const html = buildPartyLedgerHtml(doc)
  const name = `${statementFileBase(fromDate, toDate)}.html`
  return new File([html], name, { type: 'text/html' })
}

export async function sharePartyLedger(
  doc: PartyLedgerDoc,
  fromDate: string,
  toDate: string,
  message: string,
) {
  const file = partyLedgerFile(doc, fromDate, toDate)
  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean
    share?: (data: ShareData) => Promise<void>
  }
  if (nav.share && nav.canShare?.({ files: [file] })) {
    await nav.share({
      title: 'Party Statement',
      text: message,
      files: [file],
    })
    return 'shared' as const
  }
  if (nav.share) {
    await nav.share({ title: 'Party Statement', text: message })
    return 'shared-text' as const
  }
  return 'fallback' as const
}
