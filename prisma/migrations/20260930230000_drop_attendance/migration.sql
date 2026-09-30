-- Attendance (출퇴근) is out of scope: the app is expenses and leave only.
--
-- Dropped in dependency order. AttendanceEvent and AttendanceCorrection both
-- reference AttendanceRecord with ON DELETE CASCADE, so the parent goes first
-- and Postgres takes the children with it; the two DROP TABLEs below are for
-- clarity and for the case where a table is already empty of dependents.
--
-- Data is intentionally not preserved: this is a development install, and any
-- rows here are the browser E2E's own check-in fixtures. The earlier
-- attendance_events and _init migrations are left in place so the migration
-- history still matches this schema.

DROP TABLE IF EXISTS "AttendanceEvent";
DROP TABLE IF EXISTS "AttendanceCorrection";
DROP TABLE IF EXISTS "AttendanceRecord";

DROP TYPE IF EXISTS "AttendanceEventKind";
DROP TYPE IF EXISTS "CorrectionStatus";

-- Two enum values that only attendance ever wrote. "ATTENDANCE_CORRECTION" was
-- never written by any code path; the two CORRECTION_* notification types were
-- likewise attendance-only.
--
-- PostgreSQL 16 has no `ALTER TYPE ... DROP VALUE` (it arrived in 17), so both
-- types are rebuilt and the column is moved across. The USING clause casts
-- through text; it cannot fail because the values being removed were only ever
-- written by attendance, and no attendance rows survive this migration.

CREATE TYPE "ApprovalTargetType_new" AS ENUM ('LEAVE', 'EXPENSE');
ALTER TABLE "Approval"
  ALTER COLUMN "targetType" TYPE "ApprovalTargetType_new"
  USING ("targetType"::text::"ApprovalTargetType_new");
DROP TYPE "ApprovalTargetType";
ALTER TYPE "ApprovalTargetType_new" RENAME TO "ApprovalTargetType";

CREATE TYPE "NotificationType_new" AS ENUM (
  'LEAVE_REQUEST', 'LEAVE_DECISION', 'EXPENSE_REQUEST', 'EXPENSE_DECISION', 'SYSTEM'
);
ALTER TABLE "Notification"
  ALTER COLUMN "type" TYPE "NotificationType_new"
  USING ("type"::text::"NotificationType_new");
DROP TYPE "NotificationType";
ALTER TYPE "NotificationType_new" RENAME TO "NotificationType";
