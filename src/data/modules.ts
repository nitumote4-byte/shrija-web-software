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
  Gauge,
  File,
  BarChart3,
  MoreHorizontal,
} from 'lucide-react'

/** Card accent identity — presentation only, see [data-accent] in index.css */
export type ModuleAccent =
  | 'blue'
  | 'cyan'
  | 'teal'
  | 'green'
  | 'emerald'
  | 'indigo'
  | 'violet'
  | 'purple'
  | 'orange'
  | 'amber'
  | 'pink'
  | 'rose'
  | 'slate'

export type ModuleDef = {
  id: string
  title: string
  description: string
  path: string
  icon: LucideIcon
  accent?: ModuleAccent
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
    accent: 'blue',
  },
  {
    id: 'auto-request',
    title: 'Auto Request',
    description: 'Import AHC / system feeds into the daily job queue.',
    path: '/auto-request',
    icon: Bot,
    accent: 'green',
  },
  {
    id: 'rough-sheet',
    title: 'Rough Sheet',
    description: 'Record receipt weight, sampling & rough acceptance.',
    path: '/rough-sheet',
    icon: ScrollText,
    accent: 'purple',
  },
  {
    id: 'request-list',
    title: 'Request List',
    description: 'Run the daily production sheet — weigh, complete, reject.',
    path: '/request-list',
    icon: ListOrdered,
    accent: 'orange',
  },
  {
    id: 'qm-request-list',
    title: 'QM Request List',
    description: 'Quality manager overview of branch job progress.',
    path: '/qm-request-list',
    icon: ClipboardList,
    accent: 'pink',
  },
  {
    id: 'billing',
    title: 'Billing',
    description: 'Issue Invoice Cum Delivery Challan with GST & print.',
    path: '/billing',
    icon: FileSpreadsheet,
    accent: 'cyan',
  },
  {
    id: 'generated-bills',
    title: 'Generated Bills',
    description: 'View, update, print, PDF or delete generated invoices.',
    path: '/generated-bills',
    icon: Receipt,
    accent: 'teal',
  },
  {
    id: 'monthly-billing',
    title: 'Monthly Billing',
    description: 'Monthly consolidated invoice by party & requests.',
    path: '/monthly-billing',
    icon: FileSpreadsheet,
    accent: 'orange',
  },
  {
    id: 'monthly-bills',
    title: 'View Monthly Bills',
    description: 'Open, print or delete monthly consolidated invoices.',
    path: '/monthly-bills',
    icon: Eye,
    accent: 'indigo',
  },
  {
    id: 'print-job-card',
    title: 'Print Job Card',
    description: 'Print job cards for lab and hallmarking tracking.',
    path: '/print-job-card',
    icon: Printer,
    accent: 'violet',
  },
  {
    id: 'extra-hallmark',
    title: 'Extra Hallmark Sheet',
    description: 'Track X-ray / extra hallmarking lots and pieces.',
    path: '/xray-hallmark',
    icon: List,
    accent: 'teal',
  },
  {
    id: 'xrf-daily-standard',
    title: 'XRF Daily Standard Check',
    description: 'Daily XRF machine standard check — readings, average, and standard master.',
    path: '/xrf-daily-standard',
    icon: Gauge,
    accent: 'purple',
  },
  {
    id: 'fund-entry',
    title: 'Fund Entry',
    description: 'Post party receipts — cash, UPI, bank & cheque.',
    path: '/fund-entry',
    icon: Banknote,
    accent: 'emerald',
  },
  {
    id: 'expense-entry',
    title: 'Expense Entry',
    description: 'Log centre expenses for cash flow & P&L.',
    path: '/expense-entry',
    icon: Receipt,
    accent: 'amber',
  },
  {
    id: 'add-party',
    title: 'Add Party',
    description: 'Onboard jewellers with GSTIN, license & credit terms.',
    path: '/add-party',
    icon: UserPlus,
    accent: 'indigo',
  },
  {
    id: 'new-category',
    title: 'New Category',
    description: 'Add jewellery types for hallmarking requests — sync or create one by one.',
    path: '/new-category',
    icon: Tag,
    accent: 'violet',
  },
  {
    id: 'create-fire-assay',
    title: 'Create Fire Assay',
    description: 'Run CG Auto, Cornet & manual fire assay sheets.',
    path: '/create-fire-assay',
    icon: Flame,
    accent: 'rose',
  },
  {
    id: 'view-fire-assay',
    title: 'View Fire Assay',
    description: 'Review assay results and purity findings.',
    path: '/view-fire-assay',
    icon: Eye,
    accent: 'purple',
  },
  {
    id: 'qm-stock',
    title: 'QM Stock',
    description: 'Control gold, silver & assay consumables at QM desk.',
    path: '/qm-stock',
    icon: Package,
    accent: 'teal',
  },
  {
    id: 'lab-stock',
    title: 'Lab Stock',
    description: 'Track lab gold, CG weight & assay master balances.',
    path: '/lab-stock',
    icon: FlaskConical,
    accent: 'cyan',
  },
  {
    id: 'touch-form',
    title: 'Touch Form',
    description: 'Record fire-touch purity assessments for clients.',
    path: '/touch-form',
    icon: File,
    accent: 'blue',
  },
  {
    id: 'touch-billing',
    title: 'Touch Billing',
    description: 'Bill touch services and close party dues.',
    path: '/touch-billing',
    icon: FileSpreadsheet,
    accent: 'indigo',
  },
  {
    id: 'reports',
    title: 'Reports',
    description: 'Royalty, GST, statements, stock & compliance reports.',
    path: '/reports',
    icon: BarChart3,
    accent: 'violet',
  },
  {
    id: 'others',
    title: 'Others',
    description: 'Firm profile, staff, attendance, cash flow & settings.',
    path: '/others',
    icon: MoreHorizontal,
    accent: 'slate',
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
    accent: 'blue',
  },
  ...modules,
]

/** Default centre name — overridden by Company Profile firm name */
export const CENTRE_NAME = 'SHRIJA ASSAYING & HALLMARKING CENTRE'
export const USER_NAME = 'qm_admin'
export const USER_ROLE = 'Quality Manager'
