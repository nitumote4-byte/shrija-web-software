import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PaymentSuccessReceiptModal } from '../../components/PaymentSuccessReceiptModal'
import { useToast } from '../../components/ui'
import { store } from '../../data/store'
import {
  calculateOtherServiceTotal,
  defaultRateBasisForKind,
  defaultUnitForKind,
  formatOtherServiceQuantity,
  money2,
  otherServiceLineItemsOf,
  pendingAmountOf,
  type OtherService,
  type OtherServiceKind,
  type OtherServiceLineItemInput,
  type OtherServicePaymentMode,
  type OtherServiceRateBasis,
  type OtherServiceUnit,
} from '../../data/otherServices'
import { openOtherServiceReceiptPrint } from '../../utils/otherServiceReceiptPrint'
import { CustomerDetailsCard } from './entry/CustomerDetailsCard'
import { newDraftItem, type DraftItem } from './entry/draft'
import { localYmd } from './entry/format'
import { LaserSolderingItems } from './entry/LaserSolderingItems'
import { ManualServiceDetails } from './entry/ManualServiceDetails'
import { PaymentDetails } from './entry/PaymentDetails'
import { ReadyToSaveCard } from './entry/ReadyToSaveCard'
import { ServiceEntryActions } from './entry/ServiceEntryActions'
import { ServiceEntryHeader } from './entry/ServiceEntryHeader'
import { ServiceSummary } from './entry/ServiceSummary'
import { ServiceTypeSelector } from './entry/ServiceTypeSelector'
import { WeightServiceDetails } from './entry/WeightServiceDetails'
import { serviceVisual } from './entry/serviceVisual'
import './entry/new-service-entry.css'

function initialRate(
  kind: OtherServiceKind | undefined,
  unit: OtherServiceUnit | undefined,
  rateBasis: OtherServiceRateBasis | undefined,
  rate: number | undefined,
) {
  if (rate == null) return ''
  if (kind === 'weight' && rateBasis === 'Per Gram' && unit === 'GM') {
    return String(money2(rate * 1000))
  }
  return String(rate)
}

export function NewServiceEntry() {
  const { toast, Toast } = useToast()
  const [params] = useSearchParams()
  const editId = params.get('id') || params.get('payment') || ''
  const types = store.getOtherServiceTypes()
  const editing = editId ? store.getOtherServiceById(editId) : undefined

  const [typeId, setTypeId] = useState(editing?.typeId || types[0]?.id || '')
  const [customerName, setCustomerName] = useState(editing?.customerName || '')
  const [address, setAddress] = useState(editing?.address || '')
  const [contactNo, setContactNo] = useState(editing?.contactNo || '')
  const [date, setDate] = useState(editing?.date || localYmd())
  const [unit, setUnit] = useState<OtherServiceUnit>(editing?.unit || 'GM')
  const [quantity, setQuantity] = useState(editing ? String(editing.quantity) : '')
  const [rate, setRate] = useState(
    editing ? initialRate(editing.kind, editing.unit, editing.rateBasis, editing.rate) : '',
  )
  const [rateBasis, setRateBasis] = useState<OtherServiceRateBasis>(
    editing?.kind === 'weight' ? 'Per KG' : editing?.rateBasis || 'Per Gram',
  )
  const [item, setItem] = useState(editing?.item || '')
  const [productDescription, setProductDescription] = useState(editing?.productDescription || '')
  const [remark, setRemark] = useState(editing?.remark || '')
  const [amountReceived, setAmountReceived] = useState(editing ? String(editing.amountReceived) : '')
  const [paymentMode, setPaymentMode] = useState<OtherServicePaymentMode>(editing?.paymentMode || 'Cash')
  const [draftItems, setDraftItems] = useState<DraftItem[]>(() => {
    if (!editing || editing.kind !== 'piece') return [newDraftItem()]
    const existing = otherServiceLineItemsOf(editing)
    if (!existing.length) return [newDraftItem()]
    return existing.map((line) =>
      newDraftItem({
        key: line.id,
        description: line.description,
        quantity: String(line.quantity),
        rate: String(line.rate),
      }),
    )
  })
  const [tick, setTick] = useState(0)
  const [saving, setSaving] = useState(false)
  const [receiptService, setReceiptService] = useState<OtherService | null>(null)
  const printedOnceRef = useRef(false)
  void tick

  const selectedType = types.find((t) => t.id === typeId) || types[0]
  const kind: OtherServiceKind = selectedType?.kind || 'manual'
  const isPiece = kind === 'piece'
  const isWeight = kind === 'weight'

  useEffect(() => {
    if (editing) return
    const nextUnit = defaultUnitForKind(kind)
    setUnit(nextUnit)
    setRateBasis(defaultRateBasisForKind(kind, nextUnit))
    if (kind === 'piece') setDraftItems([newDraftItem()])
  }, [kind, editing])

  useEffect(() => {
    setRateBasis(defaultRateBasisForKind(kind, unit))
  }, [unit, kind])

  const parsedItems: OtherServiceLineItemInput[] = useMemo(
    () =>
      draftItems.map((row) => ({
        description: row.description,
        quantity: Number(row.quantity),
        rate: Number(row.rate),
      })),
    [draftItems],
  )

  const draftHasValues = draftItems.some((row) => row.description.trim() || row.quantity !== '' || row.rate !== '')

  const calc = useMemo(() => {
    if (isPiece) {
      if (!draftHasValues) return { ok: true as const, total: 0 }
      return calculateOtherServiceTotal({
        kind,
        unit: 'Piece',
        rateBasis: 'Per Piece',
        quantity: 0,
        rate: 0,
        items: parsedItems,
      })
    }
    return calculateOtherServiceTotal({
      kind,
      unit,
      rateBasis,
      quantity: Number(quantity) || 0,
      rate: Number(rate) || 0,
    })
  }, [isPiece, draftHasValues, kind, unit, rateBasis, quantity, rate, parsedItems])

  const total = calc.ok ? calc.total : 0
  const received = Number(amountReceived) || 0
  const pending = pendingAmountOf(total, received)
  const filledItemCount = draftItems.filter(
    (row) => row.description.trim() || row.quantity !== '' || row.rate !== '',
  ).length
  const quantityLabel = isPiece
    ? `${draftItems.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0)} pcs`
    : quantity === ''
      ? '—'
      : formatOtherServiceQuantity(Number(quantity) || 0, unit)

  const updateDraft = (key: string, patch: Partial<DraftItem>) => {
    setDraftItems((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  const removeDraft = (key: string) => {
    setDraftItems((rows) => (rows.length <= 1 ? [newDraftItem()] : rows.filter((row) => row.key !== key)))
  }

  const resetBlank = () => {
    setCustomerName('')
    setAddress('')
    setContactNo('')
    setQuantity('')
    setRate('')
    setItem('')
    setProductDescription('')
    setRemark('')
    setAmountReceived('')
    setDraftItems([newDraftItem()])
  }

  const persistService = (printAfter: boolean) => {
    const payload = isPiece
      ? {
          customerName,
          address,
          contactNo,
          date,
          unit: 'Piece' as const,
          quantity: 0,
          rate: 0,
          rateBasis: 'Per Piece' as const,
          item: '',
          productDescription,
          remark,
          amountReceived: received,
          paymentMode,
          items: parsedItems,
        }
      : {
          customerName,
          address,
          contactNo,
          date,
          unit,
          quantity: Number(quantity) || 0,
          rate: Number(rate) || 0,
          rateBasis,
          item,
          productDescription,
          remark,
          amountReceived: received,
          paymentMode,
        }
    setSaving(true)
    try {
      if (editing) {
        const result = store.updateOtherService(editing.id, payload)
        if (!result.ok) {
          toast(result.error)
          return
        }
        setTick((n) => n + 1)
        toast(`Updated ${result.service.slipNo}`)
        if (printAfter) {
          printedOnceRef.current = false
          setReceiptService(result.service)
        }
        return
      }
      const result = store.addOtherService({
        typeId,
        ...payload,
      })
      if (!result.ok) {
        toast(result.error)
        return
      }
      setTick((n) => n + 1)
      toast(`Saved ${result.service.slipNo}`)
      if (printAfter) {
        printedOnceRef.current = false
        setReceiptService(result.service)
      }
      resetBlank()
    } finally {
      setSaving(false)
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const submitter = 'submitter' in e.nativeEvent ? (e.nativeEvent as SubmitEvent).submitter : null
    const intent = submitter instanceof HTMLButtonElement ? submitter.value : 'print'
    persistService(intent !== 'save')
  }

  const printSavedReceipt = () => {
    if (!receiptService) return
    const ok = openOtherServiceReceiptPrint(receiptService, printedOnceRef.current)
    printedOnceRef.current = true
    if (!ok) toast('Allow pop-ups to print the receipt')
  }

  const clearForm = () => {
    if (editing) {
      setCustomerName(editing.customerName || '')
      setAddress(editing.address || '')
      setContactNo(editing.contactNo || '')
      setDate(editing.date || localYmd())
      setUnit(editing.unit || 'GM')
      setQuantity(String(editing.quantity ?? ''))
      setRate(initialRate(editing.kind, editing.unit, editing.rateBasis, editing.rate))
      setRateBasis(editing.kind === 'weight' ? 'Per KG' : editing.rateBasis || 'Per Gram')
      setItem(editing.item || '')
      setProductDescription(editing.productDescription || '')
      setRemark(editing.remark || '')
      setAmountReceived(String(editing.amountReceived ?? ''))
      setPaymentMode(editing.paymentMode || 'Cash')
      const existing = otherServiceLineItemsOf(editing)
      setDraftItems(
        existing.length
          ? existing.map((line) =>
              newDraftItem({
                key: line.id,
                description: line.description,
                quantity: String(line.quantity),
                rate: String(line.rate),
              }),
            )
          : [newDraftItem()],
      )
      return
    }
    setDate(localYmd())
    setPaymentMode('Cash')
    resetBlank()
  }

  const weightErrorVisible = quantity !== '' && rate !== ''
  const manualErrorVisible = rate !== '' && (unit === 'Fixed' || quantity !== '')

  return (
    <div className="nse-page">
      <ServiceEntryHeader editing={Boolean(editing)} slipNo={editing?.slipNo} date={date} />
      <form onSubmit={submit}>
        <ServiceTypeSelector types={types} typeId={typeId} disabled={Boolean(editing)} onChange={setTypeId} />
        <div className="nse-layout">
          <div className="nse-main">
            <CustomerDetailsCard
              customerName={customerName}
              contactNo={contactNo}
              date={date}
              address={address}
              onCustomerName={setCustomerName}
              onContactNo={setContactNo}
              onDate={setDate}
              onAddress={setAddress}
            />
            {isPiece ? (
              <LaserSolderingItems
                title={selectedType?.name || 'Laser Soldering'}
                items={draftItems}
                total={total}
                onAdd={() => setDraftItems((rows) => [...rows, newDraftItem()])}
                onUpdate={updateDraft}
                onRemove={removeDraft}
              />
            ) : isWeight ? (
              <WeightServiceDetails
                title={selectedType?.name || 'Service details'}
                accent={selectedType ? serviceVisual(selectedType).accent : 'vibrator'}
                unit={unit}
                quantity={quantity}
                rate={rate}
                rateBasis={rateBasis}
                productDescription={productDescription}
                total={total}
                calcError={!calc.ok ? calc.error : undefined}
                showError={weightErrorVisible}
                onUnit={setUnit}
                onQuantity={setQuantity}
                onRate={setRate}
                onProductDescription={setProductDescription}
              />
            ) : (
              <ManualServiceDetails
                unit={unit}
                quantity={quantity}
                rate={rate}
                rateBasis={rateBasis}
                productDescription={productDescription}
                total={total}
                calcError={!calc.ok ? calc.error : undefined}
                showError={manualErrorVisible}
                onUnit={setUnit}
                onQuantity={setQuantity}
                onRate={setRate}
                onProductDescription={setProductDescription}
              />
            )}
            <section className="nse-card nse-remark">
              <div className="nse-card-head">
                <h2>Remark (Optional)</h2>
                <p>Any additional notes for this slip</p>
              </div>
              <label className="nse-field">
                <span className="sr-only">Remark</span>
                <textarea
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder="Any additional notes..."
                  rows={3}
                />
              </label>
            </section>
            {editing ? (
              <p className="nse-note">
                Slip {editing.slipNo} · Receipt {editing.receiptNo || '—'}
              </p>
            ) : null}
          </div>
          <aside className="nse-aside">
            <ServiceSummary
              serviceName={selectedType?.name || ''}
              itemCount={isPiece ? filledItemCount : undefined}
              quantityLabel={quantityLabel}
              total={total}
            />
            <PaymentDetails
              paymentMode={paymentMode}
              amountReceived={amountReceived}
              total={total}
              received={received}
              pending={pending}
              onPaymentMode={setPaymentMode}
              onAmountReceived={setAmountReceived}
            />
            <ReadyToSaveCard editing={Boolean(editing)} />
          </aside>
        </div>
        <ServiceEntryActions editing={Boolean(editing)} saving={saving} onClear={clearForm} />
      </form>
      <PaymentSuccessReceiptModal
        open={Boolean(receiptService)}
        service={receiptService}
        onPrint={printSavedReceipt}
        onDone={() => setReceiptService(null)}
      />
      {Toast}
    </div>
  )
}
