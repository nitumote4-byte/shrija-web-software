import { Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  Calculator,
  Calendar,
  Coins,
  Download,
  FileSpreadsheet,
  FileText,
  Gem,
  HandCoins,
  Mail,
  MapPin,
  MessageCircle,
  Percent,
  PlusCircle,
  Printer,
  Receipt,
  RefreshCw,
  Scale,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  Trophy,
  Wallet,
} from 'lucide-react'
import { statusBadge, useToast } from '../components/ui'
import { getFirmProfile } from '../data/firmProfile'
import { CENTRE_NAME } from '../data/modules'
import { computeInvoicePaymentStatuses, store } from '../data/store'
import { tenantGet, tenantSet } from '../data/tenant'

/** Local calendar YYYY-MM-DD (avoids UTC day shift in IST late night / early morning). */
function localYmd(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function ReportShell({
  title,
  subtitle,
  children,
  onDownload,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
  onDownload?: () => void
}) {
  return (
    <div className="others-subpage">
      <Link to="/reports" className="back-link">
        <ArrowLeft size={16} /> Back to Reports
      </Link>
      <div className="page-header">
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        {onDownload && (
          <button type="button" className="btn btn-primary" onClick={onDownload}>
            <Download size={16} /> Download
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

type RoyaltyPartyRow = {
  partyName: string
  licenseNo: string
  grossWeight: number
  recPic: number
  hm: number
  cut: number
  rej: number
  rejWeight: number
  bisRoyalty: number
  gst: number
}

function loadFirmForReport() {
  const defaults = {
    firmName: CENTRE_NAME,
    email: 'info@shrija-hallmarking.in',
    address: 'Main Market, City',
    gstNo: '27AAAAA0000A1Z5',
  }
  return { ...defaults, ...getFirmProfile() }
}

function formatShortDate(iso: string) {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}-${m}-${y.slice(2)}`
}

export function RoyaltyReport() {
  const data = store.getAll()
  const { toast, Toast } = useToast()
  const firm = loadFirmForReport()

  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [endDate, setEndDate] = useState(() => {
    const d = new Date()
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    return last.toISOString().slice(0, 10)
  })
  const [fetched, setFetched] = useState(false)

  const rows = useMemo(() => {
    if (!fetched) return [] as RoyaltyPartyRow[]
    const inRange = data.roughSheets.filter(
      (r) =>
        r.date >= startDate &&
        r.date <= endDate &&
        r.status !== 'Rejected',
    )
    // Also include request-only parties if no rough rows
    const byParty = new Map<string, RoyaltyPartyRow>()

    for (const r of inRange) {
      const party = data.parties.find((p) => p.id === r.partyId || p.name === r.partyName)
      const key = r.partyName
      const cur = byParty.get(key) || {
        partyName: r.partyName,
        licenseNo: party?.licenseNo || '',
        grossWeight: 0,
        recPic: 0,
        hm: 0,
        cut: 0,
        rej: 0,
        rejWeight: 0,
        bisRoyalty: 0,
        gst: 0,
      }
      const rej = Number(r.rejectPic) || 0
      const pic = Number(r.pic) || 0
      const cut = Number(r.sampleQty) || 0
      const hm = Math.max(0, pic - rej)
      cur.grossWeight += Number(r.weight) || 0
      cur.recPic += pic
      cur.hm += hm
      cur.cut += cut
      cur.rej += rej
      cur.rejWeight += rej > 0 && pic > 0 ? (Number(r.weight) || 0) * (rej / pic) : 0
      byParty.set(key, cur)
    }

    // Fallback: requests in range with no rough aggregation yet
    if (byParty.size === 0) {
      for (const req of data.requests.filter((r) => r.date >= startDate && r.date <= endDate)) {
        const party = data.parties.find((p) => p.id === req.partyId)
        const key = req.partyName
        const cur = byParty.get(key) || {
          partyName: req.partyName,
          licenseNo: party?.licenseNo || '',
          grossWeight: 0,
          recPic: 0,
          hm: 0,
          cut: 0,
          rej: 0,
          rejWeight: 0,
          bisRoyalty: 0,
          gst: 0,
        }
        cur.grossWeight += req.weight
        cur.recPic += req.pieces
        cur.hm += req.pieces
        byParty.set(key, cur)
      }
    }

    const ROYALTY_PER_HM = 4.5
    return [...byParty.values()].map((r) => {
      const bisRoyalty = Number((r.hm * ROYALTY_PER_HM).toFixed(2))
      const gst = Number((bisRoyalty * 0.18).toFixed(2))
      return {
        ...r,
        grossWeight: Number(r.grossWeight.toFixed(3)),
        rejWeight: Number(r.rejWeight.toFixed(3)),
        bisRoyalty,
        gst,
      }
    })
  }, [fetched, data, startDate, endDate])

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.grossWeight += r.grossWeight
        acc.recPic += r.recPic
        acc.hm += r.hm
        acc.cut += r.cut
        acc.rej += r.rej
        acc.rejWeight += r.rejWeight
        acc.bisRoyalty += r.bisRoyalty
        acc.gst += r.gst
        return acc
      },
      {
        grossWeight: 0,
        recPic: 0,
        hm: 0,
        cut: 0,
        rej: 0,
        rejWeight: 0,
        bisRoyalty: 0,
        gst: 0,
      },
    )
  }, [rows])

  const grandTotal = Number((totals.bisRoyalty + totals.gst).toFixed(2))

  const fetchReport = () => {
    setFetched(true)
    toast('Royalty report loaded')
  }

  const download = () => {
    if (!fetched) {
      toast('Fetch report first')
      return
    }
    downloadCsv('royalty-report.csv', [
      [
        'Sr No',
        'Name of Party',
        'License No',
        'Gross Weight',
        'Rec Pic',
        'HM',
        'Cut',
        'Rej',
        'Rej Pcs Weight',
        'BIS Royalty',
        'GST',
      ],
      ...rows.map((r, i) => [
        String(i + 1),
        r.partyName,
        r.licenseNo,
        r.grossWeight.toFixed(3),
        String(r.recPic),
        String(r.hm),
        String(r.cut),
        String(r.rej),
        r.rejWeight.toFixed(3),
        r.bisRoyalty.toFixed(2),
        r.gst.toFixed(2),
      ]),
      [
        '',
        'TOTALS',
        '',
        totals.grossWeight.toFixed(3),
        String(totals.recPic),
        String(totals.hm),
        String(totals.cut),
        String(totals.rej),
        totals.rejWeight.toFixed(3),
        totals.bisRoyalty.toFixed(2),
        totals.gst.toFixed(2),
      ],
      ['', 'GRAND TOTAL', '', '', '', '', '', '', '', '', grandTotal.toFixed(2)],
    ])
    toast('Report downloaded')
  }

  return (
    <div className="royalty-page">
      <Link to="/reports" className="back-link">
        <ArrowLeft size={16} /> Back to Reports
      </Link>

      <section className="royalty-filters">
        <div className="royalty-date-row">
          <div className="field">
            <label>START DATE</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="field">
            <label>END DATE</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
        <div className="royalty-actions">
          <button type="button" className="btn btn-navy" onClick={fetchReport}>
            <Search size={16} /> Fetch Report
          </button>
          <button type="button" className="btn btn-green" onClick={download}>
            <Download size={16} /> Download Report
          </button>
        </div>
      </section>

      <section className="royalty-sheet">
        <header className="royalty-sheet-head">
          <h1>{firm.firmName}</h1>
          <p>{firm.address}</p>
          <p>{firm.email}</p>
          <h2>Royalty Report</h2>
          <p className="royalty-period">
            {fetched
              ? `${formatShortDate(startDate)} — ${formatShortDate(endDate)}`
              : '— — —'}
          </p>
        </header>

        <div className="table-wrap">
          <table className="data-table navy-head-table royalty-table">
            <thead>
              <tr>
                <th>SR. NO</th>
                <th>NAME OF PARTY</th>
                <th>LICENSE NO</th>
                <th>GROSS WEIGHT (GMS)</th>
                <th>REC PIC</th>
                <th>HM</th>
                <th>CUT</th>
                <th>REJ</th>
                <th>REJ PCS WEIGHT</th>
                <th>BIS ROYALTY (₹)</th>
                <th>GST (₹)</th>
              </tr>
            </thead>
            <tbody>
              {!fetched ? (
                <tr>
                  <td colSpan={11} className="empty-state">
                    Select date range and click Fetch Report
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="empty-state">
                    No royalty data for selected period
                  </td>
                </tr>
              ) : (
                <>
                  {rows.map((r, i) => (
                    <tr key={r.partyName}>
                      <td>{i + 1}</td>
                      <td>{r.partyName}</td>
                      <td>{r.licenseNo || '—'}</td>
                      <td>{r.grossWeight.toFixed(3)}</td>
                      <td>{r.recPic}</td>
                      <td>{r.hm}</td>
                      <td>{r.cut}</td>
                      <td>{r.rej}</td>
                      <td>{r.rejWeight.toFixed(3)}</td>
                      <td>{r.bisRoyalty.toFixed(2)}</td>
                      <td>{r.gst.toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="royalty-totals">
                    <td colSpan={3}>
                      <strong>Totals</strong>
                    </td>
                    <td>
                      <strong>{totals.grossWeight.toFixed(3)}</strong>
                    </td>
                    <td>
                      <strong>{totals.recPic}</strong>
                    </td>
                    <td>
                      <strong>{totals.hm}</strong>
                    </td>
                    <td>
                      <strong>{totals.cut}</strong>
                    </td>
                    <td>
                      <strong>{totals.rej}</strong>
                    </td>
                    <td>
                      <strong>{totals.rejWeight.toFixed(3)}</strong>
                    </td>
                    <td>
                      <strong>{totals.bisRoyalty.toFixed(2)}</strong>
                    </td>
                    <td>
                      <strong>{totals.gst.toFixed(2)}</strong>
                    </td>
                  </tr>
                  <tr className="royalty-grand">
                    <td colSpan={9} />
                    <td colSpan={2}>
                      <strong>Grand Total: {grandTotal.toFixed(2)}</strong>
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="manual-actions">
        <Link to="/reports" className="btn btn-navy">
          <ArrowLeft size={16} /> Back
        </Link>
      </div>
      {Toast}
    </div>
  )
}

type StmtRow = {
  key: string
  jeweller: string
  type: string
  date: string
  pcs: number
  credit: number
  debit: number
  balance: number
  remarks: string
}

function loadFirmProfile() {
  const defaults = {
    firmName: CENTRE_NAME,
    email: 'info@shrija-hallmarking.in',
    address: 'Main Market, City',
    gstNo: '27AAAAA0000A1Z5',
  }
  return { ...defaults, ...getFirmProfile() }
}

function formatStmtDate(iso: string) {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}-${m}-${y}`
}

function money2(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function PartyStatement() {
  const data = store.getAll()
  const { toast, Toast } = useToast()
  const firm = loadFirmProfile()

  const [mode, setMode] = useState<'selected' | 'all'>('selected')
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [partyQuery, setPartyQuery] = useState('')
  const [partyOpen, setPartyOpen] = useState(false)
  const [partyId, setPartyId] = useState('')
  const [fetched, setFetched] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 15

  const party = data.parties.find((p) => p.id === partyId)

  const partyOptions = useMemo(() => {
    const q = partyQuery.trim().toLowerCase()
    return data.parties.filter(
      (p) =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.phone.includes(q) ||
        p.address.toLowerCase().includes(q),
    )
  }, [data.parties, partyQuery])

  const buildRowsForParty = (p: (typeof data.parties)[0]): StmtRow[] => {
    const invoices = data.invoices.filter(
      (i) => i.partyName === p.name && i.date >= startDate && i.date <= endDate,
    )
    const funds = data.funds.filter(
      (f) =>
        (f.partyName === p.name || f.source === p.name) &&
        f.date >= startDate &&
        f.date <= endDate,
    )
    const priorInvoices = data.invoices.filter(
      (i) => i.partyName === p.name && i.date < startDate,
    )
    const priorFunds = data.funds.filter(
      (f) => (f.partyName === p.name || f.source === p.name) && f.date < startDate,
    )
    const priorDebit = priorInvoices.reduce((s, i) => s + i.total, 0)
    const priorCredit = priorFunds.reduce((s, f) => s + f.amount, 0)
    const opening = priorDebit - priorCredit

    const rows: StmtRow[] = [
      {
        key: `${p.id}-opy`,
        jeweller: '',
        type: 'Opening Balance From Previous Year',
        date: '',
        pcs: 0,
        credit: 0,
        debit: 0,
        balance: 0,
        remarks: '',
      },
      {
        key: `${p.id}-op`,
        jeweller: '',
        type: 'Opening Balance',
        date: '',
        pcs: 0,
        credit: Math.max(0, -opening),
        debit: Math.max(0, opening),
        balance: opening,
        remarks: '',
      },
    ]

    let bal = opening
    type Ev = { date: string; kind: 'inv' | 'fund'; id: string }
    const events: Ev[] = [
      ...invoices.map((i) => ({ date: i.date, kind: 'inv' as const, id: i.id })),
      ...funds.map((f) => ({ date: f.date, kind: 'fund' as const, id: f.id })),
    ].sort((a, b) => a.date.localeCompare(b.date))

    for (const ev of events) {
      if (ev.kind === 'inv') {
        const inv = invoices.find((i) => i.id === ev.id)!
        const req = data.requests.find((r) => r.requestNo === inv.requestNo)
        bal += inv.total
        rows.push({
          key: inv.id,
          jeweller: p.name,
          type: 'Invoice',
          date: inv.date,
          pcs: req?.pieces || 0,
          credit: 0,
          debit: inv.total,
          balance: bal,
          remarks: inv.invoiceNo,
        })
      } else {
        const fund = funds.find((f) => f.id === ev.id)!
        bal -= fund.amount
        rows.push({
          key: fund.id,
          jeweller: p.name,
          type: fund.mode || 'Receipt',
          date: fund.date,
          pcs: 0,
          credit: fund.amount,
          debit: 0,
          balance: bal,
          remarks: fund.remarks || fund.voucherNo || '',
        })
      }
    }

    const periodCredit = rows
      .filter((r) => !r.key.endsWith('-opy') && !r.key.endsWith('-op') && !r.key.endsWith('-total'))
      .reduce((s, r) => s + r.credit, 0)
    const periodDebit = rows
      .filter((r) => !r.key.endsWith('-opy') && !r.key.endsWith('-op') && !r.key.endsWith('-total'))
      .reduce((s, r) => s + r.debit, 0)
    const periodPcs = rows
      .filter((r) => !r.key.endsWith('-opy') && !r.key.endsWith('-op') && !r.key.endsWith('-total'))
      .reduce((s, r) => s + r.pcs, 0)
    rows.push({
      key: `${p.id}-total`,
      jeweller: '',
      type: 'Total',
      date: '',
      pcs: periodPcs,
      credit: periodCredit,
      debit: periodDebit,
      balance: bal,
      remarks: '',
    })
    return rows
  }

  const statementRows = useMemo(() => {
    if (!fetched) return []
    if (mode === 'selected') {
      if (!party) return []
      return buildRowsForParty(party)
    }
    return data.parties.flatMap((p) => buildRowsForParty(p))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetched, mode, partyId, startDate, endDate, data])

  const totalPages = Math.max(1, Math.ceil(statementRows.length / pageSize))
  const pageRows = statementRows.slice((page - 1) * pageSize, page * pageSize)

  const fetchData = () => {
    if (mode === 'selected' && !partyId) {
      toast('Search and select a party')
      return
    }
    setFetched(true)
    setPage(1)
    toast('Statement loaded')
  }

  const download = () => {
    if (!fetched || statementRows.length === 0) {
      toast('Fetch data first')
      return
    }
    downloadCsv('party-statement.csv', [
      ['Name of Jeweller', 'Type', 'Date', 'Pcs', 'Credit', 'Debit', 'Balance', 'Remarks'],
      ...statementRows.map((r) => [
        r.jeweller,
        r.type,
        r.date,
        String(r.pcs),
        r.credit.toFixed(2),
        r.debit.toFixed(2),
        r.balance.toFixed(2),
        r.remarks,
      ]),
    ])
    toast('Report downloaded')
  }

  const sendWhatsapp = () => {
    if (!fetched) {
      toast('Fetch data first')
      return
    }
    const name = mode === 'selected' ? party?.name || 'Party' : 'All Parties'
    const text = encodeURIComponent(
      `${firm.firmName}\nParty Statement: ${name}\nPeriod: ${formatStmtDate(startDate)} — ${formatStmtDate(endDate)}\nRows: ${statementRows.length}`,
    )
    const phone = (party?.phone || '').replace(/\D/g, '')
    const url = phone
      ? `https://wa.me/91${phone.slice(-10)}?text=${text}`
      : `https://wa.me/?text=${text}`
    window.open(url, '_blank')
  }

  const addressHint =
    mode === 'selected'
      ? party
        ? party.address || party.name
        : 'Select a party to view address.'
      : `${data.parties.length} parties selected`

  return (
    <div className="pstmt-page">
      <Link to="/reports" className="back-link">
        <ArrowLeft size={16} /> Back to Reports
      </Link>

      <section className="pstmt-filters">
        <div className="field">
          <label>STATEMENT TYPE</label>
          <div className="pstmt-type-toggle">
            <button
              type="button"
              className={mode === 'selected' ? 'active' : ''}
              onClick={() => {
                setMode('selected')
                setFetched(false)
              }}
            >
              Selected Party
            </button>
            <button
              type="button"
              className={mode === 'all' ? 'active' : ''}
              onClick={() => {
                setMode('all')
                setFetched(false)
              }}
            >
              All Parties
            </button>
          </div>
        </div>

        <div className="pstmt-date-row">
          <div className="field">
            <label>START DATE</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="field">
            <label>END DATE</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>

        {mode === 'selected' && (
          <div className="field">
            <label>PARTY NAME</label>
            <div className="party-search">
              <input
                placeholder="Search and select Party."
                value={party ? party.name : partyQuery}
                onChange={(e) => {
                  setPartyId('')
                  setPartyQuery(e.target.value)
                  setPartyOpen(true)
                  setFetched(false)
                }}
                onFocus={() => setPartyOpen(true)}
                onBlur={() => setTimeout(() => setPartyOpen(false), 150)}
              />
              {partyOpen && partyOptions.length > 0 && (
                <div className="party-dropdown">
                  {partyOptions.slice(0, 8).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="party-option"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setPartyId(p.id)
                        setPartyQuery(p.name)
                        setPartyOpen(false)
                        setFetched(false)
                      }}
                    >
                      <strong>{p.name}</strong>
                      <span>{p.address || p.phone || '—'}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="pstmt-actions">
          <button type="button" className="btn btn-navy" onClick={fetchData}>
            <Search size={16} /> Fetch Data
          </button>
          <button type="button" className="btn btn-green" onClick={download}>
            <Download size={16} /> Download Report
          </button>
          <button type="button" className="btn btn-teal" onClick={sendWhatsapp}>
            <MessageCircle size={16} /> Send To Whatsapp
          </button>
        </div>

        <div className="pstmt-address-bar">
          <MapPin size={16} />
          <span>{addressHint}</span>
        </div>
      </section>

      <section className="pstmt-sheet">
        <header className="pstmt-sheet-head">
          <h1>{firm.firmName}</h1>
          <p>{firm.address}</p>
          <p>
            {firm.email} | GST NO: {firm.gstNo}
          </p>
          <h2>Party Statement</h2>
          {fetched ? (
            <p className="pstmt-period">
              {formatStmtDate(startDate)} — {formatStmtDate(endDate)}
            </p>
          ) : (
            <p className="pstmt-period muted">Select filters and fetch data</p>
          )}
        </header>

        {fetched && (
          <>
            <div className="table-wrap">
              <table className="data-table navy-head-table pstmt-table">
                <thead>
                  <tr>
                    <th>NAME OF JEWELLER</th>
                    <th>TYPE</th>
                    <th>DATE</th>
                    <th>PCS</th>
                    <th>CREDIT</th>
                    <th>DEBIT</th>
                    <th>BALANCE</th>
                    <th>REMARKS</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="empty-state">
                        No statement rows
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((r) => (
                      <tr key={r.key} className={r.type === 'Total' ? 'pstmt-total-row' : ''}>
                        <td>{r.jeweller}</td>
                        <td>{r.type}</td>
                        <td>{r.date ? formatStmtDate(r.date) : ''}</td>
                        <td>{r.type === 'Total' || r.pcs ? r.pcs : ''}</td>
                        <td>{money2(r.credit)}</td>
                        <td>{money2(r.debit)}</td>
                        <td>{money2(r.balance)}</td>
                        <td>{r.remarks}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="pstmt-pager">
              <button type="button" disabled={page <= 1} onClick={() => setPage(1)}>
                First
              </button>
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <input readOnly value={page} aria-label="Page" />
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage(totalPages)}
              >
                Last
              </button>
            </div>
          </>
        )}
      </section>

      <div className="manual-actions">
        <Link to="/reports" className="btn btn-navy">
          Back
        </Link>
      </div>
      {Toast}
    </div>
  )
}

export function BulkStatementDownload() {
  const { toast, Toast } = useToast()
  const parties = store.getAll().parties
  const [selected, setSelected] = useState<string[]>(parties.map((p) => p.id))

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const download = () => {
    const data = store.getAll()
    const rows: string[][] = [['Party', 'Phone', 'GST', 'Requests', 'Invoice Total']]
    for (const p of data.parties.filter((x) => selected.includes(x.id))) {
      const reqCount = data.requests.filter((r) => r.partyId === p.id).length
      const invTotal = data.invoices
        .filter((i) => i.partyName === p.name)
        .reduce((s, i) => s + i.total, 0)
      rows.push([p.name, p.phone, p.gstin, String(reqCount), String(invTotal)])
    }
    downloadCsv('bulk-party-statements.csv', rows)
    toast(`${selected.length} statement(s) downloaded`)
  }

  return (
    <ReportShell
      title="Bulk Statement Download"
      subtitle="Download multiple party statements"
      onDownload={download}
    >
      <div className="panel">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Select</th>
                <th>Party</th>
                <th>Phone</th>
                <th>GST</th>
              </tr>
            </thead>
            <tbody>
              {parties.map((p) => (
                <tr key={p.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.includes(p.id)}
                      onChange={() => toggle(p.id)}
                    />
                  </td>
                  <td>{p.name}</td>
                  <td>{p.phone}</td>
                  <td>{p.gstin || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {Toast}
    </ReportShell>
  )
}

export function FundReceiptRegister() {
  const data = store.getAll()
  const { toast, Toast } = useToast()

  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [partyQuery, setPartyQuery] = useState('')
  const [partyOpen, setPartyOpen] = useState(false)
  const [partyId, setPartyId] = useState('')
  const [fetched, setFetched] = useState(false)

  const party = data.parties.find((p) => p.id === partyId)

  const partyOptions = useMemo(() => {
    const q = partyQuery.trim().toLowerCase()
    return data.parties.filter(
      (p) =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.phone.includes(q) ||
        p.address.toLowerCase().includes(q),
    )
  }, [data.parties, partyQuery])

  const rows = useMemo(() => {
    if (!fetched) return []
    return data.funds.filter((f) => {
      if (f.date < startDate || f.date > endDate) return false
      if (party) {
        const name = (f.partyName || f.source || '').toLowerCase()
        if (name !== party.name.toLowerCase()) return false
      }
      return true
    })
  }, [fetched, data.funds, startDate, endDate, party])

  const doFetch = () => {
    setFetched(true)
    toast('Fund receipts loaded')
  }

  const download = () => {
    if (!fetched) {
      toast('Fetch data first')
      return
    }
    downloadCsv('fund-receipt-register.csv', [
      ['Date', 'Voucher No', 'Transaction Type', 'Party Name', 'Total Amount', 'Remarks'],
      ...rows.map((f) => [
        f.date,
        f.voucherNo || '',
        f.mode,
        f.partyName || f.source,
        f.amount.toFixed(2),
        f.remarks || '',
      ]),
    ])
    toast('Report downloaded')
  }

  const addressHint = party
    ? party.address || party.name
    : 'Select a party to view address.'

  const formatDate = (iso: string) => {
    const [y, m, d] = iso.split('-')
    if (!y || !m || !d) return iso
    return `${d}-${m}-${y}`
  }

  return (
    <div className="fundreg-page">
      <Link to="/reports" className="back-link">
        <ArrowLeft size={16} /> Back to Reports
      </Link>

      <section className="fundreg-filters">
        <div className="fundreg-date-row">
          <div className="field">
            <label>START DATE</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="field">
            <label>END DATE</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>

        <div className="field">
          <label>PARTY NAME (OPTIONAL)</label>
          <div className="party-search">
            <input
              placeholder="Search and select Party."
              value={party ? party.name : partyQuery}
              onChange={(e) => {
                setPartyId('')
                setPartyQuery(e.target.value)
                setPartyOpen(true)
                setFetched(false)
              }}
              onFocus={() => setPartyOpen(true)}
              onBlur={() => setTimeout(() => setPartyOpen(false), 150)}
            />
            {party && (
              <button
                type="button"
                className="fundreg-clear"
                title="Clear party"
                onClick={() => {
                  setPartyId('')
                  setPartyQuery('')
                  setFetched(false)
                }}
              >
                ×
              </button>
            )}
            {partyOpen && partyOptions.length > 0 && (
              <div className="party-dropdown">
                {partyOptions.slice(0, 8).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="party-option"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setPartyId(p.id)
                      setPartyQuery(p.name)
                      setPartyOpen(false)
                      setFetched(false)
                    }}
                  >
                    <strong>{p.name}</strong>
                    <span>{p.address || p.phone || '—'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="fundreg-actions">
          <button type="button" className="btn btn-navy" onClick={doFetch}>
            <Search size={16} /> Fetch Data
          </button>
          <button type="button" className="btn btn-green" onClick={download}>
            <Download size={16} /> Download Report
          </button>
        </div>

        <div className="fundreg-address-bar">
          <MapPin size={16} />
          <span>{addressHint}</span>
        </div>
      </section>

      <section className="fundreg-sheet">
        <header className="fundreg-sheet-head">
          <h2>Fund Receipt Register</h2>
          {fetched && (
            <p>
              {formatDate(startDate)} -- {formatDate(endDate)}
            </p>
          )}
        </header>

        <div className="table-wrap">
          <table className="data-table navy-head-table">
            <thead>
              <tr>
                <th>DATE</th>
                <th>VOUCHER NO</th>
                <th>TRANSACTION TYPE</th>
                <th>PARTY NAME</th>
                <th>TOTAL AMOUNT</th>
                <th>REMARKS</th>
              </tr>
            </thead>
            <tbody>
              {!fetched ? (
                <tr>
                  <td colSpan={6} className="empty-state">
                    Select filters and click Fetch Data
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty-state">
                    No records found
                  </td>
                </tr>
              ) : (
                rows.map((f) => (
                  <tr key={f.id}>
                    <td>{formatDate(f.date)}</td>
                    <td>{f.voucherNo ? `#${f.voucherNo}` : '—'}</td>
                    <td>{f.mode}</td>
                    <td>{f.partyName || f.source}</td>
                    <td>
                      ₹{' '}
                      {f.amount.toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td>{f.remarks || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="manual-actions">
        <Link to="/reports" className="btn btn-navy">
          Back
        </Link>
      </div>
      {Toast}
    </div>
  )
}

export function PartyGstRegister() {
  const parties = store.getAll().parties
  return (
    <ReportShell
      title="Party Register with GST"
      subtitle="GST details of all parties"
      onDownload={() =>
        downloadCsv('party-gst-register.csv', [
          ['Party', 'GSTIN', 'State', 'State Code', 'License', 'Address'],
          ...parties.map((p) => [
            p.name,
            p.gstin,
            p.state,
            p.stateCode,
            p.licenseNo,
            p.address,
          ]),
        ])
      }
    >
      <div className="panel">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Party</th>
                <th>GSTIN</th>
                <th>State</th>
                <th>Code</th>
                <th>License / CML</th>
                <th>Address</th>
              </tr>
            </thead>
            <tbody>
              {parties.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.gstin || '—'}</td>
                  <td>{p.state || '—'}</td>
                  <td>{p.stateCode || '—'}</td>
                  <td>{p.licenseNo || '—'}</td>
                  <td>{p.address || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ReportShell>
  )
}

export function ExpenseRegister() {
  const expenses = store.getAll().expenses
  const total = expenses.reduce(
    (s, e) => s + (Number(e.grossAmount) || Number(e.amount) + (Number(e.gstAmount) || 0)),
    0,
  )
  return (
    <ReportShell title="Expense Register" subtitle="Track all business expenses">
      <div className="stats-row">
        <div className="stat-card">
          <span>Total Expenses</span>
          <strong>₹ {total.toLocaleString('en-IN')}</strong>
        </div>
      </div>
      <div className="panel">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Mode</th>
                <th>Product</th>
                <th>Party</th>
                <th>Amount</th>
                <th>GST</th>
                <th>Gross</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => {
                const gross =
                  Number(e.grossAmount) || Number(e.amount) + (Number(e.gstAmount) || 0)
                return (
                  <tr key={e.id}>
                    <td>{e.date}</td>
                    <td>{e.mode || 'Cash'}</td>
                    <td>{e.product || e.category}</td>
                    <td>{e.partyName || e.paidTo}</td>
                    <td>₹ {e.amount.toLocaleString('en-IN')}</td>
                    <td>₹ {(Number(e.gstAmount) || 0).toLocaleString('en-IN')}</td>
                    <td>₹ {gross.toLocaleString('en-IN')}</td>
                    <td>{e.remarks || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </ReportShell>
  )
}

export function SamplingSheetReport() {
  const { toast, Toast } = useToast()
  const data = store.getAll()

  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [fetched, setFetched] = useState(false)

  const formatDisplay = (iso: string) => {
    const [y, m, d] = iso.split('-')
    if (!y || !m || !d) return iso
    return `${d}-${m}-${y}`
  }

  const rows = useMemo(() => {
    if (!fetched) return []
    return data.roughSheets
      .filter((r) => r.date >= startDate && r.date <= endDate)
      .map((r) => {
        const pending = data.pendingRough.find(
          (p) => p.requestNo === r.requestNo || (p.partyId === r.partyId && p.date === r.date),
        )
        const invoice = data.invoices.find(
          (i) =>
            i.requestNo === r.requestNo ||
            (i.partyName.toLowerCase() === r.partyName.toLowerCase() && i.date === r.date),
        )
        const reject = r.rejectPic ?? 0
        const cut = r.samplingMethod.toLowerCase().includes('cut') ? r.sampleQty || 1 : 0
        const hm = Math.max(0, r.pic - reject)
        const returnPcs = 0
        const rejectWeight =
          r.pic > 0 && reject > 0 ? Number(((r.weight / r.pic) * reject).toFixed(3)) : 0

        return {
          id: r.id,
          dateTime: `${formatDisplay(r.date)} ${r.shift === 'Night' ? '08:00 PM' : '10:00 AM'}`,
          receiptNo: pending?.receiptNo || '—',
          requestNo: r.requestNo || pending?.requestNo || '—',
          jobCardNo: r.jobCardNo || pending?.jobCardNo || '—',
          purity: r.purity,
          item: r.item,
          pieces: r.pic,
          weight: r.weight,
          sampleWeight: r.sampleWeight,
          invoiceNo: invoice?.invoiceNo || '—',
          hm,
          cut,
          reject,
          returnPcs,
          rejectWeight,
          remarks: [r.samplingMethod, r.status !== 'Pending' ? r.status : ''].filter(Boolean).join(' · ') || '—',
        }
      })
  }, [fetched, data.roughSheets, data.pendingRough, data.invoices, startDate, endDate])

  const doFetch = () => {
    setFetched(true)
    toast('Sampling records loaded')
  }

  const download = () => {
    if (!fetched) {
      toast('Fetch data first')
      return
    }
    downloadCsv('sampling-jewellery-register.csv', [
      [
        'Date & Time',
        'Receipt No',
        'Request No',
        'Jobcard No',
        'Purity',
        'Item',
        'No of Pieces',
        'Weight',
        'Sample Weight',
        'Invoice No',
        'HM',
        'Cut',
        'Reject',
        'Return',
        'Weight of Rejected Items',
        'Remarks',
      ],
      ...rows.map((r) => [
        r.dateTime,
        r.receiptNo,
        r.requestNo,
        r.jobCardNo,
        r.purity,
        r.item,
        String(r.pieces),
        r.weight.toFixed(3),
        r.sampleWeight.toFixed(3),
        r.invoiceNo,
        String(r.hm),
        String(r.cut),
        String(r.reject),
        String(r.returnPcs),
        r.rejectWeight.toFixed(3),
        r.remarks,
      ]),
    ])
    toast('Report downloaded')
  }

  return (
    <div className="samp-page">
      <Link to="/reports" className="back-link">
        <ArrowLeft size={16} /> Back to Reports
      </Link>

      <section className="samp-filters">
        <div className="samp-date-row">
          <div className="field">
            <label>START DATE</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                setFetched(false)
              }}
            />
          </div>
          <div className="field">
            <label>END DATE</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value)
                setFetched(false)
              }}
            />
          </div>
        </div>
        <div className="samp-actions">
          <button type="button" className="btn btn-navy" onClick={doFetch}>
            <Search size={16} /> Fetch Data
          </button>
          <button type="button" className="btn btn-green" onClick={download}>
            <Download size={16} /> Download Report
          </button>
        </div>
      </section>

      <section className="samp-sheet">
        <header className="samp-sheet-head">
          <div className="samp-mail-icon">
            <Mail size={22} />
          </div>
          <h2>Record Of Samples/Jewellery Register</h2>
          {fetched && (
            <p>
              <Calendar size={14} /> {formatDisplay(startDate)} — {formatDisplay(endDate)}
            </p>
          )}
        </header>

        <div className="table-wrap">
          <table className="data-table navy-head-table samp-table">
            <thead>
              <tr>
                <th>DATE &amp; TIME</th>
                <th>RECEIPT NO</th>
                <th>REQUEST NO</th>
                <th>JOBCARD NO</th>
                <th>PURITY</th>
                <th>ITEM</th>
                <th>NO OF PIECES</th>
                <th>WEIGHT</th>
                <th>SAMPLE WEIGHT</th>
                <th>INVOICE NO</th>
                <th>HM</th>
                <th>CUT</th>
                <th>REJECT</th>
                <th>RETURN</th>
                <th>WEIGHT OF REJECTED ITEMS</th>
                <th>REMARKS</th>
              </tr>
            </thead>
            <tbody>
              {!fetched ? (
                <tr>
                  <td colSpan={16} className="empty-state">
                    Select dates and click Fetch Data
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={16} className="empty-state">
                    No records found
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.dateTime}</td>
                    <td>{r.receiptNo}</td>
                    <td>{r.requestNo}</td>
                    <td>{r.jobCardNo}</td>
                    <td>{r.purity}</td>
                    <td>{r.item}</td>
                    <td>{r.pieces}</td>
                    <td>{r.weight.toFixed(3)}</td>
                    <td>{r.sampleWeight.toFixed(3)}</td>
                    <td>{r.invoiceNo}</td>
                    <td>{r.hm}</td>
                    <td>{r.cut}</td>
                    <td>{r.reject}</td>
                    <td>{r.returnPcs}</td>
                    <td>{r.rejectWeight.toFixed(3)}</td>
                    <td>{r.remarks}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="samp-back">
        <Link to="/reports" className="btn btn-navy">
          Back
        </Link>
      </div>
      {Toast}
    </div>
  )
}

export function GstCreditReport() {
  const data = store.getAll()

  const sales = useMemo(() => {
    let cgst = 0
    let sgst = 0
    let igst = 0
    for (const inv of data.invoices) {
      const party = data.parties.find(
        (p) => p.name.toLowerCase() === inv.partyName.toLowerCase(),
      )
      if (party?.igstApplicable) {
        igst += inv.tax
      } else {
        const half = inv.tax / 2
        cgst += half
        sgst += half
      }
    }
    return {
      cgst: Number(cgst.toFixed(2)),
      sgst: Number(sgst.toFixed(2)),
      igst: Number(igst.toFixed(2)),
      total: Number((cgst + sgst + igst).toFixed(2)),
    }
  }, [data.invoices, data.parties])

  // Purchase ITC not tracked yet — keep zero like Gold Shark demo
  const purchase = { cgst: 0, sgst: 0, igst: 0, total: 0 }

  const net = Number((sales.total - purchase.total).toFixed(2))
  const toBePaid = net >= 0

  return (
    <div className="gstc-page">
      <Link to="/reports" className="back-link">
        <ArrowLeft size={16} /> Back to Reports
      </Link>

      <header className="gstc-hero">
        <h1>GST Summary Dashboard</h1>
        <p>Track your GST credits, liabilities, and calculate payable/refundable amounts</p>
      </header>

      <div className="gstc-summary">
        <div className="gstc-sum-card sales">
          <div className="gstc-sum-icon">
            <TrendingUp size={22} />
          </div>
          <span>TOTAL SALES GST</span>
          <strong>{moneyInr(sales.total)}</strong>
        </div>
        <div className="gstc-sum-card purchase">
          <div className="gstc-sum-icon">
            <TrendingDown size={22} />
          </div>
          <span>TOTAL PURCHASE GST (ITC)</span>
          <strong>{moneyInr(purchase.total)}</strong>
        </div>
        <div className="gstc-sum-card net">
          <div className="gstc-sum-icon">
            <Calculator size={22} />
          </div>
          <span>NET GST PAYABLE</span>
          <strong>{moneyInr(Math.abs(net))}</strong>
        </div>
      </div>

      <div className="gstc-columns">
        <section className="gstc-panel sales">
          <header className="gstc-panel-head">
            <FileText size={18} />
            <h2>Sales GST (Output Tax)</h2>
          </header>
          <ul className="gstc-rows">
            <li>
              <span className="gstc-row-icon">
                <Percent size={16} />
              </span>
              <span>CGST (Central GST)</span>
              <strong>{moneyInr(sales.cgst)}</strong>
            </li>
            <li>
              <span className="gstc-row-icon">
                <Percent size={16} />
              </span>
              <span>SGST (State GST)</span>
              <strong>{moneyInr(sales.sgst)}</strong>
            </li>
            <li>
              <span className="gstc-row-icon">
                <Percent size={16} />
              </span>
              <span>IGST (Integrated GST)</span>
              <strong>{moneyInr(sales.igst)}</strong>
            </li>
          </ul>
          <footer className="gstc-panel-foot">
            <span>Total Sales GST</span>
            <strong>{moneyInr(sales.total)}</strong>
          </footer>
        </section>

        <section className="gstc-panel purchase">
          <header className="gstc-panel-head">
            <Receipt size={18} />
            <h2>Purchase GST (Input Tax Credit)</h2>
          </header>
          <ul className="gstc-rows">
            <li>
              <span className="gstc-row-icon">
                <Percent size={16} />
              </span>
              <span>CGST (Central GST)</span>
              <strong>{moneyInr(purchase.cgst)}</strong>
            </li>
            <li>
              <span className="gstc-row-icon">
                <Percent size={16} />
              </span>
              <span>SGST (State GST)</span>
              <strong>{moneyInr(purchase.sgst)}</strong>
            </li>
            <li>
              <span className="gstc-row-icon">
                <Percent size={16} />
              </span>
              <span>IGST (Integrated GST)</span>
              <strong>{moneyInr(purchase.igst)}</strong>
            </li>
          </ul>
          <footer className="gstc-panel-foot">
            <span>Total Purchase GST (ITC)</span>
            <strong>{moneyInr(purchase.total)}</strong>
          </footer>
        </section>
      </div>

      <section className={`gstc-liability ${toBePaid ? 'payable' : 'refundable'}`}>
        <div className="gstc-liability-left">
          <div className="gstc-scale-icon">
            <Scale size={28} />
          </div>
          <div>
            <h2>GST Liability Calculation</h2>
            <p>Sales GST - Purchase GST (ITC) = Net Payable/Refundable</p>
          </div>
        </div>
        <div className="gstc-liability-right">
          <strong>{moneyInr(Math.abs(net))}</strong>
          <span className="gstc-pay-badge">
            <ArrowUpRight size={14} />
            {toBePaid ? 'To Be Paid' : 'Refundable'}
          </span>
        </div>
      </section>

      <div className="gstc-actions">
        <Link to="/reports" className="btn btn-secondary">
          <ArrowLeft size={16} /> Go Back
        </Link>
      </div>
    </div>
  )
}

export function ExtraHallmarkReport() {
  const rows = store.getAll().requests.filter((r) =>
    r.remarks.toLowerCase().includes('extra'),
  )
  const all = rows.length ? rows : store.getAll().requests.filter((r) => r.source === 'Manual')
  return (
    <ReportShell title="Extra Hallmark Report" subtitle="Additional hallmark records">
      <div className="panel">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Request</th>
                <th>Date</th>
                <th>Party</th>
                <th>Category</th>
                <th>PIC</th>
                <th>Weight</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {all.map((r) => (
                <tr key={r.id}>
                  <td>{r.requestNo}</td>
                  <td>{r.date}</td>
                  <td>{r.partyName}</td>
                  <td>{r.categoryName}</td>
                  <td>{r.pieces}</td>
                  <td>{r.weight.toFixed(2)} g</td>
                  <td>{r.remarks || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ReportShell>
  )
}

export function PartySummaryReport() {
  const data = store.getAll()
  const rows = data.parties.map((p) => {
    const reqs = data.requests.filter((r) => r.partyId === p.id)
    const weight = reqs.reduce((s, r) => s + r.weight, 0)
    const billed = data.invoices
      .filter((i) => i.partyName === p.name)
      .reduce((s, i) => s + i.total, 0)
    return { p, reqs: reqs.length, weight, billed }
  })

  return (
    <ReportShell title="Party Summary" subtitle="Overview of all parties">
      <div className="panel">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Party</th>
                <th>State</th>
                <th>Group</th>
                <th>Requests</th>
                <th>Total Weight</th>
                <th>Billed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ p, reqs, weight, billed }) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.state || '—'}</td>
                  <td>{p.groupName || '—'}</td>
                  <td>{reqs}</td>
                  <td>{weight.toFixed(2)} g</td>
                  <td>₹ {billed.toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ReportShell>
  )
}

function moneyInr(n: number) {
  return `₹${n.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function ProfitLossReport() {
  const [tick, setTick] = useState(0)
  const data = useMemo(() => {
    void tick
    return store.getAll()
  }, [tick])

  const assetItems = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of data.expenses) {
      const key = e.category.trim() || 'Other Expense'
      map.set(key, (map.get(key) || 0) + e.amount)
    }
    return [...map.entries()]
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
  }, [data.expenses])

  const totalAssets = assetItems.reduce((s, r) => s + r.amount, 0)
  const picsWithGst = data.invoices.reduce((s, i) => s + i.total, 0)
  const otherMonthlyIncome = 0
  const totalLiabilities = picsWithGst + otherMonthlyIncome
  const net = totalLiabilities - totalAssets
  const margin = totalLiabilities > 0 ? (net / totalLiabilities) * 100 : 0
  const isProfit = net >= 0

  const refresh = () => {
    setTick((n) => n + 1)
  }

  return (
    <div className="pnl-page">
      <Link to="/reports" className="back-link">
        <ArrowLeft size={16} /> Back to Reports
      </Link>

      <header className="pnl-hero">
        <div className="pnl-hero-icon">
          <TrendingUp size={22} />
        </div>
        <h1>Balance Sheet</h1>
        <p>Comprehensive overview of your business assets, liabilities, and financial performance.</p>
      </header>

      <div className="pnl-summary">
        <div className="pnl-sum-card pnl-sum-assets">
          <div className="pnl-sum-icon">
            <Wallet size={22} />
          </div>
          <div>
            <span>Total Assets</span>
            <strong>{moneyInr(totalAssets)}</strong>
          </div>
        </div>
        <div className="pnl-sum-card pnl-sum-liab">
          <div className="pnl-sum-icon">
            <Coins size={22} />
          </div>
          <div>
            <span>Total Liabilities</span>
            <strong>{moneyInr(totalLiabilities)}</strong>
          </div>
        </div>
        <div className="pnl-sum-card pnl-sum-net">
          <div className="pnl-sum-icon">
            <TrendingUp size={22} />
          </div>
          <div>
            <span>{isProfit ? 'Net Profit' : 'Net Loss'}</span>
            <strong>{moneyInr(Math.abs(net))}</strong>
          </div>
        </div>
      </div>

      <div className="pnl-columns">
        <section className="pnl-panel pnl-assets">
          <header className="pnl-panel-head">
            <Building2 size={22} />
            <div>
              <h2>Assets</h2>
              <p>Total business expenses &amp; costs</p>
            </div>
          </header>
          <div className="pnl-panel-cols">
            <span>ITEM NAME</span>
            <span>AMOUNT</span>
          </div>
          <ul className="pnl-item-list">
            {assetItems.length === 0 ? (
              <li className="pnl-empty">No expense items</li>
            ) : (
              assetItems.map((row) => (
                <li key={row.name}>
                  <span className="pnl-item-icon assets">
                    <Receipt size={16} />
                  </span>
                  <span className="pnl-item-name">{row.name}</span>
                  <span className="pnl-item-amt">{moneyInr(row.amount)}</span>
                </li>
              ))
            )}
          </ul>
          <footer className="pnl-panel-foot">
            <span>Total Assets</span>
            <strong>{moneyInr(totalAssets)}</strong>
          </footer>
        </section>

        <section className="pnl-panel pnl-liab">
          <header className="pnl-panel-head">
            <HandCoins size={22} />
            <div>
              <h2>Liabilities (Income)</h2>
              <p>Revenue &amp; income sources</p>
            </div>
          </header>
          <div className="pnl-panel-cols">
            <span>ITEM NAME</span>
            <span>AMOUNT</span>
          </div>
          <ul className="pnl-item-list">
            <li>
              <span className="pnl-item-icon liab">
                <Gem size={16} />
              </span>
              <span className="pnl-item-name">Total Pics With GST Amount</span>
              <span className="pnl-item-amt">{moneyInr(picsWithGst)}</span>
            </li>
            <li>
              <span className="pnl-item-icon liab">
                <PlusCircle size={16} />
              </span>
              <span className="pnl-item-name">Other Monthly Income</span>
              <span className="pnl-item-amt">{moneyInr(otherMonthlyIncome)}</span>
            </li>
          </ul>
          <footer className="pnl-panel-foot">
            <span>Total Liabilities</span>
            <strong>{moneyInr(totalLiabilities)}</strong>
          </footer>
        </section>
      </div>

      <section className={`pnl-net-card ${isProfit ? 'profit' : 'loss'}`}>
        <div className="pnl-net-trophy">
          <Trophy size={28} />
        </div>
        <h2>Net Profit / Loss</h2>
        <p className="pnl-net-value">{moneyInr(Math.abs(net))}</p>
        <span className={`pnl-net-badge ${isProfit ? 'profit' : 'loss'}`}>
          {isProfit ? (
            <>
              <ArrowUpRight size={14} /> Profit
            </>
          ) : (
            <>Loss</>
          )}
        </span>
        <div className="pnl-net-meta">
          <div>
            <span>Total Income</span>
            <strong>{moneyInr(totalLiabilities)}</strong>
          </div>
          <div>
            <span>Total Expenses</span>
            <strong>{moneyInr(totalAssets)}</strong>
          </div>
          <div>
            <span>Margin</span>
            <strong>{margin.toFixed(1)}%</strong>
          </div>
        </div>
      </section>

      <div className="pnl-actions">
        <Link to="/reports" className="btn btn-secondary">
          <ArrowLeft size={16} /> Go Back
        </Link>
        <button type="button" className="btn btn-green" onClick={refresh}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>
    </div>
  )
}

export function InvoiceListReport() {
  const data = store.getAll()
  const { toast, Toast } = useToast()
  /** Empty string = All Parties */
  const [partyName, setPartyName] = useState('')
  const [status, setStatus] = useState('All Status')
  const [txnType, setTxnType] = useState('All Types')
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return localYmd(d)
  })
  const [endDate, setEndDate] = useState(() => localYmd())
  const [fetched, setFetched] = useState(false)

  const partyOptions = useMemo(() => {
    const names = new Set<string>()
    for (const p of data.parties) {
      if (p.name?.trim()) names.add(p.name.trim())
    }
    for (const inv of data.invoices) {
      if (inv.partyName?.trim()) names.add(inv.partyName.trim())
    }
    return [...names].sort((a, b) => a.localeCompare(b))
  }, [data.parties, data.invoices])

  const paymentStatusById = useMemo(
    () => computeInvoicePaymentStatuses(data.invoices, data.funds),
    [data.invoices, data.funds],
  )

  const findParty = (name: string) =>
    data.parties.find((p) => p.name.toLowerCase() === name.trim().toLowerCase())

  const rows = useMemo(() => {
    if (!fetched) return []
    const partyKey = partyName.trim().toLowerCase()
    return data.invoices
      .filter((inv) => {
        if (partyKey && inv.partyName.trim().toLowerCase() !== partyKey) return false
        const payStatus = paymentStatusById.get(inv.id) || inv.status
        if (status !== 'All Status' && payStatus.toUpperCase() !== status.toUpperCase()) return false
        if (inv.date < startDate || inv.date > endDate) return false
        const party = findParty(inv.partyName)
        if (txnType !== 'All Types' && party && party.transactionType !== txnType) return false
        if (txnType !== 'All Types' && !party) return false
        return true
      })
      .map((inv) => {
        const party = findParty(inv.partyName)
        const req = data.requests.find((r) => r.requestNo === inv.requestNo)
        const rough = data.roughSheets.filter(
          (r) =>
            r.requestNo === inv.requestNo ||
            (r.partyName === inv.partyName && r.date === inv.date),
        )
        const hmPiece =
          rough.reduce((s, r) => s + Math.max(0, (r.pic || 0) - (r.rejectPic || 0)), 0) ||
          req?.pieces ||
          0
        const useIgst = Boolean(party?.igstApplicable)
        const sgst = useIgst ? 0 : Number((inv.tax / 2).toFixed(2))
        const cgst = useIgst ? 0 : Number((inv.tax / 2).toFixed(2))
        const igst = useIgst ? inv.tax : 0
        return {
          inv,
          payStatus: paymentStatusById.get(inv.id) || inv.status,
          party,
          hmPiece,
          sgst,
          cgst,
          igst,
          txnType: party?.transactionType || '—',
        }
      })
      .sort((a, b) => {
        const byParty = a.inv.partyName.localeCompare(b.inv.partyName)
        if (byParty !== 0) return byParty
        return a.inv.date.localeCompare(b.inv.date) || a.inv.invoiceNo.localeCompare(b.inv.invoiceNo)
      })
    // findParty closes over data.parties — ok inside useMemo deps via data
  }, [fetched, data, partyName, status, txnType, startDate, endDate, paymentStatusById])

  /** All Parties → group by party; single party → one group */
  const partyGroups = useMemo(() => {
    if (!fetched || rows.length === 0) return [] as { party: string; rows: typeof rows }[]
    if (partyName.trim()) {
      return [{ party: partyName.trim(), rows }]
    }
    const map = new Map<string, typeof rows>()
    for (const r of rows) {
      const key = r.inv.partyName || '—'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    }
    return [...map.entries()].map(([party, groupRows]) => ({ party, rows: groupRows }))
  }, [fetched, rows, partyName])

  const summary = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.count += 1
        acc.hm += r.hmPiece
        acc.amount += r.inv.amount
        acc.sgst += r.sgst
        acc.cgst += r.cgst
        acc.igst += r.igst
        acc.grand += r.inv.total
        return acc
      },
      { count: 0, hm: 0, amount: 0, sgst: 0, cgst: 0, igst: 0, grand: 0 },
    )
  }, [rows])

  const getInvoices = () => {
    store.syncInvoicePaymentStatuses()
    setFetched(true)
    // toast after state will use current filters on next render — compute here
    const partyKey = partyName.trim().toLowerCase()
    const matched = data.invoices.filter((inv) => {
      if (partyKey && inv.partyName.trim().toLowerCase() !== partyKey) return false
      return inv.date >= startDate && inv.date <= endDate
    })
    const scope = partyName.trim() ? partyName.trim() : 'All Parties'
    toast(
      matched.length
        ? `${matched.length} invoice(s) · ${scope}`
        : data.invoices.length
          ? `No invoices for ${scope} between ${startDate} and ${endDate}`
          : 'No invoices found',
    )
  }

  const download = () => {
    if (!fetched) {
      toast('Click Get Invoices first')
      return
    }
    const scope = partyName.trim() || 'all-parties'
    downloadCsv(`invoice-list-${scope.replace(/\s+/g, '-').toLowerCase()}.csv`, [
      [
        'Bill Date',
        'Bill No',
        'Party Name',
        'State',
        'GSTIN No',
        'HM Piece',
        'Amount',
        'SGST',
        'CGST',
        'IGST',
        'Bill Amount',
        'Status',
      ],
      ...rows.map((r) => [
        r.inv.date,
        r.inv.invoiceNo,
        r.inv.partyName,
        r.party?.state || '',
        r.party?.gstin || '',
        String(r.hmPiece),
        r.inv.amount.toFixed(2),
        r.sgst.toFixed(2),
        r.cgst.toFixed(2),
        r.igst.toFixed(2),
        r.inv.total.toFixed(2),
        r.payStatus.toUpperCase(),
      ]),
    ])
    toast('Report downloaded')
  }

  const money = (n: number) =>
    `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const formatDate = (iso: string) => {
    const [y, m, d] = iso.split('-')
    if (!y || !m || !d) return iso
    return `${d}/${m}/${y}`
  }

  const groupSubtotal = (groupRows: typeof rows) =>
    groupRows.reduce(
      (acc, r) => {
        acc.hm += r.hmPiece
        acc.amount += r.inv.amount
        acc.sgst += r.sgst
        acc.cgst += r.cgst
        acc.igst += r.igst
        acc.grand += r.inv.total
        return acc
      },
      { hm: 0, amount: 0, sgst: 0, cgst: 0, igst: 0, grand: 0 },
    )

  const showPartyGroups = !partyName.trim() && partyGroups.length > 1

  return (
    <div className="invlist-page">
      <Link to="/reports" className="back-link">
        <ArrowLeft size={16} /> Back to Reports
      </Link>

      <section className="invlist-filter-card">
        <h2>Filter Invoices by Date Range</h2>
        <p className="invlist-filter-hint">
          Choose <strong>All Parties</strong> for the full list (party-wise sections), or pick one party for
          individual invoices.
        </p>
        <div className="invlist-filter-grid">
          <div className="field">
            <label>PARTY</label>
            <select value={partyName} onChange={(e) => setPartyName(e.target.value)}>
              <option value="">All Parties</option>
              {partyOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>STATUS</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option>All Status</option>
              <option>Unpaid</option>
              <option>Paid</option>
              <option>Partial</option>
            </select>
          </div>
          <div className="field">
            <label>TRANSACTION TYPE</label>
            <select value={txnType} onChange={(e) => setTxnType(e.target.value)}>
              <option>All Types</option>
              <option>Cash</option>
              <option>Credit</option>
              <option>Bank</option>
            </select>
          </div>
          <div className="field">
            <label>START DATE</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="field">
            <label>END DATE</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
        <div className="invlist-filter-actions">
          <button type="button" className="btn btn-navy" onClick={getInvoices}>
            <Search size={16} /> Get Invoices
          </button>
          {fetched && (
            <button type="button" className="btn btn-green" onClick={download}>
              <Download size={16} /> Download Report
            </button>
          )}
        </div>
      </section>

      <section className="invlist-table-card">
        <div className="invlist-scope-bar">
          {fetched ? (
            <span>
              Showing:{' '}
              <strong>{partyName.trim() ? partyName.trim() : 'All Parties'}</strong>
              {rows.length ? ` · ${rows.length} invoice(s)` : null}
              {showPartyGroups ? ` · ${partyGroups.length} parties` : null}
            </span>
          ) : (
            <span>Select filters and click Get Invoices</span>
          )}
        </div>
        <div className="table-wrap">
          <table className="data-table navy-head-table invlist-table">
            <thead>
              <tr>
                <th>BILL DATE</th>
                <th>BILL NO</th>
                <th>PARTY NAME</th>
                <th>STATE</th>
                <th>GSTIN NO</th>
                <th>HM PIECE</th>
                <th>AMOUNT</th>
                <th>SGST</th>
                <th>CGST</th>
                <th>IGST</th>
                <th>BILL AMOUNT</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {!fetched ? (
                <tr>
                  <td colSpan={12} className="empty-state invlist-empty">
                    <span className="invlist-empty-icon">📄</span>
                    Select All Parties or one party, then click &apos;Get Invoices&apos;
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="empty-state">
                    No invoices found for selected filters
                  </td>
                </tr>
              ) : showPartyGroups ? (
                partyGroups.map((g) => {
                  const sub = groupSubtotal(g.rows)
                  return (
                    <Fragment key={g.party}>
                      <tr className="invlist-party-head">
                        <td colSpan={12}>
                          <strong>{g.party}</strong>
                          <span>
                            {g.rows.length} bill(s) · HM {sub.hm} · {money(sub.grand)}
                          </span>
                        </td>
                      </tr>
                      {g.rows.map((r) => (
                        <tr key={r.inv.id}>
                          <td>{formatDate(r.inv.date)}</td>
                          <td>{r.inv.invoiceNo}</td>
                          <td>{r.inv.partyName}</td>
                          <td>{r.party?.state || '—'}</td>
                          <td>{r.party?.gstin || '—'}</td>
                          <td>{r.hmPiece}</td>
                          <td>{money(r.inv.amount)}</td>
                          <td>{money(r.sgst)}</td>
                          <td>{money(r.cgst)}</td>
                          <td>{money(r.igst)}</td>
                          <td>{money(r.inv.total)}</td>
                          <td>
                            <span
                              className={`invlist-status ${r.payStatus === 'Unpaid' ? 'unpaid' : r.payStatus === 'Paid' ? 'paid' : 'partial'}`}
                            >
                              {r.payStatus.toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      ))}
                      <tr className="invlist-party-sub">
                        <td colSpan={5}>Subtotal — {g.party}</td>
                        <td>{sub.hm}</td>
                        <td>{money(sub.amount)}</td>
                        <td>{money(sub.sgst)}</td>
                        <td>{money(sub.cgst)}</td>
                        <td>{money(sub.igst)}</td>
                        <td>{money(sub.grand)}</td>
                        <td />
                      </tr>
                    </Fragment>
                  )
                })
              ) : (
                rows.map((r) => (
                  <tr key={r.inv.id}>
                    <td>{formatDate(r.inv.date)}</td>
                    <td>{r.inv.invoiceNo}</td>
                    <td>{r.inv.partyName}</td>
                    <td>{r.party?.state || '—'}</td>
                    <td>{r.party?.gstin || '—'}</td>
                    <td>{r.hmPiece}</td>
                    <td>{money(r.inv.amount)}</td>
                    <td>{money(r.sgst)}</td>
                    <td>{money(r.cgst)}</td>
                    <td>{money(r.igst)}</td>
                    <td>{money(r.inv.total)}</td>
                    <td>
                      <span
                        className={`invlist-status ${r.payStatus === 'Unpaid' ? 'unpaid' : r.payStatus === 'Paid' ? 'paid' : 'partial'}`}
                      >
                        {r.payStatus.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {fetched && rows.length > 0 && (
          <div className="invlist-summary">
            <div>
              <span>Total Invoices</span>
              <strong>{summary.count}</strong>
            </div>
            <div>
              <span>Total HM Piece</span>
              <strong>{summary.hm}</strong>
            </div>
            <div>
              <span>Total Amount</span>
              <strong>{money(summary.amount)}</strong>
            </div>
            <div>
              <span>Total SGST</span>
              <strong>{money(summary.sgst)}</strong>
            </div>
            <div>
              <span>Total CGST</span>
              <strong>{money(summary.cgst)}</strong>
            </div>
            <div>
              <span>Total IGST</span>
              <strong>{money(summary.igst)}</strong>
            </div>
            <div className="invlist-grand">
              <span>Grand Total</span>
              <strong>{money(summary.grand)}</strong>
            </div>
          </div>
        )}
      </section>

      <div className="manual-actions">
        <Link to="/reports" className="btn btn-navy">
          Back
        </Link>
      </div>
      {Toast}
    </div>
  )
}

export function FireTouchReport() {
  const assays = store.getAll().fireAssays
  const touches = store.getAll().touches
  return (
    <ReportShell title="Fire Touch Report" subtitle="Fire assay touch records">
      <div className="panel">
        <h2>Fire Assay</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Assay No</th>
                <th>Date</th>
                <th>Party</th>
                <th>Declared</th>
                <th>Found</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {assays.map((a) => (
                <tr key={a.id}>
                  <td>{a.assayNo}</td>
                  <td>{a.date}</td>
                  <td>{a.partyName}</td>
                  <td>{a.declaredPurity}</td>
                  <td>{a.purityFound || '—'}</td>
                  <td>{statusBadge(a.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="panel">
        <h2>Touch Records</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Touch No</th>
                <th>Date</th>
                <th>Party</th>
                <th>Declared</th>
                <th>Found</th>
                <th>Fee</th>
              </tr>
            </thead>
            <tbody>
              {touches.map((t) => (
                <tr key={t.id}>
                  <td>{t.touchNo}</td>
                  <td>{t.date}</td>
                  <td>{t.partyName}</td>
                  <td>{t.declaredTouch}</td>
                  <td>{t.foundTouch}</td>
                  <td>₹ {t.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ReportShell>
  )
}

type CreditNoteRecord = {
  id: string
  cnNo: string
  partyId: string
  partyName: string
  month: string
  totalPicMinBills: number
  discountPct: number
  totalPic: number
  finalAmountMinBills: number
  discountedTotal: number
  finalDiscount: number
  status: 'Unpaid' | 'Paid'
  invoiceGenerated: boolean
  paidAt?: string
}

const CN_KEY = 'shrija-credit-notes'

function loadCreditNotes(): CreditNoteRecord[] {
  try {
    const raw = tenantGet(CN_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CreditNoteRecord[]
    if (!Array.isArray(parsed)) return []
    return parsed.map((n) => ({
      ...n,
      status: n.status === 'Paid' ? 'Paid' : 'Unpaid',
      invoiceGenerated: Boolean(n.invoiceGenerated),
      cnNo: n.cnNo || '',
    }))
  } catch {
    return []
  }
}

function saveCreditNotes(notes: CreditNoteRecord[]) {
  tenantSet(CN_KEY, JSON.stringify(notes))
}

function monthBounds(month: string) {
  const [y, m] = month.split('-').map(Number)
  const start = `${month}-01`
  const last = new Date(y, m, 0).getDate()
  const end = `${month}-${String(last).padStart(2, '0')}`
  const label = `From ${formatCnDate(start)} to ${formatCnDate(end)}`
  return { start, end, label, last }
}

function formatCnDate(iso: string) {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

function formatCnDateTime(d = new Date()) {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  let h = d.getHours()
  const min = String(d.getMinutes()).padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${dd}-${mm}-${yyyy} ${String(h).padStart(2, '0')}:${min} ${ampm}`
}

export function CreditNoteReport() {
  const { toast, Toast } = useToast()
  const data = store.getAll()
  const firm = useMemo(() => getFirmProfile(), [])

  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [partyQuery, setPartyQuery] = useState('')
  const [partyOpen, setPartyOpen] = useState(false)
  const [partyId, setPartyId] = useState('')
  const [fetched, setFetched] = useState(false)
  const [notes, setNotes] = useState<CreditNoteRecord[]>(() => loadCreditNotes())
  const [preview, setPreview] = useState<null | { kind: 'invoice'; row: CreditNoteRecord } | { kind: 'report' }>(
    null,
  )

  const party = data.parties.find((p) => p.id === partyId)

  const partyOptions = useMemo(() => {
    const q = partyQuery.trim().toLowerCase()
    return data.parties.filter(
      (p) =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.phone.includes(q) ||
        p.address.toLowerCase().includes(q),
    )
  }, [data.parties, partyQuery])

  const persist = (next: CreditNoteRecord[]) => {
    setNotes(next)
    saveCreditNotes(next)
  }

  const buildRow = (p: (typeof data.parties)[0], m: string): CreditNoteRecord => {
    const existing = notes.find((n) => n.partyId === p.id && n.month === m)
    const totalPic = data.requests
      .filter((r) => r.partyId === p.id && r.date.startsWith(m))
      .reduce((s, r) => s + r.pieces, 0)
    const totalPicMinBills = p.skipMinBill ? 0 : 0
    const discountPct = existing?.discountPct ?? 0
    const finalAmountMinBills = 0
    const discountedTotal = existing?.discountedTotal ?? 0
    const finalDiscount = existing?.finalDiscount ?? 0

    if (existing) {
      return {
        ...existing,
        totalPic,
        totalPicMinBills,
        finalAmountMinBills,
        partyName: p.name,
      }
    }

    return {
      id: `draft-${p.id}-${m}`,
      cnNo: '',
      partyId: p.id,
      partyName: p.name,
      month: m,
      totalPicMinBills,
      discountPct,
      totalPic,
      finalAmountMinBills,
      discountedTotal,
      finalDiscount,
      status: 'Unpaid',
      invoiceGenerated: false,
    }
  }

  const rows = useMemo(() => {
    if (!fetched || !party) return []
    return [buildRow(party, month)]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetched, party, month, notes, data.requests])

  const totals = useMemo(
    () => ({
      totalPicMinBills: rows.reduce((s, r) => s + r.totalPicMinBills, 0),
      discountPct: rows.reduce((s, r) => s + r.discountPct, 0),
      totalPic: rows.reduce((s, r) => s + r.totalPic, 0),
      finalAmountMinBills: rows.reduce((s, r) => s + r.finalAmountMinBills, 0),
      discountedTotal: rows.reduce((s, r) => s + r.discountedTotal, 0),
      finalDiscount: rows.reduce((s, r) => s + r.finalDiscount, 0),
    }),
    [rows],
  )

  const { label: rangeLabel } = monthBounds(month)

  const doSearch = () => {
    if (!partyId) {
      toast('Select a party')
      return
    }
    setFetched(true)
    toast('Credit note report loaded')
  }

  const nextCnNo = (list: CreditNoteRecord[]) => {
    const nums = list
      .map((n) => Number((n.cnNo || '').replace(/\D/g, '')))
      .filter((n) => !Number.isNaN(n) && n > 0)
    const max = nums.length ? Math.max(...nums) : 0
    return `CN-${max + 1}`
  }

  const payRow = (row: CreditNoteRecord) => {
    if (row.status === 'Paid') return
    const cnNo = nextCnNo(notes)
    const saved: CreditNoteRecord = {
      ...row,
      id: `cn-${row.partyId}-${row.month}`,
      cnNo,
      status: 'Paid',
      invoiceGenerated: false,
      paidAt: new Date().toISOString(),
    }
    const rest = notes.filter((n) => !(n.partyId === row.partyId && n.month === row.month))
    persist([saved, ...rest])
    toast(`Marked paid — ${cnNo}`)
  }

  const payAll = () => {
    if (!fetched || rows.length === 0) {
      toast('Search first')
      return
    }
    let list = [...notes]
    let paid = 0
    for (const row of rows) {
      if (row.status === 'Paid') continue
      const cnNo = nextCnNo(list)
      const saved: CreditNoteRecord = {
        ...row,
        id: `cn-${row.partyId}-${row.month}`,
        cnNo,
        status: 'Paid',
        invoiceGenerated: false,
        paidAt: new Date().toISOString(),
      }
      list = [saved, ...list.filter((n) => !(n.partyId === row.partyId && n.month === row.month))]
      paid += 1
    }
    if (!paid) {
      toast('Nothing to pay')
      return
    }
    persist(list)
    toast(`Paid ${paid} credit note(s)`)
  }

  const generateInvoice = (row: CreditNoteRecord) => {
    if (row.status !== 'Paid') {
      toast('Pay first')
      return
    }
    const updatedRow: CreditNoteRecord = { ...row, invoiceGenerated: true }
    const updated = notes.map((n) =>
      n.partyId === row.partyId && n.month === row.month ? updatedRow : n,
    )
    persist(updated)
    const amount = Number(row.finalDiscount || row.discountedTotal || 0)
    const tax = Number((Math.abs(amount) * 0.18).toFixed(2))
    store.addInvoice({
      partyName: row.partyName,
      requestNo: row.cnNo || `CN-${row.month}`,
      amount: -Math.abs(amount),
      tax: -tax,
      total: -(Math.abs(amount) + tax),
      status: 'Paid',
      invoiceNo: row.cnNo || undefined,
    })
    setPreview({ kind: 'invoice', row: updatedRow })
    toast('Credit note invoice generated')
  }

  const deleteNote = (row: CreditNoteRecord) => {
    if (!window.confirm(`Delete ${row.cnNo || 'credit note'}?`)) return
    persist(notes.filter((n) => !(n.partyId === row.partyId && n.month === row.month)))
    toast('Credit note deleted')
  }

  const printCreditNote = (row: CreditNoteRecord) => {
    setPreview({ kind: 'invoice', row })
  }

  const exportExcel = () => {
    if (!fetched || rows.length === 0) {
      toast('Search first')
      return
    }
    downloadCsv(`Credit_Note_Report_${new Date().toISOString().slice(0, 10)}.csv`, [
      [
        'Name',
        'Total Pic (Minimum Bills)',
        'Discount (%)',
        'Total Pic',
        'Final Amount (Min Bills)',
        'Discounted Total',
        'Final Discount',
        'Status',
        'Actions',
      ],
      ...rows.map((r) => [
        r.partyName,
        r.totalPicMinBills.toFixed(2),
        r.discountPct.toFixed(2),
        r.totalPic.toFixed(2),
        r.finalAmountMinBills.toFixed(2),
        r.discountedTotal.toFixed(2),
        r.finalDiscount.toFixed(2),
        r.status,
        r.status === 'Paid' ? `${r.cnNo}Delete` : 'Pay',
      ]),
      [
        'Total:',
        totals.totalPicMinBills.toFixed(2),
        totals.discountPct.toFixed(2),
        totals.totalPic.toFixed(2),
        totals.finalAmountMinBills.toFixed(2),
        totals.discountedTotal.toFixed(2),
        totals.finalDiscount.toFixed(2),
        '',
        '',
      ],
    ])
    toast('Excel downloaded')
  }

  const exportPdf = () => {
    if (!fetched || rows.length === 0) {
      toast('Search first')
      return
    }
    setPreview({ kind: 'report' })
  }

  const num = (n: number) => n.toFixed(2)

  const previewParty =
    preview?.kind === 'invoice'
      ? data.parties.find((x) => x.id === preview.row.partyId)
      : undefined
  const previewAmount =
    preview?.kind === 'invoice'
      ? preview.row.finalDiscount || preview.row.discountedTotal || 0
      : 0
  const previewDated = formatCnDateTime()

  return (
    <div className={`cn-page ${preview ? 'cn-printing' : ''}`}>
      <div className="cn-main no-print">
      <Link to="/reports" className="back-link">
        <ArrowLeft size={16} /> Back to Reports
      </Link>

      <section className="cn-filters">
        <div className="field">
          <label>Select Month</label>
          <input type="month" value={month} onChange={(e) => { setMonth(e.target.value); setFetched(false) }} />
        </div>

        <div className="field cn-party-field">
          <label>Select Party</label>
          <div className="party-search">
            <input
              placeholder="Select a party"
              value={party ? party.name : partyQuery}
              onChange={(e) => {
                setPartyId('')
                setPartyQuery(e.target.value)
                setPartyOpen(true)
                setFetched(false)
              }}
              onFocus={() => setPartyOpen(true)}
              onBlur={() => setTimeout(() => setPartyOpen(false), 150)}
            />
            {party && (
              <button
                type="button"
                className="fundreg-clear"
                title="Clear party"
                onClick={() => {
                  setPartyId('')
                  setPartyQuery('')
                  setFetched(false)
                }}
              >
                ×
              </button>
            )}
            {partyOpen && partyOptions.length > 0 && (
              <div className="party-dropdown">
                {partyOptions.slice(0, 8).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="party-option"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setPartyId(p.id)
                      setPartyQuery(p.name)
                      setPartyOpen(false)
                      setFetched(false)
                    }}
                  >
                    <strong>{p.name}</strong>
                    <span>{p.address || p.phone || '—'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="cn-actions">
          <button type="button" className="btn btn-navy" onClick={doSearch}>
            <Search size={16} /> Search
          </button>
          <button type="button" className="btn btn-cn-payall" onClick={payAll}>
            <Wallet size={16} /> Pay All
          </button>
          <button type="button" className="btn btn-green" onClick={exportExcel}>
            <FileSpreadsheet size={16} /> Excel
          </button>
          <button type="button" className="btn btn-pdf" onClick={exportPdf}>
            <FileText size={16} /> PDF
          </button>
        </div>
      </section>

      {fetched && (
        <section className="cn-sheet">
          <header className="cn-sheet-head">
            <h2>Credit Note Report</h2>
            <p>{rangeLabel}</p>
          </header>

          <div className="table-wrap">
            <table className="data-table cn-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Total Pic (Minimum Bills)</th>
                  <th>Discount (%)</th>
                  <th>Total Pic</th>
                  <th>Final Amount (Min Bills)</th>
                  <th>Discounted Total</th>
                  <th>Final Discount</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.partyName}</td>
                    <td>{num(r.totalPicMinBills)}</td>
                    <td>{num(r.discountPct)}</td>
                    <td>{num(r.totalPic)}</td>
                    <td>{num(r.finalAmountMinBills)}</td>
                    <td>{num(r.discountedTotal)}</td>
                    <td>{num(r.finalDiscount)}</td>
                    <td>
                      <span className={`cn-status ${r.status === 'Paid' ? 'paid' : 'unpaid'}`}>
                        {r.status}
                      </span>
                    </td>
                    <td>
                      <div className="cn-row-actions">
                        {r.status === 'Unpaid' && (
                          <button type="button" className="btn btn-navy btn-sm" onClick={() => payRow(r)}>
                            Pay
                          </button>
                        )}
                        {r.status === 'Paid' && !r.invoiceGenerated && (
                          <button
                            type="button"
                            className="btn btn-cn-generate btn-sm"
                            onClick={() => generateInvoice(r)}
                          >
                            Generate Invoice
                          </button>
                        )}
                        {r.status === 'Paid' && r.invoiceGenerated && (
                          <>
                            <button
                              type="button"
                              className="btn btn-green btn-sm"
                              onClick={() => printCreditNote(r)}
                            >
                              {r.cnNo || 'CN'}
                            </button>
                            <button
                              type="button"
                              className="btn btn-cn-delete btn-sm"
                              onClick={() => deleteNote(r)}
                            >
                              <Trash2 size={14} /> Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                <tr className="cn-total-row">
                  <td>Total:</td>
                  <td>{num(totals.totalPicMinBills)}</td>
                  <td>{num(totals.discountPct)}</td>
                  <td>{num(totals.totalPic)}</td>
                  <td>{num(totals.finalAmountMinBills)}</td>
                  <td>{num(totals.discountedTotal)}</td>
                  <td>{num(totals.finalDiscount)}</td>
                  <td colSpan={2} />
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="cn-back">
        <Link to="/reports" className="btn btn-secondary">
          Back
        </Link>
      </div>
      </div>

      {preview && (
        <div className="cn-preview-overlay">
          <div className="cn-preview-toolbar no-print">
            <button type="button" className="btn btn-navy" onClick={() => window.print()}>
              <Printer size={16} /> Print
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setPreview(null)}>
              Close
            </button>
          </div>

          {preview.kind === 'invoice' && (
            <div className="cn-print-sheet">
              <h1>CREDIT NOTE WITHOUT STOCK</h1>
              <p className="cn-print-sub">(Original Copy)</p>
              <div className="cn-print-meta">
                <div>
                  <strong>{preview.row.partyName}</strong>
                  <div>{previewParty?.address || '—'}</div>
                  <div>GSTIN: {previewParty?.gstin || '—'}</div>
                  <div>State Code: {previewParty?.stateCode || '—'}</div>
                </div>
                <div>
                  <div>Invoice No: {preview.row.cnNo || '—'}</div>
                  <div>Dated: {previewDated}</div>
                  <div>Place: {previewParty?.stateCode || '—'}</div>
                  <div>SAC Code: 998900</div>
                </div>
              </div>
              <table className="cn-print-table">
                <thead>
                  <tr>
                    <th>S.N.</th>
                    <th>Description of Goods</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>1</td>
                    <td>Discount Exp. A/C</td>
                    <td>{previewAmount.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
              <div className="cn-print-bottom">
                <div className="cn-print-words">
                  <strong>Amount in Words:</strong> Rupees Only
                </div>
                <div className="cn-print-totals">
                  <div>Add: CGST: 0.00</div>
                  <div>Add: SGST: 0.00</div>
                  <div>Round Off: 0.00</div>
                  <div>
                    <strong>Grand Total: {previewAmount.toFixed(2)}</strong>
                  </div>
                </div>
              </div>
              <div className="cn-print-note">
                <strong>Note:</strong>
              </div>
              <div className="cn-print-sign">
                For, {firm.firmName || CENTRE_NAME}
                <br />
                <br />
                <br />
                Authorised Signatory
              </div>
            </div>
          )}

          {preview.kind === 'report' && (
            <div className="cn-print-report">
              <h1>Credit Note Report</h1>
              <p>Party: {party?.name || '—'}</p>
              <p>Date Range: {rangeLabel}</p>
              <table className="cn-print-table navy">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Total Pic (Minimum Bills)</th>
                    <th>Discount (%)</th>
                    <th>Total Pic</th>
                    <th>Final Amount (Min Bills)</th>
                    <th>Discounted Total</th>
                    <th>Final Discount</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.partyName}</td>
                      <td>{num(r.totalPicMinBills)}</td>
                      <td>{num(r.discountPct)}</td>
                      <td>{num(r.totalPic)}</td>
                      <td>{num(r.finalAmountMinBills)}</td>
                      <td>{num(r.discountedTotal)}</td>
                      <td>{num(r.finalDiscount)}</td>
                    </tr>
                  ))}
                  <tr className="cn-total-row">
                    <td>Total:</td>
                    <td>{num(totals.totalPicMinBills)}</td>
                    <td>{num(totals.discountPct)}</td>
                    <td>{num(totals.totalPic)}</td>
                    <td>{num(totals.finalAmountMinBills)}</td>
                    <td>{num(totals.discountedTotal)}</td>
                    <td>{num(totals.finalDiscount)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {Toast}
    </div>
  )
}
