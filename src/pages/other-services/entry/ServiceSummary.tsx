import { AnimatedAmount } from './AnimatedAmount'

export function ServiceSummary({
  serviceName,
  itemCount,
  quantityLabel,
  weightLabel,
  weightSecondary,
  total,
}: {
  serviceName: string
  itemCount?: number
  quantityLabel: string
  weightLabel?: string
  weightSecondary?: string
  total: number
}) {
  return (
    <section className="nse-card nse-summary-card">
      <div className="nse-card-head">
        <h2>Service Summary</h2>
        <p>Live totals for this slip</p>
      </div>
      <dl className="nse-summary-list">
        <div>
          <dt>Service Type</dt>
          <dd>{serviceName || '—'}</dd>
        </div>
        {itemCount != null ? (
          <div>
            <dt>Total Items</dt>
            <dd>{itemCount}</dd>
          </div>
        ) : (
          <div>
            <dt>Quantity</dt>
            <dd>{quantityLabel}</dd>
          </div>
        )}
        {weightLabel != null ? (
          <div>
            <dt>Total Weight</dt>
            <dd className="nse-summary-weight">
              <span>{weightLabel}</span>
              {weightSecondary ? <small>({weightSecondary})</small> : null}
            </dd>
          </div>
        ) : null}
      </dl>
      <div className="nse-summary-total">
        <span>Total Amount</span>
        <AnimatedAmount value={total} />
      </div>
    </section>
  )
}
