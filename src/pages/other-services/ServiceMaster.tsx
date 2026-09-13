import { useState, type FormEvent } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { statusBadge, useToast } from '../../components/ui'
import { store } from '../../data/store'
import {
  UNIFIED_WEIGHT_SERVICE_NAME,
  isLegacyMergedWeightServiceType,
  type OtherServiceKind,
} from '../../data/otherServices'
import './other-services.css'

export function ServiceMaster() {
  const { toast, Toast } = useToast()
  const [tick, setTick] = useState(0)
  const types = store.getOtherServiceTypes(true)
  const usedTypeIds = new Set((store.getAll().otherServices || []).map((s) => s.typeId))
  void tick
  const [name, setName] = useState('')
  const [kind, setKind] = useState<OtherServiceKind>('manual')
  const [prefix, setPrefix] = useState('MS')

  const add = (e: FormEvent) => {
    e.preventDefault()
    const result = store.addOtherServiceType({ name, kind, slipPrefix: prefix })
    if (!result.ok) {
      toast(result.error)
      return
    }
    toast(`Added ${result.type.name}`)
    setName('')
    setTick((n) => n + 1)
  }

  const toggle = (id: string, active: boolean) => {
    const row = types.find((t) => t.id === id)
    if (row && isLegacyMergedWeightServiceType(row) && active) {
      toast(`Use "${UNIFIED_WEIGHT_SERVICE_NAME}" for new entries. Legacy types stay for history only.`)
      return
    }
    const result = store.updateOtherServiceType(id, { active })
    if (!result.ok) {
      toast(result.error)
      return
    }
    toast(`${result.type.name} ${active ? 'activated' : 'deactivated'}`)
    setTick((n) => n + 1)
  }

  return (
    <div className="os-page">
      <PageHeader
        title="Service Settings"
        subtitle={`Built-in weight service is "${UNIFIED_WEIGHT_SERVICE_NAME}". Older Vibrator / Silver Polish / Braveting types remain for history only.`}
      />
      <form className="os-card" onSubmit={add}>
        <div className="os-grid">
          <div className="field">
            <label>Service Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Chain Cleaning" required />
          </div>
          <div className="field">
            <label>Kind</label>
            <select value={kind} onChange={(e) => setKind(e.target.value as OtherServiceKind)}>
              <option value="manual">Manual</option>
              <option value="weight">Weight (GM / KG)</option>
              <option value="piece">Piece</option>
            </select>
          </div>
          <div className="field">
            <label>Slip Prefix</label>
            <input value={prefix} onChange={(e) => setPrefix(e.target.value)} />
          </div>
        </div>
        <div className="os-actions">
          <button type="submit" className="btn btn-navy">
            Add Service
          </button>
        </div>
      </form>
      <div className="os-card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Kind</th>
                <th>Prefix</th>
                <th>Status</th>
                <th>Used</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {types.map((t) => {
                const used = usedTypeIds.has(t.id)
                const legacy = isLegacyMergedWeightServiceType(t)
                return (
                  <tr key={t.id}>
                    <td>
                      {t.name}
                      {legacy ? <div className="os-muted">Merged into {UNIFIED_WEIGHT_SERVICE_NAME}</div> : null}
                    </td>
                    <td>{t.kind}</td>
                    <td>{t.slipPrefix}</td>
                    <td>{statusBadge(t.active ? 'Active' : legacy ? 'Historical' : 'Inactive')}</td>
                    <td>{used ? 'Yes' : 'No'}</td>
                    <td>
                      <div className="os-row-actions">
                        {legacy ? (
                          <span className="os-muted">Kept for historical records</span>
                        ) : t.active ? (
                          <button type="button" className="btn btn-ghost" onClick={() => toggle(t.id, false)}>
                            Deactivate
                          </button>
                        ) : (
                          <button type="button" className="btn btn-navy" onClick={() => toggle(t.id, true)}>
                            Activate
                          </button>
                        )}
                        {used && !legacy ? <span className="os-muted">Cannot delete — has transactions</span> : null}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      {Toast}
    </div>
  )
}
