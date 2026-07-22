import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { AnalyticsDashboard } from './pages/AnalyticsDashboard'
import { ManualRequest } from './pages/ManualRequest'
import { AutoRequest } from './pages/AutoRequest'
import { RoughSheet } from './pages/RoughSheet'
import { RequestList } from './pages/RequestList'
import { QMRequestList } from './pages/QMRequestList'
import { Billing } from './pages/Billing'
import { PrintJobCard } from './pages/PrintJobCard'
import { XrayHallmark } from './pages/XrayHallmark'
import { FundEntry } from './pages/FundEntry'
import { ExpenseEntry } from './pages/ExpenseEntry'
import { AddParty } from './pages/AddParty'
import { NewCategory } from './pages/NewCategory'
import { CreateFireAssay } from './pages/CreateFireAssay'
import {
  CgAutoFireAssay,
  CornetAutoFireAssay,
  CornetMsM2FireAssay,
  ManualFireAssay,
} from './pages/FireAssayForms'
import { ViewFireAssay } from './pages/ViewFireAssay'
import { LabGoldStock, LabStock, LabStockItem, QMBISGoldStock, QMGoldStock, QMStock, QMStockItem } from './pages/Stock'
import { TouchForm } from './pages/TouchForm'
import { TouchBilling } from './pages/TouchBilling'
import { Reports } from './pages/Reports'
import {
  BulkStatementDownload,
  CreditNoteReport,
  ExpenseRegister,
  ExtraHallmarkReport,
  FireTouchReport,
  FundReceiptRegister,
  GstCreditReport,
  InvoiceListReport,
  PartyGstRegister,
  PartyStatement,
  PartySummaryReport,
  ProfitLossReport,
  RoyaltyReport,
  SamplingSheetReport,
} from './pages/ReportsPages'
import { Others } from './pages/Others'
import {
  AddStaff,
  AddToGroup,
  CompanyProfile,
  DailyCashFlow,
  ExtraHallmark,
  InvoiceSettings,
  ManagePassword,
  PartyDetails,
  RejectedRequest,
  StaffAttendance,
  TouchFundEntry,
} from './pages/OthersPages'
import { DataBackup } from './pages/DataBackup'
import { LicensePage } from './pages/License'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="dashboard" element={<AnalyticsDashboard />} />
            <Route path="license" element={<LicensePage />} />
            <Route path="manual-request" element={<ManualRequest />} />
            <Route path="auto-request" element={<AutoRequest />} />
            <Route path="rough-sheet" element={<RoughSheet />} />
            <Route path="request-list" element={<RequestList />} />
            <Route path="qm-request-list" element={<QMRequestList />} />
            <Route path="billing" element={<Billing />} />
            <Route path="print-job-card" element={<PrintJobCard />} />
            <Route path="xray-hallmark" element={<XrayHallmark />} />
            <Route path="fund-entry" element={<FundEntry />} />
            <Route path="expense-entry" element={<ExpenseEntry />} />
            <Route path="add-party" element={<AddParty />} />
            <Route path="new-category" element={<NewCategory />} />
            <Route path="create-fire-assay" element={<CreateFireAssay />} />
            <Route path="create-fire-assay/cg-auto" element={<CgAutoFireAssay />} />
            <Route path="create-fire-assay/cornet-auto" element={<CornetAutoFireAssay />} />
            <Route path="create-fire-assay/cornet-ms-m2" element={<CornetMsM2FireAssay />} />
            <Route path="create-fire-assay/manual" element={<ManualFireAssay />} />
            <Route path="view-fire-assay" element={<ViewFireAssay />} />
            <Route path="qm-stock" element={<QMStock />} />
            <Route path="qm-stock/gold" element={<QMGoldStock />} />
            <Route path="qm-stock/bis/gold" element={<QMBISGoldStock />} />
            <Route path="qm-stock/bis/:bisItem" element={<QMStockItem />} />
            <Route path="qm-stock/:item" element={<QMStockItem />} />
            <Route path="lab-stock" element={<LabStock />} />
            <Route path="lab-stock/gold" element={<LabGoldStock />} />
            <Route path="lab-stock/bis/:bisItem" element={<LabStockItem />} />
            <Route path="lab-stock/:item" element={<LabStockItem />} />
            <Route path="touch-form" element={<TouchForm />} />
            <Route path="touch-billing" element={<TouchBilling />} />
            <Route path="reports" element={<Reports />} />
            <Route path="reports/royalty" element={<RoyaltyReport />} />
            <Route path="reports/party-statement" element={<PartyStatement />} />
            <Route path="reports/bulk-statement" element={<BulkStatementDownload />} />
            <Route path="reports/fund-receipt" element={<FundReceiptRegister />} />
            <Route path="reports/party-gst" element={<PartyGstRegister />} />
            <Route path="reports/expense-register" element={<ExpenseRegister />} />
            <Route path="reports/sampling-sheet" element={<SamplingSheetReport />} />
            <Route path="reports/gst-credit" element={<GstCreditReport />} />
            <Route path="reports/extra-hallmark" element={<ExtraHallmarkReport />} />
            <Route path="reports/party-summary" element={<PartySummaryReport />} />
            <Route path="reports/profit-loss" element={<ProfitLossReport />} />
            <Route path="reports/invoice-list" element={<InvoiceListReport />} />
            <Route path="reports/fire-touch" element={<FireTouchReport />} />
            <Route path="reports/credit-note" element={<CreditNoteReport />} />
            <Route path="others" element={<Others />} />
            <Route path="others/party-details" element={<PartyDetails />} />
            <Route path="others/company-profile" element={<CompanyProfile />} />
            <Route path="others/daily-cash-flow" element={<DailyCashFlow />} />
            <Route path="others/rejected-request" element={<RejectedRequest />} />
            <Route path="others/extra-hallmark" element={<ExtraHallmark />} />
            <Route path="others/add-to-group" element={<AddToGroup />} />
            <Route path="others/touch-fund" element={<TouchFundEntry />} />
            <Route path="others/manage-password" element={<ManagePassword />} />
            <Route path="account-settings" element={<ManagePassword />} />
            <Route path="others/add-staff" element={<AddStaff />} />
            <Route path="others/staff-attendance" element={<StaffAttendance />} />
            <Route path="others/invoice-settings" element={<InvoiceSettings />} />
            <Route path="others/backup" element={<DataBackup />} />
            <Route path="others/license" element={<LicensePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
