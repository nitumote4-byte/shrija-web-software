import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, FileText, Home, Search } from 'lucide-react'
import { invoiceToChallan, type ChallanView } from '../components/InvoiceChallan'
import { InvoicePreviewPanel } from '../components/InvoicePreviewPanel'
import { useToast } from '../components/ui'
import { verifyLoginPassword } from '../data/auth'
import { store, type InvoiceLine } from '../data/store'
import {
  BILL_DELETE_CONFIRM_1,
  BILL_DELETE_CONFIRM_2,
  BILL_DELETE_PASSWORD_PROMPT,
  reduceBillDeletePhase,
  type BillDeletePhase,
} from '../data/requestBillingDeletion'
import { tenantGet } from '../data/tenant'
import {
  applyInvoicePaperForPrint,
  loadInvoicePaperSize,
  printInvoiceSheet,
  saveInvoicePaperSize,
  type InvoicePaperSize,
} from '../utils/invoicePaper'
import { invoiceTotalsFromActual, parseMinBillAmount } from '../utils/minBillCharge'

function money(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function loadMinBillSettings() {
  try {
    const raw = tenantGet('shrija-invoice-settings')
    if (!raw) {
      return { enabled: false, minAmount: parseMinBillAmount(undefined) }
    }
    const parsed = JSON.parse(raw) as { minBillCharges?: boolean; minBillAmount?: unknown }
    return {
      enabled: Boolean(parsed.minBillCharges),
      minAmount: parseMinBillAmount(parsed.minBillAmount),
    }
  } catch {
    return { enabled: false, minAmount: parseMinBillAmount(undefined) }
  }
}

function recalc(
  lines: InvoiceLine[],
  useIgst: boolean,
  skipMinBill: boolean,
  settings: { enabled: boolean; minAmount: number },
) {
  const actual = Number(lines.reduce((s, l) => s + l.amount, 0).toFixed(2))
  return invoiceTotalsFromActual(actual, {
    enabled: settings.enabled,
    minAmount: settings.minAmount,
    skipMinBill,
    useIgst,
  })
}

export function ViewGeneratedBills() {
  const data = store.getAll()
  const { toast, Toast } = useToast()
  const minBillSettings = loadMinBillSettings()
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
  const [paperSize, setPaperSize] = useState<InvoicePaperSize>(() => loadInvoicePaperSize())
  const [tick, setTick] = useState(0)
  const [deletePhase, setDeletePhase] = useState<BillDeletePhase>('idle')
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)
  void tick

  const setPaper = (size: InvoicePaperSize) => {
    setPaperSize(size)
    saveInvoicePaperSize(size)
    applyInvoicePaperForPrint(size)
  }

  const invoices = data.invoices

  const skipMinBillForActive = () => {
    const inv = activeId ? store.getInvoiceById(activeId) : null
    const party =
      data.parties.find((p) => p.id === inv?.partyId) ||
      data.parties.find((p) => p.name === (inv?.partyName || preview?.partyName))
    return Boolean(party?.skipMinBill)
  }

  const options = useMemo(() => {
    return invoices.map((inv) => ({
      key: inv.id,
      label: `${inv.requestNo} / Inv ${inv.invoiceNo} — ${inv.partyName}`,
    }))
  }, [invoices])

  const livePreview: ChallanView | null = (() => {
    if (!preview) return null
    if (!editing) return preview
    const lines = editLines.map((l) => ({
      ...l,
      amount: Number((Math.max(0, l.hm) * l.rate).toFixed(2)),
    }))
    const r = recalc(lines, preview.useIgst, skipMinBillForActive(), minBillSettings)
    return {
      ...preview,
      lines,
      ...editWeights,
      weightReturned: Number(
        (editWeights.weightReceived - editWeights.sampleWeight).toFixed(3),
      ),
      taxable: r.taxable,
      cgst: r.cgst,
      sgst: r.sgst,
      igst: r.igst,
      grandTotal: r.grandTotal,
      minChargeAdjustment: r.minChargeAdjustment,
    }
  })()

  const loadInvoice = (id: string) => {
    const inv = store.getInvoiceById(id)
    if (!inv) {
      toast('Invoice not found')
      return null
    }
    const all = store.getAll()
    const view = invoiceToChallan(inv, all)
    // Persist hydrated snapshot so reprint stays complete
    if ((!inv.lines || inv.lines.length === 0) && view.lines.length > 0) {
      store.updateInvoice(inv.id, {
        lines: view.lines,
        weightReceived: view.weightReceived,
        sampleWeight: view.sampleWeight,
        unusedSample: view.unusedSample,
        fireboxScrap: view.fireboxScrap,
        weightReturned: view.weightReturned,
        partyAddress: view.partyAddress,
        partyGstin: view.partyGstin,
        partyCml: view.partyCml,
        placeOfSupply: view.placeOfSupply,
        stateCode: view.stateCode,
        careOf: view.careOf,
        requestDate: view.requestDate,
        cgst: view.cgst,
        sgst: view.sgst,
        igst: view.igst,
        useIgst: view.useIgst,
        sac: '998346',
      })
    }
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
      toast('Select Request Number Or Invoice No')
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
    printInvoiceSheet(paperSize)
  }

  const downloadPdf = () => {
    if (!preview) {
      toast('Get a bill first')
      return
    }
    toast(`Print → Save as PDF (${paperSize})`)
    setTimeout(() => printInvoiceSheet(paperSize), 200)
  }

  const resetBillDelete = () => {
    setDeletePhase('idle')
    setDeletePassword('')
    setDeleteError('')
    setDeleteBusy(false)
  }

  const commitBillDelete = () => {
    if (!activeId) return
    const ok = store.deleteInvoice(activeId)
    resetBillDelete()
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

  const deleteBill = () => {
    if (!activeId || !preview) {
      toast('Get a bill first')
      return
    }
    setDeletePassword('')
    setDeleteError('')
    setDeletePhase(reduceBillDeletePhase('idle', { type: 'start' }))
  }

  const submitDeletePassword = async () => {
    if (deleteBusy) return
    const password = deletePassword
    if (!password) {
      setDeleteError('Password is required')
      return
    }
    setDeleteBusy(true)
    setDeleteError('')
    const result = await verifyLoginPassword(password)
    setDeletePassword('')
    setDeleteBusy(false)
    if (!result.ok) {
      setDeletePhase(reduceBillDeletePhase('password', { type: 'passwordResult', ok: false }))
      setDeleteError(result.error || 'Incorrect password')
      return
    }
    setDeletePhase(reduceBillDeletePhase('password', { type: 'passwordResult', ok: true }))
  }

  const onConfirm1 = (ok: boolean) => {
    setDeletePhase(reduceBillDeletePhase('confirm1', { type: 'confirm1', ok }))
  }

  const onConfirm2 = (ok: boolean) => {
    const next = reduceBillDeletePhase('confirm2', { type: 'confirm2', ok })
    if (next === 'deleted') {
      commitBillDelete()
      return
    }
    setDeletePhase(next)
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
    const lines = editLines.map((l) => ({
      ...l,
      amount: Number((Math.max(0, l.hm) * l.rate).toFixed(2)),
    }))
    const useIgst = preview.useIgst
    const { taxable, cgst, sgst, igst, tax, grandTotal, minChargeAdjustment } = recalc(
      lines,
      useIgst,
      skipMinBillForActive(),
      minBillSettings,
    )
    const weightReturned = Number(
      (editWeights.weightReceived - editWeights.sampleWeight).toFixed(3),
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
      minChargeAdjustment,
      weightReceived: editWeights.weightReceived,
      sampleWeight: editWeights.sampleWeight,
      unusedSample: editWeights.unusedSample,
      unusedSampleEdited: true,
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
    <div className="generated-bills-page">
      <nav className="gb-subnav no-print" aria-label="Billing navigation">
        <Link to="/">
          <Home size={14} /> Home
        </Link>
        <Link to="/billing">Billing</Link>
        <Link to="/monthly-billing">Monthly Billing</Link>
        <Link to="/generated-bills" className="active">
          View Bills
        </Link>
        <Link to="/monthly-bills">View Monthly Bills</Link>
      </nav>

      <h1 className="gb-page-title no-print">View Generated Bill</h1>

      <section className="gb-card no-print">
        <header className="gb-card-head">
          <Search size={18} />
          <h2>Search Invoice</h2>
        </header>
        <div className="gb-search-row">
          <label className="gb-select-wrap">
            <span>Select Request Number Or Invoice No.</span>
            <select
              value={selectedKey}
              onChange={(e) => setSelectedKey(e.target.value)}
              aria-label="Select Request Number Or Invoice No"
            >
              <option value="">Select Request Number Or Invoice No</option>
              {options.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <div className="gb-actions">
            <button type="button" className="gb-btn gb-btn-get" onClick={getBill}>
              Get
            </button>
            <button type="button" className="gb-btn gb-btn-print" onClick={printBill}>
              Print
            </button>
            <button type="button" className="gb-btn gb-btn-pdf" onClick={downloadPdf}>
              Download PDF
            </button>
            <button type="button" className="gb-btn gb-btn-del" onClick={deleteBill}>
              Delete
            </button>
            {!editing ? (
              <button type="button" className="gb-btn gb-btn-upd" onClick={startUpdate}>
                Update
              </button>
            ) : (
              <button type="button" className="gb-btn gb-btn-upd" onClick={saveUpdate}>
                Save Update
              </button>
            )}
          </div>
        </div>
      </section>

      {editing && preview && (
        <section className="gb-card generated-edit-panel no-print">
          <header className="gb-card-head">
            <FileText size={18} />
            <h2>Update invoice data</h2>
          </header>
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

      <InvoicePreviewPanel
        view={livePreview}
        paperSize={paperSize}
        onPaperChange={setPaper}
        hint="Get invoice → choose A4/A5 → Print / PDF · Update to edit lines & weights"
      />

      <div className="gb-back-wrap no-print">
        <Link to="/" className="gb-btn gb-btn-back">
          <ArrowLeft size={14} /> Back
        </Link>
      </div>
      {deletePhase === 'password' && (
        <div className="modal-backdrop" onClick={resetBillDelete}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>{BILL_DELETE_PASSWORD_PROMPT}</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void submitDeletePassword()
              }}
            >
              <div className="field">
                <label htmlFor="bill-delete-password">Login password</label>
                <input
                  id="bill-delete-password"
                  type="password"
                  autoComplete="current-password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  autoFocus
                />
              </div>
              {deleteError ? <p className="field-hint">{deleteError}</p> : null}
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={resetBillDelete}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={deleteBusy}>
                  OK
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deletePhase === 'confirm1' && (
        <div className="modal-backdrop" onClick={resetBillDelete}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>{BILL_DELETE_CONFIRM_1}</h3>
            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => onConfirm1(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={() => onConfirm1(true)}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {deletePhase === 'confirm2' && (
        <div className="modal-backdrop" onClick={resetBillDelete}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>{BILL_DELETE_CONFIRM_2}</h3>
            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => onConfirm2(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={() => onConfirm2(true)}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {Toast}
    </div>
  )
}
