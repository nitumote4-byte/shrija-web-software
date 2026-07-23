import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  BadgePercent,
  Calculator,
  Crown,
  FileDown,
  FileText,
  Flame,
  HandCoins,
  LineChart,
  Receipt,
  Stamp,
  TestTubes,
  Users,
} from 'lucide-react'

type ReportLink = {
  title: string
  description: string
  path: string
  icon: React.ComponentType<{ size?: number }>
  color: string
}

const reports: ReportLink[] = [
  {
    title: 'Royalty Report',
    description: 'BIS royalty, HM charges & GST summary',
    path: '/reports/royalty',
    icon: Crown,
    color: '#2563EB',
  },
  {
    title: 'Party Statement',
    description: 'Ledger statements for selected parties',
    path: '/reports/party-statement',
    icon: FileText,
    color: '#2563EB',
  },
  {
    title: 'Bulk Statement Download',
    description: 'Export statements for multiple parties',
    path: '/reports/bulk-statement',
    icon: FileDown,
    color: '#171717',
  },
  {
    title: 'Fund Receipt Register',
    description: 'Cash, UPI, bank & cheque receipts',
    path: '/reports/fund-receipt',
    icon: HandCoins,
    color: '#16a34a',
  },
  {
    title: 'Party Register with GST',
    description: 'GSTIN, state code & license directory',
    path: '/reports/party-gst',
    icon: BadgePercent,
    color: '#ea580c',
  },
  {
    title: 'Expense Register',
    description: 'Centre operating expense register',
    path: '/reports/expense-register',
    icon: FileText,
    color: '#dc2626',
  },
  {
    title: 'Sampling Sheet',
    description: 'Samples / jewellery register by date',
    path: '/reports/sampling-sheet',
    icon: TestTubes,
    color: '#0d9488',
  },
  {
    title: 'GST Credit',
    description: 'Output tax, ITC & net payable',
    path: '/reports/gst-credit',
    icon: Calculator,
    color: '#2563EB',
  },
  {
    title: 'Extra Hallmark Report',
    description: 'Additional hallmark & X-ray lots',
    path: '/reports/extra-hallmark',
    icon: Stamp,
    color: '#171717',
  },
  {
    title: 'Party Summary',
    description: 'Party-wise business overview',
    path: '/reports/party-summary',
    icon: Users,
    color: '#2563EB',
  },
  {
    title: 'Profit & Loss',
    description: 'Income, expenses & net margin',
    path: '/reports/profit-loss',
    icon: LineChart,
    color: '#ea580c',
  },
  {
    title: 'Invoice List',
    description: 'All invoices with filters & export',
    path: '/reports/invoice-list',
    icon: Receipt,
    color: '#16a34a',
  },
  {
    title: 'Fire Touch Report',
    description: 'Touch assessment billing records',
    path: '/reports/fire-touch',
    icon: Flame,
    color: '#b42318',
  },
  {
    title: 'Credit Note',
    description: 'Party discounts & credit notes',
    path: '/reports/credit-note',
    icon: FileText,
    color: '#ea580c',
  },
]

export function Reports() {
  return (
    <div className="others-hub">
      <div className="others-hub-head">
        <h1>Business reports & compliance</h1>
        <p>Royalty, GST, statements, stock and financial reports for your hallmarking centre.</p>
      </div>

      <div className="others-card-grid">
        {reports.map((item) => {
          const Icon = item.icon
          return (
            <Link key={item.path} to={item.path} className="others-link-card">
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
