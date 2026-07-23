import { useMemo, useState } from 'react'
import { CloudDownload, Gem, List, Pencil, Plus, Save, Search, Trash2 } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { useToast } from '../components/ui'
import { store } from '../data/store'

type Mode = 'empty' | 'manage'

export function NewCategory() {
  const { toast, Toast } = useToast()
  const [tick, setTick] = useState(0)
  const [mode, setMode] = useState<Mode | null>(null)
  const [name, setName] = useState('')
  const [query, setQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  void tick
  const categories = store.getAll().jewelleryCategories
  const started = mode === 'manage' || categories.length > 0

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return categories
    return categories.filter((c) => c.name.toLowerCase().includes(q))
  }, [categories, query])

  const reload = () => setTick((t) => t + 1)

  const syncFromDb = () => {
    const added = store.syncJewelleryCategoriesFromDefaults()
    setMode('manage')
    reload()
    toast(
      added > 0
        ? `${added} categor${added === 1 ? 'y' : 'ies'} imported from database`
        : 'Common categories already synced',
    )
  }

  const useOwn = () => {
    setMode('manage')
  }

  const saveCategory = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      toast('Enter name of jewellery')
      return
    }
    const row = store.addJewelleryCategory(trimmed)
    if (!row) {
      toast('Category already exists')
      return
    }
    setName('')
    reload()
    toast('Category added successfully!')
  }

  const startEdit = (id: string, current: string) => {
    setEditingId(id)
    setEditName(current)
  }

  const saveEdit = (id: string) => {
    const updated = store.updateJewelleryCategory(id, editName)
    if (!updated) {
      toast('Could not update — name empty or already used')
      return
    }
    setEditingId(null)
    setEditName('')
    reload()
    toast('Category updated')
  }

  const remove = (id: string, label: string) => {
    if (!window.confirm(`Delete category "${label}"?`)) return
    if (store.deleteJewelleryCategory(id)) {
      reload()
      toast('Category deleted')
    }
  }

  return (
    <div className="jewcat-page">
      <PageHeader
        title="New Category"
        subtitle="Manage jewellery categories for hallmarking requests"
      />

      {!started ? (
        <div className="jewcat-start panel">
          <h2>Get Started with Categories</h2>
          <p>
            You haven&apos;t added any categories yet. You can either import common categories from
            our database or start fresh by adding your own.
          </p>
          <div className="jewcat-start-actions">
            <button type="button" className="jewcat-start-card" onClick={syncFromDb}>
              <span className="jewcat-start-icon sync">
                <CloudDownload size={28} />
              </span>
              <strong>Sync from Database</strong>
              <span>Import common jewellery types instantly.</span>
            </button>
            <button type="button" className="jewcat-start-card" onClick={useOwn}>
              <span className="jewcat-start-icon own">
                <Pencil size={28} />
              </span>
              <strong>Use Your Own</strong>
              <span>Manually add specific categories.</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="jewcat-layout">
          <div className="panel jewcat-add">
            <div className="jewcat-card-head">
              <span className="jewcat-head-icon add">
                <Plus size={18} />
              </span>
              <div>
                <h2>Add Category</h2>
                <p>Create a new jewellery type.</p>
              </div>
            </div>

            <div className="jewcat-total">
              <strong>{categories.length}</strong>
              <span>TOTAL CATEGORIES</span>
            </div>

            <form onSubmit={saveCategory} className="jewcat-form">
              <div className="field">
                <label>Name of Jewellery</label>
                <div className="jewcat-input-wrap">
                  <Gem size={16} className="jewcat-input-icon" />
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Gold Ring, Silver Bracelet"
                    required
                  />
                </div>
              </div>
              <button type="submit" className="btn btn-primary jewcat-save">
                <Save size={16} /> Save Category
              </button>
            </form>
          </div>

          <div className="panel jewcat-list">
            <div className="jewcat-card-head">
              <span className="jewcat-head-icon list">
                <List size={18} />
              </span>
              <div>
                <h2>Category List</h2>
                <p>All registered jewellery types.</p>
              </div>
            </div>

            <div className="jewcat-search">
              <Search size={16} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search categories..."
                aria-label="Search categories"
              />
            </div>

            <div className="table-wrap">
              <table className="data-table navy-head-table jewcat-table">
                <thead>
                  <tr>
                    <th># SR</th>
                    <th>
                      <span className="jewcat-th-gem">
                        <Gem size={14} /> Jewellery Name
                      </span>
                    </th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="empty-state">
                        No categories yet — add one on the left.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((c, i) => (
                      <tr key={c.id}>
                        <td>{i + 1}</td>
                        <td>
                          {editingId === c.id ? (
                            <input
                              className="table-input"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEdit(c.id)
                                if (e.key === 'Escape') setEditingId(null)
                              }}
                              autoFocus
                            />
                          ) : (
                            <strong>{c.name}</strong>
                          )}
                        </td>
                        <td className="jewcat-actions">
                          {editingId === c.id ? (
                            <button
                              type="button"
                              className="action-sq edit"
                              title="Save"
                              onClick={() => saveEdit(c.id)}
                            >
                              <Save size={15} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="action-sq edit"
                              title="Edit"
                              onClick={() => startEdit(c.id, c.name)}
                            >
                              <Pencil size={15} />
                            </button>
                          )}
                          <button
                            type="button"
                            className="action-sq delete"
                            title="Delete"
                            onClick={() => remove(c.id, c.name)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {categories.length === 0 && (
              <button type="button" className="btn btn-secondary jewcat-resync" onClick={syncFromDb}>
                <CloudDownload size={16} /> Sync from Database
              </button>
            )}
          </div>
        </div>
      )}

      {Toast}
    </div>
  )
}
