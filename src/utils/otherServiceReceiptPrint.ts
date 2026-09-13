import { getInvoiceHeader } from '../data/firmProfile'
import {
  formatOtherServiceLineQuantity,
  formatOtherServiceQuantity,
  formatOtherServiceRate,
  otherServiceLineItemsOf,
  totalWeightOf,
  type OtherService,
} from '../data/otherServices'

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function money(n: number) {
  return `₹ ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatWhen(iso: string) {
  try {
    const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`)
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export function formatOtherServiceReceiptWhen(iso: string) {
  const raw = String(iso || '')
  try {
    const d = new Date(raw.includes('T') ? raw : `${raw}T12:00:00`)
    if (Number.isNaN(d.getTime())) return raw || '—'
    const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
    return `${date} • ${time}`
  } catch {
    return raw || '—'
  }
}

/** Visual barcode caption from the already-issued receipt number. Does not mint a new number. */
export function otherServiceReceiptBarcodeText(receiptNo: string) {
  const text = String(receiptNo || '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
  return text || 'RECEIPT'
}

export type OtherServiceReceiptSlipItem = {
  description: string
  quantity: string
  rate: string
  amount: string
}

export type OtherServiceReceiptSlipFact = {
  label: string
  value: string
}

export type OtherServiceReceiptSlip = {
  receiptNo: string
  barcodeText: string
  dateTimeLabel: string
  customerName: string
  serviceName: string
  kind: OtherService['kind']
  itemRows: OtherServiceReceiptSlipItem[]
  facts: OtherServiceReceiptSlipFact[]
  totalAmount: string
  paymentMode: string
  status: string
}

/**
 * Presentation model for the payment-success animation.
 * Uses the saved Other Service record only — no totals are recalculated here.
 */
export function buildOtherServiceReceiptSlip(row: OtherService): OtherServiceReceiptSlip {
  const items = otherServiceLineItemsOf(row)
  const itemRows: OtherServiceReceiptSlipItem[] =
    items.length && (row.kind === 'piece' || row.kind === 'weight')
      ? items.map((item) => ({
          description: item.description,
          quantity:
            row.kind === 'weight' ? formatOtherServiceLineQuantity(item) : String(item.quantity),
          rate:
            row.kind === 'weight'
              ? formatOtherServiceRate(item.rate, 'Per KG')
              : money(item.rate),
          amount: money(item.amount),
        }))
      : []
  const facts: OtherServiceReceiptSlipFact[] = itemRows.length
    ? row.kind === 'weight'
      ? [{ label: 'Total Weight', value: totalWeightOf(items).label }]
      : []
    : [
        {
          label: row.kind === 'weight' ? 'Weight' : 'Quantity',
          value: formatOtherServiceQuantity(row.quantity, row.unit),
        },
        { label: 'Rate', value: formatOtherServiceRate(row.rate, row.rateBasis) },
        { label: 'Amount', value: money(row.totalAmount) },
      ]
  return {
    receiptNo: row.receiptNo || '—',
    barcodeText: otherServiceReceiptBarcodeText(row.receiptNo || ''),
    dateTimeLabel: formatOtherServiceReceiptWhen(row.dateTime || row.date),
    customerName: row.customerName,
    serviceName: row.typeName,
    kind: row.kind,
    itemRows,
    facts,
    totalAmount: money(row.totalAmount),
    paymentMode: row.paymentMode,
    status: String(row.paymentStatus || 'Paid').toUpperCase(),
  }
}

export function otherServiceReceiptDetailsHtml(row: OtherService): string {
  const items = otherServiceLineItemsOf(row)
  if (row.kind === 'piece' && items.length) {
    const rows = items
      .map(
        (item) => `<tr>
          <td>${escapeHtml(item.description)}</td>
          <td>${escapeHtml(String(item.quantity))} pcs</td>
          <td>${money(item.rate)}</td>
          <td>${money(item.amount)}</td>
        </tr>`,
      )
      .join('')
    return `<tr><td class="lbl">SERVICE</td><td>${escapeHtml(row.typeName)}</td></tr>
      <tr><td colspan="2">
        <table class="items">
          <thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr><td colspan="3">Total</td><td>${money(row.totalAmount)}</td></tr></tfoot>
        </table>
      </td></tr>`
  }

  if (row.kind === 'weight' && items.length) {
    const weight = totalWeightOf(items)
    const rows = items
      .map(
        (item) => `<tr>
          <td>${escapeHtml(item.description)}</td>
          <td>${escapeHtml(formatOtherServiceLineQuantity(item))}</td>
          <td>${escapeHtml(formatOtherServiceRate(item.rate, 'Per KG'))}</td>
          <td>${money(item.amount)}</td>
        </tr>`,
      )
      .join('')
    return `<tr><td class="lbl">SERVICE</td><td>${escapeHtml(row.typeName)}</td></tr>
      <tr><td colspan="2">
        <table class="items">
          <thead><tr><th>Item</th><th>Weight</th><th>Rate</th><th>Amount</th></tr></thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr><td colspan="3">Total Weight</td><td>${escapeHtml(weight.label)}</td></tr>
            <tr><td colspan="3">Total Amount</td><td>${money(row.totalAmount)}</td></tr>
          </tfoot>
        </table>
      </td></tr>`
  }

  const qty = formatOtherServiceQuantity(row.quantity, row.unit)
  const qtyLabel = row.kind === 'weight' ? 'WEIGHT' : 'WEIGHT / QTY / PIECES'
  const extra =
    row.kind === 'weight'
      ? ''
      : `<tr><td class="lbl">ITEM / DESCRIPTION</td><td>${escapeHtml(row.item || row.productDescription || '—')}</td></tr>`
  return `${extra}
      <tr><td class="lbl">SERVICE</td><td>${escapeHtml(row.typeName)}</td></tr>
      <tr><td class="lbl">${qtyLabel}</td><td><span class="unit-note">${escapeHtml(qty)}</span></td></tr>
      <tr><td class="lbl">RATE</td><td>${escapeHtml(formatOtherServiceRate(row.rate, row.rateBasis))}</td></tr>
      <tr><td class="lbl">AMOUNT</td><td><strong>${money(row.totalAmount)}</strong></td></tr>`
}

function receiptHtml(row: OtherService, reprint: boolean) {
  const header = getInvoiceHeader(row.centreId)
  const receiptNo = row.receiptNo || '—'
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Other Service Receipt ${escapeHtml(receiptNo)}</title>
  <style>
    @page { size: A5; margin: 12mm; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 16px; font-family: "Segoe UI", Arial, sans-serif; color: #0f172a; background: #fff; }
    .sheet { max-width: 148mm; margin: 0 auto; }
    .head { display: flex; justify-content: space-between; gap: 16px; border-bottom: 2px solid #1a365d; padding-bottom: 12px; margin-bottom: 14px; }
    .firm strong { display: block; font-size: 15px; margin-bottom: 4px; }
    .firm div { font-size: 12px; color: #475569; line-height: 1.35; }
    .meta { text-align: right; flex-shrink: 0; }
    .meta h1 { margin: 0 0 6px; font-size: 16px; letter-spacing: 0.04em; }
    .meta div { font-size: 12px; }
    .reprint { color: #b45309; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    td { padding: 5px 0; vertical-align: top; }
    td.lbl { width: 42%; color: #64748b; font-weight: 600; font-size: 11px; letter-spacing: 0.03em; }
    table.items { margin: 6px 0 8px; border: 1px solid #cbd5e1; }
    table.items th, table.items td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
    table.items th { text-align: left; background: #f8fafc; color: #475569; font-size: 11px; }
    table.items td:nth-child(2), table.items td:nth-child(3), table.items td:nth-child(4),
    table.items th:nth-child(2), table.items th:nth-child(3), table.items th:nth-child(4) { text-align: right; }
    table.items tfoot td { border-bottom: 0; font-weight: 700; }
    .total { margin-top: 12px; padding-top: 10px; border-top: 1px dashed #cbd5e1; }
    .total strong { font-size: 16px; }
    .sign { margin-top: 36px; text-align: center; font-size: 12px; color: #334155; }
    .unit-note { font-size: 11px; color: #1a365d; font-weight: 700; }
    @media print { body { padding: 0; } .sheet { max-width: none; } }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="head">
      <div class="firm">
        <strong>${escapeHtml(header.centreName)}</strong>
        <div>${escapeHtml(header.centreAddress || '—')}</div>
        ${
          header.centreGstin && header.centreGstin !== '—'
            ? `<div>GSTIN: ${escapeHtml(header.centreGstin)}</div>`
            : ''
        }
      </div>
      <div class="meta">
        <h1>SERVICE RECEIPT</h1>
        ${reprint ? '<div class="reprint">REPRINT</div>' : ''}
        <div>Receipt No: <strong>${escapeHtml(receiptNo)}</strong></div>
        <div>Slip No: <strong>${escapeHtml(row.slipNo)}</strong></div>
        <div>${escapeHtml(formatWhen(row.dateTime || row.date))}</div>
      </div>
    </div>
    <table>
      <tr><td class="lbl">CUSTOMER</td><td><strong>${escapeHtml(row.customerName)}</strong></td></tr>
      <tr><td class="lbl">ADDRESS</td><td>${escapeHtml(row.address || '—')}</td></tr>
      <tr><td class="lbl">CONTACT NO.</td><td>${escapeHtml(row.contactNo || '—')}</td></tr>
      ${otherServiceReceiptDetailsHtml(row)}
      ${
        row.kind === 'piece' || (row.kind === 'weight' && otherServiceLineItemsOf(row).length)
          ? `<tr><td class="lbl">TOTAL AMOUNT</td><td><strong>${money(row.totalAmount)}</strong></td></tr>`
          : ''
      }
      ${
        row.kind !== 'weight' && row.productDescription && row.kind !== 'piece'
          ? ''
          : row.kind === 'weight' && row.productDescription
            ? `<tr><td class="lbl">DESCRIPTION</td><td>${escapeHtml(row.productDescription)}</td></tr>`
            : ''
      }
      <tr><td class="lbl">PAYMENT MODE</td><td>${escapeHtml(row.paymentMode)}</td></tr>
      <tr><td class="lbl">AMOUNT RECEIVED</td><td>${money(row.amountReceived)}</td></tr>
      <tr><td class="lbl">PENDING AMOUNT</td><td>${money(row.pendingAmount)}</td></tr>
      <tr><td class="lbl">REMARK</td><td>${escapeHtml(row.remark || '—')}</td></tr>
    </table>
    <div class="total">Total payable: <strong>${money(row.totalAmount)}</strong> · Status: <strong>${escapeHtml(row.paymentStatus)}</strong></div>
    <div class="sign">Received by: ____________________</div>
  </div>
</body>
</html>`
}

export function openOtherServiceReceiptPrint(row: OtherService, reprint = false): boolean {
  const w = window.open('', '_blank', 'width=800,height=900')
  if (!w) return false
  w.document.write(receiptHtml(row, reprint))
  w.document.close()
  w.onload = () => {
    setTimeout(() => {
      w.focus()
      w.print()
    }, 250)
  }
  return true
}

export function previewOtherServiceReceipt(row: OtherService, reprint = false): boolean {
  const w = window.open('', '_blank', 'width=800,height=900')
  if (!w) return false
  w.document.write(receiptHtml(row, reprint))
  w.document.close()
  return true
}
