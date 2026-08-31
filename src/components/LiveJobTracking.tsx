import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Check, Circle, ClipboardList, Radio, Search, SearchX } from 'lucide-react'
import { canAccessPath } from '../data/roles'
import { store } from '../data/store'
import { getStoreVersion } from '../data/tenantCache'
import {
  buildJobTrack,
  buildJobTracks,
  findRequestByNumber,
  formatTrackingInstant,
  type JobTrackView,
  type TrackedStage,
} from '../utils/jobTracking'

const LIST_LIMIT = 8
const STORE_POLL_MS = 5000

function statusBadgeClass(status: string) {
  if (status === 'Pending') return 'badge badge-pending'
  if (status === 'In Progress' || status === 'Assayed') return 'badge badge-progress'
  if (status === 'Billed') return 'badge badge-billed'
  if (status === 'Hallmarked' || status === 'Delivered' || status === 'Completed') return 'badge badge-done'
  return 'badge'
}

function StageMark({ stage, compact }: { stage: TrackedStage; compact?: boolean }) {
  const label =
    stage.state === 'completed'
      ? `${stage.label} completed`
      : stage.state === 'current'
        ? `${stage.label} current`
        : `${stage.label} pending`
  return (
    <span
      className={`job-track-mark is-${stage.state}${compact ? ' is-compact' : ''}`}
      aria-label={label}
      title={label}
    >
      {stage.state === 'completed' ? (
        <Check size={compact ? 11 : 14} strokeWidth={2.6} aria-hidden />
      ) : stage.state === 'current' ? (
        <span className="job-track-pulse" aria-hidden />
      ) : (
        <Circle size={compact ? 11 : 13} strokeWidth={2} aria-hidden />
      )}
    </span>
  )
}

function WorkflowTimeline({
  stages,
  detailed,
}: {
  stages: TrackedStage[]
  detailed?: boolean
}) {
  return (
    <ol className={`job-track-flow${detailed ? ' is-detailed' : ''}`} aria-label="Job workflow">
      {stages.map((stage, index) => (
        <li
          key={stage.id}
          className={`job-track-step is-${stage.state}`}
          data-filled={stage.state === 'completed' || stage.state === 'current' ? 'true' : 'false'}
        >
          {index > 0 ? <span className="job-track-connector" aria-hidden /> : null}
          <StageMark stage={stage} compact={!detailed} />
          <div className="job-track-step-copy">
            <strong>{stage.label}</strong>
            {detailed ? (
              <span>
                {stage.timestampLabel}
                {stage.pendingLabel ? ` · ${stage.pendingLabel}` : ''}
              </span>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  )
}

function ProgressBar({ percent, label }: { percent: number; label: string }) {
  return (
    <div className="job-track-progress" aria-label={`Progress ${percent} percent, ${label}`}>
      <span className="job-track-progress-track">
        <span className="job-track-progress-fill" style={{ width: `${percent}%` }} />
      </span>
      <span className="job-track-progress-pct">{percent}%</span>
    </div>
  )
}

export function LiveJobTracking() {
  const canSeeParty =
    canAccessPath('/request-list') ||
    canAccessPath('/qm-request-list') ||
    canAccessPath('/billing') ||
    canAccessPath('/add-party')
  const canSeeAnalyst = canAccessPath('/create-fire-assay') || canAccessPath('/view-fire-assay')

  const [storeVersion, setStoreVersion] = useState(() => getStoreVersion())
  const [query, setQuery] = useState('')
  const [submitted, setSubmitted] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    const id = window.setInterval(() => {
      const next = getStoreVersion()
      setStoreVersion((prev) => (prev === next ? prev : next))
    }, STORE_POLL_MS)
    return () => window.clearInterval(id)
  }, [])

  const snapshot = useMemo(() => {
    const data = store.getAll()
    return {
      requests: data.requests,
      roughSheets: data.roughSheets,
      pendingRough: data.pendingRough,
      fireAssays: data.fireAssays,
      invoices: data.invoices,
      monthlyInvoices: data.monthlyInvoices || [],
    }
  }, [storeVersion])

  const liveJobs = useMemo(() => buildJobTracks(snapshot, LIST_LIMIT), [snapshot])

  const searched = useMemo(() => {
    if (!submitted) return null
    const req = findRequestByNumber(snapshot.requests, submitted)
    return req ? buildJobTrack(req, snapshot) : null
  }, [snapshot, submitted])

  const selected = useMemo(() => {
    if (searched) return searched
    if (selectedId) return liveJobs.find((job) => job.requestId === selectedId) || liveJobs[0] || null
    return liveJobs[0] || null
  }, [liveJobs, searched, selectedId])

  function runSearch(raw: string) {
    const value = raw.trim()
    setQuery(value)
    setSubmitted(value)
    setSelectedId(null)
    if (!value) {
      setNotFound(false)
      return
    }
    setNotFound(!findRequestByNumber(snapshot.requests, value))
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    runSearch(query)
  }

  function onRowKey(e: KeyboardEvent<HTMLButtonElement>, job: JobTrackView) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setSubmitted('')
      setNotFound(false)
      setSelectedId(job.requestId)
    }
  }

  const showNotFound = Boolean(submitted) && notFound
  const emptyList = liveJobs.length === 0 && !submitted

  return (
    <section className="home-panel home-live-track" data-accent="cyan" aria-labelledby="live-job-tracking-title">
      <div className="home-panel-head job-track-head">
        <div>
          <h2 id="live-job-tracking-title">
            <span className="job-track-live" aria-hidden>
              <Radio size={16} />
            </span>
            Live Job Tracking
          </h2>
          <p>Read-only status of where each request currently stands.</p>
        </div>
        <form className="job-track-search" onSubmit={onSubmit} role="search">
          <Search className="job-track-search-icon" size={16} aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              if (!e.target.value.trim()) {
                setSubmitted('')
                setNotFound(false)
              }
            }}
            placeholder="Search Request Number..."
            aria-label="Search Request Number"
            autoComplete="off"
            spellCheck={false}
          />
        </form>
      </div>

      {showNotFound ? (
        <div className="job-track-empty" role="status">
          <SearchX size={28} aria-hidden />
          <strong>Request not found</strong>
          <span>Check the Request Number and try again.</span>
        </div>
      ) : emptyList ? (
        <div className="job-track-empty" role="status">
          <ClipboardList size={28} aria-hidden />
          <strong>No active jobs to track</strong>
          <span>New requests will appear here as they are received.</span>
        </div>
      ) : (
        <div className="job-track-layout">
          <ul className="job-track-list" aria-label="Recent and active jobs">
            {liveJobs.map((job) => {
              const active = !searched && selected?.requestId === job.requestId
              return (
                <li key={job.requestId}>
                  <button
                    type="button"
                    className={`job-track-row${active ? ' is-active' : ''}`}
                    onClick={() => {
                      setSubmitted('')
                      setNotFound(false)
                      setSelectedId(job.requestId)
                    }}
                    onKeyDown={(e) => onRowKey(e, job)}
                    aria-pressed={active}
                    aria-label={`${job.requestNo}, ${job.currentStageLabel}, ${job.status}`}
                  >
                    <div className="job-track-row-top">
                      <strong>{job.requestNo}</strong>
                      <span className={statusBadgeClass(job.status)}>{job.status}</span>
                    </div>
                    <div className="job-track-row-meta">
                      <span>{job.currentStageLabel}</span>
                      <span>{job.lastUpdatedLabel}</span>
                    </div>
                    <ProgressBar percent={job.progressPercent} label={job.currentStageLabel} />
                    <WorkflowTimeline stages={job.stages} />
                  </button>
                </li>
              )
            })}
          </ul>

          {selected ? (
            <article className="job-track-detail" aria-live="polite">
              <header className="job-track-detail-head">
                <div>
                  <p className="job-track-kicker">Request Number</p>
                  <h3>{selected.requestNo}</h3>
                </div>
                <span className={statusBadgeClass(selected.status)}>{selected.status}</span>
              </header>

              <dl className="job-track-facts">
                <div>
                  <dt>Current Stage</dt>
                  <dd>{selected.currentStageLabel}</dd>
                </div>
                <div>
                  <dt>Current Status</dt>
                  <dd>{selected.status}</dd>
                </div>
                <div>
                  <dt>Request Date</dt>
                  <dd>{formatTrackingInstant(selected.requestDate)}</dd>
                </div>
                <div>
                  <dt>Last Updated</dt>
                  <dd>{selected.lastUpdatedLabel}</dd>
                </div>
                {canSeeParty && selected.partyName ? (
                  <div>
                    <dt>Customer</dt>
                    <dd>{selected.partyName}</dd>
                  </div>
                ) : null}
                {selected.jobCardNo ? (
                  <div>
                    <dt>Job reference</dt>
                    <dd>{selected.jobCardNo}</dd>
                  </div>
                ) : null}
                {canSeeAnalyst && selected.analyst ? (
                  <div>
                    <dt>Analyst</dt>
                    <dd>{selected.analyst}</dd>
                  </div>
                ) : null}
                {selected.source ? (
                  <div>
                    <dt>Source</dt>
                    <dd>{selected.source}</dd>
                  </div>
                ) : null}
              </dl>

              <ProgressBar percent={selected.progressPercent} label={selected.currentStageLabel} />
              <WorkflowTimeline stages={selected.stages} detailed />
            </article>
          ) : null}
        </div>
      )}
    </section>
  )
}
