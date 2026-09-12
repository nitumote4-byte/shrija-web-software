import { FileText } from 'lucide-react'
import type { OtherServiceRateBasis, OtherServiceUnit } from '../../../data/otherServices'
import { MANUAL_UNITS } from '../../../data/otherServices'
import { AnimatedAmount } from './AnimatedAmount'

export function ManualServiceDetails({
  unit,
  quantity,
  rate,
  rateBasis,
  productDescription,
  total,
  calcError,
  showError,
  onUnit,
  onQuantity,
  onRate,
  onProductDescription,
}: {
  unit: OtherServiceUnit
  quantity: string
  rate: string
  rateBasis: OtherServiceRateBasis
  productDescription: string
  total: number
  calcError?: string
  showError: boolean
  onUnit: (unit: OtherServiceUnit) => void
  onQuantity: (value: string) => void
  onRate: (value: string) => void
  onProductDescription: (value: string) => void
}) {
  const qtyRequired = unit !== 'Fixed'

  return (
    <section className="nse-card nse-card-manual">
      <div className="nse-card-head">
        <h2>Manual Service</h2>
        <p>Custom charges for any additional work.</p>
      </div>
      <div className="nse-weight-grid">
        <label className="nse-field nse-field-span">
          <span>Service Description</span>
          <span className="nse-input">
            <FileText size={16} />
            <input
              value={productDescription}
              onChange={(e) => onProductDescription(e.target.value)}
              placeholder="Describe the service"
            />
          </span>
        </label>
        <label className="nse-field">
          <span>Unit</span>
          <select value={unit} onChange={(e) => onUnit(e.target.value as OtherServiceUnit)}>
            {MANUAL_UNITS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="nse-field">
          <span>{unit === 'Piece' ? 'Number of Pieces' : unit === 'Fixed' ? 'Quantity (optional)' : 'Quantity'}</span>
          <input
            type="number"
            min={unit === 'Piece' ? 1 : 0}
            step={unit === 'Piece' ? 1 : 0.001}
            value={quantity}
            onChange={(e) => onQuantity(e.target.value)}
            required={qtyRequired}
            placeholder={qtyRequired ? '0' : '—'}
          />
        </label>
        <label className="nse-field">
          <span>Rate</span>
          <span className="nse-input nse-input-prefix">
            <span>₹</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={rate}
              onChange={(e) => onRate(e.target.value)}
              required
            />
          </span>
        </label>
        <label className="nse-field">
          <span>Rate Basis</span>
          <input readOnly value={rateBasis} />
        </label>
      </div>
      <div className="nse-calc-box">
        <span>Amount</span>
        <AnimatedAmount value={total} />
      </div>
      {showError && calcError ? <p className="nse-error">{calcError}</p> : null}
    </section>
  )
}
