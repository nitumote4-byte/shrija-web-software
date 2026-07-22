import { useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { useToast } from '../components/ui'
import { store } from '../data/store'

export function TouchForm() {
  const data = store.getAll()
  const { toast, Toast } = useToast()
  const [partyName, setPartyName] = useState(data.parties[0]?.name ?? '')
  const [metal, setMetal] = useState('Gold')
  const [declaredTouch, setDeclaredTouch] = useState('22K')
  const [foundTouch, setFoundTouch] = useState('')
  const [weight, setWeight] = useState('')
  const [amount, setAmount] = useState('200')
  const [tick, setTick] = useState(0)
  void tick

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    store.addTouch({
      partyName,
      metal,
      declaredTouch,
      foundTouch: foundTouch || declaredTouch,
      weight: Number(weight),
      amount: Number(amount),
    })
    setTick((t) => t + 1)
    toast('Touch assessment saved')
    setFoundTouch('')
    setWeight('')
  }

  const touches = store.getAll().touches

  return (
    <>
      <PageHeader
        title="Touch Form"
        subtitle="Log data for purity touch assessments."
      />
      <div className="panel">
        <h2>New Touch Assessment</h2>
        <form onSubmit={submit}>
          <div className="form-grid">
            <div className="field">
              <label>Party</label>
              <select value={partyName} onChange={(e) => setPartyName(e.target.value)}>
                {data.parties.map((p) => (
                  <option key={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Metal</label>
              <select value={metal} onChange={(e) => setMetal(e.target.value)}>
                <option>Gold</option>
                <option>Silver</option>
              </select>
            </div>
            <div className="field">
              <label>Declared Touch</label>
              <input
                value={declaredTouch}
                onChange={(e) => setDeclaredTouch(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Found Touch</label>
              <input value={foundTouch} onChange={(e) => setFoundTouch(e.target.value)} />
            </div>
            <div className="field">
              <label>Weight (g)</label>
              <input
                type="number"
                step="0.01"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Fee (₹)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              Save Touch Form
            </button>
          </div>
        </form>
      </div>
      <div className="panel">
        <h2>Touch Records</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Touch No</th>
                <th>Date</th>
                <th>Party</th>
                <th>Metal</th>
                <th>Declared</th>
                <th>Found</th>
                <th>Weight</th>
                <th>Fee</th>
              </tr>
            </thead>
            <tbody>
              {touches.map((t) => (
                <tr key={t.id}>
                  <td>{t.touchNo}</td>
                  <td>{t.date}</td>
                  <td>{t.partyName}</td>
                  <td>{t.metal}</td>
                  <td>{t.declaredTouch}</td>
                  <td>{t.foundTouch}</td>
                  <td>{t.weight.toFixed(2)} g</td>
                  <td>₹ {t.amount}</td>
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
