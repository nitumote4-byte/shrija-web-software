import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  WEIGHT_PRODUCT_CUSTOM,
  WEIGHT_PRODUCT_PRESETS,
  WEIGHT_UNIT_OPTIONS,
  calculateWeightLineItemAmount,
  type OtherServiceWeightUnit,
} from '../../../data/otherServices'
import type { DraftWeightItem } from './draft'
import { money } from './format'

export function WeightPolishItems({
  items,
  onAdd,
  onUpdate,
  onRemove,
}: {
  title?: string
  subtitle?: string
  items: DraftWeightItem[]
  total?: number
  totalWeightLabel?: string
  onAdd: () => void
  onUpdate: (key: string, patch: Partial<DraftWeightItem>) => void
  onRemove: (key: string) => void
}) {
  const [leaving, setLeaving] = useState<Record<string, boolean>>({})

  const requestRemove = (key: string) => {
    if (leaving[key]) return
    setLeaving((cur) => ({ ...cur, [key]: true }))
    window.setTimeout(() => {
      onRemove(key)
      setLeaving((cur) => {
        const next = { ...cur }
        delete next[key]
        return next
      })
    }, 180)
  }

  return (
    <section className="nse-card nse-card-weight accent-polish">
      <div className="nse-card-head nse-card-head-row">
        <div>
          <h2>Items (Jewellery Details)</h2>
          <p>Add all items brought by the customer for silver polishing / vibrating</p>
        </div>
        <button type="button" className="nse-btn nse-btn-add nse-btn-add-navy" onClick={onAdd}>
          <Plus size={15} strokeWidth={2.4} /> Add Item
        </button>
      </div>
      <div className="nse-table-wrap">
        <table className="nse-items-table nse-weight-items-table">
          <thead>
            <tr>
              <th>#</th>
              <th>
                Product / Item <em>*</em>
              </th>
              <th>
                Weight / Quantity <em>*</em>
              </th>
              <th>
                Unit <em>*</em>
              </th>
              <th>
                Rate per KG (₹) <em>*</em>
              </th>
              <th>Amount (₹)</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row, index) => {
              const qty = Number(row.quantity)
              const rowRate = Number(row.rate)
              const amount =
                row.quantity !== '' &&
                row.rate !== '' &&
                Number.isFinite(qty) &&
                Number.isFinite(rowRate) &&
                qty > 0
                  ? calculateWeightLineItemAmount(qty, row.unit, rowRate)
                  : 0
              const showCustom =
                row.productPreset === WEIGHT_PRODUCT_CUSTOM ||
                (row.productPreset === '' && row.customName !== '')
              return (
                <tr key={row.key} className={`nse-item-row${leaving[row.key] ? ' is-leaving' : ''}`}>
                  <td className="nse-idx">{index + 1}</td>
                  <td>
                    <div className="nse-product-stack">
                      <select
                        value={
                          row.productPreset ||
                          (row.customName ? WEIGHT_PRODUCT_CUSTOM : '')
                        }
                        onChange={(e) => {
                          const value = e.target.value
                          onUpdate(row.key, {
                            productPreset: value,
                            customName: value === WEIGHT_PRODUCT_CUSTOM ? row.customName : '',
                          })
                        }}
                        required={!showCustom}
                      >
                        <option value="">Select item…</option>
                        {WEIGHT_PRODUCT_PRESETS.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                        <option value={WEIGHT_PRODUCT_CUSTOM}>{WEIGHT_PRODUCT_CUSTOM}</option>
                      </select>
                      {showCustom ? (
                        <input
                          value={row.customName}
                          onChange={(e) =>
                            onUpdate(row.key, {
                              productPreset: WEIGHT_PRODUCT_CUSTOM,
                              customName: e.target.value,
                            })
                          }
                          placeholder="Custom item name"
                          required
                        />
                      ) : null}
                    </div>
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      step="0.001"
                      value={row.quantity}
                      onChange={(e) => onUpdate(row.key, { quantity: e.target.value })}
                      required
                      placeholder="150"
                    />
                  </td>
                  <td>
                    <select
                      value={row.unit}
                      onChange={(e) => onUpdate(row.key, { unit: e.target.value as OtherServiceWeightUnit })}
                    >
                      {WEIGHT_UNIT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={row.rate}
                      onChange={(e) => onUpdate(row.key, { rate: e.target.value })}
                      required
                      placeholder="1000"
                    />
                  </td>
                  <td className="nse-line-amount">{money(amount)}</td>
                  <td>
                    <button
                      type="button"
                      className="nse-icon-btn"
                      onClick={() => requestRemove(row.key)}
                      aria-label="Remove item"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <button type="button" className="nse-add-another" onClick={onAdd}>
        <span className="nse-add-another-icon" aria-hidden>
          <Plus size={18} strokeWidth={2.4} />
        </span>
        <span>Add Another Item</span>
      </button>

      <div className="nse-calc-box nse-calc-info">
        <span>Calculation</span>
        <p>
          Amount = (Weight in Gram ÷ 1000) × Rate per KG
          <br />
          Amount = Weight in KG × Rate per KG
        </p>
        <p className="nse-calc-note">
          Original entered unit (Gram/KG) will be preserved in the record and receipt.
        </p>
      </div>
    </section>
  )
}
