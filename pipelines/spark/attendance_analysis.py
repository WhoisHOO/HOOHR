"""PySpark 근태 패턴 분석 잡 (스텁).

Postgres의 AttendanceRecord를 읽어 부서별 출근 패턴 집계를 계산한다.
MVP에서는 근태 주간 요약(DAG)과 함께 로컬 모드로 검증하고,
EKS 전환 시 클러스터 모드로 확장한다.

실행 예 (로컬):
    python pipelines/spark/attendance_analysis.py
"""

import os

from pyspark.sql import SparkSession
from pyspark.sql.functions import col, date_format, weekofyear

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://hr:hr_dev_password@localhost:5432/hr_app"
)
OUTPUT_TABLE = "analytics.attendance_pattern_by_dept"


def build_spark() -> SparkSession:
    return (
        SparkSession.builder.appName("attendance_pattern_by_dept")
        .config("spark.jars.packages", "org.postgresql:postgresql:42.7.4")
        .master("local[*]")
        .getOrCreate()
    )


def main() -> None:
    spark = build_spark()
    df = (
        spark.read.format("jdbc")
        .option("url", DATABASE_URL)
        .option("dbtable", '"AttendanceRecord"')
        .option("user", DATABASE_URL.split("//")[1].split(":")[0])
        .load()
        .withColumn("week", weekofyear(col("date")))
        .withColumn("year", date_format(col("date"), "yyyy"))
    )

    summary = df.groupBy("year", "week", "employeeId").count()
    summary.show(truncate=False)

    summary.write.format("jdbc").option("url", DATABASE_URL).option(
        "dbtable", OUTPUT_TABLE
    ).mode("overwrite").save()

    spark.stop()


if __name__ == "__main__":
    main()