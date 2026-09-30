# HOOHR - live log window (Windows). Launched by start-logs.bat.
# Shows both containers' output live and appends everything to
# logs/hoohr.log, so a user who missed a message can still read it later.

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

# Same reason as in start.ps1: compose writes container output to stderr, and
# with ErrorActionPreference=Stop a `2>&1` on a native command turns every log
# line into a terminating error. This is a log viewer - it must never die
# because the thing it is watching wrote to stderr.
$ErrorActionPreference = "Continue"

$LogDir  = Join-Path $root "logs"
$LogFile = Join-Path $LogDir  "hoohr.log"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

function Say  ([string]$m)             { Write-Host $m }
function Step ([string]$n, [string]$m) { Write-Host ""; Write-Host ("[{0}] {1}" -f $n, $m) -ForegroundColor Cyan }
function Warn ([string]$m)             { Write-Host $m -ForegroundColor Yellow }
function Die  ([string]$m)             { Write-Host ""; Write-Host ("X " + $m) -ForegroundColor Red; Write-Host ""; exit 1 }

$line = "=" * 58
Say $line -ForegroundColor Cyan
Say "  HOOHR 로그" -ForegroundColor Cyan
Say $line -ForegroundColor Cyan

# ---------------------------------------------------------------------------
Step "1/3" "Docker 확인"

& docker info --format "{{.ServerVersion}}" 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
  Die "Docker가 실행되고 있지 않습니다. start.bat 을 먼저 실행해 주세요."
}

# ---------------------------------------------------------------------------
Step "2/3" "앱 상태 확인"

$services = & docker compose ps --format "{{.Service}} : {{.State}}" 2>&1
$services | ForEach-Object { Write-Host ("    " + $_) }
$appUp = @($services | Where-Object { $_ -match "^app\s*:\s*running" }).Count -gt 0
if (-not $appUp) {
  Warn "앱 컨테이너가 실행 중이 아닙니다. start.bat 을 먼저 실행해 주세요."
  Warn " nonetheless showing logs - Ctrl+C 로 나갈 수 있습니다."
}

$envPath = Join-Path $root ".env"
if (Test-Path -LiteralPath $envPath) {
  $lines = [System.IO.File]::ReadAllLines($envPath, [System.Text.Encoding]::UTF8)
  $port  = ($lines | Where-Object { $_ -match '^APP_PORT=' } | Select-Object -First 1)
  if (-not $port) { $port = "APP_PORT=3000" }
  $portNum = ($port -split "=", 2)[1].Trim().Trim('"')
  Say ("    앱 주소: http://localhost:" + $portNum)
}

# ---------------------------------------------------------------------------
Step "3/3" "실시간 로그 (중단하려면 Ctrl+C)"

Say ("    이 내용은 " + $LogFile + " 에도 저장됩니다.") -ForegroundColor DarkGray
Say ""

# Truncate each session so the file stays readable, but keep the previous one
# as hoohr.prev.log so nothing is silently destroyed.
if (Test-Path -LiteralPath $LogFile) {
  Move-Item -LiteralPath $LogFile -Destination (Join-Path $LogDir "hoohr.prev.log") -Force
}

# --timestamps gives a wall-clock time on every line; `2>&1` matters because
# compose writes container stderr (where Next.js logs go) to stderr.
& docker compose logs -f --timestamps --tail 200 2>&1 |
  ForEach-Object {
    $line = $_.ToString()
    Write-Host $line
    # Append in a try/catch: Ctrl+C during the pipeline raises here, and an
    # unhandled exception would print a red stack trace over the logs.
    try { Add-Content -LiteralPath $LogFile -Value $line -Encoding UTF8 } catch {}
  }
