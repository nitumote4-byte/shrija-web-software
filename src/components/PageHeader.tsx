import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle: string
  actions?: React.ReactNode
}) {
  return (
    <div className="page-header-wrapper">
      <Link to="/" className="back-link">
        <ArrowLeft size={14} /> Back to Dashboard
      </Link>
      <div className="page-header">
        <div className="page-header-title-box">
          <h1 className="page-title">{title}</h1>
          <p className="page-subtitle">{subtitle}</p>
        </div>
        {actions && <div className="page-header-actions">{actions}</div>}
      </div>
    </div>
  )
}

