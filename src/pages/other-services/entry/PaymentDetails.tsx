import { Wallet } from 'lucide-react'
import type { OtherServicePaymentMode } from '../../../data/otherServices'
import { PAYMENT_MODES } from '../../../data/otherServices'
import { AnimatedAmount } from './AnimatedAmount'
import { money } from './format'

export function PaymentDetails({
  paymentMode,
  amountReceived,
  total,
  received,
  pending,
  onPaymentMode,
  onAmountReceived,
}: {
  paymentMode: OtherServicePaymentMode
  amountReceived: string
  total: number
  received: number
  pending: number
  onPaymentMode: (mode: OtherServicePaymentMode) => void
  onAmountReceived: (value: string) => void
}) {
  const paid = pending <= 0 && total > 0

  return (
    <section className="nse-card nse-pay-card">
      <div className="nse-card-head">
        <h2>Payment Details</h2>
        <p>Record what the customer paid</p>
      </div>
      <div className="nse-pay-fields">
        <label className="nse-field">
          <span>
            Payment Mode <em>*</em>
          </span>
          <span className="nse-input">
            <Wallet size={16} />
            <select
              value={paymentMode}
              onChange={(e) => onPaymentMode(e.target.value as OtherServicePaymentMode)}
            >
              {PAYMENT_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
          </span>
        </label>
        <label className="nse-field">
          <span>Amount Received</span>
          <span className="nse-input nse-input-prefix">
            <span>₹</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={amountReceived}
              onChange={(e) => onAmountReceived(e.target.value)}
              placeholder={money(total).replace(/^₹\s*/, '')}
            />
          </span>
        </label>
      </div>
      <div className="nse-pay-rows">
        <div>
          <span>Total Amount</span>
          <AnimatedAmount value={total} />
        </div>
        <div className="is-received">
          <span>Received</span>
          <strong>{money(received)}</strong>
        </div>
        <div className={pending > 0 ? 'is-pending' : 'is-clear'}>
          <span>Pending</span>
          <strong>{money(pending)}</strong>
        </div>
      </div>
      {paid ? <div className="nse-paid-pill">Paid</div> : null}
    </section>
  )
}
