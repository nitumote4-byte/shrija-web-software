import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { PwaInstallBanner } from './components/PwaInstallBanner'
import { Login } from './pages/Login'

/** Eager login only — all modules load on demand for faster first paint. */
const ResetPassword = lazy(() =>
  import('./pages/ResetPassword').then((m) => ({ default: m.ResetPassword })),
)
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })))
const AnalyticsDashboard = lazy(() =>
  import('./pages/AnalyticsDashboard').then((m) => ({ default: m.AnalyticsDashboard })),
)
const ManualRequest = lazy(() =>
  import('./pages/ManualRequest').then((m) => ({ default: m.ManualRequest })),
)
const AutoRequest = lazy(() => import('./pages/AutoRequest').then((m) => ({ default: m.AutoRequest })))
const RoughSheet = lazy(() => import('./pages/RoughSheet').then((m) => ({ default: m.RoughSheet })))
const RequestList = lazy(() => import('./pages/RequestList').then((m) => ({ default: m.RequestList })))
const QMRequestList = lazy(() =>
  import('./pages/QMRequestList').then((m) => ({ default: m.QMRequestList })),
)
const Billing = lazy(() => import('./pages/Billing').then((m) => ({ default: m.Billing })))
const ViewGeneratedBills = lazy(() =>
  import('./pages/ViewGeneratedBills').then((m) => ({ default: m.ViewGeneratedBills })),
)
const MonthlyBilling = lazy(() =>
  import('./pages/MonthlyBilling').then((m) => ({ default: m.MonthlyBilling })),
)
const ViewMonthlyBills = lazy(() =>
  import('./pages/ViewMonthlyBills').then((m) => ({ default: m.ViewMonthlyBills })),
)
const PrintJobCard = lazy(() =>
  import('./pages/PrintJobCard').then((m) => ({ default: m.PrintJobCard })),
)
const XrayHallmark = lazy(() =>
  import('./pages/XrayHallmark').then((m) => ({ default: m.XrayHallmark })),
)
const XrfDailyStandardCheck = lazy(() =>
  import('./pages/XrfDailyStandardCheck').then((m) => ({ default: m.XrfDailyStandardCheck })),
)
const FundEntry = lazy(() => import('./pages/FundEntry').then((m) => ({ default: m.FundEntry })))
const ExpenseEntry = lazy(() =>
  import('./pages/ExpenseEntry').then((m) => ({ default: m.ExpenseEntry })),
)
const AddParty = lazy(() => import('./pages/AddParty').then((m) => ({ default: m.AddParty })))
const NewCategory = lazy(() => import('./pages/NewCategory').then((m) => ({ default: m.NewCategory })))
const CreateFireAssay = lazy(() =>
  import('./pages/CreateFireAssay').then((m) => ({ default: m.CreateFireAssay })),
)
const CgAutoFireAssay = lazy(() =>
  import('./pages/FireAssayForms').then((m) => ({ default: m.CgAutoFireAssay })),
)
const CornetAutoFireAssay = lazy(() =>
  import('./pages/FireAssayForms').then((m) => ({ default: m.CornetAutoFireAssay })),
)
const CornetMsM2FireAssay = lazy(() =>
  import('./pages/FireAssayForms').then((m) => ({ default: m.CornetMsM2FireAssay })),
)
const ManualFireAssay = lazy(() =>
  import('./pages/FireAssayForms').then((m) => ({ default: m.ManualFireAssay })),
)
const ViewFireAssay = lazy(() =>
  import('./pages/ViewFireAssay').then((m) => ({ default: m.ViewFireAssay })),
)
const QMStock = lazy(() => import('./pages/Stock').then((m) => ({ default: m.QMStock })))
const QMGoldStock = lazy(() => import('./pages/Stock').then((m) => ({ default: m.QMGoldStock })))
const QMBISGoldStock = lazy(() =>
  import('./pages/Stock').then((m) => ({ default: m.QMBISGoldStock })),
)
const QMStockItem = lazy(() => import('./pages/Stock').then((m) => ({ default: m.QMStockItem })))
const LabStock = lazy(() => import('./pages/Stock').then((m) => ({ default: m.LabStock })))
const LabGoldStock = lazy(() => import('./pages/Stock').then((m) => ({ default: m.LabGoldStock })))
const LabStockItem = lazy(() => import('./pages/Stock').then((m) => ({ default: m.LabStockItem })))
const TouchForm = lazy(() => import('./pages/TouchForm').then((m) => ({ default: m.TouchForm })))
const TouchBilling = lazy(() =>
  import('./pages/TouchBilling').then((m) => ({ default: m.TouchBilling })),
)
const Reports = lazy(() => import('./pages/Reports').then((m) => ({ default: m.Reports })))
const RoyaltyReport = lazy(() =>
  import('./pages/ReportsPages').then((m) => ({ default: m.RoyaltyReport })),
)
const PartyStatement = lazy(() =>
  import('./pages/ReportsPages').then((m) => ({ default: m.PartyStatement })),
)
const BulkStatementDownload = lazy(() =>
  import('./pages/ReportsPages').then((m) => ({ default: m.BulkStatementDownload })),
)
const FundReceiptRegister = lazy(() =>
  import('./pages/ReportsPages').then((m) => ({ default: m.FundReceiptRegister })),
)
const PartyGstRegister = lazy(() =>
  import('./pages/ReportsPages').then((m) => ({ default: m.PartyGstRegister })),
)
const ExpenseRegister = lazy(() =>
  import('./pages/ReportsPages').then((m) => ({ default: m.ExpenseRegister })),
)
const SamplingSheetReport = lazy(() =>
  import('./pages/ReportsPages').then((m) => ({ default: m.SamplingSheetReport })),
)
const GstCreditReport = lazy(() =>
  import('./pages/ReportsPages').then((m) => ({ default: m.GstCreditReport })),
)
const ExtraHallmarkReport = lazy(() =>
  import('./pages/ReportsPages').then((m) => ({ default: m.ExtraHallmarkReport })),
)
const PartySummaryReport = lazy(() =>
  import('./pages/ReportsPages').then((m) => ({ default: m.PartySummaryReport })),
)
const ProfitLossReport = lazy(() =>
  import('./pages/ReportsPages').then((m) => ({ default: m.ProfitLossReport })),
)
const InvoiceListReport = lazy(() =>
  import('./pages/ReportsPages').then((m) => ({ default: m.InvoiceListReport })),
)
const FireTouchReport = lazy(() =>
  import('./pages/ReportsPages').then((m) => ({ default: m.FireTouchReport })),
)
const CreditNoteReport = lazy(() =>
  import('./pages/ReportsPages').then((m) => ({ default: m.CreditNoteReport })),
)
const Others = lazy(() => import('./pages/Others').then((m) => ({ default: m.Others })))
const PartyDetails = lazy(() =>
  import('./pages/OthersPages').then((m) => ({ default: m.PartyDetails })),
)
const CompanyProfile = lazy(() =>
  import('./pages/OthersPages').then((m) => ({ default: m.CompanyProfile })),
)
const DailyCashFlow = lazy(() =>
  import('./pages/OthersPages').then((m) => ({ default: m.DailyCashFlow })),
)
const RejectedRequest = lazy(() =>
  import('./pages/OthersPages').then((m) => ({ default: m.RejectedRequest })),
)
const ExtraHallmark = lazy(() =>
  import('./pages/OthersPages').then((m) => ({ default: m.ExtraHallmark })),
)
const AddToGroup = lazy(() => import('./pages/OthersPages').then((m) => ({ default: m.AddToGroup })))
const TouchFundEntry = lazy(() =>
  import('./pages/OthersPages').then((m) => ({ default: m.TouchFundEntry })),
)
const ManagePassword = lazy(() =>
  import('./pages/OthersPages').then((m) => ({ default: m.ManagePassword })),
)
const AddStaff = lazy(() => import('./pages/OthersPages').then((m) => ({ default: m.AddStaff })))
const StaffAttendance = lazy(() =>
  import('./pages/OthersPages').then((m) => ({ default: m.StaffAttendance })),
)
const InvoiceSettings = lazy(() =>
  import('./pages/OthersPages').then((m) => ({ default: m.InvoiceSettings })),
)
const OperationalPeriodPage = lazy(() =>
  import('./pages/OperationalPeriod').then((m) => ({ default: m.OperationalPeriodPage })),
)
const DataBackup = lazy(() => import('./pages/DataBackup').then((m) => ({ default: m.DataBackup })))
const LicensePage = lazy(() => import('./pages/License').then((m) => ({ default: m.LicensePage })))
const PlatformOperator = lazy(() =>
  import('./pages/PlatformOperator').then((m) => ({ default: m.PlatformOperator })),
)

function PageFallback() {
  return (
    <div className="page-loading" role="status" aria-live="polite">
      Loading…
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <PwaInstallBanner />
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/operator" element={<PlatformOperator />} />

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
              <Route path="generated-bills" element={<ViewGeneratedBills />} />
              <Route path="monthly-billing" element={<MonthlyBilling />} />
              <Route path="monthly-bills" element={<ViewMonthlyBills />} />
              <Route path="print-job-card" element={<PrintJobCard />} />
              <Route path="xray-hallmark" element={<XrayHallmark />} />
              <Route path="xrf-daily-standard" element={<XrfDailyStandardCheck />} />
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
              <Route path="others/operational-period" element={<OperationalPeriodPage />} />
              <Route path="others/backup" element={<DataBackup />} />
              <Route path="others/license" element={<LicensePage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
