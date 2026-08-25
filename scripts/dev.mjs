/**
 * Local development orchestrator.
 *
 * Order: Docker Postgres → API :8787 (until dbReady) → Vite :5173 (strict).
 * Does not silently move the UI to 5174+.
 */
import { spawn, execFileSync } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const WEB_PORT = 5173
const API_PORT_DEFAULT = 8787
const PG_PORT = 5432
const isWin = process.platform === 'win32'

const children = []

function log(msg) {
  console.log(`[dev] ${msg}`)
}

function fail(msg) {
  console.error(`[dev] ${msg}`)
  shutdown(1)
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function readServerEnv() {
  const envPath = path.join(ROOT, 'server', '.env')
  const out = {}
  if (!fs.existsSync(envPath)) return out
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

function requiredEnvPresent(env) {
  const missing = []
  if (!env.DATABASE_URL) missing.push('DATABASE_URL')
  if (!env.JWT_SECRET) missing.push('JWT_SECRET')
  return missing
}

function portInUse(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host })
    socket.setTimeout(800)
    socket.on('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.on('timeout', () => {
      socket.destroy()
      resolve(false)
    })
    socket.on('error', () => resolve(false))
  })
}

function pidsOnPort(port) {
  const pids = new Set()
  try {
    if (isWin) {
      const out = execFileSync('netstat', ['-ano', '-p', 'TCP'], { encoding: 'utf8' })
      const re = new RegExp(`TCP\\s+\\S+:${port}\\s+\\S+\\s+LISTENING\\s+(\\d+)`, 'gi')
      let m
      while ((m = re.exec(out))) pids.add(Number(m[1]))
    } else {
      try {
        const out = execFileSync('lsof', ['-t', `-iTCP:${port}`, '-sTCP:LISTEN'], {
          encoding: 'utf8',
        })
        for (const line of out.split(/\s+/)) {
          const n = Number(line.trim())
          if (Number.isFinite(n) && n > 0) pids.add(n)
        }
      } catch {
        /* lsof missing or nothing listening */
      }
    }
  } catch {
    /* netstat failed */
  }
  pids.delete(0)
  return [...pids]
}

function commandLine(pid) {
  try {
    if (isWin) {
      const ps = `(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").CommandLine`
      return execFileSync('powershell.exe', ['-NoProfile', '-Command', ps], {
        encoding: 'utf8',
        timeout: 8000,
      })
        .trim()
        .replace(/\s+/g, ' ')
    }
    return execFileSync('ps', ['-p', String(pid), '-o', 'args='], { encoding: 'utf8' })
      .trim()
      .replace(/\s+/g, ' ')
  } catch {
    return ''
  }
}

function processName(pid) {
  try {
    if (isWin) {
      const ps = `(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").Name`
      return execFileSync('powershell.exe', ['-NoProfile', '-Command', ps], {
        encoding: 'utf8',
        timeout: 8000,
      }).trim()
    }
    return execFileSync('ps', ['-p', String(pid), '-o', 'comm='], { encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

function isOurDevProcess(cmd) {
  if (!cmd) return false
  const normalized = cmd.replace(/\\/g, '/').toLowerCase()
  const root = ROOT.replace(/\\/g, '/').toLowerCase()
  const inProject = normalized.includes(root) || normalized.includes('shrija web software')
  if (!inProject) return false
  return /vite|tsx|src\/index\.ts|scripts\/dev\.mjs|concurrently|npm run dev/.test(normalized)
}

function killPid(pid) {
  try {
    if (isWin) {
      execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' })
    } else {
      process.kill(pid, 'SIGTERM')
    }
  } catch {
    /* already gone */
  }
}

async function freeOurPort(port, label) {
  const pids = pidsOnPort(port)
  if (pids.length === 0) return

  const ours = []
  const foreign = []
  for (const pid of pids) {
    const cmd = commandLine(pid)
    const name = processName(pid)
    const info = { pid, name, cmd: cmd.slice(0, 180) }
    if (isOurDevProcess(cmd)) ours.push(info)
    else foreign.push(info)
  }

  if (foreign.length) {
    const details = foreign
      .map((p) => `PID ${p.pid} (${p.name || 'unknown'})${p.cmd ? `: ${p.cmd}` : ''}`)
      .join('\n  ')
    fail(
      `${label} port ${port} is in use by another application (not this project's dev server).\n  ${details}\nStop that application, then run npm run dev again.\nThis project will not switch to another port.`,
    )
  }

  for (const p of ours) {
    log(`Stopping stale ${label} process PID ${p.pid}`)
    killPid(p.pid)
  }

  for (let i = 0; i < 20; i++) {
    await sleep(200)
    if (pidsOnPort(port).length === 0) return
  }

  fail(`${label} port ${port} is still occupied after stopping this project's processes.`)
}

function spawnInherit(command, args, cwd = ROOT) {
  // Always spawn node/executables directly — never npm.cmd/.bat with shell:false.
  // Node 20+ on Windows throws spawn EINVAL for .cmd without a shell.
  const child = spawn(command, args, {
    cwd,
    stdio: 'inherit',
    shell: false,
    env: { ...process.env, FORCE_COLOR: '1' },
    windowsHide: true,
  })
  children.push(child)
  child.on('error', (err) => {
    if (shuttingDown) return
    console.error(`[dev] Failed to start ${path.basename(command)}: ${err.message}`)
    shutdown(1)
  })
  child.on('exit', (code, signal) => {
    if (shuttingDown) return
    if (signal) return
    if (code && code !== 0) {
      console.error(`[dev] ${command} ${args.join(' ')} exited with code ${code}`)
      shutdown(code)
    }
  })
  return child
}

let shuttingDown = false
function shutdown(code = 0) {
  if (shuttingDown) return
  shuttingDown = true
  for (const child of children) {
    if (!child.pid || child.exitCode != null) continue
    killPid(child.pid)
  }
  process.exit(code)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))
if (isWin) {
  const readline = await import('node:readline')
  readline.createInterface({ input: process.stdin, output: process.stdout }).on('SIGINT', () => {
    shutdown(0)
  })
}

async function waitForTcp(port, host, timeoutMs, label) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await portInUse(port, host)) return
    await sleep(400)
  }
  fail(
    `${label} did not accept connections on ${host}:${port} within ${Math.round(timeoutMs / 1000)}s.`,
  )
}

async function waitForHttp(url, timeoutMs, label) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) })
      if (res.status > 0) return
    } catch {
      /* not up yet */
    }
    await sleep(400)
  }
  fail(`${label} did not respond at ${url} within ${Math.round(timeoutMs / 1000)}s.`)
}

async function waitForApiReady(apiPort, timeoutMs) {
  const start = Date.now()
  let last = null
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${apiPort}/api/health`)
      last = await res.json()
      if (last?.ok && last?.dbReady) return last
    } catch {
      last = { error: 'API process not reachable yet' }
    }
    await sleep(500)
  }
  const dbErr = last?.dbError ? ` Last DB error: ${last.dbError}` : ''
  fail(
    `API on port ${apiPort} did not become ready (dbReady) within ${Math.round(timeoutMs / 1000)}s.${dbErr}\nCheck Docker Desktop, server/.env DATABASE_URL, and the API logs above.`,
  )
}

function ensureServerEnvFile() {
  const envPath = path.join(ROOT, 'server', '.env')
  const examplePath = path.join(ROOT, 'server', '.env.example')
  if (fs.existsSync(envPath)) return
  if (!fs.existsSync(examplePath)) {
    fail('Missing server/.env and server/.env.example.')
  }
  fs.copyFileSync(examplePath, envPath)
  log('Created server/.env from server/.env.example. Review it if login fails.')
}

function ensureDockerPostgres() {
  try {
    execFileSync('docker', ['info'], { stdio: 'ignore', timeout: 15000 })
  } catch {
    fail(
      'Docker is not running. Start Docker Desktop, wait until it is ready, then run npm run dev again.\nLocal PostgreSQL is provided by docker-compose.yml.',
    )
  }

  log('Starting PostgreSQL (docker compose up -d)')
  try {
    execFileSync('docker', ['compose', 'up', '-d'], {
      cwd: ROOT,
      stdio: 'inherit',
      timeout: 180000,
    })
  } catch {
    fail('docker compose up -d failed. Is Docker Desktop running?')
  }
}

async function main() {
  ensureServerEnvFile()
  const envAfter = readServerEnv()
  const missing = requiredEnvPresent(envAfter)
  if (missing.length) {
    fail(
      `server/.env is missing required variable(s): ${missing.join(', ')}.\nCopy from server/.env.example and set them (do not commit the file).`,
    )
  }

  const apiPort = Number(envAfter.PORT || API_PORT_DEFAULT)
  if (apiPort !== API_PORT_DEFAULT) {
    log(
      `Warning: server/.env PORT=${apiPort} but the Vite proxy targets ${API_PORT_DEFAULT}. Keep PORT=${API_PORT_DEFAULT} for local development.`,
    )
  }

  if (!fs.existsSync(path.join(ROOT, 'node_modules', 'vite'))) {
    fail('Frontend dependencies missing. Run npm install in the project root.')
  }
  if (!fs.existsSync(path.join(ROOT, 'server', 'node_modules'))) {
    fail('API dependencies missing. Run: npm --prefix server install')
  }

  await freeOurPort(WEB_PORT, 'Frontend')
  await freeOurPort(apiPort, 'API')

  ensureDockerPostgres()
  log(`Waiting for PostgreSQL on port ${PG_PORT}`)
  await waitForTcp(PG_PORT, '127.0.0.1', 60000, 'PostgreSQL')

  const tsxCli = path.join(ROOT, 'server', 'node_modules', 'tsx', 'dist', 'cli.mjs')
  const viteCli = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js')
  if (!fs.existsSync(tsxCli)) {
    fail('API runner missing (server/node_modules/tsx). Run: npm --prefix server install')
  }
  if (!fs.existsSync(viteCli)) {
    fail('Frontend runner missing (node_modules/vite). Run npm install in the project root.')
  }

  log(`Starting API on port ${apiPort}`)
  spawnInherit(process.execPath, [tsxCli, 'watch', 'src/index.ts'], path.join(ROOT, 'server'))
  await waitForApiReady(apiPort, 90000)

  log(`Starting frontend on http://localhost:${WEB_PORT} (strict port)`)
  spawnInherit(process.execPath, [viteCli], ROOT)
  await waitForHttp(`http://127.0.0.1:${WEB_PORT}/`, 30000, 'Frontend')

  console.log('')
  console.log('========================================================')
  console.log(' Shrija local development is ready')
  console.log(` Frontend   http://localhost:${WEB_PORT}`)
  console.log(` API        http://127.0.0.1:${apiPort}`)
  console.log(` Health     http://127.0.0.1:${apiPort}/api/health`)
  console.log(' Database   ready')
  console.log('========================================================')
  console.log(' Press Ctrl+C to stop.')
  console.log('')
}

main().catch((err) => {
  console.error('[dev]', err instanceof Error ? err.message : err)
  shutdown(1)
})
