"""근태 주간 요약 DAG.

Postgres(app DB)에서 지난 주 근태 기록을 읽어 '근태 주간 요약' 결과를
같은 DB의 요약 테이블(analytics.attendance_weekly_summary)에 기록한다.

Airflow 2.x (docker compose) 기준 표준 코드. 환경변수:
- DATABASE_URL: 앱과 동일한 연결 문자열
"""

from datetime import datetime, timedelta

from airflow import DAG
from airflow.models import Variable
from airflow.operators.python import PythonOperator

try:
    import psycopg2
except ImportError:  # pragma: no cover - 로컬 린트용 가드
    psycopg2 = None

SCHEDULE_INTERVAL = Variable.get("attendance_weekly_schedule", default_var="0 6 * * 1")

CREATE_SUMMARY_SQL = """
CREATE TABLE IF NOT EXISTS analytics.attendance_weekly_summary (
    week_start   DATE NOT NULL,
    employee_id  TEXT NOT NULL,
    work_days    INT  NOT NULL,
    avg_check_in  TIME,
    PRIMARY KEY (week_start, employee_id)
);
"""

QUERY_SQL = """
INSERT INTO analytics.attendance_weekly_summary (week_start, employee_id, work_days, avg_check_in)
SELECT
    %(week_start)s::date,
    a."employeeId",
    COUNT(*) FILTER (WHERE a."checkInAt" IS NOT NULL)::int,
    MIN(a."checkInAt"::time)
FROM "AttendanceRecord" a
WHERE a.date >= %(week_start)s::date AND a.date < %(week_start)s::date + INTERVAL '7 days'
GROUP BY a."employeeId"
ON CONFLICT (week_start, employee_id) DO UPDATE SET
    work_days = EXCLUDED.work_days,
    avg_check_in = EXCLUDED.avg_check_in;
"""


def _run_summary(week_start: str) -> None:
    if psycopg2 is None:
        raise RuntimeError("psycopg2 미설치 — pipelines/requirements.txt 참고")
    conn = psycopg2.connect(Variable.get("DATABASE_URL", default_var="postgresql://hr:hr_dev_password@localhost:5432/hr_app"))
    try:
        with conn.cursor() as cur:
            cur.execute('CREATE SCHEMA IF NOT EXISTS analytics')
            cur.execute(CREATE_SUMMARY_SQL)
            cur.execute(QUERY_SQL, {"week_start": week_start})
        conn.commit()
    finally:
        conn.close()


def _last_monday(**_) -> str:
    today = datetime.utcnow().date()
    return (today - timedelta(days=today.weekday(), weeks=1)).isoformat()


with DAG(
    dag_id="attendance_weekly_summary",
    description="지난주 근태 주간 요약 생성",
    schedule=SCHEDULE_INTERVAL,
    start_date=datetime(2026, 1, 1),
    catchup=False,
    tags=["attendance"],
) as dag:
    PythonOperator(
        task_id="run_attendance_weekly_summary",
        python_callable=_run_summary,
        op_kwargs={"week_start": _last_monday()},
    )