import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

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
    },
    jwtSecret(),
    { expiresIn: '12h' },
  )
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }
  try {
    const payload = jwt.verify(header.slice(7), jwtSecret()) as jwt.JwtPayload
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
    }
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
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

/** Reject any client-supplied tenant_id that does not match the JWT */
export function enforceTenantBody(req: Request, res: Response, next: NextFunction) {
  const bodyTenant =
    (req.body && (req.body.tenantId || req.body.tenant_id)) ||
    req.query.tenantId ||
    req.query.tenant_id ||
    req.params.tenantId
  if (bodyTenant && req.user && String(bodyTenant) !== req.user.tenantId) {
    res.status(403).json({ error: 'tenant_id mismatch — cross-tenant access denied' })
    return
  }
  next()
}
