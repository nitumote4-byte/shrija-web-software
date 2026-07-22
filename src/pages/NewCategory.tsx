import { useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { useToast } from '../components/ui'
import { store } from '../data/store'

export function NewCategory() {
  const [tick, setTick] = useState(0)
  const { toast, Toast } = useToast()
  const [name, setName] = useState('')
  const [purity, setPurity] = useState('916')
  const [metal, setMetal] = useState<'Gold' | 'Silver' | 'Platinum'>('Gold')
  const [rate, setRate] = useState('40')
  void tick

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    store.addCategory({ name, purity, metal, rate: Number(rate) })
    setTick((t) => t + 1)
    toast(`Category "${name}" created`)
    setName('')
  }

  const categories = store.getAll().categories

  return (
    <>
      <PageHeader
        title="New Category"
        subtitle="Create item categories or purity types."
      />
      <div className="panel">
        <h2>Create Category</h2>
        <form onSubmit={submit}>
          <div className="form-grid">
            <div className="field">
              <label>Category Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="field">
              <label>Metal</label>
              <select value={metal} onChange={(e) => setMetal(e.target.value as typeof metal)}>
                <option>Gold</option>
                <option>Silver</option>
                <option>Platinum</option>
              </select>
            </div>
            <div className="field">
              <label>Purity</label>
              <input value={purity} onChange={(e) => setPurity(e.target.value)} required />
            </div>
            <div className="field">
              <label>Rate / piece (₹)</label>
              <input
                type="number"
                min="1"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              Save Category
            </button>
          </div>
        </form>
      </div>
      <div className="panel">
        <h2>Categories</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Metal</th>
                <th>Purity</th>
                <th>Rate</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.metal}</td>
                  <td>{c.purity}</td>
                  <td>₹ {c.rate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {Toast}
    </>
  )
}
