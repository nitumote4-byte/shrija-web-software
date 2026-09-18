/**
 * BIS Hallmarking Amendment Regulations, 2026 — Schedule IV rates.
 * Run: npx --yes tsx scripts/hallmarking-rates.selftest.ts
 */
import {
  GOLD_BIS_FEE_PER_ARTICLE,
  GOLD_BIS_MIN_CONSIGNMENT_FEE,
  GOLD_HALLMARKING_FEE_PER_ARTICLE,
  GOLD_MIN_CONSIGNMENT_FEE,
  SILVER_BIS_FEE_PER_ARTICLE,
  SILVER_BIS_MIN_CONSIGNMENT_FEE,
  SILVER_HALLMARKING_FEE_PER_ARTICLE,
  SILVER_MIN_CONSIGNMENT_FEE,
  applyNotifiedHallmarkingRate,
  bisFeePerArticle,
  bisLevyForConsignment,
  bisMinConsignmentFee,
  hallmarkingFeePerArticle,
  metalFromPurity,
  resolveHallmarkMinConsignmentFee,
} from '../src/utils/hallmarkingRates.ts'

function assertEq(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

// --- AHC customer-facing rates ---
assertEq(GOLD_HALLMARKING_FEE_PER_ARTICLE, 75, 'Gold AHC per article')
assertEq(SILVER_HALLMARKING_FEE_PER_ARTICLE, 35, 'Silver AHC per article')
assertEq(hallmarkingFeePerArticle('Gold'), 75, 'Gold helper')
assertEq(hallmarkingFeePerArticle('Silver'), 35, 'Silver helper')
assertEq(hallmarkingFeePerArticle(undefined), 75, 'unknown metal defaults to Gold rate')

// --- Min consignments (jeweller → AHC) ---
assertEq(GOLD_MIN_CONSIGNMENT_FEE, 200, 'Gold min consignment')
assertEq(SILVER_MIN_CONSIGNMENT_FEE, 150, 'Silver min consignment')
assertEq(resolveHallmarkMinConsignmentFee('Silver', 200), 150, 'Silver ignores gold settings floor')
assertEq(resolveHallmarkMinConsignmentFee('Gold', 200), 200, 'Gold uses settings/default 200')
assertEq(resolveHallmarkMinConsignmentFee('Gold', 250), 250, 'Gold can use custom settings amount')

// --- BIS levy ---
assertEq(GOLD_BIS_FEE_PER_ARTICLE, 7.5, 'Gold BIS per article')
assertEq(SILVER_BIS_FEE_PER_ARTICLE, 3.5, 'Silver BIS per article')
assertEq(GOLD_BIS_MIN_CONSIGNMENT_FEE, 20, 'Gold BIS min')
assertEq(SILVER_BIS_MIN_CONSIGNMENT_FEE, 15, 'Silver BIS min')
assertEq(bisFeePerArticle('Gold'), 7.5, 'Gold BIS helper')
assertEq(bisFeePerArticle('Silver'), 3.5, 'Silver BIS helper')
assertEq(bisMinConsignmentFee('Gold'), 20, 'Gold BIS min helper')
assertEq(bisMinConsignmentFee('Silver'), 15, 'Silver BIS min helper')

assertEq(bisLevyForConsignment(1, 'Gold'), 20, '1 Gold article hits BIS min ₹20')
assertEq(bisLevyForConsignment(3, 'Gold'), 22.5, '3 Gold articles = 3×7.50')
assertEq(bisLevyForConsignment(1, 'Silver'), 15, '1 Silver article hits BIS min ₹15')
assertEq(bisLevyForConsignment(5, 'Silver'), 17.5, '5 Silver articles = 5×3.50')
assertEq(bisLevyForConsignment(0, 'Gold'), 0, 'zero articles = zero BIS')

assertEq(metalFromPurity('925'), 'Silver', '925 → Silver')
assertEq(metalFromPurity('916'), 'Gold', '916 → Gold')

assertEq(
  applyNotifiedHallmarkingRate({ id: 'c1', name: 'X', purity: '916', metal: 'Gold', rate: 45 }).rate,
  75,
  'sync Gold category rate',
)
assertEq(
  applyNotifiedHallmarkingRate({ id: 'c3', name: 'Y', purity: '925', metal: 'Silver', rate: 15 }).rate,
  35,
  'sync Silver category rate',
)

// Seed / fallback files must not keep old AHC rates
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const storeSrc = readFileSync(path.join(root, 'src/data/store.ts'), 'utf8')
const dbSrc = readFileSync(path.join(root, 'server/src/db.ts'), 'utf8')
const billingSrc = readFileSync(path.join(root, 'src/pages/Billing.tsx'), 'utf8')
const monthlySrc = readFileSync(path.join(root, 'src/pages/MonthlyBilling.tsx'), 'utf8')
const challanSrc = readFileSync(path.join(root, 'src/components/InvoiceChallan.tsx'), 'utf8')
const royaltySrc = readFileSync(path.join(root, 'src/pages/ReportsPages.tsx'), 'utf8')

assertEq(storeSrc.includes('rate: 75'), true, 'store seed has Gold ₹75')
assertEq(storeSrc.includes("metal: 'Silver', rate: 35"), true, 'store seed has Silver ₹35')
assertEq(/rate:\s*45/.test(storeSrc), false, 'store seed has no ₹45')
assertEq(dbSrc.includes('rate: 75'), true, 'db seed has Gold ₹75')
assertEq(dbSrc.includes("metal: 'Silver', rate: 35"), true, 'db seed has Silver ₹35')
assertEq(billingSrc.includes('hallmarkingFeePerArticle'), true, 'Billing uses notified fallback')
assertEq(billingSrc.includes('resolveHallmarkMinConsignmentFee'), true, 'Billing uses metal min')
assertEq(monthlySrc.includes('hallmarkingFeePerArticle'), true, 'Monthly Billing uses notified fallback')
assertEq(challanSrc.includes('hallmarkingFeePerArticle'), true, 'Challan uses notified fallback')
assertEq(royaltySrc.includes('bisLevyForConsignment'), true, 'Royalty uses BIS levy helper')
assertEq(royaltySrc.includes('ROYALTY_PER_HM = 4.5'), false, 'old BIS 4.5 removed')

console.log('hallmarking-rates.selftest: all assertions passed')
