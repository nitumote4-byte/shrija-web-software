/**
 * Auth middleware isolation tests (no database).
 * Run: npm --prefix server test
 */
import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { enforceTenantBody, requireActiveTenant, requireAuth, signToken, type AuthUser } from './auth.js'
import { invalidateTenantStatus, seedTenantStatusCache } from '../tenantStatus.js'
import { assertMaster } from '../license.js'

const USER_A: AuthUser = {
  userId: 'usr_a',
  tenantId: 'tn_a',
  username: 'qm_a',
  role: 'quality_manager',
  isAdmin: true,
  tenantName: 'Centre A',
  centreId: 'main',
  centreKind: 'main',
  centreName: 'Centre A',
}

const USER_OSC: AuthUser = {
  ...USER_A,
  userId: 'usr_osc',
  username: 'osc_user',
  isAdmin: false,
  role: 'reception',
  centreId: 'osc-a',
  centreKind: 'osc',
  centreName: 'Outlet A',
}

function mockRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code
      return this
    },
    json(payload: unknown) {
      this.body = payload
      return this
    },
  }
  return res as typeof res & Response
}

describe('requireAuth', () => {
  it('rejects unauthenticated access to centre-specific APIs', () => {
    const req = { headers: {} } as Request
    const res = mockRes()
    let nextCalled = false
    requireAuth(req, res, (() => {
      nextCalled = true
    }) as NextFunction)
    assert.equal(nextCalled, false)
    assert.equal(res.statusCode, 401)
  })

  it('binds tenant and centre from the verified token, not from the request body', () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret'
    const token = signToken(USER_A)
    const req = {
      headers: { authorization: `Bearer ${token}` },
      body: { tenantId: 'tn_b', centreId: 'osc-b' },
    } as Request
    const res = mockRes()
    let nextCalled = false
    requireAuth(req, res, (() => {
      nextCalled = true
    }) as NextFunction)
    assert.equal(nextCalled, true)
    assert.equal(req.user?.tenantId, 'tn_a')
    assert.equal(req.user?.centreId, 'main')
    assert.equal(req.user?.tenantName, 'Centre A')
  })

  it('rejects a forged token for another tenant', () => {
    const forged = jwt.sign(
      { sub: 'usr_b', tenantId: 'tn_b', username: 'qm_b', role: 'admin', isAdmin: true },
      'wrong-secret',
      { algorithm: 'HS256', expiresIn: '12h' },
    )
    const req = { headers: { authorization: `Bearer ${forged}` } } as Request
    const res = mockRes()
    requireAuth(req, res, (() => undefined) as NextFunction)
    assert.equal(res.statusCode, 401)
  })

  it('rejects an unsigned JWT that claims another tenant (alg none)', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
    const body = Buffer.from(
      JSON.stringify({
        sub: 'usr_a',
        tenantId: 'tn_b',
        username: 'attacker',
        role: 'admin',
        isAdmin: true,
      }),
    ).toString('base64url')
    const req = { headers: { authorization: `Bearer ${header}.${body}.` } } as Request
    const res = mockRes()
    let nextCalled = false
    requireAuth(req, res, (() => {
      nextCalled = true
    }) as NextFunction)
    assert.equal(nextCalled, false)
    assert.equal(res.statusCode, 401)
  })

  it('rejects a validly shaped token whose payload was modified after signing', () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret'
    const token = signToken(USER_A)
    const [h, p, s] = token.split('.')
    const tamperedPayload = Buffer.from(
      JSON.stringify({
        ...JSON.parse(Buffer.from(p, 'base64url').toString('utf8')),
        tenantId: 'tn_b',
      }),
    ).toString('base64url')
    const req = { headers: { authorization: `Bearer ${h}.${tamperedPayload}.${s}` } } as Request
    const res = mockRes()
    requireAuth(req, res, (() => undefined) as NextFunction)
    assert.equal(res.statusCode, 401)
  })
})

describe('enforceTenantBody', () => {
  it('blocks Center A from targeting Center B via body tenantId', () => {
    const req = { user: USER_A, body: { tenantId: 'tn_b' }, query: {}, params: {} } as Request
    const res = mockRes()
    let nextCalled = false
    enforceTenantBody(req, res, (() => {
      nextCalled = true
    }) as NextFunction)
    assert.equal(nextCalled, false)
    assert.equal(res.statusCode, 403)
  })

  it('blocks Center A from targeting Center B via URL tenantId param', () => {
    const req = { user: USER_A, body: {}, query: {}, params: { tenantId: 'tn_b' } } as Request
    const res = mockRes()
    enforceTenantBody(req, res, (() => undefined) as NextFunction)
    assert.equal(res.statusCode, 403)
  })

  it('blocks an OSC user from switching to another outlet via centreId', () => {
    const req = { user: USER_OSC, body: { centreId: 'osc-b' }, query: {}, params: {} } as Request
    const res = mockRes()
    enforceTenantBody(req, res, (() => undefined) as NextFunction)
    assert.equal(res.statusCode, 403)
  })

  it('strips client tenant fields when they match the authenticated tenant', () => {
    const req = {
      user: USER_A,
      body: { tenantId: 'tn_a', data: { parties: [] } },
      query: {},
      params: {},
    } as Request
    const res = mockRes()
    let nextCalled = false
    enforceTenantBody(req, res, (() => {
      nextCalled = true
    }) as NextFunction)
    assert.equal(nextCalled, true)
    assert.equal('tenantId' in (req.body as object), false)
    assert.deepEqual((req.body as { data: unknown }).data, { parties: [] })
  })
})

describe('platform operator (super-admin)', () => {
  it('still requires the master secret for multi-centre visibility', () => {
    const previous = process.env.LICENSE_MASTER_SECRET
    process.env.LICENSE_MASTER_SECRET = 'operator-secret'
    try {
      assert.equal(assertMaster('operator-secret'), true)
      assert.equal(assertMaster('wrong'), false)
      assert.equal(assertMaster(undefined), false)
    } finally {
      if (previous === undefined) delete process.env.LICENSE_MASTER_SECRET
      else process.env.LICENSE_MASTER_SECRET = previous
    }
  })
})

describe('JWT after tenant suspension', () => {
  afterEach(() => {
    invalidateTenantStatus()
  })

  it('denies a still-valid JWT on protected APIs once the tenant is suspended', async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret'
    seedTenantStatusCache('tn_a', 'active')

    const token = signToken(USER_A)
    const payload = jwt.decode(token) as jwt.JwtPayload
    assert.ok(payload.exp && payload.iat)
    assert.equal(payload.exp - payload.iat, 12 * 60 * 60)

    const authed = {
      headers: { authorization: `Bearer ${token}` },
    } as Request
    const loginRes = mockRes()
    let loginNext = false
    requireAuth(authed, loginRes, (() => {
      loginNext = true
    }) as NextFunction)
    assert.equal(loginNext, true)
    assert.equal(authed.user?.tenantId, 'tn_a')

    const activeRes = mockRes()
    let activeNext = false
    await requireActiveTenant(authed, activeRes, (() => {
      activeNext = true
    }) as NextFunction)
    assert.equal(activeNext, true)

    seedTenantStatusCache('tn_a', 'suspended')

    const reused = {
      headers: { authorization: `Bearer ${token}` },
    } as Request
    const jwtRes = mockRes()
    let jwtNext = false
    requireAuth(reused, jwtRes, (() => {
      jwtNext = true
    }) as NextFunction)
    assert.equal(jwtNext, true, 'JWT remains cryptographically valid within 12h')

    const deniedRes = mockRes()
    let protectedNext = false
    await requireActiveTenant(reused, deniedRes, (() => {
      protectedNext = true
    }) as NextFunction)
    assert.equal(protectedNext, false)
    assert.equal(deniedRes.statusCode, 403)
    assert.equal((deniedRes.body as { code?: string }).code, 'SUSPENDED')
  })

  it('still allows protected APIs for an active tenant with a valid JWT', async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret'
    seedTenantStatusCache('tn_a', 'active')
    const token = signToken(USER_A)
    const req = { headers: { authorization: `Bearer ${token}` } } as Request
    requireAuth(req, mockRes(), (() => undefined) as NextFunction)
    const res = mockRes()
    let nextCalled = false
    await requireActiveTenant(req, res, (() => {
      nextCalled = true
    }) as NextFunction)
    assert.equal(nextCalled, true)
    assert.equal(res.statusCode, 200)
  })
})
