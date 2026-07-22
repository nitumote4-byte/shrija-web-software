import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Upload } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { useToast } from '../components/ui'
import { downloadBackupFile, restoreBackupFile } from '../data/backup'

export function DataBackup() {
  const { toast, Toast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const onExport = () => {
    downloadBackupFile()
    toast('Backup downloaded')
  }

  const onImport = async (file: File | null) => {
    if (!file) return
    setBusy(true)
    try {
      const res = await restoreBackupFile(file)
      if (!res.ok) {
        toast(res.error)
        return
      }
      toast('Backup restored — reloading…')
      window.setTimeout(() => window.location.reload(), 600)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Backup & Restore"
        subtitle="Export centre data (store + firm) or restore from a JSON backup."
      />
      <div className="panel">
        <h2>Centre backup</h2>
        <p className="auto-manak-hint">
          Download before major changes. Restore replaces this centre&apos;s local+server store
          payload.
        </p>
        <div className="auto-manak-actions">
          <button type="button" className="btn btn-navy" onClick={onExport}>
            <Download size={16} /> Export JSON
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            <Upload size={16} /> Restore JSON
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => void onImport(e.target.files?.[0] || null)}
          />
          <Link to="/others" className="btn btn-back">
            Back
          </Link>
        </div>
      </div>
      {Toast}
    </>
  )
}
