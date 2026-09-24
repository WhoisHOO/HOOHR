# deploy/ — 운영 배포 레이어

MVP 동안: Docker Compose(로컬/단일 서버)가 실제 실행 환경.
이 폴더는 **EKS(K8s) 전환**(결정 옵션 D, 2026-09-24)을 위한 구성이 올라갈 곳.

## 외부 접속 (직원이 원격에서 접근) — Cloudflare Tunnel

원격 지역 직원이 영수증 업로드/PTO 신청하려면 공개 HTTPS 링크가 필요하다.

### 임시 링크 (도메인 불필요, 지금 당장)
```bash
cloudflared tunnel --url http://localhost:3000
# → https://<random>.trycloudflare.com  (재시작하면 URL 변경)
```
- 무료·설치만 하면 즉시 사용. URL은 프로세스 재시작 시 바뀌므로 개발/테스트용.

### 고정 링크 (무료 서브도메인 or 자체 도메인)
1. **무료 서브도메인**: `is-a.dev`(GitHub PR로 신청), `eu.org`(심사 수일~수주) 등에서 `hr-app.<도메인>` 확보
2. Cloudflare에 해당 도메인 zone 추가 (서브도메인은 NS 위임)
3. named tunnel 생성 → DNS 레코드를 `CNAME <tunnel-id>.cfargotunnel.com`으로 연결
4. `APP_URL`을 고정 URL로 설정 (초대 링크·리다이렉트가 이 주소를 사용)
- 이렇게 하면 `https://hr-app.<도메인>` 영구 주소로 직원 접속 가능.

### 참고
- 브랜드 도메인 구매는 (~$10/년) 후순위 옵션. 저렴히 시작하려면 무료 서브도메인부터.
- 프로덕션 쿠키는 `secure`(HTTPS 전용) → 접속은 반드시 HTTPS(터널이 제공).

## 로드맵

| 단계 | 내용 | 상태 |
|---|---|---|
| 1 | Cloudflare Tunnel — 로컬 앱을 HTTPS 도메인으로 노출 | 🔄 MVP부터 active (퀵 터널 가동 중. 고정 도메인은 위 절차) |
| 2 | 앱+Postgres 컨테이너 EKS 배포 (Deployment/StatefulSet, Secret, Ingress) | ⬜ MVP 후 |
| 3 | Airflow + Spark 네임스페이스 배포 (Helm: apache-airflow, spark-on-k8s) | ⬜ MVP 후 |
| 4 | Terraform으로 EKS/VPC/RDS 프로비저닝 | ⬜ MVP 후 |

## 참고
- 개발 DB는 Docker Compose(루트 `docker-compose.yml`)로 유지.
- 파이프라인 원본 DB는 읽기 전용 접근(전용 계정)으로 분리 예정.
- 파일 저장은 추후 S3 연동 — `ReceiptFile`은 이미 스키마에 `storedPath`로 추상화됨.