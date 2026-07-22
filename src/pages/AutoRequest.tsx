import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useToast } from '../components/ui'
import { store, type PendingRoughRequest } from '../data/store'

const SCRAP_BASE = 'http://127.0.0.1:19876'

type ManakCreds = {
  username: string
  baseUrl: string
  bridgeUrl: string
  allowedMacs: string
  hasPassword: boolean
}

type ManakFetchResponse = {
  ok?: boolean
  source?: string
  requests?: Array<{
    partyName: string
    item: string
    pic: number
    weight: number
    purity: string
    requestNo: string
    receiptNo: string
    jobCardNo: string
    cml: string
    date?: string
  }>
  message?: string
  needsCaptcha?: boolean
  sessionId?: string
  captchaImage?: string
  error?: string
}

type ScrapHealth = {
  ok: boolean
  version?: string
  mac?: string
  macs?: string[]
  machine?: string
  busy?: boolean
}

export function AutoRequest() {
  const { toast, Toast } = useToast()
  const [night, setNight] = useState('Night')
  const [rows, setRows] = useState<PendingRoughRequest[]>(() =>
    store.getPendingRough().filter((r) => r.status === 'Pending'),
  )
  const [selected, setSelected] = useState<string[]>([])
  const [fetching, setFetching] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [baseUrl, setBaseUrl] = useState('https://huid.manakonline.in')
  const [bridgeUrl, setBridgeUrl] = useState('')
  const [allowedMacs, setAllowedMacs] = useState('')
  const [hasPassword, setHasPassword] = useState(false)
  const [savingCreds, setSavingCreds] = useState(false)

  const [sessionId, setSessionId] = useState<string | null>(null)
  const [captchaImage, setCaptchaImage] = useState<string | null>(null)
  const [captchaText, setCaptchaText] = useState('')
  const [statusMsg, setStatusMsg] = useState('')
  const [scrapOnline, setScrapOnline] = useState(false)
  const [scrapInfo, setScrapInfo] = useState<ScrapHealth | null>(null)

  const probeScrap = async () => {
    try {
      const res = await fetch(`${SCRAP_BASE}/health`, { signal: AbortSignal.timeout(1500) })
      if (!res.ok) throw new Error('offline')
      const data = (await res.json()) as ScrapHealth
      setScrapOnline(Boolean(data.ok))
      setScrapInfo(data)
      return data
    } catch {
      setScrapOnline(false)
      setScrapInfo(null)
      return null
    }
  }

  useEffect(() => {
    void api<ManakCreds>('/api/data/manak/credentials')
      .then((c) => {
        setUsername(c.username || '')
        setBaseUrl(c.baseUrl || 'https://huid.manakonline.in')
        setBridgeUrl(c.bridgeUrl || '')
        setAllowedMacs(c.allowedMacs || '')
        setHasPassword(Boolean(c.hasPassword))
        if (!c.hasPassword) setShowSettings(true)
      })
      .catch(() => {
        setShowSettings(true)
      })

    void probeScrap()
    const t = window.setInterval(() => void probeScrap(), 5000)
    return () => window.clearInterval(t)
  }, [])

  const applyFetched = (list: NonNullable<ManakFetchResponse['requests']>) => {
    const created = store.importManakRequests(night, list)
    const pending = store.getPendingRough()
    setRows(pending)
    setSelected((prev) => [...new Set([...prev, ...created.map((r) => r.id)])])
    return created.length
  }

  const useDetectedMac = () => {
    const mac = scrapInfo?.mac || scrapInfo?.macs?.[0]
    if (!mac) {
      toast('Start Shrija Scrap Tool first to detect MAC')
      return
    }
    const set = new Set(
      allowedMacs
        .split(',')
        .map((s) => s.trim().toUpperCase().replace(/:/g, '-'))
        .filter(Boolean),
    )
    set.add(mac.toUpperCase().replace(/:/g, '-'))
    setAllowedMacs([...set].join(', '))
    toast(`MAC added: ${mac}`)
  }

  const saveCredentials = async () => {
    if (!username.trim()) {
      toast('Enter Manak username')
      return
    }
    if (!password && !hasPassword) {
      toast('Enter Manak password')
      return
    }
    setSavingCreds(true)
    try {
      const body: Record<string, unknown> = {
        username: username.trim(),
        baseUrl: baseUrl.trim() || 'https://huid.manakonline.in',
        bridgeUrl: bridgeUrl.trim(),
        allowedMacs: allowedMacs.trim(),
      }
      if (password) body.password = password
      const res = await api<ManakCreds>('/api/data/manak/credentials', {
        method: 'PUT',
        json: body,
      })
      setHasPassword(Boolean(res.hasPassword))
      setAllowedMacs(res.allowedMacs || allowedMacs)
      setPassword('')
      setShowSettings(false)
      toast('Manak credentials saved')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save credentials')
    } finally {
      setSavingCreds(false)
    }
  }

  const runLocalScrapFetch = async (): Promise<ManakFetchResponse> => {
    setStatusMsg('Scrap tool: login → open Receiving → click yellow "Scrape this page"')
    const bundle = await api<{
      username: string
      password: string
      baseUrl: string
      allowedMacs: string
    }>('/api/data/manak/scrap-bundle', { method: 'POST', json: {} })

    const res = await fetch(`${SCRAP_BASE}/fetch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: bundle.username,
        password: bundle.password,
        baseUrl: bundle.baseUrl,
        night,
        allowedMacs: bundle.allowedMacs,
        loginTimeoutSec: 180,
        postLoginWaitSec: 300,
        headed: true,
      }),
    })
    const body = (await res.json()) as ManakFetchResponse & { error?: string }
    if (!res.ok) throw new Error(body.error || `Scrap tool error (${res.status})`)
    return body
  }

  const runCloudFetch = async (opts?: {
    sessionId?: string
    captchaText?: string
    demo?: boolean
  }): Promise<ManakFetchResponse> => {
    setStatusMsg(opts?.demo ? 'Demo fetch…' : 'Cloud Manak fetch…')
    return api<ManakFetchResponse>('/api/data/manak/fetch', {
      method: 'POST',
      json: {
        night,
        sessionId: opts?.sessionId,
        captchaText: opts?.captchaText,
        demo: opts?.demo,
      },
    })
  }

  const runFetch = async (opts?: {
    sessionId?: string
    captchaText?: string
    demo?: boolean
    forceCloud?: boolean
  }) => {
    setFetching(true)
    try {
      let res: ManakFetchResponse

      if (opts?.demo) {
        res = await runCloudFetch({ demo: true })
      } else if (opts?.sessionId || opts?.forceCloud) {
        res = await runCloudFetch(opts)
      } else {
        const health = await probeScrap()
        if (health?.ok) {
          res = await runLocalScrapFetch()
        } else {
          toast('Scrap tool offline — using cloud fetch. Start tools/shrija-scrap/start.bat for best results.')
          res = await runCloudFetch()
        }
      }

      if (res.needsCaptcha && res.sessionId) {
        setSessionId(res.sessionId)
        setCaptchaImage(res.captchaImage || null)
        setCaptchaText('')
        setStatusMsg(res.message || 'Enter captcha to continue')
        toast('Enter Manak captcha, then Confirm')
        return
      }

      setSessionId(null)
      setCaptchaImage(null)
      setCaptchaText('')

      const list = res.requests || []
      if (list.length) {
        const n = applyFetched(list)
        setStatusMsg(res.message || `Loaded ${n} new request(s)`)
        toast(n ? `${n} new request(s)` : 'No new requests (already loaded)')
      } else {
        setStatusMsg(res.message || 'No pending requests')
        toast(res.message || 'No pending requests from Manak')
      }
    } catch (e) {
      setStatusMsg('')
      toast(e instanceof Error ? e.message : 'Manak fetch failed')
    } finally {
      setFetching(false)
    }
  }

  const fetchRequest = () => {
    if (fetching) {
      toast('Already fetching…')
      return
    }
    if (!hasPassword && !username) {
      setShowSettings(true)
      toast('Save Manak credentials first')
      return
    }
    void runFetch()
  }

  const confirmCaptcha = () => {
    if (!sessionId) {
      toast('Session expired — click Fetch Request again')
      return
    }
    void runFetch({ sessionId, captchaText, forceCloud: true })
  }

  const toggleRow = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const toggleAll = () => {
    if (selected.length === rows.length) setSelected([])
    else setSelected(rows.map((r) => r.id))
  }

  const saveRequest = () => {
    if (selected.length === 0) {
      toast('Please check at least one request')
      return
    }
    const created = store.saveAutoRequests({ night, selectedIds: selected })
    setRows((prev) => prev.filter((r) => !selected.includes(r.id)))
    setSelected([])
    toast(`${created.length} auto request(s) saved`)
  }

  return (
    <div className="auto-request-page">
      <div className="auto-top-bar">
        <select
          className="auto-night-select"
          value={night}
          onChange={(e) => setNight(e.target.value)}
        >
          <option value="Night">Night</option>
          <option value="Day">Day</option>
        </select>
        <span className={`scrap-pill ${scrapOnline ? 'scrap-on' : 'scrap-off'}`}>
          Scrap tool: {scrapOnline ? `Online v${scrapInfo?.version || '?'}` : 'Offline'}
          {scrapOnline && scrapInfo?.mac ? ` · ${scrapInfo.mac}` : ''}
        </span>
        {fetching && <span className="fetching-pill">Fetching…</span>}
        {statusMsg && !fetching && <span className="auto-status-msg">{statusMsg}</span>}
        <button
          type="button"
          className="btn btn-ghost auto-settings-btn"
          onClick={() => setShowSettings((v) => !v)}
        >
          Manak Settings
        </button>
      </div>

      {showSettings && (
        <div className="panel auto-manak-settings">
          <h3>Manak Online (BIS) + Scrap Tool</h3>
          <p className="auto-manak-hint">
            Gold Shark jaisa: reception PC par <strong>Shrija Scrap Tool</strong> chalao (
            <code>tools/shrija-scrap/start.bat</code>). Fetch pehle local tool use karega — Manak
            browser khulega, captcha aap enter karoge.
          </p>
          <div className="auto-manak-grid">
            <label>
              Username
              <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
            </label>
            <label>
              Password {hasPassword && !password ? '(saved — leave blank to keep)' : ''}
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder={hasPassword ? '••••••••' : ''}
              />
            </label>
            <label>
              Portal base URL
              <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
            </label>
            <label>
              Allowed MAC(s) — desk PC
              <input
                value={allowedMacs}
                onChange={(e) => setAllowedMacs(e.target.value)}
                placeholder="28-D0-43-20-EB-D6"
              />
            </label>
            <label>
              Bridge URL (optional PHP)
              <input
                value={bridgeUrl}
                onChange={(e) => setBridgeUrl(e.target.value)}
                placeholder="https://your-host/automate_request.php"
              />
            </label>
          </div>
          <div className="auto-manak-actions">
            <button type="button" className="btn btn-navy" disabled={savingCreds} onClick={() => void saveCredentials()}>
              {savingCreds ? 'Saving…' : 'Save credentials'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={useDetectedMac}>
              Use this PC MAC
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => void probeScrap()}>
              Refresh scrap status
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setShowSettings(false)}>
              Close
            </button>
          </div>
          {!scrapOnline && (
            <p className="auto-manak-hint" style={{ marginTop: '0.85rem', marginBottom: 0 }}>
              Scrap tool offline. PC par folder kholo → <code>tools\shrija-scrap\start.bat</code> →
              window khula rakho → yahan Offline se Online ho jayega.
            </p>
          )}
        </div>
      )}

      {captchaImage && sessionId && (
        <div className="panel auto-captcha-panel">
          <h3>Manak captcha (cloud fallback)</h3>
          <div className="auto-captcha-row">
            <img src={captchaImage} alt="Manak captcha" className="auto-captcha-img" />
            <div className="auto-captcha-fields">
              <input
                value={captchaText}
                onChange={(e) => setCaptchaText(e.target.value)}
                placeholder="Enter captcha"
                autoFocus
              />
              <button type="button" className="btn btn-navy" disabled={fetching} onClick={confirmCaptcha}>
                Confirm &amp; Fetch
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="panel auto-table-panel">
        <div className="table-wrap">
          <table className="data-table navy-head-table">
            <thead>
              <tr>
                <th className="col-check">
                  <input
                    type="checkbox"
                    checked={rows.length > 0 && selected.length === rows.length}
                    onChange={toggleAll}
                    aria-label="Select all"
                  />{' '}
                  Check
                </th>
                <th>Party Name</th>
                <th>Item</th>
                <th>PIC</th>
                <th>Weight</th>
                <th>Purity</th>
                <th>Request No</th>
                <th>Receipt No</th>
                <th>Job Card No</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="empty-state">
                    &nbsp;
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className={selected.includes(row.id) ? 'row-selected' : ''}>
                    <td className="col-check">
                      <input
                        type="checkbox"
                        checked={selected.includes(row.id)}
                        onChange={() => toggleRow(row.id)}
                        aria-label={`Select ${row.requestNo}`}
                      />
                    </td>
                    <td>{row.partyName}</td>
                    <td>{row.item}</td>
                    <td>{row.pic}</td>
                    <td>{row.weight.toFixed(2)}</td>
                    <td>{row.purity}</td>
                    <td>{row.requestNo}</td>
                    <td>{row.receiptNo}</td>
                    <td>{row.jobCardNo}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="auto-actions">
        <div className="auto-action-row">
          <button type="button" className="btn btn-navy" onClick={saveRequest}>
            Save Request
          </button>
          <button type="button" className="btn btn-navy" onClick={fetchRequest} disabled={fetching}>
            Fetch Request
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={fetching}
            onClick={() => void runFetch({ forceCloud: true })}
            title="Skip local scrap tool"
          >
            Cloud Fetch
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={fetching}
            onClick={() => void runFetch({ demo: true })}
            title="Sample rows only"
          >
            Demo Fetch
          </button>
        </div>
        <Link to="/" className="btn btn-back">
          Back
        </Link>
      </div>

      {Toast}
    </div>
  )
}
