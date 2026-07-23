import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { InvoiceChallan, invoiceToChallan, type ChallanView } from '../components/InvoiceChallan'
import { useToast } from '../components/ui'
import { store, type InvoiceLine } from '../data/store'

function money(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function recalc(lines: InvoiceLine[], useIgst: boolean) {
  const taxable = Number(lines.reduce((s, l) => s + l.amount, 0).toFixed(2))
  const cgst = useIgst ? 0 : Number((taxable * 0.09).toFixed(2))
  const sgst = useIgst ? 0 : Number((taxable * 0.09).toFixed(2))
  const igst = useIgst ? Number((taxable * 0.18).toFixed(2)) : 0
  return {
    taxable,
    cgst,
    sgst,
    igst,
    tax: cgst + sgst + igst,
    grandTotal: Number((taxable + cgst + sgst + igst).toFixed(2)),
  }
}

export function ViewGeneratedBills() {
  const data = store.getAll()
  const { toast, Toast } = useToast()
  const [selectedKey, setSelectedKey] = useState('')
  const [preview, setPreview] = useState<ChallanView | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [editLines, setEditLines] = useState<InvoiceLine[]>([])
  const [editWeights, setEditWeights] = useState({
    weightReceived: 0,
    sampleWeight: 0,
    unusedSample: 0,
    fireboxScrap: 0,
  })
  const [tick, setTick] = useState(0)
  void tick

  const invoices = data.invoices

  const options = useMemo(() => {
    return invoices.map((inv) => ({
      key: inv.id,
      label: `${inv.invoiceNo} · Req ${inv.requestNo} · ${inv.partyName}`,
    }))
  }, [invoices])

  const loadInvoice = (id: string) => {
    const inv = store.getInvoiceById(id)
    if (!inv) {
      toast('Invoice not found')
      return null
    }
    const view = invoiceToChallan(inv)
    setPreview(view)
    setActiveId(inv.id)
    setEditLines(view.lines.map((l) => ({ ...l })))
    setEditWeights({
      weightReceived: view.weightReceived,
      sampleWeight: view.sampleWeight,
      unusedSample: view.unusedSample,
      fireboxScrap: view.fireboxScrap,
    })
    setEditing(false)
    return inv
  }

  const getBill = () => {
    if (!selectedKey) {
      toast('Select Request Number or Invoice')
      return
    }
    const inv = loadInvoice(selectedKey)
    if (inv) toast(`Loaded invoice ${inv.invoiceNo}`)
  }

  const printBill = () => {
    if (!preview) {
      toast('Get a bill first')
      return
    }
    window.print()
  }

  const downloadPdf = () => {
    if (!preview) {
      toast('Get a bill first')
      return
    }
    toast('Print dialog → Destination: Save as PDF')
    setTimeout(() => window.print(), 200)
  }

  const deleteBill = () => {
    if (!activeId || !preview) {
      toast('Get a bill first')
      return
    }
    if (!window.confirm(`Delete invoice ${preview.invoiceNo}?`)) return
    const ok = store.deleteInvoice(activeId)
    if (!ok) {
      toast('Delete failed')
      return
    }
    setPreview(null)
    setActiveId(null)
    setSelectedKey('')
    setTick((t) => t + 1)
    toast('Invoice deleted · data pushed')
  }

  const startUpdate = () => {
    if (!preview || !activeId) {
      toast('Get a bill first')
      return
    }
    setEditing(true)
    toast('Edit melt / rates / weights, then Save Update')
  }

  const saveUpdate = () => {
    if (!activeId || !preview) return
    const inv = store.getInvoiceById(activeId)
    if (!inv) return
    const lines = editLines.map((l) => ({
      ...l,
      amount: Number((Math.max(0, l.hm) * l.rate).toFixed(2)),
    }))
    const useIgst = preview.useIgst
    const { taxable, cgst, sgst, igst, tax, grandTotal } = recalc(lines, useIgst)
    const weightReturned = Number(
      (
        editWeights.weightReceived -
        editWeights.sampleWeight +
        editWeights.unusedSample -
        editWeights.fireboxScrap
      ).toFixed(3),
    )
    const updated = store.updateInvoice(activeId, {
      lines,
      amount: taxable,
      tax,
      total: grandTotal,
      cgst,
      sgst,
      igst,
      useIgst,
      weightReceived: editWeights.weightReceived,
      sampleWeight: editWeights.sampleWeight,
      unusedSample: editWeights.unusedSample,
      fireboxScrap: editWeights.fireboxScrap,
      weightReturned,
      sac: '998346',
    })
    if (!updated) {
      toast('Update failed')
      return
    }
    setPreview(invoiceToChallan(updated))
    setEditLines(lines)
    setEditing(false)
    setTick((t) => t + 1)
    toast(`Invoice ${updated.invoiceNo} updated · data pushed`)
  }

  const patchLine = (idx: number, patch: Partial<InvoiceLine>) => {
    setEditLines((rows) =>
      rows.map((r, i) => {
        if (i !== idx) return r
        const next = { ...r, ...patch }
        if (patch.pcsRec != null || patch.rej != null || patch.melt != null || patch.hm != null) {
          const pcs = patch.pcsRec ?? next.pcsRec
          const rej = patch.rej ?? next.rej
          const melt = patch.melt ?? next.melt
          if (patch.hm == null) next.hm = Math.max(0, pcs - rej - melt)
        }
        next.amount = Number((Math.max(0, next.hm) * next.rate).toFixed(2))
        return next
      }),
    )
  }

  return (
    <div className="billing-page generated-bills-page">
      <div className="billing-title-row no-print">
        <h1 className="billing-title">View Generated Bill</h1>
        <Link to="/billing" className="btn btn-secondary">
          Invoice Generation
        </Link>
      </div>

      <section className="billing-controls generated-bill-search no-print">
        <label className="billing-field billing-field-wide">
          <span>Select Request Number or Invoice</span>
          <select
            value={selectedKey}
            onChange={(e) => setSelectedKey(e.target.value)}
            aria-label="Select Request Number or Invoice"
          >
            <option value="">Select Request Number Or Invoice No</option>
            {options.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn btn-navy" onClick={getBill}>
          Get
        </button>
        <button type="button" className="btn btn-secondary" onClick={printBill}>
          Print
        </button>
        <button type="button" className="btn btn-orange" onClick={downloadPdf}>
          Download PDF
        </button>
        <button type="button" className="btn btn-danger" onClick={deleteBill}>
          Delete
        </button>
        {!editing ? (
          <button type="button" className="btn btn-green" onClick={startUpdate}>
            Update
          </button>
        ) : (
          <button type="button" className="btn btn-green" onClick={saveUpdate}>
            Save Update
          </button>
        )}
      </section>

      {editing && preview && (
        <section className="generated-edit-panel no-print">
          <h3>Update invoice data</h3>
          <div className="generated-edit-weights">
            {(
              [
                ['weightReceived', 'Weight Received'],
                ['sampleWeight', 'Sample Weight'],
                ['unusedSample', 'Unused Sample Return'],
                ['fireboxScrap', 'Firebox Sample Scrapped'],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                <span>{label}</span>
                <input
                  type="number"
                  step="0.001"
                  value={editWeights[key]}
                  onChange={(e) =>
                    setEditWeights((w) => ({ ...w, [key]: Number(e.target.value) || 0 }))
                  }
                />
              </label>
            ))}
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Pcs</th>
                  <th>HM</th>
                  <th>Rej</th>
                  <th>Melt</th>
                  <th>Rate</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {editLines.map((line, i) => (
                  <tr key={i}>
                    <td>
                      <input
                        value={line.description}
                        onChange={(e) => patchLine(i, { description: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={line.pcsRec}
                        onChange={(e) => patchLine(i, { pcsRec: Number(e.target.value) || 0 })}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={line.hm}
                        onChange={(e) => patchLine(i, { hm: Number(e.target.value) || 0 })}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={line.rej}
                        onChange={(e) => patchLine(i, { rej: Number(e.target.value) || 0 })}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={line.melt}
                        onChange={(e) => patchLine(i, { melt: Number(e.target.value) || 0 })}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        value={line.rate}
                        onChange={(e) => patchLine(i, { rate: Number(e.target.value) || 0 })}
                      />
                    </td>
                    <td>{money(line.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </section>
      )}

      <h2 className="billing-preview-label no-print">Invoice Preview</h2>
      <InvoiceChallan
        view={
          editing && preview
            ? {
                ...preview,
                lines: editLines.map((l) => ({
                  ...l,
                  amount: Number((Math.max(0, l.hm) * l.rate).toFixed(2)),
                })),
                ...editWeights,
                weightReturned: Number(
                  (
                    editWeights.weightReceived -
                    editWeights.sampleWeight +
                    editWeights.unusedSample -
                    editWeights.fireboxScrap
                  ).toFixed(3),
                ),
                ...(() => {
                  const r = recalc(
                    editLines.map((l) => ({
                      ...l,
                      amount: Number((Math.max(0, l.hm) * l.rate).toFixed(2)),
                    })),
                    preview.useIgst,
                  )
                  return {
                    taxable: r.taxable,
                    cgst: r.cgst,
                    sgst: r.sgst,
                    igst: r.igst,
                    grandTotal: r.grandTotal,
                  }
                })(),
              }
            : preview
        }
      />

      <div className="manual-actions no-print">
        <Link to="/" className="btn btn-reset">
          Back
        </Link>
      </div>
      {Toast}
    </div>
  )
}
