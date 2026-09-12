import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Upload } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { useToast } from '../components/ui'
import { getSession } from '../data/auth'
import { downloadBackupFile, restoreBackupFile } from '../data/backup'

export function DataBackup() {
  const { toast, Toast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const isAdmin = Boolean(getSession()?.isAdmin)

  const onExport = () => {
    downloadBackupFile()
    toast('Backup downloaded')
  }

  const onImport = async (file: File | null) => {
    if (!file) return
    if (!isAdmin) {
      toast('Only a centre administrator can restore a backup')
      return
    }
    const typed = window.prompt(
      'Restore replaces ALL parties, bills, assays, and stock for this centre.\nType RESTORE to continue.',
    )
    if (typed !== 'RESTORE') {
      toast('Restore cancelled')
      return
    }
    if (!window.confirm('This cannot be undone from the app. Continue?')) {
      toast('Restore cancelled')
      return
    }
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
          Download before major changes. Restore is admin-only and replaces this centre&apos;s store
          on the server. Type RESTORE when prompted.
        </p>
        {!isAdmin && (
          <p className="login-error" role="status">
            Only a centre administrator can export or restore backups.
          </p>
        )}
        <div className="auto-manak-actions">
          <button type="button" className="btn btn-navy" onClick={onExport} disabled={!isAdmin}>
            <Download size={16} /> Export JSON
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy || !isAdmin}
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
