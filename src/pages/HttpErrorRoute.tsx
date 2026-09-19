import { useParams } from 'react-router-dom'
import { ErrorPage } from '../components/ErrorPage'
import { resolveHttpErrorStatus } from '../errors/httpErrorConfig'

/**
 * Optional deep-link route: /error/:status
 * Unknown / non-mapped codes render the 500 screen.
 */
export function HttpErrorRoute() {
  const { status: raw } = useParams()
  const parsed = Number.parseInt(raw || '', 10)
  const status = Number.isFinite(parsed) ? resolveHttpErrorStatus(parsed) : 500
  return <ErrorPage status={status} />
}
