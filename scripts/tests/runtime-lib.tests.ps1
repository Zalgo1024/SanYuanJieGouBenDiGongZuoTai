$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
. (Join-Path $repoRoot "scripts\runtime-lib.ps1")

function Assert-Equal {
    param($Actual, $Expected, [string]$Message)
    if ($Actual -ne $Expected) {
        throw "$Message (expected=$Expected, actual=$Actual)"
    }
}

function Assert-True {
    param([bool]$Actual, [string]$Message)
    if (-not $Actual) { throw $Message }
}

$workspace = "D:\Work\Triad Analysis"
Assert-True (Test-WorkspaceCommand -CommandLine 'node "D:\Work\Triad Analysis\frontend\node_modules\next\dist\bin\next" start' -WorkspaceRoot $workspace) "Workspace command should match its repository"
Assert-True (Test-WorkspaceCommand -CommandLine 'NODE "d:\work\triad analysis\frontend\server.js"' -WorkspaceRoot $workspace) "Workspace matching should be case-insensitive"
Assert-Equal (Test-WorkspaceCommand -CommandLine 'node "D:\Other\frontend\server.js"' -WorkspaceRoot $workspace) $false "Unrelated process must not match"
Assert-Equal (Test-WorkspaceCommand -CommandLine 'node "D:\Work\Triad Analysis-old\frontend\server.js"' -WorkspaceRoot $workspace) $false "A neighboring path with the same prefix must not match"

Assert-Equal (Get-PortDecision -ListenerPid 0 -CommandLine "" -WorkspaceRoot $workspace) "free" "Empty port should be free"
Assert-Equal (Get-PortDecision -ListenerPid 120 -CommandLine 'node "D:\Work\Triad Analysis\frontend\server.js"' -WorkspaceRoot $workspace) "reuse" "Owned listener should be reused"
Assert-Equal (Get-PortDecision -ListenerPid 121 -CommandLine 'node "D:\Other\server.js"' -WorkspaceRoot $workspace) "conflict" "Foreign listener should be rejected"

Assert-True (Test-ServiceCommand -ServiceName "frontend" -CommandLine 'node "D:\Work\Triad Analysis\frontend\node_modules\next\dist\bin\next" start "D:\Work\Triad Analysis\frontend" -p 3000' -WorkspaceRoot $workspace) "Next production command should be owned"
Assert-True (Test-ServiceCommand -ServiceName "frontend" -CommandLine 'node "D:\Work\Triad Analysis\frontend\node_modules\next\dist\bin\next" start -p 3000' -WorkspaceRoot $workspace) "Legacy launcher command from the same workspace should remain manageable"
Assert-Equal (Test-ServiceCommand -ServiceName "frontend" -CommandLine 'node "D:\Work\Triad Analysis\frontend\node_modules\next\dist\bin\next" start "D:\Other\frontend" -p 3000' -WorkspaceRoot $workspace) $false "Next command targeting another project directory must not be managed"
Assert-Equal (Test-ServiceCommand -ServiceName "frontend" -CommandLine 'node "D:\Work\Triad Analysis\frontend\node_modules\next\dist\bin\next" dev -p 3000' -WorkspaceRoot $workspace) $false "Next development command must not be managed"
Assert-Equal (Test-ServiceCommand -ServiceName "frontend" -CommandLine 'other.exe --log "D:\Work\Triad Analysis\frontend\log"' -WorkspaceRoot $workspace) $false "An unrelated command with a workspace argument must not be managed"
Assert-Equal (Test-ServiceCommand -ServiceName "frontend" -CommandLine 'node "D:\Other\next" start --note "D:\Work\Triad Analysis\frontend\node_modules\next\dist\bin\next"' -WorkspaceRoot $workspace) $false "The exact Next entry must be the executable argument"
Assert-True (Test-ServiceCommand -ServiceName "backend" -CommandLine 'python -m uvicorn app.main:app --app-dir "D:\Work\Triad Analysis\backend" --port 8000' -WorkspaceRoot $workspace) "Uvicorn command with the repository app-dir should be owned"
Assert-Equal (Test-ServiceCommand -ServiceName "backend" -CommandLine 'python "D:\Work\Triad Analysis\backend\tool.py" --port 8000' -WorkspaceRoot $workspace) $false "An unrelated Python command must not be managed"
Assert-Equal (Test-ServiceCommand -ServiceName "backend" -CommandLine 'python -m uvicorn app.main:app --app-dir "D:\Other\backend" --note "D:\Work\Triad Analysis\backend"' -WorkspaceRoot $workspace) $false "The app-dir value must be this repository backend"

Assert-Equal (Get-FrontendAction -ServiceStatus "stopped" -BuildFresh $false) "start" "Stopped frontend should start"
Assert-Equal (Get-FrontendAction -ServiceStatus "running" -BuildFresh $true) "reuse" "Fresh running frontend should be reused"
Assert-Equal (Get-FrontendAction -ServiceStatus "running" -BuildFresh $false) "restart" "Stale running frontend should restart"

$tempRoot = Join-Path $env:TEMP "triad-runtime-lib-$PID"
New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null
try {
    $buildId = Join-Path $tempRoot "BUILD_ID"
    $source = Join-Path $tempRoot "page.tsx"
    Set-Content -LiteralPath $source -Value "source" -Encoding utf8
    Start-Sleep -Milliseconds 50
    Set-Content -LiteralPath $buildId -Value "build" -Encoding utf8
    Assert-True (Test-FrontendBuildFresh -BuildIdPath $buildId -SourcePaths @($source)) "Newer build should be fresh"

    Start-Sleep -Milliseconds 50
    Set-Content -LiteralPath $source -Value "changed" -Encoding utf8
    Assert-Equal (Test-FrontendBuildFresh -BuildIdPath $buildId -SourcePaths @($source)) $false "Newer source should make the build stale"
    Assert-Equal (Test-FrontendBuildFresh -BuildIdPath (Join-Path $tempRoot "missing") -SourcePaths @($source)) $false "Missing build should be stale"
}
finally {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force
}

Write-Host "runtime-lib tests passed"
