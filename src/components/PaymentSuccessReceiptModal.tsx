import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { BrandLogo } from './BrandLogo'
import { getInvoiceHeader } from '../data/firmProfile'
import type { OtherService } from '../data/otherServices'
import {
  buildOtherServiceReceiptSlip,
  otherServiceReceiptBarcodeText,
} from '../utils/otherServiceReceiptPrint'
import './PaymentSuccessReceiptModal.css'

const PRINTING_MS = 2200

type PaymentSuccessReceiptModalProps = {
  open: boolean
  service: OtherService | null
  onPrint: () => void
  onDone: () => void
}

function prefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function barcodeBars(text: string) {
  const seed = otherServiceReceiptBarcodeText(text)
  const bars: number[] = [2]
  for (const ch of seed) {
    const n = ch.charCodeAt(0)
    bars.push(1 + (n % 3), 1, 2 + ((n >> 2) % 2), 1)
  }
  bars.push(2)
  return bars
}

export function PaymentSuccessReceiptModal({
  open,
  service,
  onPrint,
  onDone,
}: PaymentSuccessReceiptModalProps) {
  const titleId = useId()
  const descId = useId()
  const printBtnRef = useRef<HTMLButtonElement>(null)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone
  const [complete, setComplete] = useState(false)
  const reduced = open && prefersReducedMotion()

  const slip = useMemo(() => (service ? buildOtherServiceReceiptSlip(service) : null), [service])
  const header = useMemo(() => (open ? getInvoiceHeader(service?.centreId) : null), [open, service?.centreId])
  const bars = useMemo(() => (slip ? barcodeBars(slip.receiptNo) : []), [slip])

  useEffect(() => {
    if (!open || !service) {
      setComplete(false)
      return
    }
    if (prefersReducedMotion()) {
      setComplete(true)
      return
    }
    setComplete(false)
    const timer = window.setTimeout(() => setComplete(true), PRINTING_MS)
    return () => window.clearTimeout(timer)
  }, [open, service])

  useEffect(() => {
    if (!open) return
    const prev = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      onDoneRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKey)
      prev?.focus()
    }
  }, [open])

  useEffect(() => {
    if (open && complete) printBtnRef.current?.focus()
  }, [open, complete])

  if (!open || !service || !slip) return null

  const brandName = header?.centreName || 'SMG Hallmarking Centre'
  const overlayClass = [
    'os-pr-overlay',
    complete ? 'is-complete' : 'is-printing',
    reduced ? 'is-reduced' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={overlayClass}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
    >
      <div className="os-pr-stage">
        <div className="os-pr-machine">
          <div className="os-pr-particles" aria-hidden>
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="os-pr-printer">
            <div className="os-pr-printer-shake">
              <div className="os-pr-body">
                <div className="os-pr-face">
                  <div className="os-pr-brand">
                    <BrandLogo markOnly size={22} />
                    SMG
                  </div>
                  <div className="os-pr-led-wrap">
                    <span className="os-pr-led" aria-hidden />
                    Ready
                  </div>
                </div>
                <div className="os-pr-slot" aria-hidden />
              </div>
            </div>
          </div>
          <div className="os-pr-chute">
            <article className="os-pr-paper" aria-label={`Receipt ${slip.receiptNo}`}>
              <header className="os-pr-head">
                <div className="os-pr-head-logo">
                  <BrandLogo markOnly size={28} />
                </div>
                <strong>SMG</strong>
                <span>HALLMARKING CENTRE</span>
                <span>{brandName}</span>
              </header>
              <div className="os-pr-paid">
                <span className="os-pr-paid-icon" aria-hidden>
                  <Check size={12} strokeWidth={3} />
                </span>
                PAYMENT RECEIVED
              </div>
              <dl className="os-pr-rows">
                <div className="os-pr-row">
                  <dt>Receipt No.</dt>
                  <dd>{slip.receiptNo}</dd>
                </div>
                <div className="os-pr-row">
                  <dt>Date &amp; Time</dt>
                  <dd>{slip.dateTimeLabel}</dd>
                </div>
                <div className="os-pr-row">
                  <dt>Customer Name</dt>
                  <dd>{slip.customerName}</dd>
                </div>
                <div className="os-pr-row">
                  <dt>Service</dt>
                  <dd>{slip.serviceName}</dd>
                </div>
              </dl>
              {slip.itemRows.length > 0 ? (
                <table className="os-pr-items">
                  <thead>
                    <tr>
                      <th>ITEM</th>
                      <th>QTY</th>
                      <th>RATE</th>
                      <th>AMOUNT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slip.itemRows.map((item) => (
                      <tr key={`${item.description}-${item.quantity}-${item.rate}`}>
                        <td>{item.description}</td>
                        <td>{item.quantity}</td>
                        <td>{item.rate}</td>
                        <td>{item.amount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
              {slip.facts.length > 0 ? (
                <dl className="os-pr-rows">
                  {slip.facts.map((fact) => (
                    <div className="os-pr-row" key={fact.label}>
                      <dt>{fact.label}</dt>
                      <dd>{fact.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              <hr className="os-pr-rule" />
              <div className="os-pr-total">
                <span>TOTAL AMOUNT</span>
                <strong>{slip.totalAmount}</strong>
              </div>
              <div className="os-pr-status">
                <span>Payment Mode</span>
                <span>{slip.paymentMode}</span>
              </div>
              <div className="os-pr-status">
                <span>STATUS</span>
                <strong>{slip.status}</strong>
              </div>
              <div className="os-pr-barcode" aria-hidden>
                {bars.map((width, index) => (
                  <i key={`${width}-${index}`} style={{ width }} />
                ))}
              </div>
              <span className="os-pr-barcode-caption">{slip.barcodeText}</span>
              <div className="os-pr-thanks">
                <strong>Thank you for choosing SMG</strong>
                <span>PURITY • PRECISION • TRUST</span>
              </div>
            </article>
          </div>
        </div>
        <div className="os-pr-status-panel">
          <div className="os-pr-check" aria-hidden>
            <Check size={18} strokeWidth={3} />
          </div>
          <h2 id={titleId}>Payment Recorded Successfully!</h2>
          <p id={descId} aria-live="polite">
            {complete ? 'Your receipt has been generated.' : 'Your receipt is being printed...'}
          </p>
          {complete ? (
            <div className="os-pr-actions">
              <button
                ref={printBtnRef}
                type="button"
                className="btn btn-navy"
                onClick={onPrint}
                aria-label="Print the generated receipt again"
              >
                Print Again
              </button>
              <button type="button" className="btn btn-ghost" onClick={onDone}>
                Done
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}