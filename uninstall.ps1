# HOOHR 삭제: 컨테이너를 끄고 모든 데이터를 지웁니다.
#
# - `docker compose down -v` = 컨테이너 + DB 볼륨 + 업로드 볼륨 삭제.
# - 이미지(hr-app-app)는 남겨둡니다. 다음 start.bat이 다시 빌드 없이
#   바로 뜨도록. 디스크까지 비우려면 `docker rmi hr-app-app`을 별도로.
# - 이 파일은 UTF-8 with BOM으로 저장되어야 합니다 (start.ps1과 동일).

$ErrorActionPreference = "Stop"

function Say([string]$m) { Write-Host "  $m" }
function Die([string]$m) {
  Write-Host ""
  Write-Host "  실패: $m" -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "  HOOHR 삭제" -ForegroundColor Yellow
Write-Host ""

try {
  docker info --format "{{.ServerVersion}}" 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) { Die "Docker Desktop이 꺼져 있습니다. 켜고 다시 실행하세요." }
} catch {
  Die "Docker Desktop이 꺼져 있습니다. 켜고 다시 실행하세요."
}

Say "지워지는 것:"
Say "  - 앱/DB 컨테이너 (hr-app-app-1, hr-app-db-1)"
Say "  - DB 데이터 전체 (직원, 휴가, 영수증 기록)"
Say "  - 올린 영수증 사진 파일"
Say "남는 것:"
Say "  - 앱 이미지 (다음 시작이 빠릅니다)"
Say ""
$ans = Read-Host "  정말 지울까요? (y/N)"
if ($ans -ne "y" -and $ans -ne "Y") {
  Say "취소했습니다. 아무것도 지우지 않았습니다."
  exit 0
}

Write-Host ""
Say "끄는 중..."
docker compose down -v
if ($LASTEXITCODE -ne 0) { Die "docker compose down -v 실패." }

Write-Host ""
Write-Host "  삭제 완료." -ForegroundColor Green
Say "다시 시작하려면 start.bat을 더블클릭하세요 (처음 화면부터 나옵니다)."
