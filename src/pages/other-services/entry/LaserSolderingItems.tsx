import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { calculateLineItemAmount } from '../../../data/otherServices'
import { AnimatedAmount } from './AnimatedAmount'
import type { DraftItem } from './draft'
import { money } from './format'

export function LaserSolderingItems({
  title,
  items,
  total,
  onAdd,
  onUpdate,
  onRemove,
}: {
  title: string
  items: DraftItem[]
  total: number
  onAdd: () => void
  onUpdate: (key: string, patch: Partial<DraftItem>) => void
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
    <section className="nse-card nse-card-laser">
      <div className="nse-card-head nse-card-head-row">
        <div>
          <h2>Items ({title})</h2>
          <p>Add multiple items for soldering service.</p>
        </div>
        <button type="button" className="nse-btn nse-btn-add" onClick={onAdd}>
          <Plus size={15} strokeWidth={2.4} /> Add Item
        </button>
      </div>
      <div className="nse-table-wrap">
        <table className="nse-items-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Item Description</th>
              <th>Quantity (pcs)</th>
              <th>Rate / Piece (₹)</th>
              <th>Amount (₹)</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row, index) => {
              const qty = Number(row.quantity)
              const rowRate = Number(row.rate)
              const amount =
                row.quantity !== '' && row.rate !== '' && Number.isFinite(qty) && Number.isFinite(rowRate)
                  ? calculateLineItemAmount(qty, rowRate)
                  : 0
              return (
                <tr key={row.key} className={`nse-item-row${leaving[row.key] ? ' is-leaving' : ''}`}>
                  <td className="nse-idx">{index + 1}</td>
                  <td>
                    <input
                      value={row.description}
                      onChange={(e) => onUpdate(row.key, { description: e.target.value })}
                      placeholder="Hair, Locket, Ring…"
                      required
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={row.quantity}
                      onChange={(e) => onUpdate(row.key, { quantity: e.target.value })}
                      required
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.rate}
                      onChange={(e) => onUpdate(row.key, { rate: e.target.value })}
                      required
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
      <div className="nse-items-total">
        <span>Total Amount</span>
        <AnimatedAmount value={total} />
      </div>
    </section>
  )
}
