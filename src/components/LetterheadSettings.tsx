import { useEffect, useRef, useState } from 'react'
import {
  centreLetterheadLabel,
  fetchLetterhead,
  getCachedLetterhead,
  removeLetterhead,
  saveLetterhead,
  type CentreLetterhead,
} from '../data/letterhead'

type Props = {
  toast: (msg: string) => void
}

export function LetterheadSettings({ toast }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [centreLabel, setCentreLabel] = useState(() => centreLetterheadLabel())
  const [current, setCurrent] = useState<CentreLetterhead | null>(
    () => getCachedLetterhead()?.letterhead || null,
  )

  useEffect(() => {
    let cancelled = false
    void fetchLetterhead().then((res) => {
      if (cancelled) return
      setCurrent(res.letterhead)
      setCentreLabel(centreLetterheadLabel(res.centreKind, res.centreName))
    })
    return () => {
      cancelled = true
    }
  }, [])

  const pickFile = () => fileRef.current?.click()

  const onFile = async (file: File | undefined | null) => {
    if (!file) return
    setBusy(true)
    try {
      const res = await saveLetterhead(file)
      setCurrent(res.letterhead)
      setCentreLabel(centreLetterheadLabel(res.centreKind, res.centreName))
      toast(current ? 'Letterhead replaced' : 'Letterhead uploaded')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const onRemove = async () => {
    setBusy(true)
    try {
      const res = await removeLetterhead()
      setCurrent(null)
      setCentreLabel(centreLetterheadLabel(res.centreKind, res.centreName))
      toast('Letterhead removed')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not remove letterhead')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="invset-section">
      <h2>Billing Letterhead</h2>
      <p className="invset-hint" style={{ marginTop: 0, marginBottom: '0.75rem' }}>
        Uploaded image is used at the top of this centre&apos;s invoices. It is not shared with
        other centres or tenants.
      </p>

      <div className="field">
        <label>Centre / Outlet</label>
        <input value={centreLabel} readOnly />
      </div>

      <div className="invset-letterhead">
        <label>Letterhead</label>
        {current?.dataUrl ? (
          <div className="invset-letterhead-preview">
            <img src={current.dataUrl} alt="Current letterhead" />
          </div>
        ) : (
          <p className="invset-hint">No letterhead uploaded — invoices will show the centre name only.</p>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={(e) => void onFile(e.target.files?.[0])}
        />

        <div className="invset-letterhead-actions">
          <button type="button" className="btn btn-navy" onClick={pickFile} disabled={busy}>
            {current ? 'Replace' : 'Upload Letterhead'}
          </button>
          {current ? (
            <button type="button" className="link-btn" onClick={() => void onRemove()} disabled={busy}>
              Remove
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
