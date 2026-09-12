import { Scale } from 'lucide-react'
import type { OtherServiceRateBasis, OtherServiceUnit } from '../../../data/otherServices'
import { WEIGHT_UNIT_OPTIONS } from '../../../data/otherServices'
import { AnimatedAmount } from './AnimatedAmount'
import { money } from './format'
import type { ServiceAccent } from './serviceVisual'

export function WeightServiceDetails({
  title,
  accent,
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
  title: string
  accent: ServiceAccent
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
  const qtyLabel = unit === 'KG' ? 'KG' : 'g'
  const entered = quantity !== '' && rate !== ''
  const formula = entered
    ? `${quantity} ${qtyLabel} × ${money(Number(rate) || 0)}/kg = ${money(total)}`
    : null

  return (
    <section className={`nse-card nse-card-weight accent-${accent}`}>
      <div className="nse-card-head">
        <h2>{title}</h2>
        <p>Rate is always per KG. The quantity you enter keeps its unit.</p>
      </div>
      <div className="nse-weight-grid">
        <label className="nse-field">
          <span>Unit</span>
          <select value={unit} onChange={(e) => onUnit(e.target.value as OtherServiceUnit)}>
            {WEIGHT_UNIT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="nse-field">
          <span>Quantity / Weight</span>
          <span className="nse-input">
            <Scale size={16} />
            <input
              type="number"
              min={0}
              step={0.001}
              value={quantity}
              onChange={(e) => onQuantity(e.target.value)}
              required
              placeholder={unit === 'KG' ? 'e.g. 1' : 'e.g. 500'}
            />
          </span>
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
              placeholder="1000"
            />
          </span>
        </label>
        <label className="nse-field">
          <span>Rate Basis</span>
          <input readOnly value={rateBasis} />
        </label>
        <label className="nse-field nse-field-span">
          <span>Product Description</span>
          <input
            value={productDescription}
            onChange={(e) => onProductDescription(e.target.value)}
            placeholder="Optional item notes"
          />
        </label>
      </div>
      <div className="nse-calc-box">
        <span>Calculation</span>
        {formula ? (
          <strong>{formula}</strong>
        ) : (
          <p>
            500 g × ₹1000/kg = ₹500
            <br />
            1 KG × ₹1000/kg = ₹1000
          </p>
        )}
        <div className="nse-calc-total">
          <span>Amount</span>
          <AnimatedAmount value={entered ? total : 0} />
        </div>
      </div>
      {showError && calcError ? <p className="nse-error">{calcError}</p> : null}
    </section>
  )
}
