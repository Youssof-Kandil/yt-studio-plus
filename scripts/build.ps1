# Packages the extension into dist/studio-plus-<version>.zip for the Chrome Web Store.
# Usage:  powershell -ExecutionPolicy Bypass -File scripts/build.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$manifest = Get-Content (Join-Path $root 'manifest.json') -Raw | ConvertFrom-Json
$version = $manifest.version

# Files that ship in the extension (everything else – docs, store art, scripts – stays out)
$include = @(
  'manifest.json', 'inject.js', 'background.js',
  'core.js', 'panel.js', 'templates.js', 'likes.js', 'compare.js', 'content.css',
  'icons/icon16.png', 'icons/icon32.png', 'icons/icon48.png', 'icons/icon128.png'
)

$dist = Join-Path $root 'dist'
New-Item -ItemType Directory -Force $dist | Out-Null
$zip = Join-Path $dist "studio-plus-$version.zip"
if (Test-Path $zip) { Remove-Item -Force $zip }

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::Open($zip, 'Create')
try {
  foreach ($rel in $include) {
    $src = Join-Path $root $rel
    if (-not (Test-Path $src)) { throw "Missing file: $rel" }
    # Forward slashes in entry names – the Web Store rejects backslash paths.
    [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $src, $rel.Replace('\', '/'), 'Optimal')
  }
} finally { $archive.Dispose() }
Write-Host "Built $zip"
