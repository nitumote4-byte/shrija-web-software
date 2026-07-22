import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  Keyboard,
  Bot,
  ScrollText,
  ListOrdered,
  ClipboardList,
  FileSpreadsheet,
  Printer,
  List,
  Banknote,
  Receipt,
  UserPlus,
  Tag,
  Flame,
  Eye,
  Package,
  FlaskConical,
  File,
  BarChart3,
  MoreHorizontal,
} from 'lucide-react'

export type ModuleDef = {
  id: string
  title: string
  description: string
  path: string
  icon: LucideIcon
}

/** Software product name (suite) */
export const PRODUCT_NAME = 'Shrija Hallmark Suite'
export const PRODUCT_TAGLINE = 'BIS Hallmarking · Fire Assay · Billing · Compliance'
export const PRODUCT_VERSION = '2.0'

export const modules: ModuleDef[] = [
  {
    id: 'manual-request',
    title: 'Manual Request',
    description: 'Capture walk-in hallmarking jobs with party, purity & pieces.',
    path: '/manual-request',
    icon: Keyboard,
  },
  {
    id: 'auto-request',
    title: 'Auto Request',
    description: 'Import AHC / system feeds into the daily job queue.',
    path: '/auto-request',
    icon: Bot,
  },
  {
    id: 'rough-sheet',
    title: 'Rough Sheet',
    description: 'Record receipt weight, sampling & rough acceptance.',
    path: '/rough-sheet',
    icon: ScrollText,
  },
  {
    id: 'request-list',
    title: 'Request List',
    description: 'Run the daily production sheet — weigh, complete, reject.',
    path: '/request-list',
    icon: ListOrdered,
  },
  {
    id: 'qm-request-list',
    title: 'QM Request List',
    description: 'Quality manager overview of branch job progress.',
    path: '/qm-request-list',
    icon: ClipboardList,
  },
  {
    id: 'billing',
    title: 'Billing',
    description: 'Issue Invoice Cum Delivery Challan with GST & print.',
    path: '/billing',
    icon: FileSpreadsheet,
  },
  {
    id: 'print-job-card',
    title: 'Print Job Card',
    description: 'Print job cards for lab and hallmarking tracking.',
    path: '/print-job-card',
    icon: Printer,
  },
  {
    id: 'extra-hallmark',
    title: 'Extra Hallmark Sheet',
    description: 'Track X-ray / extra hallmarking lots and pieces.',
    path: '/xray-hallmark',
    icon: List,
  },
  {
    id: 'fund-entry',
    title: 'Fund Entry',
    description: 'Post party receipts — cash, UPI, bank & cheque.',
    path: '/fund-entry',
    icon: Banknote,
  },
  {
    id: 'expense-entry',
    title: 'Expense Entry',
    description: 'Log centre expenses for cash flow & P&L.',
    path: '/expense-entry',
    icon: Receipt,
  },
  {
    id: 'add-party',
    title: 'Add Party',
    description: 'Onboard jewellers with GSTIN, license & credit terms.',
    path: '/add-party',
    icon: UserPlus,
  },
  {
    id: 'new-category',
    title: 'New Category',
    description: 'Maintain purity rates for gold, silver & platinum.',
    path: '/new-category',
    icon: Tag,
  },
  {
    id: 'create-fire-assay',
    title: 'Create Fire Assay',
    description: 'Run CG Auto, Cornet & manual fire assay sheets.',
    path: '/create-fire-assay',
    icon: Flame,
  },
  {
    id: 'view-fire-assay',
    title: 'View Fire Assay',
    description: 'Review assay results and purity findings.',
    path: '/view-fire-assay',
    icon: Eye,
  },
  {
    id: 'qm-stock',
    title: 'QM Stock',
    description: 'Control gold, silver & assay consumables at QM desk.',
    path: '/qm-stock',
    icon: Package,
  },
  {
    id: 'lab-stock',
    title: 'Lab Stock',
    description: 'Track lab gold, CG weight & assay master balances.',
    path: '/lab-stock',
    icon: FlaskConical,
  },
  {
    id: 'touch-form',
    title: 'Touch Form',
    description: 'Record fire-touch purity assessments for clients.',
    path: '/touch-form',
    icon: File,
  },
  {
    id: 'touch-billing',
    title: 'Touch Billing',
    description: 'Bill touch services and close party dues.',
    path: '/touch-billing',
    icon: FileSpreadsheet,
  },
  {
    id: 'reports',
    title: 'Reports',
    description: 'Royalty, GST, statements, stock & compliance reports.',
    path: '/reports',
    icon: BarChart3,
  },
  {
    id: 'others',
    title: 'Others',
    description: 'Firm profile, staff, attendance, cash flow & settings.',
    path: '/others',
    icon: MoreHorizontal,
  },
]

/** Full launcher grid including Dashboard (FAB "All Modules"). */
export const allModules: ModuleDef[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    description: 'Live operations KPIs, calendar & performance.',
    path: '/dashboard',
    icon: LayoutDashboard,
  },
  ...modules,
]

/** Default centre name — overridden by Company Profile firm name */
export const CENTRE_NAME = 'SHRIJA ASSAYING & HALLMARKING CENTRE'
export const USER_NAME = 'qm_admin'
export const USER_ROLE = 'Quality Manager'
