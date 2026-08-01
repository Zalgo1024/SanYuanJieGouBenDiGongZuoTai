$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$controllerPath = Join-Path $repoRoot "scripts\local-workbench.ps1"
if (-not (Test-Path -LiteralPath $controllerPath -PathType Leaf)) {
    throw "runtime controller is missing"
}

$content = Get-Content -LiteralPath $controllerPath -Raw -Encoding utf8
$requiredPatterns = @(
    'ValidateSet\("start", "stop", "status"\)',
    'runtime-lib\.ps1',
    'Get-NetTCPConnection',
    'Get-CimInstance Win32_Process',
    'Stop-Process',
    '127\.0\.0\.1',
    '/health',
    'next\\dist\\bin\\next',
    '"start"',
    '\.runtime',
    'backend\.log',
    'frontend\.log',
    '--app-dir',
    'ENGINE_DIR',
    '\.env\.local',
    'Get-FrontendAction',
    'Test-ServiceCommand',
    '\.next-staging',
    '\.next-previous',
    'Restore-FrontendBuild',
    'Restarting previous frontend after build switch failure',
    'tsconfigSnapshot',
    'startedBackend',
    'startedFrontend',
    'ConvertTo-Json',
    'Start-Process.*http://127\.0\.0\.1:3000'
)

foreach ($pattern in $requiredPatterns) {
    if ($content -notmatch $pattern) {
        throw "controller contract missing pattern: $pattern"
    }
}

Write-Host "runtime-controller static tests passed"
