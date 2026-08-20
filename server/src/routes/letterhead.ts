import { Router } from 'express'
import { z } from 'zod'
import { nowIso, pool, uid } from '../db.js'
import {
  publicLetterheadView,
  letterheadScopeFromSession,
  resolveLetterhead,
  validateLetterheadUpload,
  type LetterheadRecord,
} from '../letterhead.js'
import { sessionCentre } from '../middleware/auth.js'

export const letterheadRouter = Router()

function asRecord(row: {
  id: string
  tenant_id: string
  centre_id: string
  file_name: string
  mime_type: string
  width: number
  height: number
  data_url: string
  created_at: Date | string
  updated_at: Date | string
}): LetterheadRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    centreId: row.centre_id,
    fileName: row.file_name,
    mimeType: row.mime_type,
    width: Number(row.width) || 0,
    height: Number(row.height) || 0,
    dataUrl: row.data_url,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  }
}

async function loadTenantLetterheads(tenantId: string): Promise<LetterheadRecord[]> {
  const { rows } = await pool.query(
    `SELECT id, tenant_id, centre_id, file_name, mime_type, width, height, data_url, created_at, updated_at
     FROM centre_letterheads WHERE tenant_id = $1`,
    [tenantId],
  )
  return (rows as Parameters<typeof asRecord>[0][]).map(asRecord)
}

letterheadRouter.get('/letterhead', async (req, res) => {
  const user = req.user!
  const scope = letterheadScopeFromSession(user)
  const records = await loadTenantLetterheads(scope.tenantId)
  const row = resolveLetterhead(records, scope.tenantId, scope.centreId)
  res.json({
    letterhead: publicLetterheadView(row),
    centreId: scope.centreId,
    centreKind: sessionCentre(user).centreKind,
    centreName: user.centreName || user.tenantName,
  })
})

const putSchema = z.object({
  dataUrl: z.string().min(1),
  mimeType: z.string().optional(),
  fileName: z.string().optional(),
  width: z.coerce.number().optional(),
  height: z.coerce.number().optional(),
})

letterheadRouter.put('/letterhead', async (req, res) => {
  const user = req.user!
  const scope = letterheadScopeFromSession(user)
  const parsed = putSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Letterhead image is required' })
    return
  }

  const valid = validateLetterheadUpload(parsed.data)
  if (!valid.ok) {
    res.status(400).json({ error: valid.error })
    return
  }

  const id = uid('lh')
  const updatedAt = nowIso()
  await pool.query(
    `INSERT INTO centre_letterheads
       (id, tenant_id, centre_id, file_name, mime_type, width, height, data_url, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
     ON CONFLICT (tenant_id, centre_id) DO UPDATE SET
       file_name = EXCLUDED.file_name,
       mime_type = EXCLUDED.mime_type,
       width = EXCLUDED.width,
       height = EXCLUDED.height,
       data_url = EXCLUDED.data_url,
       updated_at = EXCLUDED.updated_at
     RETURNING id`,
    [
      id,
      scope.tenantId,
      scope.centreId,
      valid.fileName,
      valid.mimeType,
      valid.width,
      valid.height,
      valid.dataUrl,
      updatedAt,
    ],
  )

  const records = await loadTenantLetterheads(scope.tenantId)
  const row = resolveLetterhead(records, scope.tenantId, scope.centreId)
  res.json({
    ok: true,
    letterhead: publicLetterheadView(row),
    centreId: scope.centreId,
    centreKind: sessionCentre(user).centreKind,
    centreName: user.centreName || user.tenantName,
  })
})

letterheadRouter.delete('/letterhead', async (req, res) => {
  const user = req.user!
  const scope = letterheadScopeFromSession(user)
  await pool.query(`DELETE FROM centre_letterheads WHERE tenant_id = $1 AND centre_id = $2`, [
    scope.tenantId,
    scope.centreId,
  ])
  res.json({
    ok: true,
    letterhead: null,
    centreId: scope.centreId,
    centreKind: sessionCentre(user).centreKind,
    centreName: user.centreName || user.tenantName,
  })
})
