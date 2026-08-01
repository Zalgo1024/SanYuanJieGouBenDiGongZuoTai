$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$entryPoints = @{
    "start.bat" = "-Action start"
    "stop.bat" = "-Action stop"
    "status.bat" = "-Action status"
}

foreach ($entry in $entryPoints.GetEnumerator()) {
    $path = Join-Path $repoRoot $entry.Key
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "$($entry.Key) is missing" }
    $content = Get-Content -LiteralPath $path -Raw -Encoding utf8
    if ($content -notmatch 'scripts\\local-workbench\.ps1') { throw "$($entry.Key) does not call the runtime controller" }
    if ($content -notmatch [regex]::Escape($entry.Value)) { throw "$($entry.Key) does not use $($entry.Value)" }
}

$package = Get-Content -LiteralPath (Join-Path $repoRoot "frontend\package.json") -Raw -Encoding utf8 | ConvertFrom-Json
if ($package.scripts.PSObject.Properties.Name -contains "dev:local") {
    throw "package.json still references the removed scripts/start-local.ps1"
}

$nextConfig = Get-Content -LiteralPath (Join-Path $repoRoot "frontend\next.config.ts") -Raw -Encoding utf8
if ($nextConfig -notmatch 'NEXT_DIST_DIR') {
    throw "next.config.ts does not support isolated staging builds"
}

Write-Host "runtime-entrypoint static tests passed"
