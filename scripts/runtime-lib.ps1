Set-StrictMode -Version Latest

function Test-WorkspaceCommand {
    [CmdletBinding()]
    param(
        [AllowEmptyString()][string]$CommandLine,
        [Parameter(Mandatory = $true)][string]$WorkspaceRoot
    )

    if ([string]::IsNullOrWhiteSpace($CommandLine)) { return $false }
    $normalizedRoot = [System.IO.Path]::GetFullPath($WorkspaceRoot).TrimEnd('\', '/')
    $searchFrom = 0
    while ($searchFrom -lt $CommandLine.Length) {
        $matchAt = $CommandLine.IndexOf($normalizedRoot, $searchFrom, [System.StringComparison]::OrdinalIgnoreCase)
        if ($matchAt -lt 0) { return $false }
        $afterMatch = $matchAt + $normalizedRoot.Length
        if ($afterMatch -ge $CommandLine.Length) { return $true }
        $nextCharacter = $CommandLine[$afterMatch]
        if ($nextCharacter -eq '\' -or $nextCharacter -eq '/' -or $nextCharacter -eq '"' -or $nextCharacter -eq "'") {
            return $true
        }
        $searchFrom = $afterMatch
    }
    return $false
}

function Get-PortDecision {
    [CmdletBinding()]
    param(
        [int]$ListenerPid,
        [AllowEmptyString()][string]$CommandLine,
        [Parameter(Mandatory = $true)][string]$WorkspaceRoot
    )

    if ($ListenerPid -le 0) { return "free" }
    if (Test-WorkspaceCommand -CommandLine $CommandLine -WorkspaceRoot $WorkspaceRoot) { return "reuse" }
    return "conflict"
}

function Test-ServiceCommand {
    [CmdletBinding()]
    param(
        [ValidateSet("backend", "frontend")][string]$ServiceName,
        [AllowEmptyString()][string]$CommandLine,
        [Parameter(Mandatory = $true)][string]$WorkspaceRoot
    )

    if ($ServiceName -eq "frontend") {
        $nextEntry = [regex]::Escape((Join-Path $WorkspaceRoot "frontend\node_modules\next\dist\bin\next"))
        $nodeExecutable = '(?:"[^"]*node(?:\.exe)?"|[^\s"]*node(?:\.exe)?)'
        $nextPattern = '^\s*' + $nodeExecutable + '\s+["'']?' + $nextEntry + '["'']?\s+start(?:\s|$)'
        return [regex]::IsMatch($CommandLine, $nextPattern, 'IgnoreCase')
    }

    $isUvicorn = [regex]::IsMatch($CommandLine, '(?:^|\s)-m\s+uvicorn(?:\s|$)', 'IgnoreCase')
    $isApplication = [regex]::IsMatch($CommandLine, '(?:^|\s)app\.main:app(?:\s|$)', 'IgnoreCase')
    $backendDir = [regex]::Escape((Join-Path $WorkspaceRoot "backend"))
    $appDirPattern = '(?:^|\s)--app-dir(?:\s+|=)["'']?' + $backendDir + '["'']?(?=\s|$)'
    $hasExactAppDir = [regex]::IsMatch($CommandLine, $appDirPattern, 'IgnoreCase')
    return $isUvicorn -and $isApplication -and $hasExactAppDir
}

function Test-FrontendBuildFresh {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$BuildIdPath,
        [Parameter(Mandatory = $true)][string[]]$SourcePaths
    )

    if (-not (Test-Path -LiteralPath $BuildIdPath -PathType Leaf)) { return $false }
    $buildTime = (Get-Item -LiteralPath $BuildIdPath).LastWriteTimeUtc

    foreach ($sourcePath in $SourcePaths) {
        if (-not (Test-Path -LiteralPath $sourcePath)) { continue }
        $sourceItem = Get-Item -LiteralPath $sourcePath
        if (-not $sourceItem.PSIsContainer) {
            if ($sourceItem.LastWriteTimeUtc -gt $buildTime) { return $false }
            continue
        }

        $newerFile = Get-ChildItem -LiteralPath $sourcePath -File -Recurse -ErrorAction SilentlyContinue |
            Where-Object { $_.LastWriteTimeUtc -gt $buildTime } |
            Select-Object -First 1
        if ($null -ne $newerFile) { return $false }
    }

    return $true
}

function Get-FrontendAction {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$ServiceStatus,
        [Parameter(Mandatory = $true)][bool]$BuildFresh
    )

    if ($ServiceStatus -eq "stopped") { return "start" }
    if ($ServiceStatus -eq "running" -and $BuildFresh) { return "reuse" }
    if ($ServiceStatus -eq "running") { return "restart" }
    throw "Unsupported frontend service status: $ServiceStatus"
}
