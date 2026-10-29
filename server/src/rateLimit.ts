import crypto from 'node:crypto'
import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit'
import type { Request } from 'express'

/**
 * In-memory limits are per Node process. A second instance, a restart, or a
 * fleet does not share counters. This does not stop distributed guessing.
 *
 * trust proxy stays off. X-Forwarded-For and X-Real-IP are not rate-limit
 * identities: Railway's peer addresses are not a stable allowlist, and the
 * Vercel rewrite sits in front of that edge. A shared visitor-IP bucket would
 * let one login streak throttle every centre, so login is keyed by username.
 */
export const RATE_LIMIT_MESSAGE = {
  error: 'Too many attempts. Please try again in 15 minutes.',
}

const WINDOW_MS = 15 * 60 * 1000

function limiter(max: number, keyGenerator: (req: Request) => string): RateLimitRequestHandler {
  return rateLimit({
    windowMs: WINDOW_MS,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: RATE_LIMIT_MESSAGE,
    keyGenerator,
    validate: { xForwardedForHeader: false },
  })
}

export function loginRateKey(username: unknown): string {
  const value = String(username ?? '').trim().toLowerCase()
  if (!value) return 'login:missing-username'
  return `login:${value.slice(0, 200)}`
}

export function forgotRateKey(username: unknown): string {
  const value = String(username ?? '').trim().toLowerCase()
  if (!value) return 'forgot:missing-username'
  return `forgot:${value.slice(0, 200)}`
}

/** One bucket per process. Forwarding headers are ignored. */
export function sharedRateKey(bucket: string): string {
  return `shared:${bucket}`
}

export function bearerRateKey(authorization: unknown): string {
  const value = String(authorization ?? '').trim()
  if (!/^bearer\s+\S{16,}/i.test(value)) return 'session:missing-bearer'
  return `session:${crypto.createHash('sha256').update(value).digest('hex')}`
}

export function resetTokenRateKey(token: unknown): string {
  const value = String(token ?? '').trim()
  if (value.length < 16) return 'reset:missing-token'
  return `reset:${crypto.createHash('sha256').update(value).digest('hex')}`
}

/**
 * Test hook for a future verified proxy. Production callers pass an empty
 * allowlist, so a header value cannot select a bucket.
 */
export function trustedPeerKey(
  peer: string,
  allowlist: readonly string[],
  assertedClient: string | undefined,
): string {
  const normalizedPeer = peer.trim()
  const asserted = assertedClient?.trim()
  if (normalizedPeer && allowlist.includes(normalizedPeer) && asserted) {
    return `trusted:${asserted}`
  }
  return `peer:${normalizedPeer || 'unknown'}`
}

function usernameFrom(req: Request): unknown {
  const body = req.body
  if (body && typeof body === 'object' && 'username' in body) {
    return (body as { username?: unknown }).username
  }
  return undefined
}

function tokenFrom(req: Request): unknown {
  const body = req.body
  if (body && typeof body === 'object' && 'token' in body) {
    return (body as { token?: unknown }).token
  }
  return undefined
}

export function createLoginLimiter(max = 30): RateLimitRequestHandler {
  return limiter(max, (req) => loginRateKey(usernameFrom(req)))
}

export function createForgotLimiter(max = 8): RateLimitRequestHandler {
  return limiter(max, (req) => forgotRateKey(usernameFrom(req)))
}

export function createSharedLimiter(bucket: string, max: number): RateLimitRequestHandler {
  return limiter(max, () => sharedRateKey(bucket))
}

export function createBearerLimiter(max = 30): RateLimitRequestHandler {
  return limiter(max, (req) => bearerRateKey(req.headers.authorization))
}

export function createResetLimiter(max = 30): RateLimitRequestHandler {
  return limiter(max, (req) => resetTokenRateKey(tokenFrom(req)))
}

export const loginLimiter = createLoginLimiter()
export const forgotLimiter = createForgotLimiter()
export const registerLimiter = createSharedLimiter('register', 30)
export const issuedLimiter = createSharedLimiter('license-issued', 10)
export const issueLimiter = createSharedLimiter('license-issue', 40)
export const adminLimiter = createSharedLimiter('admin-master', 40)
export const changePasswordLimiter = createBearerLimiter()
export const verifyPasswordLimiter = createBearerLimiter()
export const resetPasswordLimiter = createResetLimiter()

export function createActivateLimiter(max = 40): RateLimitRequestHandler {
  return limiter(max, (req) => {
    const userId = req.user?.userId
    if (!userId) return 'activate:missing-user'
    return `activate:${userId}`
  })
}

export const activateLimiter = createActivateLimiter()
