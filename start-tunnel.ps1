# HOOHR - public access via a Cloudflare Tunnel (Windows).
# Launched by start-tunnel.bat. Opens the app to the internet so other people
# can actually use it; right now it is reachable only on this machine.
#
# The one thing that makes this more than a port forward: it writes the public
# address into APP_URL and restarts the app so the new value takes effect.
# APP_URL is what invite emails and notification links are built from
# (src/app/actions/auth.ts, src/lib/notifications.ts), so leaving it at
# http://localhost:3000 means every link you email points at the recipient's
# own machine. That failure is silent, so this script does not skip it.

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

# Compose writes progress to stderr, and under ErrorActionPreference=Stop a
# `2>&1` on a native command turns each of those lines into a terminating error.
$ErrorActionPreference = "Continue"

$envPath = Join-Path $root ".env"
$LogFile = Join-Path $root "logs\tunnel.log"
New-Item -ItemType Directory -Force -Path (Join-Path $root "logs") | Out-Null

function Say  ([string]$m)             { Write-Host $m }
function Step ([string]$n, [string]$m) { Write-Host ""; Write-Host ("[{0}] {1}" -f $n, $m) -ForegroundColor Cyan }
function Warn ([string]$m)             { Write-Host $m -ForegroundColor Yellow }
function Die  ([string]$m)             { Write-Host ""; Write-Host ("X " + $m) -ForegroundColor Red; Write-Host ""; exit 1 }
function Record([string]$m) {
  Add-Content -LiteralPath $LogFile -Value ((Get-Date -Format "HH:mm:ss") + " " + $m) -Encoding UTF8
}

function Read-EnvValue([string]$key) {
  if (-not (Test-Path -LiteralPath $envPath)) { return $null }
  $line = [System.IO.File]::ReadAllLines($envPath, [System.Text.Encoding]::UTF8) |
          Where-Object { $_ -match ("^" + [regex]::Escape($key) + "=") } |
          Select-Object -First 1
  if (-not $line) { return $null }
  return ($line -split "=", 2)[1].Trim().Trim('"').Trim("'")
}

# Rewrites a key in place, or appends it. Written with an explicit UTF-8 BOM to
# match the encoding the rest of the tooling expects for .env.
function Set-EnvValue([string]$key, [string]$value) {
  $enc    = New-Object System.Text.UTF8Encoding $true
  $lines  = [System.Collections.ArrayList]@(
             [System.IO.File]::ReadAllLines($envPath, [System.Text.Encoding]::UTF8))
  $quoted = '"' + $value + '"'
  $hit = $false
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match ("^\s*" + [regex]::Escape($key) + "=")) {
      $lines[$i] = "$key=$quoted"
      $hit = $true
      break
    }
  }
  if (-not $hit) { [void]$lines.Add("$key=$quoted") }
  [System.IO.File]::WriteAllLines($envPath, $lines, $enc)
  return $hit
}

# ---------------------------------------------------------------------------
Step "1/4" "설정 확인"

if (-not (Test-Path -LiteralPath $envPath)) {
  Die ".env 가 없습니다. start.bat 을 먼저 실행해 주세요."
}

$mode = Read-EnvValue "TUNNEL_MODE"
if (-not $mode) {
  Say "    터널 방식을 선택해 주세요:"
  Say "      1) 빠른 터널  - 무료, 계정/도메인 불필요. 지금 바로 공유할 때."
  Say "                      단, 주소를 다시 켤 때마다 바뀝니다."
  Say "      2) 고정 주소    - 주소가 변하지 않음. Cloudflare 계정 + 도메인 + TUNNEL_TOKEN 필요."
  $choice = Read-Host "    선택 (1 또는 2)"
  $mode = if ($choice -eq "2") { "named" } else { "quick" }
  [void](Set-EnvValue "TUNNEL_MODE" $mode)
  Say ("    선택됨: " + $mode)
}

if ($mode -ne "quick" -and $mode -ne "named") {
  Die ("알 수 없는 TUNNEL_MODE: '" + $mode + "'. quick 또는 named 여야 합니다.")
}

if ($mode -eq "named") {
  $token = Read-EnvValue "TUNNEL_TOKEN"
  if (-not $token) {
    Die "고정 주소 모드에는 TUNNEL_TOKEN 이 필요합니다.`n   Cloudflare 대시보드에서 터널을 만들고 'Install and run a connector' 명령의`n   --token 뒤 값을 .env 의 TUNNEL_TOKEN 에 넣은 뒤 다시 실행해 주세요."
  }
  $publicUrl = (Read-EnvValue "APP_URL")
  if (-not $publicUrl -or $publicUrl -match "localhost") {
    Die "고정 주소 모드에서는 .env 의 APP_URL 이 실제 공개 주소여야 합니다.`n   지금 값: " + $publicUrl + "`n   예: APP_URL=`"https://hr.example.com`""
  }
}

# ---------------------------------------------------------------------------
Step "2/4" "터널 컨테이너 시작"

$service = if ($mode -eq "quick") { "tunnel-quick" } else { "tunnel-named" }

# Stop whichever tunnel is running first. Both services share the container
# name hoohr_tunnel, so switching modes without this would fail on a name clash
# with a confusing error.
& docker rm -f hoohr_tunnel 2>&1 | Out-Null

Say ("    (" + $service + " 실행 중...)")
& docker compose --profile tunnel up -d $service 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
  Die ("터널을 시작하지 못했습니다. 상세 로그: " + $LogFile)
}

# ---------------------------------------------------------------------------
Step "3/4" "공개 주소 확인"

$publicUrl = $null

if ($mode -eq "named") {
  # Already known - it came from APP_URL. Give the connector a moment to attach.
  $waited = 0
  while ($waited -lt 90) {
    Start-Sleep -Seconds 3
    $waited += 3
    $logs = (& docker compose --profile tunnel logs $service --tail 30 2>&1) -join "`n"
    if ($logs -match "Registered tunnel connection") { break }
    Write-Host ("    ... 연결 대기 중 ({0}초)" -f $waited) -ForegroundColor DarkGray
  }
  if ($waited -ge 90 -and -not ($logs -match "Registered tunnel connection")) {
    Die "터널이 90초 안에 Cloudflare에 연결되지 않았습니다. TUNNEL_TOKEN 과 DNS 설정을 확인해 주세요."
  }
  Say ("    연결됨 (" + $waited + "초)")
} else {
  # A quick tunnel's hostname is assigned by Cloudflare and only appears in the
  # logs, so it has to be scraped rather than configured.
  $waited = 0
  while ($waited -lt 120 -and -not $publicUrl) {
    Start-Sleep -Seconds 3
    $waited += 3
    $logs = (& docker compose --profile tunnel logs $service --tail 60 2>&1) -join "`n"
    $m = [regex]::Match($logs, "https://[a-z0-9-]+\.trycloudflare\.com")
    if ($m.Success) { $publicUrl = $m.Value }
    else { Write-Host ("    ... 주소 배정 대기 중 ({0}초)" -f $waited) -ForegroundColor DarkGray }
  }
  if (-not $publicUrl) {
    Die "120초 안에 공개 주소를 받지 못했습니다.`n   상세 로그: " + $LogFile + "`n   인터넷 연결과 Docker를 확인해 주세요."
  }
  Say ("    주소 배정 완료 ({0}초)" -f $waited)
  Record ("  quick tunnel url: " + $publicUrl)
}

# ---------------------------------------------------------------------------
Step "4/4" "앱에 공개 주소 적용"

$prev = Read-EnvValue "APP_URL"
if ($prev -ne $publicUrl) {
  [void](Set-EnvValue "APP_URL" $publicUrl)
  Say ("    APP_URL 갱신: " + $prev + "  ->  " + $publicUrl)
  # An environment change only reaches a container when it is recreated, so the
  # app is deliberately brought back up here. Without this the links stay wrong
  # until the next full start.
  & docker compose up -d app 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { Die "앱 재시작에 실패했습니다." }
  Say "    앱을 새 설정으로 재시작했습니다."
} else {
  Say "    APP_URL 이 이미 올바릅니다 (변경 없음)."
}

# Verify through the tunnel, not locally. Checking http://localhost here would
# pass even if the tunnel were broken, which is the whole thing being tested.
Say "    공개 주소를 통해 확인 중..."
$probe = (& curl.exe -s -o NUL -w "%{http_code}" --max-time 20 "$publicUrl/api/health" 2>$null | Select-Object -First 1)
if ($probe -eq "200") {
  Say "    정상 (HTTP 200)" -ForegroundColor Green
} else {
  Warn ("    HTTP " + $probe + " - 아직 준비되지 않았을 수 있습니다. 10초 뒤에 직접 열어보세요.")
}

$line = "=" * 58
Say ""
Say $line -ForegroundColor Green
Say "  HOOHR 가 인터넷에 공개되었습니다." -ForegroundColor Green
Say $line -ForegroundColor Green
Say ("  공개 주소 : " + $publicUrl)
Say ""
if ($mode -eq "quick") {
  Say "  [중요] 이 주소는 터널을 다시 켤 때마다 바뀝니다." -ForegroundColor Yellow
  Say "          이메일 등에 넣을 주소가 필요하면 고정 주소 모드로 바꾸세요." -ForegroundColor Yellow
} else {
  Say "  이 주소는 고정되어 있습니다. 초대 링크에 그대로 사용하세요." -ForegroundColor Green
}
Say ""
Say "  초대 링크와 알림 링크는 위 주소로 생성됩니다 (APP_URL)." -ForegroundColor DarkGray
Say "  로그 실시간 보기 : start-logs.bat"
Say "  공개 닫기         : docker rm -f hoohr_tunnel"
Say ""
Say $line -ForegroundColor Green

Record ("public: " + $publicUrl)
Write-Host ""
$null = Read-Host "Enter 를 누르면 이 창이 닫힙니다 (터널은 계속 실행됩니다)"
