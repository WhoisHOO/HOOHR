# HOOHR - one-click start (Windows).
# Safe to run repeatedly: the image is cached, so a second run is seconds.
# Needs nothing beyond PowerShell 5.1, which ships with Windows 10/11.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

# Console output as UTF-8 so the Korean below is not mangled by the OEM
# codepage. (The .ps1 itself is saved as UTF-8 *with* a BOM, which is what
# makes PowerShell 5.1 read it correctly - a BOM-less UTF-8 file is decoded as
# ANSI and every Korean character turns to mojibake.)
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$LogDir  = Join-Path $root "logs"
$LogFile = Join-Path $LogDir  "start.log"
$Utf8Bom = New-Object System.Text.UTF8Encoding $true

function Say  ([string]$m)             { Write-Host $m }
function Step ([string]$n, [string]$m) { Write-Host ""; Write-Host ("[{0}] {1}" -f $n, $m) -ForegroundColor Cyan }
function Warn ([string]$m)             { Write-Host $m -ForegroundColor Yellow }
function Die  ([string]$m)             { Write-Host ""; Write-Host ("X " + $m) -ForegroundColor Red; Write-Host ""; exit 1 }
function Record([string]$m) {
  Add-Content -LiteralPath $LogFile -Value ((Get-Date -Format "HH:mm:ss") + " " + $m) -Encoding UTF8
}

# Runs a native command with stderr merged into stdout, immune to
# $ErrorActionPreference="Stop".
#
# This is not a style preference. Docker writes ordinary build progress to
# stderr, and with ErrorActionPreference=Stop, `2>&1` turns each of those lines
# into a terminating ErrorRecord - so the very first `docker compose up` killed
# the script mid-build. The exit code is the real signal, and it is returned
# alongside the output.
function Invoke-Native([scriptblock]$Block) {
  $prev = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $out  = & $Block 2>&1 | ForEach-Object { $_.ToString() }
    $code = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $prev
  }
  return [pscustomobject]@{ Output = @($out); ExitCode = $code }
}

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
Record "=== start.ps1 invoked ==="

# ---------------------------------------------------------------------------
Step "1/5" "Docker 확인"

# `docker info` is the only honest readiness signal: the CLI can be on PATH
# while the engine is still booting.
function Test-DockerReady {
  return (Invoke-Native { docker info --format "{{.ServerVersion}}" }).ExitCode -eq 0
}

if (-not (Test-DockerReady)) {
  Warn "Docker가 실행되고 있지 않습니다. Docker Desktop을 시작합니다..."
  $exe = @(
    "$Env:ProgramFiles\Docker\Docker\Docker Desktop.exe",
    "${Env:ProgramFiles(x86)}\Docker\Docker\Docker Desktop.exe",
    "$Env:LOCALAPPDATA\Docker\Docker Desktop.exe"
  ) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1

  if (-not $exe) {
    Die "Docker Desktop을 찾을 수 없습니다.`n   https://www.docker.com/products/docker-desktop/ 에서 설치한 뒤 다시 실행해 주세요."
  }
  Start-Process -FilePath $exe | Out-Null

  $waited = 0
  while ($waited -lt 300 -and -not (Test-DockerReady)) {
    Start-Sleep -Seconds 5
    $waited += 5
    Write-Host ("    ... 대기 중 {0}초" -f $waited) -ForegroundColor DarkGray
  }
  if (-not (Test-DockerReady)) {
    Die "Docker가 5분 안에 준비되지 않았습니다. Docker Desktop을 직접 실행해 주세요."
  }
  Say ("    Docker 준비 완료 ({0}초 대기)" -f $waited)
}
$dockerVersion = (Invoke-Native { docker info --format "{{.ServerVersion}}" }).Output | Select-Object -First 1
Say ("    Docker 준비됨 (engine " + $dockerVersion + ")")

# ---------------------------------------------------------------------------
Step "2/5" "설정 (국가, 실행 환경)"

$envPath = Join-Path $root ".env"

# Every setup question is two options. Not a free-text field, not a third
# choice: the whole point of the setup is that a non-developer can finish it
# without reading anything.
function Ask-Choice([string]$question, [string]$optionA, [string]$optionB) {
  while ($true) {
    Write-Host ""
    Write-Host ("  " + $question) -ForegroundColor White
    Write-Host ("    1) " + $optionA)
    Write-Host ("    2) " + $optionB)
    $answer = (Read-Host "    1 또는 2 를 입력").Trim()
    if ($answer -eq "1") { return "1" }
    if ($answer -eq "2") { return "2" }
    Warn "    1 또는 2 중 하나를 입력해 주세요."
  }
}

function New-RandomHex([int]$byteCount) {
  $bytes = New-Object byte[] $byteCount
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  $rng.GetBytes($bytes)
  -join ($bytes | ForEach-Object { $_.ToString("x2") })
}

function New-RandomPassword([int]$len) {
  # No 0/O/1/l/I: a password that cannot be misread when copied off the screen
  # is worth more than the few bits an extended alphabet would add.
  $alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  $limit = 256 - (256 % $alphabet.Length)
  $sb = New-Object System.Text.StringBuilder
  for ($i = 0; $i -lt $len; $i++) {
    $b = New-Object byte[] 1
    do { $rng.GetBytes($b) } while ($b[0] -ge $limit)
    [void]$sb.Append($alphabet[$b[0] % $alphabet.Length])
  }
  $sb.ToString()
}

# Read with an explicit UTF-8 encoding. `Get-Content` would use the console's
# ANSI codepage and mangle the Korean, and `Get-Content -Raw` on a UTF-8 file
# has already cost this project one corrupted file.
function Read-EnvValue([string]$path, [string]$key) {
  if (-not (Test-Path -LiteralPath $path)) { return $null }
  $line = [System.IO.File]::ReadAllLines($path, [System.Text.Encoding]::UTF8) |
          Where-Object { $_ -match ("^" + [regex]::Escape($key) + "=") } |
          Select-Object -First 1
  if (-not $line) { return $null }
  return ($line -split "=", 2)[1].Trim().Trim('"').Trim("'")
}

$freshInstall = $false
if (Test-Path -LiteralPath $envPath) {
  $secret = Read-EnvValue $envPath "AUTH_SECRET"
  if (-not $secret) {
    Die ".env 가 불완전합니다 (AUTH_SECRET 가 비어 있음).`n   .env 파일을 지운 뒤 start.bat 을 다시 실행해 주세요."
  }
  $countryOut = Read-EnvValue $envPath "COMPANY_COUNTRY"
  $targetOut  = Read-EnvValue $envPath "RUNTIME_TARGET"
  if (-not $countryOut) { $countryOut = "KR" }
  if (-not $targetOut)  { $targetOut = "personal" }
  Say "    기존 .env 를 사용합니다. 비밀번호와 설정은 그대로 유지됩니다."
} else {
  $freshInstall = $true
  $secret = New-RandomHex 32

  # Q1. The country decides the currency, the timezone and the language.
  if ((Ask-Choice "어느 국가로 사용하시겠습니까?" "대한민국" "미국") -eq "1") {
    $country = "KR"
  } else {
    $country = "US"
  }

  # Q2. Where it runs. "server" gets a public https address in step 5.
  if ((Ask-Choice "이 컴퓨터에서만 쓰시겠습니까, 서버에 올리시겠습니까?" "개인 컴퓨터" "서버") -eq "1") {
    $target = "personal"
  } else {
    $target = "server"
  }

  $template = [System.IO.File]::ReadAllText((Join-Path $root ".env.example"), [System.Text.Encoding]::UTF8)
  # The template's comments explain the optional SMTP block, so they are kept;
  # only the blank secrets and the two answers get real values.
  $written = "# HOOHR - start.bat 이 자동 생성했습니다. 수정 후 다시 실행하면 이 값들이 유지됩니다.`r`n" +
    $template.Replace('AUTH_SECRET=""',                    ('AUTH_SECRET="' + $secret + '"')).
            Replace('COMPANY_COUNTRY="KR"',                ('COMPANY_COUNTRY="' + $country + '"')).
            Replace('RUNTIME_TARGET="personal"',          ('RUNTIME_TARGET="' + $target + '"'))
  [System.IO.File]::WriteAllText($envPath, $written, $Utf8Bom)
  $countryOut = $country
  $targetOut  = $target
  Say ("    새 .env 를 만들었습니다 (국가 " + $country + ", " + $target + " / 시크릿 자동 생성).")
}

$adminEmailOut = Read-EnvValue $envPath "BOOTSTRAP_ADMIN_EMAIL"
$appPortOut    = Read-EnvValue $envPath "APP_PORT"
if (-not $appPortOut) { $appPortOut = "3000" }

# ---------------------------------------------------------------------------
Step "3/5" "앱 빌드 및 실행 (최초 실행은 2~5분 걸립니다)"

$build = Invoke-Native { docker compose up -d --build }
$build.Output | ForEach-Object { Record ("  " + $_) }
if ($build.ExitCode -ne 0) {
  Write-Host ""
  $build.Output | Select-Object -Last 25 | ForEach-Object { Write-Host $_ -ForegroundColor DarkGray }
  Die "docker compose 실행에 실패했습니다.`n   원인은 start-logs.bat 창에서 볼 수 있습니다."
}

# ---------------------------------------------------------------------------
Step "4/5" "앱이 준비될 때까지 대기"

$url       = "http://localhost:" + $appPortOut
$healthUrl = $url + "/api/health"
$ready     = $false
$waited    = 0
$lastCode  = ""

while ($waited -lt 600) {
  Start-Sleep -Seconds 3
  $waited += 3

  # curl rather than Invoke-WebRequest: curl does not follow redirects unless
  # told to, so a 307 auth bounce can never be mistaken for "ready". (PS 5.1's
  # Invoke-WebRequest follows them, which is how a broken probe once reported
  # healthy off a /login page.)
  $lastCode = (& curl.exe -s -o NUL -w "%{http_code}" --max-time 5 $healthUrl 2>$null | Select-Object -First 1)

  if ($lastCode -eq "200") { $ready = $true; break }
  if ($lastCode -eq "503") {
    Write-Host ("    ... 데이터베이스 준비 중 ({0}초)" -f $waited) -ForegroundColor DarkGray
  } elseif ($lastCode -eq "307" -or $lastCode -eq "302") {
    Warn ("    앱이 /api/health 를 인증으로 막고 있습니다 (HTTP {0}). 이건 버그입니다." -f $lastCode)
  } else {
    Write-Host ("    ... 대기 중 (HTTP {1}, {0}초)" -f $waited, $lastCode) -ForegroundColor DarkGray
  }
  Record ("  waiting: http=" + $lastCode + " t=" + $waited + "s")
}

if (-not $ready) {
  Die ("10분 안에 앱이 준비되지 않았습니다 (마지막 HTTP 상태: {0}).`n   start-logs.bat 으로 원인을 확인해 주세요." -f $lastCode)
}
Say ("    준비 완료 ({0}초)" -f $waited)

# ---------------------------------------------------------------------------
# Q2 was "personal or server". A server is only a server if other people can
# reach it, so that answer is acted on here instead of being written to .env
# and then ignored - which is what this step used to do. The tunnel publishes
# the app, points APP_URL at it, and re-creates the app so that invite and
# notification links carry the public address.
$tunnelUrl = $null

if ($targetOut -eq "server") {
  Step "5/5" "공개 주소 열기 (서버 모드)"

  $tunnelScript = Join-Path $root "start-tunnel.ps1"
  if (-not (Test-Path -LiteralPath $tunnelScript)) {
    Die "start-tunnel.ps1 이 없습니다. 저장소가 온전하지 않은 것 같습니다."
  }
  Unblock-File -LiteralPath $tunnelScript -ErrorAction SilentlyContinue

  # -Mode is what keeps the install a two-question setup. Without it a fresh
  # server install would stop for a third question here, and the only answer
  # open to someone who has no Cloudflare account is "quick" anyway. A mode
  # already saved in .env is honoured, so switching to a named tunnel later
  # sticks.
  $tunnelMode = Read-EnvValue $envPath "TUNNEL_MODE"
  if (-not $tunnelMode) { $tunnelMode = "quick" }
  Say ("    터널 모드: " + $tunnelMode)

  # Deliberately not Invoke-Native. That helper captures the output, and this
  # takes up to two minutes of waiting for a hostname - the window would look
  # frozen the whole time. -NoNewWindow leaves the child on this console so its
  # progress appears as it happens, and -PassThru still gives the exit code.
  # -Quiet stops the child printing a summary banner, since the summary below is
  # this script's to print and two stacked banners read as two separate events.
  $tunnelArgs = '-NoProfile -ExecutionPolicy Bypass -File "' + $tunnelScript + '" -Mode ' + $tunnelMode + ' -NoPause -Quiet'
  $tunnelProc = Start-Process -FilePath "powershell" -ArgumentList $tunnelArgs -Wait -PassThru -NoNewWindow
  Record ("  tunnel exit=" + $tunnelProc.ExitCode + " mode=" + $tunnelMode)

  # The tunnel script leaves the address in APP_URL, which is also how the
  # standalone start-tunnel.bat path works. Re-reading it here keeps the two
  # entry points from having to agree on anything else. It also verified the
  # public address itself and reported the result in its exit code, so there is
  # no second probe here to wait on.
  $tunnelUrl = Read-EnvValue $envPath "APP_URL"
  if (-not $tunnelUrl -or $tunnelUrl -match "localhost") {
    $tunnelUrl = $null
    if ($tunnelProc.ExitCode -ne 0) {
      Warn "공개 주소를 만들지 못했습니다."
      Warn ("  이 컴퓨터에서는 http://localhost:" + $appPortOut + " 로 그대로 사용할 수 있습니다.")
      Warn ("  원인은 logs\tunnel.log 와 start-logs.bat 에서 보세요.")
    } else {
      Warn "공개 주소가 .env 에 반영되지 않았습니다. start-tunnel.bat 으로 다시 시도해 주세요."
    }
  } elseif ($tunnelProc.ExitCode -ne 0) {
    # The tunnel is up and APP_URL points at it, but the last check through the
    # public address did not come back clean. Still worth showing the address.
    Warn ("  공개 주소가 아직 응답하지 않습니다. 위 주소를 브라우저에서 새로고침해 보세요.")
  }
} else {
  Step "5/5" "브라우저 열기"
}

$openUrl = if ($tunnelUrl) { $tunnelUrl } else { $url }
Start-Process $openUrl | Out-Null

$line = "=" * 58
Say ""
Say $line -ForegroundColor Green
if ($freshInstall) { Say "  HOOHR 설치가 완료되었습니다." -ForegroundColor Green }
else               { Say "  HOOHR 가 실행 중입니다." -ForegroundColor Green }
Say $line -ForegroundColor Green
Say  ("  주소          : " + $url)
if ($tunnelUrl) {
  Say  ("  공개 주소     : " + $tunnelUrl) -ForegroundColor Green
  Say  "                  (다른 사람은 이 주소로 접속합니다)" -ForegroundColor DarkGray
  # Worth repeating here, since -Quiet suppressed the tunnel script's own copy
  # of this warning. A quick tunnel's hostname is new every run, so an address
  # pasted into an email stops working after the next restart.
  if ($tunnelMode -eq "quick") {
    Say  "  [중요] 이 주소는 start.bat 을 다시 켤 때마다 바뀝니다." -ForegroundColor Yellow
  }
}
Say  ("  국가          : " + $countryOut)
Say $line -ForegroundColor Green
if ($freshInstall) {
  Say "  첫 실행 화면에서 관리자 계정을 만들어 주세요." -ForegroundColor DarkGray
}
Say ""
Say "  로그 실시간 보기 : start-logs.bat  더블클릭"
if ($tunnelUrl) {
  # `docker compose down` does not reliably reclaim the tunnel, because it
  # sits behind a profile and carries a fixed container name. Name it outright.
  Say "  공개 닫기         : docker rm -f hoohr_tunnel" -ForegroundColor DarkGray
}
Say "  정지하기         : docker compose down"
Say ""
Say $line -ForegroundColor Green

Record ("ready at " + $url + " as " + $adminEmailOut)
if ($tunnelUrl) { Record ("public at " + $tunnelUrl) }

Write-Host ""
$null = Read-Host "Enter 를 누르면 이 창이 닫힙니다 (앱은 계속 실행됩니다)"
