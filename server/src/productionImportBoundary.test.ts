/**
 * Regression: Railway deploys only the server/ package as /app.
 * Runtime imports that climb into the monorepo frontend (../../../src/...)
 * resolve to /src/... on Railway and crash with ERR_MODULE_NOT_FOUND.
 */
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))

/** Imports that leave the server package toward the monorepo frontend tree. */
const FORBIDDEN_IMPORT =
  /from\s+['"](?:\.\.\/){2,}src\/|from\s+['"]\/src\/|import\s*\(\s*['"](?:\.\.\/){2,}src\//

function listTsFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) {
      out.push(...listTsFiles(full))
      continue
    }
    if (name.endsWith('.ts') && !name.endsWith('.d.ts')) out.push(full)
  }
  return out
}

describe('production import boundary', () => {
  it('server sources do not import monorepo frontend src paths', () => {
    const offenders: string[] = []
    for (const file of listTsFiles(root)) {
      const rel = path.relative(root, file).replace(/\\/g, '/')
      // This test file documents the forbidden pattern.
      if (rel === 'productionImportBoundary.test.ts') continue
      const src = readFileSync(file, 'utf8')
      if (FORBIDDEN_IMPORT.test(src)) offenders.push(rel)
    }
    assert.deepEqual(
      offenders,
      [],
      `Forbidden frontend runtime imports in:\n${offenders.join('\n')}`,
    )
  })

  it('data router module resolves inside the server package', async () => {
    const mod = await import(pathToFileURL(path.join(root, 'routes/data.ts')).href)
    assert.ok(mod.dataRouter, 'dataRouter export loads without ERR_MODULE_NOT_FOUND')
  })
})
