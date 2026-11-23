import { Phone, Star } from 'lucide-react'
import type { Party } from '../data/store'
import { displayPartyGstin } from '../utils/partyGstin'
import type { PartyInsight, PartyRankRow } from '../utils/partyInsight'

function inr(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

function when(value: string) {
  if (!value) return '—'
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function Stars({ value }: { value: number }) {
  return (
    <span className="party-stars" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((step) => {
        const on = value >= step - 0.25
        return (
          <Star
            key={step}
            size={15}
            fill={on ? 'currentColor' : 'none'}
            style={{ opacity: on && value < step ? 0.45 : 1 }}
          />
        )
      })}
    </span>
  )
}

export function PartyDossier({
  party,
  insight,
  ranks,
  initials,
  tone,
  onOpen,
}: {
  party: Party
  insight: PartyInsight
  ranks: PartyRankRow[]
  initials: string
  tone: { bg: string; fg: string }
  onOpen: (id: string) => void
}) {
  const maxJobs = Math.max(1, ...insight.months.map((month) => month.jobs))
  const shownRanks = ranks.slice(0, 5)
  const selectedInTop = shownRanks.some((row) => row.id === party.id)
  const ownRank = ranks.find((row) => row.id === party.id)
  const leader = ranks[0]

  return (
    <section className="party-dossier" aria-live="polite">
      <header className="party-dossier-head">
        <span className="party-avatar party-avatar-lg" style={{ background: tone.bg, color: tone.fg }}>
          {initials}
        </span>
        <div className="party-dossier-id">
          <h2>{party.name}</h2>
          <p>
            <Phone size={13} /> {party.phone || 'No mobile'}
            <span className="party-dot" />
            {party.transactionType}
          </p>
          <div className="party-rate-row">
            <Stars value={insight.rating} />
            <strong>{insight.rating.toFixed(1)}</strong>
            <span>{insight.ratingLabel}</span>
          </div>
        </div>
        <div className="party-rank-pill">
          <span>Work rank</span>
          <strong>
            #{insight.rankByJobs}
            <small> / {insight.partyCount}</small>
          </strong>
          <em>Billing #{insight.rankByBilling}</em>
        </div>
      </header>

      <div className="party-profile-grid">
        <div>
          <span>Address</span>
          <strong>{party.address || '—'}</strong>
        </div>
        <div>
          <span>Licence</span>
          <strong>{party.licenseNo || '—'}</strong>
        </div>
        <div>
          <span>GST</span>
          <strong>{displayPartyGstin(party.gstin)}</strong>
        </div>
        <div>
          <span>State</span>
          <strong>
            {party.state || '—'}
            {party.stateCode ? ` (${party.stateCode})` : ''}
          </strong>
        </div>
        <div>
          <span>Group</span>
          <strong>{party.groupName || 'No group'}</strong>
        </div>
        <div>
          <span>On file since</span>
          <strong>{when(party.createdAt)}</strong>
        </div>
      </div>

      <div className="party-stat-grid">
        <article>
          <span>Jobs</span>
          <strong>{insight.jobs}</strong>
          <em>{insight.pieces.toLocaleString('en-IN')} pcs · {insight.weight.toLocaleString('en-IN')} g</em>
        </article>
        <article>
          <span>This month</span>
          <strong>{insight.jobsThisMonth}</strong>
          <em>Usual {insight.avgPerMonth} / month</em>
        </article>
        <article>
          <span>Pending jobs</span>
          <strong>{insight.pendingJobs}</strong>
          <em>Not billed or delivered</em>
        </article>
        <article>
          <span>Billed</span>
          <strong>{inr(insight.billed)}</strong>
          <em>{insight.invoiceCount} invoices</em>
        </article>
        <article>
          <span>Received</span>
          <strong>{inr(insight.received)}</strong>
          <em>{insight.paid} paid</em>
        </article>
        <article>
          <span>{insight.outstanding < 0 ? 'Advance' : 'Outstanding'}</span>
          <strong>{inr(Math.abs(insight.outstanding))}</strong>
          <em>
            {insight.unpaid} unpaid · {insight.partial} partial
          </em>
        </article>
      </div>

      <div className="party-dossier-split">
        <div className="party-dossier-block">
          <h3>Last 6 months</h3>
          <div className="party-month-bars">
            {insight.months.map((month) => (
              <div key={month.key} className="party-month">
                <div className="party-month-track">
                  <span style={{ height: `${Math.round((month.jobs / maxJobs) * 100)}%` }} />
                </div>
                <strong>{month.jobs}</strong>
                <em>{month.label}</em>
              </div>
            ))}
          </div>
        </div>
        <div className="party-dossier-block">
          <h3>Who works the most</h3>
          {leader && (
            <p className="party-leader">Top party: {leader.name} · {leader.jobs} jobs</p>
          )}
          <ol className="party-rank-list">
            {shownRanks.map((row) => (
              <li key={row.id} className={row.id === party.id ? 'is-on' : ''}>
                <button type="button" onClick={() => onOpen(row.id)}>
                  <b>#{row.rank}</b>
                  <span>{row.name}</span>
                  <em>{row.jobs} jobs</em>
                </button>
              </li>
            ))}
            {!selectedInTop && ownRank && (
              <li className="is-on">
                <button type="button" onClick={() => onOpen(party.id)}>
                  <b>#{ownRank.rank}</b>
                  <span>{ownRank.name}</span>
                  <em>{ownRank.jobs} jobs</em>
                </button>
              </li>
            )}
          </ol>
        </div>
      </div>

      <div className="party-dossier-cols">
        <div className="party-dossier-block">
          <h3>Recent jobs</h3>
          {insight.jobsRecent.length === 0 ? (
            <p className="party-none">No jobs yet.</p>
          ) : (
            <ul className="party-line-list">
              {insight.jobsRecent.map((job) => (
                <li key={job.id}>
                  <div>
                    <strong>{job.requestNo || 'Job'}</strong>
                    <span>
                      {when(job.date)} · {job.pieces} pcs · {job.weight} g
                    </span>
                  </div>
                  <em>{job.status}</em>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="party-dossier-block">
          <h3>Invoices</h3>
          {insight.invoicesRecent.length === 0 ? (
            <p className="party-none">No invoices yet.</p>
          ) : (
            <ul className="party-line-list">
              {insight.invoicesRecent.map((bill) => (
                <li key={bill.id}>
                  <div>
                    <strong>{bill.invoiceNo || 'Invoice'}</strong>
                    <span>
                      {when(bill.date)} · {inr(bill.total)}
                    </span>
                  </div>
                  <em className={`party-pay party-pay-${bill.status.toLowerCase()}`}>{bill.status}</em>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="party-dossier-block">
          <h3>Payments</h3>
          {insight.paymentsRecent.length === 0 ? (
            <p className="party-none">No receipts yet.</p>
          ) : (
            <ul className="party-line-list">
              {insight.paymentsRecent.map((pay) => (
                <li key={pay.id}>
                  <div>
                    <strong>{pay.voucherNo || pay.mode}</strong>
                    <span>{when(pay.date)}</span>
                  </div>
                  <em>{inr(pay.amount)}</em>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <p className="party-rate-note">
        Rating uses how much work this party sends and how many invoices are fully paid. Ranking is by job count across every party.
      </p>
    </section>
  )
}
