import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import express, { type Express } from 'express'
import type { Server } from 'node:http'
import { issuedLimiter, licenseRouter } from './routes/license.js'
import {
  createBearerLimiter,
  createLoginLimiter,
  createResetLimiter,
  createSharedLimiter,
  trustedPeerKey,
} from './rateLimit.js'

const here = path.dirname(fileURLToPath(import.meta.url))

function appWith(limiter: express.RequestHandler, pathName = '/limited'): Express {
  const app = express()
  app.set('trust proxy', false)
  app.use(express.json())
  app.post(pathName, limiter, (_req, res) => {
    res.json({ ok: true })
  })
  return app
}

async function listen(app: Express): Promise<Server> {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server))
  })
}

async function post(
  server: Server,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: { error?: string; ok?: boolean } }> {
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('test server has no port')
  const res = await fetch(`http://127.0.0.1:${address.port}/limited`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  return { status: res.status, body: (await res.json()) as { error?: string; ok?: boolean } }
}

describe('login abuse controls', () => {
  it('limits each username and ignores forwarding headers', async () => {
    const server = await listen(appWith(createLoginLimiter(2)))
    try {
      const first = await post(server, { username: 'Centre-A' }, { 'x-forwarded-for': '203.0.113.8' })
      const second = await post(
        server,
        { username: 'centre-a' },
        { 'x-forwarded-for': '198.51.100.20', 'x-real-ip': '198.51.100.21' },
      )
      const blocked = await post(server, { username: 'CENTRE-A' }, { 'x-forwarded-for': '192.0.2.9' })
      const otherCentre = await post(server, { username: 'centre-b' }, { 'x-forwarded-for': '203.0.113.8' })
      assert.equal(first.status, 200)
      assert.equal(second.status, 200)
      assert.equal(blocked.status, 429)
      assert.equal(blocked.body.error, 'Too many attempts. Please try again in 15 minutes.')
      assert.equal(otherCentre.status, 200)
    } finally {
      server.close()
    }
  })

  it('shares one bucket for requests that omit a username', async () => {
    const server = await listen(appWith(createLoginLimiter(1)))
    try {
      assert.equal((await post(server, {})).status, 200)
      assert.equal((await post(server, { username: '   ' }, { 'x-forwarded-for': '203.0.113.1' })).status, 429)
    } finally {
      server.close()
    }
  })

  it('keeps licence issuance on one process-wide bucket ahead of the route handler', async () => {
    const server = await listen(appWith(createSharedLimiter('license-issued-test', 2)))
    try {
      assert.equal((await post(server, {}, { 'x-forwarded-for': '203.0.113.1', 'x-real-ip': '203.0.113.2' })).status, 200)
      assert.equal((await post(server, {}, { 'x-forwarded-for': '198.51.100.4' })).status, 200)
      assert.equal((await post(server, {}, { 'x-real-ip': '192.0.2.5' })).status, 429)
    } finally {
      server.close()
    }

    const layer = (
      licenseRouter as unknown as {
        stack: { route?: { path: string; methods: Record<string, boolean>; stack: { handle: unknown }[] } }[]
      }
    ).stack.find((entry) => entry.route?.path === '/issued' && entry.route.methods.post)
    assert.ok(layer?.route)
    assert.equal(layer?.route?.stack[0]?.handle, issuedLimiter)
    assert.notEqual(layer?.route?.stack[1]?.handle, issuedLimiter)
  })

  it('does not let an untrusted forwarding header choose a visitor bucket', () => {
    assert.equal(trustedPeerKey('203.0.113.10', [], '198.51.100.8'), 'peer:203.0.113.10')
    assert.equal(trustedPeerKey('203.0.113.10', ['203.0.113.10'], '198.51.100.8'), 'trusted:198.51.100.8')
  })

  it('limits a bearer session without putting the raw token in the key space of another token', async () => {
    const server = await listen(appWith(createBearerLimiter(1)))
    try {
      const tokenA = 'Bearer synthetic-session-token-a'
      const tokenB = 'Bearer synthetic-session-token-b'
      assert.equal((await post(server, {}, { authorization: tokenA })).status, 200)
      assert.equal((await post(server, {}, { authorization: tokenA })).status, 429)
      assert.equal((await post(server, {}, { authorization: tokenB })).status, 200)
    } finally {
      server.close()
    }
  })

  it('limits reset tokens by digest and groups missing tokens together', async () => {
    const server = await listen(appWith(createResetLimiter(1)))
    try {
      assert.equal((await post(server, { token: 'synthetic-reset-token-a' })).status, 200)
      assert.equal((await post(server, { token: 'synthetic-reset-token-a' })).status, 429)
      assert.equal((await post(server, { token: 'synthetic-reset-token-b' })).status, 200)
      assert.equal((await post(server, { token: 'short' })).status, 200)
      assert.equal((await post(server, {})).status, 429)
    } finally {
      server.close()
    }
  })

  it('keeps trust proxy disabled in the server entrypoint', () => {
    const source = readFileSync(path.join(here, 'index.ts'), 'utf8')
    assert.match(source, /app\.set\('trust proxy', false\)/)
    assert.equal(source.includes("app.set('trust proxy', 1)"), false)
    assert.equal(source.includes('TRUSTED_PROXY_IPS'), false)
  })
})
