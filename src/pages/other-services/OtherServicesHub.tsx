import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, FileSpreadsheet, Printer, Settings, Wrench, BarChart3 } from 'lucide-react'
import { canAccessPath } from '../../data/roles'
import './other-services.css'

const links = [
  {
    title: 'New Service Entry',
    description: 'Create a slip, calculate amount, save and print the receipt.',
    path: '/other-services/entry',
    icon: Wrench,
    color: '#0f766e',
  },
  {
    title: 'Service Records',
    description: 'Search, edit, collect payment or cancel service slips.',
    path: '/other-services/records',
    icon: FileSpreadsheet,
    color: '#2563eb',
  },
  {
    title: 'Receipts',
    description: 'Preview, print and reprint customer receipts.',
    path: '/other-services/receipts',
    icon: Printer,
    color: '#16a34a',
  },
  {
    title: 'Reports',
    description: 'Other Services totals by type and payment mode.',
    path: '/other-services/reports',
    icon: BarChart3,
    color: '#7c3aed',
  },
  {
    title: 'Service Settings',
    description: 'Manual service master — add or deactivate types.',
    path: '/other-services/settings',
    icon: Settings,
    color: '#475569',
  },
]

export function OtherServicesHub() {
  return (
    <div className="others-hub">
      <div className="others-hub-head">
        <h1>Other Services</h1>
        <p>Vibrator, silver polish, laser soldering and manual services — separate from Hallmarking bills.</p>
      </div>
      <div className="others-card-grid">
        {links
          .filter((item) => canAccessPath(item.path))
          .map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.path}
                to={item.path}
                className="others-link-card"
                style={{ ['--tile-accent' as string]: item.color }}
              >
                <div className="others-link-icon" style={{ background: item.color }}>
                  <Icon size={20} />
                </div>
                <div className="others-link-text">
                  <strong>{item.title}</strong>
                  <span>{item.description}</span>
                </div>
                <ArrowRight size={18} className="others-link-arrow" />
              </Link>
            )
          })}
      </div>
      <div className="manual-actions">
        <Link to="/" className="btn btn-navy">
          <ArrowLeft size={16} /> Back
        </Link>
      </div>
    </div>
  )
}
