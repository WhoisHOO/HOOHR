# Requirements Specification — Employee Management Tool (working name: hr-app)

## 1. Project Overview

### 1.1. Background
- Lightweight employee management tool for startups/SMBs of ~20 people
- Remote employees access over the internet to record attendance, request leave, and file expense claims
- **Planned open-source release** (License: Apache-2.0 — free to resell/modify, includes patent/trademark clauses)
- Existing open-source HRMS (Frappe HRMS, etc.) are overkill for this scale → focus on "basic but essential" features only

### 1.2. Operating Environment
- Single server (starts as a dev laptop → can move to a VPS later)
- **Docker Compose** one-command deployment of app + Postgres
- External access: **Cloudflare Tunnel** (free, no static IP required)
- Target OS: Windows 11 (development) / Linux (potential production; irrelevant thanks to Docker)
- Browser-based access assumed (responsive UI; PWA planned as a later item)

### 1.3. Tech Stack (proposed)
| Layer | Technology | Reason |
|---|---|---|
| Web app | Next.js (App Router) + TypeScript | API + UI in a single project; same family as reference OSS (DutyDuke, open-expense) |
| DB | PostgreSQL + Prisma ORM | Easy schema migration management; stores receipt metadata |
| File storage | Local volume (→ abstracted behind an S3-compatible interface) | MVP stays simple for 20 people |
| Auth | Email + password, JWT session / invite links | Employee-invitation approach |
| Notifications | SMTP email (MVP) → in-app notifications later | |
| Data pipeline | **Apache Airflow + PySpark** (run on EKS) | Attendance-pattern analysis reports, etc. Confirmed (2026-09-24, option D all-in) |
| Deployment | Docker Compose (dev) → **AWS EKS (K8s)** (prod) + Cloudflare Tunnel | Confirmed (2026-09-24) |

## 2. User Roles

| Role | Description |
|---|---|
| **EMPLOYEE** | Manages only their own attendance, leave, and expenses |
| **MANAGER** | Approves requests for their team members; views team calendar |
| **ADMIN** | Invites employees, configures policies, confirms payments, views company-wide data |

Roles are simplified to 3 given the small scale. Single-level department/team hierarchy exists.

## 3. Functional Requirements

### 3.1. Employee / Organization Management
| ID | Requirement | Role | MVP |
|---|---|---|---|
| EMP-1 | Employee profile: name, email, department, position, hire date, contact | ADMIN | ✅ |
| EMP-2 | Invite employees (email link → set password) | ADMIN | ✅ |
| EMP-3 | Deactivate/reactivate employees (termination handling) | ADMIN | ✅ |
| EMP-4 | Manage department/position master data | ADMIN | ✅ |

### 3.2. Attendance
| ID | Requirement | Role | MVP |
|---|---|---|---|
| ATT-1 | Record check-in/check-out (browser button, server time) | EMPLOYEE | ✅ |
| ATT-2 | Multiple check-ins/outs per day (away/return, lunch, etc.) | EMPLOYEE | ✅ |
| ATT-3 | **Correction requests** for missing/erroneous records → manager approval | EMPLOYEE→Manager | ✅ |
| ATT-4 | View daily/monthly history (own; manager for team) | All | ✅ |
| ATT-5 | (Later) GPS/geofencing clock-in/out — location recorded only, not enforced | — | ❌ |

### 3.3. Leave / PTO
#### 3.3.1. Leave Types and Rules
| Type | Paid | Accrual rule (example) | Documentation required |
|---|---|---|---|
| Annual (PTO) | ✅ | *N* days/year from hire month, carry-over policy for unused | None |
| Sick leave | ✅ | *M* days/year, used with proof | Maybe (later) |
| Half-day / hourly leave | ✅ | Deducted from annual balance | None |
| Unpaid leave | ❌ | No policy | Approval required |

- Policy values (N, M, carry-over days) must be configurable by ADMIN
- Balance is **auto-calculated from accrual basis + manual adjustment** (for spreadsheet migration)

#### 3.3.2. Request/Approval Workflow
| ID | Requirement | MVP |
|---|---|---|
| LV-1 | Leave request: type, period, reason, half-day flag | ✅ |
| LV-2 | Show remaining balance in real time during request; block over-request | ✅ |
| LV-3 | Approve/reject (reason required on reject) → notify employee | ✅ |
| LV-4 | Approval chain: employee → manager (single step for 20-person scale; design for multi-step extension) | ✅ |
| LV-5 | Team calendar showing who is off | ✅ |
| LV-6 | Self-cancel allowed (only before approval) | ✅ |
| LV-7 | Bulk import of existing balances from file (CSV) | ✅ |

### 3.4. Expense Claims (Receipts)
| ID | Requirement | MVP |
|---|---|---|
| EXP-1 | Expense report: date, item, amount, category, description | ✅ |
| EXP-2 | **Attach receipt images/PDFs** (multiple) — shared use for claims and sick-leave proof | ✅ |
| EXP-3 | Categories: transport, meals, lodging, meeting, other + custom | ✅ |
| EXP-4 | Approval flow: employee submits → manager approves → ADMIN confirms payment (Paid) | ✅ |
| EXP-5 | Status display: Draft → Submitted → Approved → Paid / Rejected | ✅ |
| EXP-6 | CSV/PDF export (monthly reconciliation for accounting) | ✅ |
| EXP-7 | (Later) OCR auto-extraction of receipts (AI) — amount/date/vendor | ❌ |
| EXP-8 | (Later) Multi-currency support | ❌ |

### 3.5. Notifications
| ID | Requirement | MVP |
|---|---|---|
| NOT-1 | Email on leave/expense approval & rejection (SMTP) | ✅ |
| NOT-2 | Batched "pending approvals" email to manager | ✅ |
| NOT-3 | (Later) In-app notifications/push | ❌ |

### 3.6. Settings
| ID | Requirement | MVP |
|---|---|---|
| SET-1 | Company name, domain, timezone | ✅ |
| SET-2 | Leave policy (accrual days by type, carry-over) | ✅ |
| SET-3 | Holiday calendar registration | ✅ |
| SET-4 | Expense category management | ✅ |

## 4. Data Model Draft

```
Company (1) ─┬─ (N) Department ── (N) Employee ── (1) Position
             ├─ Holiday(list)
             └─ LeavePolicy (N) ── LeaveType ── (N) LeaveBalance (per Employee)

Employee (1) ── (N) AttendanceRecord      -- check_in/check_out, source(intro/auto)
Employee (1) ── (N) AttendanceCorrection  -- correction request, status
Employee (1) ── (N) LeaveRequest          -- leave_type, dates, status
LeaveRequest (1) ── (N) ApprovalStep      -- approver, status, comment, timestamp
Employee (1) ── (N) ExpenseReport         -- period, total, status
ExpenseReport (1) ── (N) ExpenseItem      -- category, date, amount, currency, desc
ExpenseItem (1) ── (N) ReceiptFile        -- s3_key, filename, mime, size
Employee (1) ── (N) Notification
```

- `AuditLog` table to keep a history of all changes (approval/payment timestamps, for operations & accounting)
- Statuses use enum constants rather than lookup tables

## 5. Permission Matrix (MVP)

| Feature | EMPLOYEE | MANAGER | ADMIN |
|---|---|---|---|
| Attendance records / correction requests | Own | Own + manage team | All |
| Leave request/cancel | Own | Own + approve team | All + policies |
| Balance view/adjustment | Own | View team | All + adjust |
| Expense submission | Own | Own + approve team | All + confirm payment |
| Team calendar | Team view | Entire team | All |
| Employee invite/profile | — | — | ✅ |
| Settings/holidays | — | — | ✅ |
| Report export | Own scope | Team scope | All |

## 6. Operational Requirements

| Item | Details |
|---|---|
| Deployment | Single command `docker compose up` |
| Data backup | Daily automatic: Postgres dump + receipt files → external storage (rclone, etc.) |
| Remote access | Cloudflare Tunnel → HTTPS domain |
| Monitoring | MVP: simple status page/health checks. Logs via Docker logs |
| Security | Secrets (e.g., S3 keys) as env vars, HTTPS enforced, password hashing (bcrypt) |
| Timezone | Store UTC, display in company-configured timezone |

## 7. MVP Scope vs. Later Phases

**MVP (v0.1):**
1. Auth + employee invites
2. Attendance check-in/out + correction approvals
3. Leave (annual/sick/half-day) request·approval·balance calculation
4. Expense claims + receipt attachments + approval + payment confirmation
5. Email notifications, team calendar, CSV export
6. Docker Compose deployment + Cloudflare Tunnel integration docs

**v0.2 onwards:**
- OCR (AI) receipt auto-extraction, PWA mobile, GPS clock-in/out
- Multi-step approvals, multi-currency, i18n (EN/KO), training/notice module

## 8. Open-Source Release Plan
- License: **Apache-2.0** (supports both internal company use and community distribution; explicit patent grant makes enterprise adoption safer)
- README documents a Docker one-click demo, screenshots, and setup guide
- Differentiators: modern stack (Next.js+TS) and "simplicity tuned for 20-person startups"
- Market positioning: one-person-maintainable scope — feature reduction/simplification is the strength

## 9. Open Issues / Decisions Needed
- [x] ~~Include Airflow/K8s/PySpark?~~ → **(D) all-in confirmed** (2026-09-24): EKS + Airflow + PySpark
- [ ] Exact leave-accrual rule (hire-date vs fiscal year basis, carry-over cap)
- [ ] Whether sick-leave proof (receipts) is mandatory and the sick-leave↔expense-claim linkage scenario
- [ ] Final project name/brand
- [ ] Default UI language (Korean-first → English i18n)

## 10. Data Pipeline (Airflow + PySpark on EKS)

### 10.1. Purpose
- Periodically collect & process attendance/expense data to produce **pattern-analysis reports** (e.g., overtime trends, per-department attendance patterns, expense category trends)
- Keep the pipeline schema future-compatible for Kafka/Hadoop (HDFS) adoption in later phases

### 10.2. Architecture Principles
| Item | Details |
|---|---|
| Source | Postgres (app DB) — read-only. Results written to separate summary tables (or report files) |
| Scheduling/workflow | Apache Airflow DAG |
| Processing engine | PySpark batch jobs (small data volume → validate in local mode for MVP, then move to cluster) |
| Operations | Airflow & Spark both deployed on EKS (K8s). Local dev runs the same images via Docker Compose |
| Trigger | DAG `schedule` (daily) + on-demand execution API from the web app (later) |

### 10.3. MVP Reports (late v0.1)
1. Weekly attendance summary (average check-in/out per person, absence detection)
2. Leave-usage aggregates (monthly usage by type)
3. Monthly expense statistics (totals by category)

### 10.4. Folder Layout
```
pipelines/
├── dags/            → Airflow DAG definitions
├── spark/           → PySpark jobs
├── Dockerfile       → Airflow image (with postgres provider)
└── README.md
```
- EKS manifests/Helm configured in `deploy/` (applied after MVP, separate docs)