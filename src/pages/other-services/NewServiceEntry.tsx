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
  selectableOtherServiceTypes,
  suggestDefaultWeightRatePerKg,
  totalWeightOf,
  UNIFIED_WEIGHT_SERVICE_SUBTITLE,
  type OtherService,
  type OtherServiceKind,
  type OtherServiceLineItemInput,
  type OtherServicePaymentMode,
  type OtherServiceRateBasis,
  type OtherServiceUnit,
} from '../../data/otherServices'
import { openOtherServiceReceiptPrint } from '../../utils/otherServiceReceiptPrint'
import { CustomerDetailsCard } from './entry/CustomerDetailsCard'
import {
  draftWeightFromSaved,
  newDraftItem,
  newDraftWeightItem,
  weightItemProductName,
  type DraftItem,
  type DraftWeightItem,
} from './entry/draft'
import { localYmd } from './entry/format'
import { LaserSolderingItems } from './entry/LaserSolderingItems'
import { ManualServiceDetails } from './entry/ManualServiceDetails'
import { PaymentDetails } from './entry/PaymentDetails'
import { ReadyToSaveCard } from './entry/ReadyToSaveCard'
import { SavePrintAsideButton, ServiceEntryActions } from './entry/ServiceEntryActions'
import { ServiceEntryHeader } from './entry/ServiceEntryHeader'
import { ServiceSummary } from './entry/ServiceSummary'
import { ServiceTypeSelector } from './entry/ServiceTypeSelector'
import { WeightPolishItems } from './entry/WeightPolishItems'
import { WeightServiceBrandHero } from './entry/WeightServiceBrandHero'
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

function seedWeightDrafts(editing: OtherService | undefined, defaultRate: string): DraftWeightItem[] {
  if (editing && editing.kind === 'weight') {
    const existing = otherServiceLineItemsOf(editing)
    if (existing.length) {
      return existing.map((line) =>
        draftWeightFromSaved({
          id: line.id,
          description: line.description,
          quantity: line.quantity,
          unit: line.unit,
          rate: line.rate,
        }),
      )
    }
    return [
      draftWeightFromSaved({
        description: editing.item || editing.productDescription || '',
        quantity: editing.quantity,
        unit: editing.unit === 'KG' ? 'KG' : 'GM',
        rate: Number(initialRate(editing.kind, editing.unit, editing.rateBasis, editing.rate)) || editing.rate,
      }),
    ]
  }
  return [newDraftWeightItem({ rate: defaultRate })]
}

export function NewServiceEntry() {
  const { toast, Toast } = useToast()
  const [params] = useSearchParams()
  const editId = params.get('id') || params.get('payment') || ''
  const allTypes = store.getOtherServiceTypes(true)
  const types = selectableOtherServiceTypes(store.getOtherServiceTypes())
  const editing = editId ? store.getOtherServiceById(editId) : undefined
  const suggestedRate = suggestDefaultWeightRatePerKg(store.getAll().otherServices || [])
  const defaultWeightRate = suggestedRate != null ? String(suggestedRate) : ''

  const selectableOrEditing = editing
    ? (() => {
        const found = allTypes.find((t) => t.id === editing.typeId)
        if (!found) return types
        if (types.some((t) => t.id === found.id)) return types
        return [found, ...types]
      })()
    : types

  const [typeId, setTypeId] = useState(editing?.typeId || selectableOrEditing[0]?.id || '')
  const [customerName, setCustomerName] = useState(editing?.customerName || '')
  const [address, setAddress] = useState(editing?.address || '')
  const [contactNo, setContactNo] = useState(editing?.contactNo || '')
  const [date, setDate] = useState(editing?.date || localYmd())
  const [unit, setUnit] = useState<OtherServiceUnit>(editing?.unit || 'GM')
  const [quantity, setQuantity] = useState(editing && editing.kind !== 'weight' ? String(editing.quantity) : '')
  const [rate, setRate] = useState(
    editing && editing.kind !== 'weight'
      ? initialRate(editing.kind, editing.unit, editing.rateBasis, editing.rate)
      : '',
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
  const [weightDrafts, setWeightDrafts] = useState<DraftWeightItem[]>(() =>
    seedWeightDrafts(editing, defaultWeightRate),
  )
  const [tick, setTick] = useState(0)
  const [saving, setSaving] = useState(false)
  const [receiptService, setReceiptService] = useState<OtherService | null>(null)
  const printedOnceRef = useRef(false)
  void tick
  void item
  void setItem

  const selectedType = selectableOrEditing.find((t) => t.id === typeId) || selectableOrEditing[0]
  const kind: OtherServiceKind = selectedType?.kind || 'manual'
  const isPiece = kind === 'piece'
  const isWeight = kind === 'weight'

  useEffect(() => {
    if (editing) return
    const nextUnit = defaultUnitForKind(kind)
    setUnit(nextUnit)
    setRateBasis(defaultRateBasisForKind(kind, nextUnit))
    if (kind === 'piece') setDraftItems([newDraftItem()])
    if (kind === 'weight') setWeightDrafts([newDraftWeightItem({ rate: defaultWeightRate })])
  }, [kind, editing, defaultWeightRate])

  useEffect(() => {
    if (kind === 'weight') return
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

  const parsedWeightItems: OtherServiceLineItemInput[] = useMemo(
    () =>
      weightDrafts.map((row) => ({
        description: weightItemProductName(row),
        quantity: Number(row.quantity),
        unit: row.unit,
        rate: Number(row.rate),
      })),
    [weightDrafts],
  )

  const draftHasValues = draftItems.some((row) => row.description.trim() || row.quantity !== '' || row.rate !== '')
  const weightHasValues = weightDrafts.some(
    (row) => weightItemProductName(row) || row.quantity !== '' || row.rate !== '',
  )

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
    if (isWeight) {
      if (!weightHasValues) return { ok: true as const, total: 0 }
      return calculateOtherServiceTotal({
        kind,
        unit: 'GM',
        rateBasis: 'Per KG',
        quantity: 0,
        rate: 0,
        items: parsedWeightItems,
      })
    }
    return calculateOtherServiceTotal({
      kind,
      unit,
      rateBasis,
      quantity: Number(quantity) || 0,
      rate: Number(rate) || 0,
    })
  }, [
    isPiece,
    isWeight,
    draftHasValues,
    weightHasValues,
    kind,
    unit,
    rateBasis,
    quantity,
    rate,
    parsedItems,
    parsedWeightItems,
  ])

  const total = calc.ok ? calc.total : 0
  const received = Number(amountReceived) || 0
  const pending = pendingAmountOf(total, received)
  const filledItemCount = isWeight
    ? weightDrafts.filter((row) => weightItemProductName(row) || row.quantity !== '' || row.rate !== '').length
    : draftItems.filter((row) => row.description.trim() || row.quantity !== '' || row.rate !== '').length

  const weightTotals = useMemo(() => {
    if (!isWeight || !weightHasValues || !calc.ok) {
      return { label: '—', secondary: undefined as string | undefined }
    }
    const normalizedRows = weightDrafts
      .map((row) => ({
        description: weightItemProductName(row),
        quantity: Number(row.quantity) || 0,
        unit: row.unit,
        rate: Number(row.rate) || 0,
        amount: 0,
      }))
      .filter((row) => row.description && row.quantity > 0)
    if (!normalizedRows.length) {
      return { label: '—', secondary: undefined as string | undefined }
    }
    const totalWeight = totalWeightOf(normalizedRows)
    if (totalWeight.unit === 'GM') {
      return {
        label: totalWeight.label,
        secondary: `${money2(totalWeight.quantity / 1000).toFixed(3)} KG`,
      }
    }
    return {
      label: totalWeight.label,
      secondary: `${money2(totalWeight.quantity * 1000)} g`,
    }
  }, [isWeight, weightHasValues, calc.ok, weightDrafts])

  const weightTotalLabel = weightTotals.label

  const quantityLabel = isPiece
    ? `${draftItems.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0)} pcs`
    : isWeight
      ? weightTotalLabel
      : quantity === ''
        ? '—'
        : formatOtherServiceQuantity(Number(quantity) || 0, unit)

  const updateDraft = (key: string, patch: Partial<DraftItem>) => {
    setDraftItems((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  const removeDraft = (key: string) => {
    setDraftItems((rows) => (rows.length <= 1 ? [newDraftItem()] : rows.filter((row) => row.key !== key)))
  }

  const updateWeightDraft = (key: string, patch: Partial<DraftWeightItem>) => {
    setWeightDrafts((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  const removeWeightDraft = (key: string) => {
    setWeightDrafts((rows) =>
      rows.length <= 1 ? [newDraftWeightItem({ rate: defaultWeightRate })] : rows.filter((row) => row.key !== key),
    )
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
    setWeightDrafts([newDraftWeightItem({ rate: defaultWeightRate })])
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
      : isWeight
        ? {
            customerName,
            address,
            contactNo,
            date,
            unit: 'GM' as const,
            quantity: 0,
            rate: 0,
            rateBasis: 'Per KG' as const,
            item: '',
            productDescription,
            remark,
            amountReceived: received,
            paymentMode,
            items: parsedWeightItems,
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
      setQuantity(editing.kind === 'weight' ? '' : String(editing.quantity ?? ''))
      setRate(
        editing.kind === 'weight'
          ? ''
          : initialRate(editing.kind, editing.unit, editing.rateBasis, editing.rate),
      )
      setRateBasis(editing.kind === 'weight' ? 'Per KG' : editing.rateBasis || 'Per Gram')
      setItem(editing.item || '')
      setProductDescription(editing.productDescription || '')
      setRemark(editing.remark || '')
      setAmountReceived(String(editing.amountReceived ?? ''))
      setPaymentMode(editing.paymentMode || 'Cash')
      const existing = otherServiceLineItemsOf(editing)
      setDraftItems(
        existing.length && editing.kind === 'piece'
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
      setWeightDrafts(seedWeightDrafts(editing, defaultWeightRate))
      return
    }
    setDate(localYmd())
    setPaymentMode('Cash')
    resetBlank()
  }

  const weightErrorVisible = weightHasValues
  const manualErrorVisible = rate !== '' && (unit === 'Fixed' || quantity !== '')

  return (
    <div className={`nse-page${isWeight ? ' nse-page-weight' : ''}`}>
      {!isWeight ? (
        <ServiceEntryHeader editing={Boolean(editing)} slipNo={editing?.slipNo} date={date} />
      ) : null}
      <form onSubmit={submit}>
        <ServiceTypeSelector
          types={selectableOrEditing}
          typeId={typeId}
          disabled={Boolean(editing)}
          onChange={setTypeId}
        />
        {isWeight ? (
          <WeightServiceBrandHero
            title={selectedType?.name || 'Silver Polish / Vibrating'}
            subtitle={UNIFIED_WEIGHT_SERVICE_SUBTITLE}
            slipNo={editing?.slipNo}
          />
        ) : null}
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
              <WeightPolishItems
                items={weightDrafts}
                onAdd={() =>
                  setWeightDrafts((rows) => [
                    ...rows,
                    newDraftWeightItem({
                      rate: rows.find((r) => r.rate)?.rate || defaultWeightRate,
                    }),
                  ])
                }
                onUpdate={updateWeightDraft}
                onRemove={removeWeightDraft}
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
            {isWeight && weightErrorVisible && !calc.ok ? <p className="nse-error">{calc.error}</p> : null}
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
              itemCount={isPiece || isWeight ? filledItemCount : undefined}
              quantityLabel={quantityLabel}
              weightLabel={isWeight ? weightTotalLabel : undefined}
              weightSecondary={isWeight ? weightTotals.secondary : undefined}
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
            {isWeight ? <SavePrintAsideButton editing={Boolean(editing)} saving={saving} /> : null}
          </aside>
        </div>
        <ServiceEntryActions
          editing={Boolean(editing)}
          saving={saving}
          onClear={clearForm}
          compact={isWeight}
        />
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
