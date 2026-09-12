import { Check } from 'lucide-react'
import type { OtherServiceType } from '../../../data/otherServices'
import { serviceVisual } from './serviceVisual'

export function ServiceTypeSelector({
  types,
  typeId,
  disabled,
  onChange,
}: {
  types: OtherServiceType[]
  typeId: string
  disabled?: boolean
  onChange: (id: string) => void
}) {
  return (
    <section className="nse-type-section" aria-label="Service type">
      <div className="nse-type-grid">
        {types.map((type) => {
          const visual = serviceVisual(type)
          const selected = type.id === typeId
          const Icon = visual.icon
          return (
            <button
              key={type.id}
              type="button"
              className={`nse-type-card accent-${visual.accent}${selected ? ' is-selected' : ''}`}
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => onChange(type.id)}
            >
              {selected ? (
                <span className="nse-type-check" aria-hidden>
                  <Check size={13} strokeWidth={3} />
                </span>
              ) : null}
              <span className="nse-type-icon">
                <Icon size={20} strokeWidth={1.9} />
              </span>
              <strong>{type.name}</strong>
              <span className="nse-type-desc">
                {visual.lines.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
