/**
 * Bundle the sampling extractor for the extension. Not part of the Vite app build.
 * Run: node tools/shrija-sampling-import/build.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
const itemSource = fs.readFileSync(path.join(root, 'src/utils/itemCategoryMatch.ts'), 'utf8')
const coreSource = fs.readFileSync(path.join(root, 'src/samplingImport/samplingImportCore.ts'), 'utf8')

const item = itemSource.replace(/^export /gm, '')
const core = coreSource.replace(/^import\s+\{[^}]+\}\s+from\s+['"][^'"]+['"];?\s*$/m, '')
const merged = `${item}\n${core}\n`
const compiled = ts.transpileModule(merged, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
  },
  fileName: 'sampling-core.ts',
}).outputText

if (!compiled.includes('function extractSamplingDetails') || !compiled.includes('function matchSamplingImport')) {
  throw new Error('Sampling bundle is missing extract or match')
}
if (compiled.includes('128898569')) {
  throw new Error('Sampling bundle contains a fixture job number')
}

const confirmationSource = fs.readFileSync(path.join(root, 'src/samplingImport/importConfirmation.ts'), 'utf8')
const confirmation = ts.transpileModule(confirmationSource, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
  },
  fileName: 'importConfirmation.ts',
}).outputText
if (!confirmation.includes('function hashConfirmationPayload') || !confirmation.includes('function isPopupSender')) {
  throw new Error('Confirmation bundle is missing handshake exports')
}
if (confirmation.includes('128898569')) {
  throw new Error('Confirmation bundle contains a fixture job number')
}

const outDir = path.join(here, 'dist')
fs.mkdirSync(outDir, { recursive: true })
const outFile = path.join(outDir, 'sampling-core.js')
fs.writeFileSync(
  outFile,
  `/* Generated from src/samplingImport/samplingImportCore.ts. Do not edit. */\n${compiled}`,
)
const confirmationFile = path.join(outDir, 'confirmation.js')
fs.writeFileSync(
  confirmationFile,
  `/* Generated from src/samplingImport/importConfirmation.ts. Do not edit. */\n${confirmation}`,
)

const classicCore = compiled.replace(/^export /gm, '')
const listener = fs.readFileSync(path.join(here, 'content-manak.js'), 'utf8').replace(
  /^import\s+\{[^}]+\}\s+from\s+['"][^'"]+['"];?\s*/m,
  '',
)
if (listener.includes('import ')) {
  throw new Error('Manak content script still imports a module')
}
const manakFile = path.join(outDir, 'content-manak.js')
const manakBundle = `/* Generated classic content script. Do not edit. */\n;(() => {\n${classicCore}\n${listener}\n})()\n`
if (manakBundle.includes('128898569') || /^import /m.test(manakBundle)) {
  throw new Error('Manak content bundle is not a classic script')
}
fs.writeFileSync(manakFile, manakBundle)

const classicConfirmation = confirmation.replace(/^export /gm, '')
const popupSource = fs
  .readFileSync(path.join(here, 'popup.js'), 'utf8')
  .replace(/^import\s+\{[^}]+\}\s+from\s+['"][^'"]+['"];?\s*/gm, '')
if (/^import /m.test(popupSource)) {
  throw new Error('Popup source still imports a module')
}
const popupFile = path.join(outDir, 'popup.js')
const popupBundle = `/* Generated classic popup. Do not edit. */\n;(() => {\n${classicCore}\n${classicConfirmation}\n${popupSource}\n})()\n`
if (popupBundle.includes('128898569') || /^import /m.test(popupBundle)) {
  throw new Error('Popup bundle is not a classic script')
}
fs.writeFileSync(popupFile, popupBundle)

const backgroundSource = fs
  .readFileSync(path.join(here, 'background.js'), 'utf8')
  .replace(/^import\s+\{[^}]+\}\s+from\s+['"][^'"]+['"];?\s*/m, '')
if (/^import /m.test(backgroundSource)) {
  throw new Error('Background source still imports a module')
}
const backgroundFile = path.join(outDir, 'background.js')
const backgroundBundle = `/* Generated classic service worker. Do not edit. */\n;(() => {\n${classicConfirmation}\n${backgroundSource}\n})()\n`
if (backgroundBundle.includes('128898569') || /^import /m.test(backgroundBundle)) {
  throw new Error('Background bundle is not a classic script')
}
fs.writeFileSync(backgroundFile, backgroundBundle)

console.log(`Wrote ${outFile}`)
console.log(`Wrote ${confirmationFile}`)
console.log(`Wrote ${manakFile}`)
console.log(`Wrote ${popupFile}`)
console.log(`Wrote ${backgroundFile}`)
