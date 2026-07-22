import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  ClipboardList,
  Database,
  FileStack,
  Flame,
  FolderPlus,
  HandCoins,
  KeyRound,
  Layers,
  Receipt,
  UserPlus,
  Users,
  UserX,
  Wallet,
  IdCard,
} from 'lucide-react'

type OtherLink = {
  title: string
  description: string
  path: string
  icon: React.ComponentType<{ size?: number }>
  color: string
}

const links: OtherLink[] = [
  {
    title: 'Fund Entry',
    description: 'Record fund transactions.',
    path: '/fund-entry',
    icon: HandCoins,
    color: '#16a34a',
  },
  {
    title: 'Party Details',
    description: 'View customer information.',
    path: '/others/party-details',
    icon: Users,
    color: '#2563eb',
  },
  {
    title: 'Expense Entry',
    description: 'Track business expenses.',
    path: '/expense-entry',
    icon: ClipboardList,
    color: '#dc2626',
  },
  {
    title: 'Add New Party',
    description: 'Register new customers.',
    path: '/add-party',
    icon: UserPlus,
    color: '#7c3aed',
  },
  {
    title: 'Add New Category',
    description: 'Create product categories.',
    path: '/new-category',
    icon: FolderPlus,
    color: '#ea580c',
  },
  {
    title: 'Company Profile',
    description: 'Update company details.',
    path: '/others/company-profile',
    icon: Building2,
    color: '#6d28d9',
  },
  {
    title: 'Daily Cash Flow',
    description: 'Monitor daily transactions.',
    path: '/others/daily-cash-flow',
    icon: Wallet,
    color: '#d97706',
  },
  {
    title: 'Rejected Request',
    description: 'View declined requests.',
    path: '/others/rejected-request',
    icon: UserX,
    color: '#db2777',
  },
  {
    title: 'Extra Hallmark Request',
    description: 'Additional hallmark entries.',
    path: '/others/extra-hallmark',
    icon: FileStack,
    color: '#0d9488',
  },
  {
    title: 'Add to Group',
    description: 'Organize parties into groups.',
    path: '/others/add-to-group',
    icon: Layers,
    color: '#0284c7',
  },
  {
    title: 'Touch Fund Entry',
    description: 'File touch fund records.',
    path: '/others/touch-fund',
    icon: Flame,
    color: '#0f766e',
  },
  {
    title: 'Manage Password',
    description: 'Update user credentials.',
    path: '/others/manage-password',
    icon: KeyRound,
    color: '#be185d',
  },
  {
    title: 'Add Staff',
    description: 'Manage employees and payroll.',
    path: '/others/add-staff',
    icon: UserPlus,
    color: '#0891b2',
  },
  {
    title: 'Staff Attendance',
    description: 'Update staff attendance.',
    path: '/others/staff-attendance',
    icon: IdCard,
    color: '#c026d3',
  },
  {
    title: 'Invoice Settings',
    description: 'Configure invoice numbering & signatures.',
    path: '/others/invoice-settings',
    icon: Receipt,
    color: '#1d4ed8',
  },
  {
    title: 'Backup & Restore',
    description: 'Export or restore centre data JSON.',
    path: '/others/backup',
    icon: Database,
    color: '#0f766e',
  },
]

export function Others() {
  return (
    <div className="others-hub">
      <div className="others-hub-head">
        <h1>Access additional features and settings for your business</h1>
      </div>

      <div className="others-card-grid">
        {links.map((item) => {
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
