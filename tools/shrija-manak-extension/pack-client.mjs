/**
 * Builds a portable client folder + ZIP for Shrija Manak Chrome extension.
 * Usage: node tools/shrija-manak-extension/pack-client.mjs
 * Does not modify automation source — only copies runtime files.
 */
import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, copyFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = __dirname
const repoRoot = join(__dirname, '..', '..')
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'))
const version = String(manifest.version || '0.0.0')
const packageName = `Shrija-Manak-Extension-v${version}`
const outRoot = join(repoRoot, 'dist', 'manak-extension-client')
const outDir = join(outRoot, packageName)
const extDir = join(outDir, 'extension')
const zipPath = join(outRoot, `${packageName}.zip`)

const RUNTIME_FILES = [
  'manifest.json',
  'background.js',
  'content-shrija.js',
  'content-manak.js',
  'manak-fill-lib.js',
  'main-world-bypass.js',
  'popup.html',
  'popup.js',
  'license.js',
]

function writeClientInstallTxt(dest) {
  const text = `Shrija CG & Cornet (Manak Fill) — Client Setup
Version: ${version}

========================================
INSTALL (Chrome / Edge) — 2 minute
========================================

1) Pehle ye ZIP extract karo (folder mat delete karna).
2) "INSTALL.bat" double-click karo.
   - Extension copy ho jayegi:
     %LOCALAPPDATA%\\Shrija\\Manak-Extension
   - Chrome Extensions page khul jayegi.
3) Extensions page pe:
   - Upar right "Developer mode" ON karo
   - "Load unpacked" dabao
   - Folder select karo:
     %LOCALAPPDATA%\\Shrija\\Manak-Extension
4) Extension list me version ${version} dikhna chahiye.
5) Toolbar pe Shrija icon pin karo.

Manual (bina INSTALL.bat):
- chrome://extensions  OR  edge://extensions
- Developer mode ON → Load unpacked → is package ka "extension" folder select karo.

========================================
LICENSE
========================================
1) Extension icon click karo
2) License key enter karo (Shrija se milegi)
3) Activate dabao
4) Delete fill tab unlock ho jayega

========================================
USE
========================================
1) Shrija software me Create Sheet
2) Manak assay / sampling page kholo
3) Lot select karo — AUTO fill chalega
4) Delete chahiye to popup se Job + Lot → Delete portal fill

========================================
UPDATE / REINSTALL
========================================
1) Naya ZIP extract karo
2) Phir se INSTALL.bat chalao (purani copy overwrite)
3) chrome://extensions pe extension card → Reload
4) Version ${version} (ya naya version) check karo

Folder mat move/delete karo jab tak extension Chrome me loaded hai.
Agar Load unpacked fail ho: folder path short rakho, OneDrive sync wale path se avoid karo.

Support: Shrija team
`
  writeFileSync(dest, text, 'utf8')
}

function writeInstallBat(dest) {
  const bat = `@echo off
setlocal EnableExtensions
title Shrija Manak Extension Setup
cd /d "%~dp0"

set "SRC=%~dp0extension"
set "DEST=%LOCALAPPDATA%\\Shrija\\Manak-Extension"

if not exist "%SRC%\\manifest.json" (
  echo [ERROR] extension folder nahi mila. ZIP sahi extract kiya?
  pause
  exit /b 1
)

echo.
echo === Shrija Manak Extension v${version} ===
echo Source : %SRC%
echo Install: %DEST%
echo.

if not exist "%LOCALAPPDATA%\\Shrija" mkdir "%LOCALAPPDATA%\\Shrija"
if exist "%DEST%" rd /s /q "%DEST%"
mkdir "%DEST%"
xcopy "%SRC%\\*" "%DEST%\\" /E /I /Y /Q >nul
if errorlevel 1 (
  echo [ERROR] Copy fail.
  pause
  exit /b 1
)

echo [OK] Extension copy ho gayi.
echo.
echo Ab browser me:
echo   1. Developer mode ON
echo   2. Load unpacked
echo   3. Select folder:
echo      %DEST%
echo.

where chrome >nul 2>&1
if %errorlevel%==0 (
  start "" chrome "chrome://extensions"
) else (
  if exist "%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe" (
    start "" "%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe" "chrome://extensions"
  ) else if exist "%LocalAppData%\\Google\\Chrome\\Application\\chrome.exe" (
    start "" "%LocalAppData%\\Google\\Chrome\\Application\\chrome.exe" "chrome://extensions"
  ) else if exist "%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe" (
    start "" "%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe" "edge://extensions"
  ) else (
    echo Browser auto-open nahi hua. Manual: chrome://extensions
  )
)

echo Path clipboard pe copy ho raha hai...
echo %DEST%| clip >nul 2>&1
echo Folder path clipboard me hai — Load unpacked pe Ctrl+V.
echo.
pause
`
  writeFileSync(dest, bat, 'utf8')
}

function writeInstallPs1(dest) {
  const lines = [
    `# Shrija Manak Extension client installer v${version}`,
    "$ErrorActionPreference = 'Stop'",
    "$src = Join-Path $PSScriptRoot 'extension'",
    "$dest = Join-Path $env:LOCALAPPDATA 'Shrija\\Manak-Extension'",
    "if (-not (Test-Path (Join-Path $src 'manifest.json'))) {",
    "  throw 'extension/manifest.json missing — extract ZIP correctly.'",
    '}',
    'New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null',
    'if (Test-Path $dest) { Remove-Item -Recurse -Force $dest }',
    'Copy-Item -Recurse -Force $src $dest',
    'Write-Host "[OK] Installed to $dest"',
    'Set-Clipboard -Value $dest',
    '$chrome = @(',
    '  "$env:ProgramFiles\\Google\\Chrome\\Application\\chrome.exe",',
    '  "$env:LocalAppData\\Google\\Chrome\\Application\\chrome.exe"',
    ') | Where-Object { Test-Path $_ } | Select-Object -First 1',
    'if ($chrome) {',
    "  Start-Process $chrome 'chrome://extensions'",
    '} else {',
    '  $pf86 = ${env:ProgramFiles(x86)}',
    "  $edge = Join-Path $pf86 'Microsoft\\Edge\\Application\\msedge.exe'",
    "  if (Test-Path $edge) { Start-Process $edge 'edge://extensions' }",
    '}',
    "Write-Host 'Developer mode ON → Load unpacked → paste folder path (clipboard).'",
    '',
  ]
  writeFileSync(dest, lines.join('\n'), 'utf8')
}

function zipWithPowerShell(folder, zip) {
  if (existsSync(zip)) rmSync(zip, { force: true })
  const folderEsc = folder.replace(/'/g, "''")
  const zipEsc = zip.replace(/'/g, "''")
  execFileSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      `Compress-Archive -LiteralPath '${folderEsc}' -DestinationPath '${zipEsc}' -Force`,
    ],
    { stdio: 'inherit' },
  )
}

rmSync(outDir, { recursive: true, force: true })
mkdirSync(extDir, { recursive: true })

for (const file of RUNTIME_FILES) {
  const from = join(root, file)
  if (!existsSync(from)) throw new Error(`Missing runtime file: ${file}`)
  copyFileSync(from, join(extDir, file))
}

writeClientInstallTxt(join(outDir, 'INSTALL.txt'))
writeInstallBat(join(outDir, 'INSTALL.bat'))
writeInstallPs1(join(outDir, 'INSTALL.ps1'))
writeFileSync(
  join(outDir, 'VERSION.txt'),
  `Shrija Manak Extension\nversion=${version}\nbuilt=${new Date().toISOString()}\n`,
  'utf8',
)

zipWithPowerShell(outDir, zipPath)

console.log('')
console.log('Client package ready:')
console.log(`  Folder: ${outDir}`)
console.log(`  ZIP:    ${zipPath}`)
console.log('')
console.log('Client ko sirf ZIP do. License key alag se bhejo.')
