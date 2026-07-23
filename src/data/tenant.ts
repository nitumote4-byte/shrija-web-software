/**
 * Tenant helpers — registry lives on the server; client only mirrors session.
 */
import { api, type ApiSession } from '../api/client'
import { getSession } from './auth'
import { hydrateTenantData, tenantGet, tenantRemove, tenantSet } from './tenantCache'

export type Tenant = {
  id: string
  slug: string
  firmName: string
  gstin: string
  plan: 'demo' | 'trial' | 'standard' | string
  status: 'active' | 'suspended' | string
  createdAt: string
}

export function getActiveTenantId(): string | null {
  return getSession()?.tenantId ?? localStorage.getItem('shrija-active-tenant')
}

export function setActiveTenantId(id: string | null) {
  if (!id) localStorage.removeItem('shrija-active-tenant')
  else localStorage.setItem('shrija-active-tenant', id)
}

export function getActiveTenant(): Tenant | null {
  const session = getSession()
  if (!session) return null
  return {
    id: session.tenantId,
    slug: '',
    firmName: session.tenantName,
    gstin: '',
    plan: 'trial',
    status: 'active',
    createdAt: session.loggedInAt,
  }
}

/**
 * Legacy helper — KV is server-scoped by JWT; key is logical only.
 * Kept so existing pages that call scopeKey(...) still resolve a stable string
 * for in-memory maps; actual I/O must go through tenantGet/tenantSet or
 * localStorage adapters that use those.
 */
export function scopeKey(key: string): string {
  const tid = getActiveTenantId() || '__none__'
  const rest = key.startsWith('shrija-') ? key.slice('shrija-'.length) : key
  return `shrija-t:${tid}:${rest}`
}

export { tenantGet, tenantSet, tenantRemove }

export async function listTenants(): Promise<Tenant[]> {
  const result = await api<{ tenants: Tenant[] }>('/api/auth/tenants')
  return Array.isArray(result?.tenants) ? result.tenants : []
}

export type CreateTenantInput = {
  firmName: string
  gstin?: string
  adminUsername: string
  adminPassword: string
  adminRole?: string
}

export async function createTenant(
  input: CreateTenantInput,
): Promise<{ ok: true; tenant: Tenant; token: string; session: ApiSession } | { ok: false; error: string }> {
  try {
    const result = await api<{
      token: string
      session: ApiSession
      tenant: Tenant
    }>('/api/auth/register', {
      method: 'POST',
      json: input,
    })
    return { ok: true, tenant: result.tenant, token: result.token, session: result.session }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Failed to create centre' }
  }
}

/** No-op: migrations are server-side now */
export function ensureTenantMigration() {
  /* server owns schema */
}

export function emptyStorePayload() {
  return {
    parties: [],
    categories: [],
    jewelleryCategories: [],
    requests: [],
    roughSheets: [],
    pendingRough: [],
    invoices: [],
    funds: [],
    expenses: [],
    fireAssays: [],
    stock: [],
    touches: [],
    xray: [],
  }
}

export function updateTenantMeta(
  _id: string,
  patch: Partial<Pick<Tenant, 'firmName' | 'gstin' | 'status' | 'plan'>>,
) {
  // Firm name updates go through firm profile API
  if (patch.firmName) {
    void hydrateTenantData()
  }
}
