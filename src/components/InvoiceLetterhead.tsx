import { useEffect, useState } from 'react'
import { getInvoiceHeader } from '../data/firmProfile'
import {
  LETTERHEAD_EVENT,
  fetchLetterhead,
  getCachedLetterhead,
  type CentreLetterhead,
} from '../data/letterhead'

/**
 * Billing letterhead region only. Does not inject centre name / GSTIN into an uploaded image.
 */
export function InvoiceLetterhead() {
  const header = getInvoiceHeader()
  const [image, setImage] = useState<CentreLetterhead | null>(
    () => getCachedLetterhead()?.letterhead || null,
  )

  useEffect(() => {
    let cancelled = false
    const applyCache = () => {
      if (!cancelled) setImage(getCachedLetterhead()?.letterhead || null)
    }
    applyCache()
    void fetchLetterhead().then(() => applyCache())
    window.addEventListener(LETTERHEAD_EVENT, applyCache)
    return () => {
      cancelled = true
      window.removeEventListener(LETTERHEAD_EVENT, applyCache)
    }
  }, [])

  if (image?.dataUrl) {
    return (
      <div className="invoice-letterhead">
        <img src={image.dataUrl} alt="" />
      </div>
    )
  }

  return (
    <div className="invoice-letterhead invoice-letterhead-fallback">
      <strong>{header.centreName}</strong>
    </div>
  )
}
