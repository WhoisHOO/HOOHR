# 데이터 파이프라인 레이어 — Airflow + PySpark

HR 웹앱(Next.js + Postgres) 위에 얹는 데이터 분석 레이어.
**원칙: 앱 DB는 읽기 전용 원본.** 계산 결과는 별도 요약 테이블(`analytics.*`)에 기록한다.

## 구성

```
pipelines/
├── dags/
│   └── attendance_weekly_summary.py   → 근태 주간 요약 DAG (매주 월 06:00)
├── spark/
│   └── attendance_analysis.py         → PySpark 부서별 출근 패턴 분석 (스텁)
├── Dockerfile                          → Airflow 이미지
└── requirements.txt
```

## 로컬 실행 (Airflow)

Airflow 공식 docker-compose 기준 (공식 문서: `airflow standalone` 또는
https://airflow.apache.org/docs/apache-airflow/stable/docker/docker-compose.yaml):

```powershell
# 1) Airflow 스탠드얼론 (minimal 검증 전용)
docker run --rm -e AIRFLOW__CORE__LOAD_EXAMPLES=False `
  -v ${PWD}/dags:/opt/airflow/dags `
  -e DATABASE_URL="postgresql://hr:hr_dev_password@host.docker.internal:5432/hr_app" `
  -p 8080:8080 -d apache/airflow:2.10.5-python3.11 airflow standalone

# 2) DAG 목록 확인
docker exec -it <container> airflow dags list
```

> ⚠️ 앱 DB가 호스트에 있을 때 컨테이너에서는 `host.docker.internal` 사용.

## PySpark 실행 (로컬)

```powershell
python -m pip install -r requirements.txt
$env:DATABASE_URL="postgresql://hr:hr_dev_password@localhost:5432/hr_app"
python spark/attendance_analysis.py
```

## EKS 운영

`deploy/` 참조. Airflow/Spark는 별도 네임스페이스에 배포, 앱 Postgres(또는 RDS)만 읽기 접근.