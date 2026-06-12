# Deploy Veckans Vader to Unraid.
#
# What it does:
#   1. Stops any local `node` process so PowerShell can clean files
#   2. Removes build artefacts so SCP doesn't ship hundreds of MB
#   3. SCPs the project (including dot-files) to the Unraid path
#   4. SSHs in, rebuilds the Docker image, restarts the container
#   5. Runs a few smoke tests against the live container
#
# Usage:
#   npm run deploy
#   pwsh scripts/deploy.ps1                # if you prefer a direct invocation
#   pwsh scripts/deploy.ps1 -SkipClean     # keep node_modules / .next
#   pwsh scripts/deploy.ps1 -SkipBuild     # only re-run container, no rebuild
#
# ASCII-only — Windows PowerShell 5.1 reads .ps1 files as ANSI by default
# and chokes on UTF-8 special characters (arrows / checkmarks). Keep
# everything in this script ASCII.

[CmdletBinding()]
param(
    [switch]$SkipClean,
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

# --- Edit these once for your environment -----------------------------------
$UnraidHost     = "root@192.168.0.6"
$RemotePath     = "/mnt/user/appdata/veckansvader"
$ContainerName  = "veckansvader"
$Network        = "authentik_network"
$HostPort       = "8090"
$ImageTag       = "veckansvader:latest"
# ----------------------------------------------------------------------------

$ProjectRoot = Split-Path -Parent $PSScriptRoot

function Step([string]$msg) {
    Write-Host ""
    Write-Host "==> $msg" -ForegroundColor Cyan
}

function Ok([string]$msg)     { Write-Host "    [ok]   $msg" -ForegroundColor Green }
function Warn([string]$msg)   { Write-Host "    [warn] $msg" -ForegroundColor Yellow }
function Failed([string]$msg) { Write-Host "    [FAIL] $msg" -ForegroundColor Red }

# Run an SSH command on Unraid; throw on non-zero exit.
function Invoke-Ssh([string]$cmd) {
    & ssh $UnraidHost $cmd
    if ($LASTEXITCODE -ne 0) {
        throw "Remote command failed (exit $LASTEXITCODE): $cmd"
    }
}

# --- 1. Kill local node processes that may be holding file locks ------------
Step "Stopping local node processes (release file locks)"
# Killing one node process can take its children with it, so by the time we
# loop to the next PID it's already gone. Suppress those "not found" errors.
Get-Process node -ErrorAction SilentlyContinue | ForEach-Object {
    $pidToKill = $_.Id
    try {
        Stop-Process -Id $pidToKill -Force -ErrorAction Stop
        Ok "killed node PID $pidToKill"
    } catch [Microsoft.PowerShell.Commands.ProcessCommandException] {
        # Process already exited (likely a child of one we just killed).
    }
}
Start-Sleep -Milliseconds 500

# --- 2. Clean local build artefacts -----------------------------------------
if (-not $SkipClean) {
    Step "Cleaning local build artefacts"
    $toRemove = @(
        "node_modules",
        ".next",
        "out",
        ".api-backup",
        ".vader-backup",
        "android/app/build",
        "android/.gradle",
        "android/build"
    )
    foreach ($p in $toRemove) {
        $full = Join-Path $ProjectRoot $p
        if (Test-Path $full) {
            Remove-Item -Recurse -Force $full
            Ok "removed $p"
        }
    }
    foreach ($f in @(".sitemap.ts.bak", ".robots.ts.bak")) {
        $full = Join-Path $ProjectRoot $f
        if (Test-Path $full) {
            Remove-Item -Force $full
            Ok "removed $f"
        }
    }
} else {
    Warn "skipping clean (SkipClean)"
}

# --- 3. SCP to Unraid -------------------------------------------------------
Step "SCP project -> ${UnraidHost}:${RemotePath}"
Push-Location $ProjectRoot
try {
    # `*` in PowerShell does not match dot-files, so we copy them in a
    # second pass below.
    & scp -r * "${UnraidHost}:${RemotePath}/"
    if ($LASTEXITCODE -ne 0) { throw "scp (main) failed (exit $LASTEXITCODE)" }
    Ok "main tree copied"

    $dotFiles = @(".dockerignore", ".gitignore") | Where-Object { Test-Path $_ }
    if ($dotFiles.Count -gt 0) {
        & scp @dotFiles "${UnraidHost}:${RemotePath}/"
        if ($LASTEXITCODE -ne 0) { throw "scp (dot-files) failed (exit $LASTEXITCODE)" }
        Ok "dot-files copied: $($dotFiles -join ', ')"
    }
} finally {
    Pop-Location
}

# --- 4. Build + run on Unraid -----------------------------------------------
Step "Stopping current container (if any)"
Invoke-Ssh "docker stop $ContainerName 2>/dev/null; docker rm $ContainerName 2>/dev/null; true"
Ok "stopped"

if (-not $SkipBuild) {
    Step "Building image on Unraid (3-5 min)"
    Invoke-Ssh "cd $RemotePath && docker build -t $ImageTag ."
    Ok "image built"
} else {
    Warn "skipping build (SkipBuild)"
}

Step "Starting container"
$runCmd = @"
docker run -d \
  --name $ContainerName \
  --restart unless-stopped \
  --network $Network \
  --dns 1.1.1.1 --dns 8.8.8.8 \
  -p ${HostPort}:3000 \
  -e NODE_ENV=production \
  -e VISITOR_DATA_DIR=/app/data \
  -v /mnt/user/appdata/veckansvader-data:/app/data \
  $ImageTag
"@
Invoke-Ssh $runCmd
Ok "container started"

# Give the Next.js server a moment to bind.
Start-Sleep -Seconds 3

# --- 5. Smoke tests ---------------------------------------------------------
Step "Smoke testing http://localhost:${HostPort}/"
$tests = @(
    "/api/estimate?place=Stockholm",
    "/vader/stockholm",
    "/vader",
    "/sitemap.xml",
    "/robots.txt"
)
$failed = @()
foreach ($t in $tests) {
    $code = & ssh $UnraidHost "curl -s -o /dev/null -w '%{http_code}' 'http://localhost:${HostPort}${t}'" 2>$null
    if ($code -match "^2\d\d$") {
        Ok "$t -> $code"
    } else {
        Failed "$t -> $code"
        $failed += $t
    }
}

# --- 6. Final report --------------------------------------------------------
Write-Host ""
if ($failed.Count -eq 0) {
    Write-Host "Deploy succeeded - all smoke tests passed." -ForegroundColor Green
    Write-Host "  Live: https://veckansvader.se" -ForegroundColor Gray
} else {
    Write-Host "Deploy completed but some smoke tests failed:" -ForegroundColor Yellow
    foreach ($t in $failed) { Write-Host "    - $t" -ForegroundColor Yellow }
    Write-Host "  Check container logs:" -ForegroundColor Yellow
    Write-Host "    ssh $UnraidHost docker logs $ContainerName" -ForegroundColor Gray
    exit 1
}
