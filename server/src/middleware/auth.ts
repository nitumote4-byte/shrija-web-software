import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { getCachedTenantStatus } from '../tenantStatus.js'
import {
  collectClientCentreOverride,
  collectClientTenantOverride,
  isCrossTenantOverride,
  stripClientTenantOverrides,
} from '../tenantIsolation.js'

function jwtSecret() {
  const secret = process.env.JWT_SECRET
  if (secret) return secret
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production')
  }
  return 'shrija-dev-secret-change-in-production'
}

export type AuthUser = {
  userId: string
  tenantId: string
  username: string
  role: string
  isAdmin: boolean
  tenantName: string
  centreId?: string
  centreKind?: 'main' | 'osc'
  centreName?: string
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

export function signToken(user: AuthUser): string {
  return jwt.sign(
    {
      sub: user.userId,
      tenantId: user.tenantId,
      username: user.username,
      role: user.role,
      isAdmin: user.isAdmin,
      tenantName: user.tenantName,
      centreId: user.centreId || 'main',
      centreKind: user.centreKind || 'main',
      centreName: user.centreName || user.tenantName,
    },
    jwtSecret(),
    { algorithm: 'HS256', expiresIn: '12h' },
  )
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }
  try {
    const payload = jwt.verify(header.slice(7), jwtSecret(), {
      algorithms: ['HS256'],
    }) as jwt.JwtPayload
    const tenantId = payload.tenantId as string | undefined
    if (!tenantId || !payload.sub) {
      res.status(401).json({ error: 'Invalid token: missing tenant' })
      return
    }
    req.user = {
      userId: String(payload.sub),
      tenantId,
      username: String(payload.username || ''),
      role: String(payload.role || ''),
      isAdmin: Boolean(payload.isAdmin),
      tenantName: String(payload.tenantName || ''),
      centreId: String(payload.centreId || 'main'),
      centreKind: payload.centreKind === 'osc' ? 'osc' : 'main',
      centreName: String(payload.centreName || payload.tenantName || ''),
    }
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

export function requireCentreAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.isAdmin) {
    res.status(403).json({ error: 'Admin access required' })
    return
  }
  next()
}

/**
 * After requireAuth — deny access when the JWT tenant has been suspended.
 * Does not change JWT lifetime. Active centres still pass, including those
 * with an expired licence (they can still call licence activation).
 */
export async function requireActiveTenant(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.tenantId) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }
  try {
    const status = await getCachedTenantStatus(req.user.tenantId)
    if (!status) {
      res.status(404).json({ error: 'Centre not found', code: 'MISSING' })
      return
    }
    if (status !== 'active') {
      res.status(403).json({ error: 'This centre is suspended', code: 'SUSPENDED' })
      return
    }
    next()
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Access check failed' })
  }
}

/** After requireAuth — block API if centre licence expired */
export async function requireValidLicense(req: Request, res: Response, next: NextFunction) {
  try {
    const { getTenantLicense } = await import('../license.js')
    const license = await getTenantLicense(req.user!.tenantId)
    if (!license) {
      res.status(404).json({ error: 'Centre not found', code: 'MISSING' })
      return
    }
    if (!license.ok) {
      res.status(403).json({
        error: license.reason || 'Licence expired',
        code: license.code || 'EXPIRED',
        license,
      })
      return
    }
    next()
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Licence check failed' })
  }
}

/**
 * Reject client-supplied tenant/centre identifiers that do not match the JWT.
 * Matching or extra keys are stripped so handlers cannot accidentally use them.
 */
export function enforceTenantBody(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  const parts = { body: req.body, query: req.query, params: req.params }
  const clientTenant = collectClientTenantOverride(parts)
  if (isCrossTenantOverride(req.user.tenantId, clientTenant)) {
    res.status(403).json({ error: 'tenant_id mismatch — cross-tenant access denied' })
    return
  }

  const clientCentre = collectClientCentreOverride(parts)
  const jwtCentre = req.user.centreId || 'main'
  if (clientCentre && req.user.centreKind === 'osc' && clientCentre !== jwtCentre) {
    res.status(403).json({ error: 'centre_id mismatch — cross-centre access denied' })
    return
  }

  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
    req.body = stripClientTenantOverrides(req.body as Record<string, unknown>)
  }

  next()
}

export function sessionCentre(user: AuthUser): { centreId: string; centreKind: 'main' | 'osc' } {
  return {
    centreId: user.centreId || 'main',
    centreKind: user.centreKind === 'osc' ? 'osc' : 'main',
  }
}
