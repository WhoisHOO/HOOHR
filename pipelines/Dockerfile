# Airflow 이미지 — pipelines 레이어 (Postgres provider 포함)
# 로컬 검증: docker compose -f pipelines/docker-compose.local.yml up
# EKS 운영: deploy/ 에서 동일 이미지 사용
FROM apache/airflow:2.10.5-python3.11

COPY --chown=airflow:root dags /opt/airflow/dags
COPY --chown=airflow:root requirements.txt /opt/airflow/requirements.txt

RUN pip install --no-cache-dir -r /opt/airflow/requirements.txt