# HR-APP Project Log (LOG.md)

> **Usage rules (important):**
> - Sessions are frequently interrupted. Therefore **one session = one section**: append a **new section** under `📜 Session Log`.
> - Never delete or overwrite existing sections. Preserve all records even if a session was cut short.
> - Starting a new session:
>   1. Open the `📜 Session Log` and read the latest `## Session N` to check the state.
>   2. Continue the work from there.
>   3. After finishing, append `## Session N+1: <title>` with the next number.
>   4. Only refresh the `📍 Current Status` summary at the top (past details stay in the session log).
> - Sessions are appended chronologically.
> - All written artifacts (docs, comments, commits, GitHub) are **English**. UI copy is Korean (i18n planned for v0.2).

---

## 📍 Current Status (as of 2026-09-28, end of Session 10)

**Progress: The whole MVP feature set is implemented — Auth + Attendance + Leave + Expense, employee/org admin, team-scoped approvals, expense CSV export, and the settings module with holiday-aware leave counting. Remaining MVP items: email notifications (NOT-1/2) and GitHub push (`gh auth login`).**

> **Session 6 note**: Session 5 ended five minutes before the Leave module files were produced. The DB logic round-trip (`_test-leave.ts`), lint/tsc, and GET checks were done in Session 6. Server-action E2E (browser) of leave forms remains, same as attendance.

| Step | Status |
|---|---|
| Dev environment setup (C:\apps, Node, uv, rg) | ✅ Done |
| UX research (open-source/paid HR tools) | ✅ Done → `docs/UX_RESEARCH.md` |
| Requirements definition | ✅ Done → `docs/REQUIREMENTS.md` |
| Next.js scaffolding | ✅ Done (Next 16.3.6, React 19, Tailwind v4, TS) |
| PostgreSQL + Docker Compose | ✅ Done (`hr_app_db` healthy) |
| Architecture decision ((D) all-in: EKS+Airflow+Spark) | ✅ Done |
| pipelines/ scaffolding (DAG + Spark) | 🔄 Dockerfile/README drafted; runtime validation pending |
| deploy/ scaffolding | 🔄 External access (tunnel) live. EKS config after MVP |
| Prisma + migration | ✅ Done |
| Seed (bootstrap admin) | ✅ Done (admin@example.com / Admin1234!) |
| lint + tsc | ✅ Done (re-verified Session 3) |
| Auth implementation | ✅ Done (login/logout/invite/accept-invite) |
| Auth verification | ✅ Done — browser login confirmed (2026-09-24). prisma/bcrypt/jose/DAL/guard all OK |
| External access (Cloudflare Tunnel) | 🔄 Quick tunnel live & shared (URL in Session 3 / commands below). **Stable URL requires a free domain** |
| License | ✅ Apache-2.0 (LICENSE + package.json, 2026-09-24 Session 4) |
| English docs/commits/GitHub | ✅ Done (Session 4) |
| Attendance module (check-in/out, corrections, team view) | ✅ Done (Session 5) |
| Leave module (request/approve/cancel, balances, CSV import) | ✅ Done (Session 6) |
| Expense module (reports/items/receipts, approve, pay) | ✅ Done (Session 7) |
| Expense CSV export (EXP-6) | ✅ Done (Session 8) |
| Employee & org admin (departments, profile, status, re-invite) | ✅ Done (Session 9) |
| Team-scoped approval inboxes (attendance/leave/expense) | ✅ Done (Session 9) |
| Settings module (company profile, policies, holidays, categories) | ✅ Done (Session 10) |
| Holiday-aware leave day counting | ✅ Done (Session 10) |
| Email notifications (NOT-1/2) | ⬜ Pending — needs SMTP config |
| Checkpoint commit (Session 5–9) | ✅ Commits local; **no git remote configured yet** |

> **Key notes:**
> - **No `git remote` is configured and `gh` is not logged in** — this is why `github.com/WhoisHOO` shows no hr-app repo. Everything is local commits only. Session 10 decided the repo name is **`hr-app`** and set up the public-repo push (see that section).
> - **500 "Connection closed." when POSTing server actions via curl/fetch is a known Next.js restriction** — not an app bug. Test real flows via browser.
> - Quick-tunnel URL persists only while the same `cloudflared` process is alive; restart/reboot generates a **new random URL**. Unrelated to dev-server restarts.
> - This PC's router DNS (192.168.1.254) fails to resolve some trycloudflare hostnames → verify via `--resolve` or 8.8.8.8. Other devices are fine.
> - **GET checks with a session cookie: use `curl.exe`, not `Invoke-WebRequest`** — PowerShell silently drops a manual `Cookie` header, which looks like a redirect loop to /login. Mint a cookie with `npx tsx _mint-cookie.ts [email]`.

> **Common commands (use at start of each session):**
> ```bash
> docker ps                                           # check DB healthy
> npm run dev                                         # dev server (localhost:3000)
> cloudflared tunnel --url http://localhost:3000      # restart tunnel (URL changes)
> npm run lint; npx tsc --noEmit                      # checks
> ```
> **⚠️ Quick-tunnel URL lifetime:** only while the same `cloudflared` process runs. Restart/reboot → new random URL (`https://<random>.trycloudflare.com`).
> Session 3 tunnel URL: `https://duration-flood-showcase-responses.trycloudflare.com` (kept while process is alive)
> **For a permanent URL:** free subdomain (is-a.dev / eu.org) → delegate nameservers to Cloudflare → named tunnel. See `deploy/README.md` "Stable link".

---

## 🎯 Project Definition

- **Lightweight HR toolkit for startups/SMBs (~20 people)** (open source, **License: Apache-2.0**)
- Features: attendance (check-in/out), leave (PTO/sick/half-day), expense claims with receipt upload, approval workflow
- Operation: single server (laptop → VPS later), external access via Cloudflare Tunnel
- Details: `docs/REQUIREMENTS.md`

## ⚙️ Confirmed Tech Stack

| Layer | Decision |
|---|---|
| Web app | **Next.js 16 (App Router) + TypeScript + Tailwind CSS v4** |
| DB | PostgreSQL + Prisma ORM |
| Auth | Email/password + invite links (jose session cookie + bcrypt) |
| Notifications | SMTP email (MVP) |
| Deployment | Docker Compose (app + Postgres) → Cloudflare Tunnel |
| Files | Receipt images on local volume (S3 interface abstraction planned) |

**Installed environment (C:\apps dev setup):** Node v24.19.0 LTS, npm 11, Python 3.14.6, uv 0.11.32, ripgrep 15.2.0, git 2.55.0 (Git Bash included), Docker Desktop, VS Code, GitHub CLI.

> ⚠️ If node/npm is not found in a new terminal, refresh PATH:
> `$env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")`

---

## 🔥 Open Decisions / Debates (important)

### 1. Include Airflow / Kubernetes / PySpark? ✅ Decided (2026-09-24)
- **User's final choice: (D) all-in — EKS + Airflow + Spark architecture**
- Earlier recommendation (A) was about complexity, but the user wants a "real data pipeline" design including data-engineering scalability
- Kafka/Hadoop will be introduced only when data volume justifies it (v0.2+); keep schema/DAG compatible
- See `docs/REQUIREMENTS.md` sections 1.3/6, and new section 10

### 2. Leave policy rules — partial
- **PTO 10 days/yr, Sick 5 days/yr** — ✅ decided by user (2026-09-24, Session 9), applied to seed + live DB (`leavePolicy.annualDays`, current-year `leaveBalance.grantedDays` → PTO 10 / SICK 5; PTO carry-over cap 5)
- **Still open**: accrual basis (hire-date vs calendar-year), carry-over mechanics beyond the cap value, sick-leave proof policy

### 3. Sick-leave vs expense linkage scenario
- "Claim expenses with receipts when on sick leave" — attach proof to leave request, or a separate expense claim? Needs separation

### 4. Project name/brand
- Working name: `hr-app` (folder + **GitHub repo name decided in Session 10**). Display/brand name still open — keep in mind that `README.md`/`package.json`/`LICENSE` use `hr-app`

### 5. OCR (receipt auto-extraction) in MVP?
- UX research ranks OCR as an "Expensify-class core" feature but MVP-later → deferred to v0.2

---

## 📁 Project Structure

```
C:\apps\projects\hr-app\
├── docs/
│   ├── REQUIREMENTS.md   → requirements spec (features/data model/roles/MVP)
│   └── UX_RESEARCH.md    → UX analysis of 9 tools (nav/workflow/10 patterns)
├── pipelines/            → Airflow + PySpark data pipeline (late v0.1)
├── deploy/               → EKS (K8s) deployment config, Cloudflare Tunnel integration
├── prisma/               → schema/migrations/seed
├── src/                  → Next.js App Router (auth/attendance/leave/expense pages)
│   └── app/actions/auth.ts  → login/logout/invite/accept-invite (server actions)
│   └── lib/              → prisma, session (jose), dal (session checks), auth-validation (zod)
├── docker-compose.yml    → app + Postgres (dev, local)
├── LICENSE               → Apache-2.0
└── .env                  → DB/AUTH_SECRET/bootstrap admin
```

## 💡 Dev Conventions
- Korean-first UI, i18n in v0.2
- Store times in UTC, display in company timezone
- Status pipelines: leave `requested→pending→approved/rejected`, expense `draft→submitted→approved→paid`
- Only deduct balance / mark paid at final status after approval
- Reference files: `AGENTS.md` (command guidance); `CLAUDE.md` already created

---

## 📜 Session Log

<!-- Add a new numbered session below for every new session. Never delete/edit existing sections. -->

### Session 1 (2026-09-24): Setup → Research → Requirements → Scaffolding → DB → Migration → Seed

> Consolidated summary of work completed before the log was restructured. (Sessions 2–3 continue from here.)

- **Dev setup**: created `C:\apps`. Installed Node LTS, rg, uv via winget. PowerShell execution policy RemoteSigned
- **Research**: analyzed Frappe HR, OpenHRApp, DutyDuke, Receipt Wrangler, open-expense, CogniClaim, BambooHR, Gusto, Rippling, Expensify, SAP Concur → `docs/UX_RESEARCH.md`
- **Requirements**: 3 modules (attendance/leave/expense) + 3 roles (employee/manager/admin), data-model draft, permission matrix, MVP scope → `docs/REQUIREMENTS.md`
- **Scaffolding**: `npx create-next-app` (src/, Tailwind, ESLint, TS) + git init
- **Architecture decision**: (D) all-in — EKS + Airflow + Spark (see "Open Decisions")
- **DB**: Docker Compose Postgres 16 container `hr_app_db` running
- **Pipeline draft**: custom DAG + Spark job written (Dockerfile/README pending)
- **Prisma**: schema + migration `20260924140414_init` applied, client at `src/generated/prisma`
- **Seed**: bootstrap admin admin@example.com / Admin1234!
- **Verification**: lint clean, tsc passes, dev HTTP 200
- **Issues**: Docker daemon down → recovered by relaunch. Fixed 2 polymorphic relation issues in Prisma. .env Korean comments → ASCII (mojibake)
- **Result**: session ended with "auth implementation pending"

### Session 2 (2026-09-24): Auth Implementation (Login + Invite + Accept Invite)

> ⚠️ Code for this session was **fully written**, but the session was cut off before the LOG.md record was saved.
> The record below was reconstructed and verified from the files.

- **Stack**: jose (JWT session cookie) + bcryptjs (password) + zod (form validation), Prisma 7 `@prisma/adapter-pg`
- **Login/logout** → `src/app/actions/auth.ts`
  - `login`: verify email/password → create session cookie → redirect /app. No account enumeration (same message)
  - `logout`: delete session → /login
- **Invite employees (ADMIN)** → `app/admin/invite/`
  - `inviteEmployee`: `randomBytes(32)` token, valid 7 days, Employee (INVITED) upsert. SMTP not configured, so **the invite link is shown on screen** (email sending in v0.2)
- **Accept invite** → `app/invite/[token]/`
  - `acceptInvitation`: expiry/duplicate checks → transaction (create User + Employee ACTIVE + Invitation.usedAt)
- **Session** → `src/lib/session.ts`: `session` cookie (7 days, httpOnly, sameSite=lax), AUTH_SECRET required
- **DAL** → `src/lib/dal.ts`: getSession (cached)/verifySession/getCurrentUser/requireUser/requireAdmin
- **Route protection** → `src/proxy.ts` (proxy matcher): blocks /app, avoids /login when logged in
- **Dashboard/layout**: sidebar (Dashboard ready, Attendance/Leave/Expense "coming soon", admin invite link), cards for leave balance/today's attendance/pending leave & expense
- **Verification**: lint passed, tsc passed (`npm run lint`, `npx tsc --noEmit`)
- **Remaining**: end-to-end verification (login→/app, accept invite→account) and LOG.md update — carried to Session 3

### Session 3 (2026-09-24): LOG.md Restructure + Auth Verification + External Access (Tunnel)

- **Background**: sessions kept breaking, and the single overwritten "current status" caused work loss (Session 2's missing record was the trigger)
- **LOG.md restructure**:
  - Reorganized into **session-unit sections**: new session = new numbered `## Session N`, appended. Existing sections must not be deleted/edited
  - Two-part layout: "Current Status" summary at top + full "Session Log" below
- **Motivation**: employees in other regions need a public web domain to upload receipts / request PTO
- **Domain analysis** (answers to questions): GitHub Pages cannot host a dynamic app (DB + server actions). Free paths = ① quick tunnel (immediate) ② free subdomain (is-a.dev / eu.org) → Cloudflare NS → named tunnel (stable URL). Buying a domain (~$10/yr) is a later option
- **What was done**:
  1. Installed `cloudflared` via winget → quick tunnel up (`duration-flood-showcase-responses.trycloudflare.com`)
  2. Public verification: `/login` 200, `/app` unauthenticated 307→login — OK through the public URL
  3. Local verification: DB/seed (USERS=1, admin ACTIVE), bcrypt/jose/session-cookie all verified in isolation, `/app` dashboard 200 with a session cookie (includes multiple prisma queries)
  4. Documented external access (quick tunnel → stable free-domain path) in `deploy/README.md`
- **Issues/limits**:
  - **POSTing server actions via curl/fetch always returns 500 "Connection closed."** — known Next.js RPC/flight restriction (reproduces with a PING-only action, not the proxy, persists after cache wipe). Not an app bug → verify real flows in a browser
  - lint/tsc passed, dev 200, dashboard 200 → auth chain is fine. One manual browser login remaining
  - Local router DNS fails to resolve some trycloudflare hosts (OK via 8.8.8.8) — irrelevant for other devices
  - Dev server + tunnel kept running in background after the session (restart: see commands above)
- **Result/next**: external-access base established, **browser login confirmed by the user** via the public link. Next: ① free stable domain (is-a.dev/eu.org) ② attendance module

### Session 4 (2026-09-24): License Decision (Apache-2.0) + English-ify All Written Artifacts

- **Background**: user decided to go public/open-source and wants all written artifacts in **English** (conversation stays in Korean). "Commits/GitHub included."
- **Decisions made**:
  1. **License: Apache-2.0** (was "MIT candidate"). Chosen for its explicit patent grant and trademark clause — safer when enterprises adopt the HR tool. ~LGPL-no, GPL-no. Differences documented to the user: MIT = simpler/no patent clause; Apache = patent + trademark + NOTICE clauses
  2. **All written artifacts English**: LOG.md, docs/REQUIREMENTS.md, docs/UX_RESEARCH.md, pipelines/deploy READMEs, root README.md, code comments. **UI copy stays Korean** (product decision, i18n planned v0.2). `src/generated/prisma` regenerated rather than hand-edited
- **What was done**:
  1. `LICENSE` (Apache-2.0 full text, "Copyright 2026 hr-app contributors")
  2. `package.json` → `"license": "Apache-2.0"`
  3. `docs/REQUIREMENTS.md` MIT → Apache-2.0 (lines in §1.1 bg and §8)
  4. LOG.md rewritten in English (this file)
  5. README/docs/comments translated to English (see Session 5 for commit)
- **Result/next**: checkpoint commit to GitHub (public repo) with an English message; domain work deferred. Requires `gh auth login` first.

### Session 5 (2026-09-24): Attendance Module MVP (check-in/out + corrections)

> **Note**: Session 5 continued the work inside `C:\apps\projects\hr-app` (the opencode workspace points at an unrelated empty repo; LOG.md `Usage rules` still apply). Checkpoint commit from Session 4 done in THIS session first: `16b35cb feat(auth): login, invite, accept-invite + docs, license, deployment scaffolding` (59 files). Push to a new public GitHub repo still requires `gh auth login` (deferred).

- **Goal**: Attendance module MVP per `docs/REQUIREMENTS.md` §3.2 (ATT-1..4): check-in/out with server time + multiple segments, correction requests with manager approval, own daily/monthly history, team view for reviewers.
- **Schema** (`prisma/schema.prisma`): added `AttendanceEvent` model + `AttendanceEventKind` enum → migration `20260924203008_attendance_events` applied, client regenerated. `AttendanceRecord` stays one record per employee-day (`checkInAt` = first check-in, `checkOutAt` = latest check-out); `AttendanceEvent` stores every segment (supports lunch/away check-in→check-out pairs).
- **New files**:
  - `src/lib/form-utils.ts` — shared `fieldErrors()` (extracted from `actions/auth.ts`, which now imports it)
  - `src/lib/attendance.ts` — pure helpers: company-tz "today", month bounds, `workedMs()` pairs check-in/out events, display formatting (server-side, company tz)
  - `src/lib/attendance-validation.ts` — zod `AttendanceCorrectionFormSchema` + action state types
  - `src/app/actions/attendance.ts` — server actions: `checkIn`/`checkOut` (transactional, open-segment guard), `submitCorrection` (ADD/EDIT/FIX, past dates only), `decideCorrection` (MANAGER/ADMIN; reject requires reason; sets decidedBy/comment)
  - `src/app/app/attendance/page.tsx` + `today-panel.tsx`, `correction-form.tsx`, `decide-form.tsx` — today card (buttons + event list + worked time), monthly history table (`?month=YYYY-MM` nav), reviewer team-today table, correction request form + "my requests" list, reviewer approval inbox
- **Integration**: sidebar "근태" now enabled (`ready`) → `/app/attendance`; dashboard "다음 단계" copy updated. `eslint.config.mjs` gained `argsIgnorePattern: "^_"` for the existing `_state`/`_formData` useActionState convention (removed unused-param warnings).
- **Verification**:
  - `npm run lint` clean, `npx tsc --noEmit` clean
  - DB logic test (`tsx` script against Postgres, test data cleaned up): checkIn→duplicate-blocked→checkOut→re-checkIn(lunch)→final checkOut, events sequence `CHECK_IN,CHECK_OUT,CHECK_IN,CHECK_OUT`, `workedMs()>0`, checkInAt preserved — all passed
  - GET checks with a session cookie: `/app/attendance` 200 with today panel, empty month notice, team table, correction sections; `?month=2026-09` 200 with correct prev/current/next labels; `/app` (dashboard) 200
- **Decisions/notes**:
  - Multiple daily segments: kept the documented one-record-per-day model and added event history instead of relaxing the unique index — history shows exact in/out times
  - Corrections are **approval-workflow only** for MVP: the schema has no corrected-time fields, so applying fixed times stays an admin/manual step (auto-apply planned v0.2)
  - Team scoping: for a 20-person MVP, MANAGER/ADMIN approval inbox shows all pending corrections (per-team scoping will follow with the employee-management module EMP-1..4 / real dept-manager relations)
  - Server-action POSTs still return 500 via curl (known Next.js restriction) — browser E2E of the buttons/forms is the remaining check
- **Result/next**: attendance MVP implemented & DAL/DB-verified. Next: **Leave module**. Uncommitted Session 5 work pending a checkpoint commit (Session 6).

### Session 6 (2026-09-24): Leave Module MVP (Requests → Approve/Reject → Balance Deduction + CSV Import)

> **Context**: Session 5 ended right before the leave files were written. This session resumed in `C:\apps\projects\hr-app`, produced/verified the Leave module per `docs/REQUIREMENTS.md` §3.3 (LV-1..7), and re-recorded everything here. Docker Desktop had to be relaunched (daemon down at start) to bring `hr_app_db` back up.

- **Goal**: Leave/PTO MVP — request (annual/sick/unpaid, half-day), real-time balance display with over-request blocking, manager/admin approval (reject requires a reason), self-cancel before approval, month leave schedule, and admin CSV balance import.
- **Schema**: `LeavePolicy` / `LeaveBalance` / `LeaveRequest` were already part of the `init` migration (no new migration needed). Policy fields: `kind` (PTO/SICK/UNPAID), `annualDays`, `maxCarryOverDays`, `isPaid`, `requiresApproval`, `active`. Balance per `(employeeId, policyId, year)` with `grantedDays/usedDays/adjustDays`. Seed already creates 3 policies (연차 15d, 병가 11d, 무급) + admin balances.
- **New files**:
  - `src/lib/leave.ts` — pure helpers: `countWorkdays()` (weekends excluded), `computeLeaveDays()` (half-day = 0.5), `remainingDays()` (granted − used + adjust), display formatters
  - `src/lib/leave-validation.ts` — zod `LeaveRequestFormSchema` + action-state types
  - `src/app/actions/leave.ts` — `requestLeave` (past-date/range/half-day guards, policy check, live balance check with over-request block), `decideLeave` (MANAGER/ADMIN; transaction re-checks PENDING then deducts balance only on APPROVE and only for non-UNPAID), `cancelLeave` (owner, PENDING only), `importBalances` (ADMIN, CSV email,kind,year,grantedDays[,usedDays,adjustDays] → per-row validation + upsert)
  - `src/app/app/leave/` — `page.tsx` (balance cards by policy, request form, my-requests list with status badge + cancel, monthly leave schedule w/ `?month=` nav, reviewer pending inbox) + `leave-form.tsx` (live day-count & remaining preview, halves submit on over), `decide-form.tsx`, `cancel-button.tsx`
  - `src/app/app/admin/balances/` — `page.tsx` + `import-form.tsx` (CSV format doc + upload)
- **Integration**: sidebar "휴가" enabled (already wired in Session 5 layout). Dashboard already shows PTO balance & pending-leave cards.
- **Verification**:
  - `npm run lint` clean, `npx tsc --noEmit` clean
  - DB logic test (`npx tsx _test-leave.ts` against Postgres, test rows cleaned): PENDING create → approve deducts usedDays +5 → duplicate approve is a no-op (no double deduction) → reject/no deduction → cancel → CANCELED → UNPAID skip-deduction → cleanup — all passed
  - GET checks with a minted admin session cookie: `/app/leave` 200 (balance cards, request form, my-requests, month schedule), `/app/leave?month=2026-09` 200 (prev/current/next labels), `/app/admin/balances` 200, `/app` 200 — no server errors in dev log
- **Decisions/notes**:
  - Balance deducted at **approval**, not at request time (matches documented "only deduct at final status" convention). Duplicate/race protected by the in-transaction fresh PENDING check
  - Weekend-only ranges are rejected; public holidays are **not** yet excluded from day counts (Holiday model exists; holiday-aware counting planned with the Settings module)
  - Year-boundary leaves deduct from the **start date's year** balance (known simplification, noted for v0.2)
  - Reviewer inbox shows all company PENDING for MANAGER/ADMIN (per-team scoping deferred, same as attendance corrections)
  - Decision email notify (NOT-1) still pending SMTP configuration (as in prior sessions)
- **Result/next**: Leave module MVP implemented & DB/GET-verified. Browser E2E of the leave forms is the remaining check (server-action POST still 500 via curl — known Next.js restriction). Next: **Expense module**. Session 5+6 work still uncommitted → checkpoint commit first (Session 7).

### Session 7 (2026-09-24): Checkpoint Commit (Session 5–6) + Expense Module MVP start

> **Note**: Record updated incrementally while working because sections keep getting cut off. This section covers: ① the Session 5–6 checkpoint commit, ② the Expense module (in progress).

- **Checkpoint commit**: Session 5 (attendance) + Session 6 (leave) work committed together as `1809e0c feat(attendance,leave): ...` (attendance migration `20260924203008_attendance_events`, generated Prisma client, actions/actions/utils/UI, admin balance CSV import, `_test-leave.ts`, `.gitignore` + `dev-server.log`). Push deferred — `gh auth login` still pending. Working tree clean after commit.
- **Expense module plan** (per `docs/REQUIREMENTS.md` §3.4, EXP-1..6, MVP on existing schema: `ExpenseReport` / `ExpenseItem` / `ExpenseCategory` / `ReceiptFile`):
  - Create DRAFT expense report with multiple items (date, category, amount, description) + per-item receipt upload → `uploads/` local dir (S3 abstraction later)
  - Submit → SUBMITTED (sets submittedAt); owner can delete only DRAFT
  - MANAGER/ADMIN approve/reject; ADMIN confirms payment (PAID). Status flow DRAFT→SUBMITTED→APPROVED→PAID / REJECTED
  - Protected file serving under `/app/files/[file]` (ownership-checked) + `uploads/` in `.gitignore`
  - Verification: lint/tsc, `_test-expense.ts` DB round-trip, GET checks
- **Progress so far**: checkpoint commit done. Expense implementation in progress.
- **Expense module — done** (per §3.4 EXP-1..5, MVP on existing schema — no new migration): 
  - `next.config.ts`: `experimental.serverActions.bodySizeLimit: "10mb"` + `allowedDevOrigins: ["*.trycloudflare.com"]` (tunnel dev actions); `/uploads/` added to `.gitignore`
  - `src/lib/expense.ts` — `formatMoney()` (cents→currency), `parseAmountToCents()`, date input helper
  - `src/lib/expense-validation.ts` — zod `ExpenseReportCreateSchema` / `ExpenseItemFormSchema` + state types, `MAX_EXPENSE_ITEMS = 20`
  - `src/lib/storage.ts` — receipt save/remove to `uploads/` (5MB cap, JPEG/PNG/WEBP/PDF whitelist, `uuid.ext` naming; S3 abstraction later)
  - `src/app/actions/expense.ts` — `createExpenseReport` (title/period meta + dynamic item rows with per-item optional receipt; file-save-then-create with rollback of saved files on DB failure), `submitExpenseReport` (own DRAFT→SUBMITTED, requires ≥1 item), `deleteExpenseReport` (own DRAFT, unlinks stored files), `decideExpense` (MANAGER/ADMIN approve/reject SUBMITTED [reject requires reason]; ADMIN-only PAY on APPROVED→PAID)
  - `src/app/app/files/[file]/route.ts` — protected receipt streaming (session + company/owner/reviewer check, RFC 5987 `filename*=UTF-8''` on `Content-Disposition` because Korean filenames crash the fetch Headers latin1 check)
  - `src/app/app/expenses/` — `page.tsx` (new-report form, my reports list w/ status badge + item rows + receipt links + submit/delete for DRAFT, reviewer SUBMITTED inbox, admin APPROVED pay queue) + client `expense-form.tsx` (dynamic item rows: date/category/amount/description/file), `submit-button.tsx`, `delete-button.tsx`, `decide-form.tsx` (approve/reject or pay modes)
  - Layout: "경비" nav item enabled (`ready: true`); dashboard "다음 단계" copy updated to "all three modules open"
- **Verification**:
  - `npm run lint` clean (`argsIgnorePattern` already covers `_state/_formData`; fixed one unused `idx`), `npx tsc --noEmit` clean
  - DB round-trip (`npx tsx _test-expense.ts`, test rows cleaned): DRAFT create w/ 2 items + nested receipt → totals correct (2050₵) → SUBMITTED → APPROVED → PAID; separate report SUBMITTED→REJECTED with comment; guard check on already-PAID report; cleanup
  - GET checks (minted admin cookie): `/app/expenses` 200 with new-report form, my reports, receipt links, submit button; `/app/files/<stored>` 200 with `application/pdf` + encoded filename — found & fixed Korean-filename header crash along the way; unauthenticated `/app/files/*` → 307 /login (proxy guard)
  - `_test-leave.ts` re-run still green (regression)
- **Decisions/notes**:
  - Receipt files land on the **local `uploads/` volume** (S3-compatible interface is a later abstraction, per requirements); receipt access is ownership-scoped (owner + MANAGER/ADMIN of the company)
  - Currency stays `USD` per schema default; amount input in USD decimals stored as cents (multi-currency is v0.2)
  - One-file-per-item UI for MVP (schema supports multiple `ReceiptFile` per item; sick-leave↔expense linkage and proof reuse deferred with the leave/expense decision backlog)
  - Server-action POST still unreachable via curl (known Next.js restriction) → browser E2E of the expense forms remains, same as attendance/leave
- **Result/next**: **All three MVP modules (attendance/leave/expense) implemented & DB/page-verified.** Next candidates: ① checkpoint commit for Session 7 ② browser E2E sweep ③ email notifications (NOT-1) ④ stable domain/tunnel, then GitHub release. Requires `gh auth login` for push.

### Session 8 (2026-09-24): Session 7 checkpoint commit + Expense CSV export (EXP-6)

> **Note**: Record updated incrementally while working (sections keep getting cut). Covers: ① Session 7 expense module checkpoint commit ② EXP-6 CSV export.

- **Checkpoint commit**: Session 7 work (expense module + protected file serving + config) committed as `expense` commit (see `git log`). Local only — push still needs `gh auth login`.
- **CSV export plan** (MVP §7 item 5, EXP-6): server route exporting a month of expense items for accounting reconciliation.
  - Route: `/app/expenses/export?month=YYYY-MM` (defaults to current month), proxy-protected
  - Scope: EMPLOYEE own reports; MANAGER/ADMIN company-wide (adds employee column)
  - Columns: date, category, title, amount (decimal .2), currency, status, description, receipt filenames
  - UTF-8 **BOM** (Excel-safe for Korean), RFC 5987 ASCII-safe download filename
  - Excludes DRAFT (not yet submitted); all other statuses included
- **Progress so far**: commit done. CSV export in progress.
- **CSV export — done**:
  - `src/app/app/expenses/export/route.ts` — GET handler with `?month=YYYY-MM` (default current month); EMPLOYEE scope = own reports, MANAGER/ADMIN = company-wide (adds `employee` column); excludes DRAFT; columns date/category(employee)/title/status/amount/currency/description/receipts; proper CSV quoting (embedded commas, quotes, newlines); **UTF-8 BOM** for Excel-safe Korean; RFC 5987 `filename*=UTF-8''expenses-YYYY-MM.csv`
  - Expenses page header now shows "이번 달 CSV 내보내기" link (company-tz current month)
  - No schema change; no new dependency
- **Verification**: `npm run lint` + `npx tsc --noEmit` clean; GET `/app/expenses/export?month=2026-09` with admin cookie → 200 `text/csv; charset=utf-8`, header row with BOM, Korean values + escaped `"comma, quote ""test"""` description + receipt filename `식대.pdf` all correct; expenses page 200 with export link; `_test-expense.ts` regression green; unauthenticated export → proxy 307 /login
- **Ops note**: Docker Desktop (and `next dev`) were down at session start — restarted, `hr_app_db` healthy again, dev server relaunched (`dev-server.log`). This is a recurring environment check at each session start.
- **Result/next**: CSV export complete → MVP feature item "CSV export" ✅. Next: ① checkpoint commit for Session 8 ② email notifications (NOT-1) once SMTP is available ③ employee/settings admin (EMP-3/4, SET-1..4) ④ stable domain + `gh auth login` + GitHub push.

### Session 9 (2026-09-24): Leave policy decision (PTO 10/SICK 5) + Employee & Org Management (EMP-1/3/4) + Team-scoped approvals

> **Note**: Record updated incrementally while working (sections keep getting cut). Covers: ① leave-policy decision + live-DB apply ② Employee/Org admin module (departments, employee profile/status) ③ team-scoped approval inboxes/guards (the 100-person readiness piece).

- **Leave policy decision**: user confirmed **PTO 10 days/yr, Sick 5 days/yr**. `prisma/seed.ts` updated (annualDays 10/5, carry-over 5/0) and applied to the **live DB** via `_apply-policy.ts` (leavePolicy + current-year leaveBalance grantedDays). Balance cards/UI read from DB so no other code touched. See "Open Decisions #2" above.
- **Employee/org plan** (EMP-1/3/4 + enable team approvals):
  - Departments: create/rename/delete + assign department manager (`Department.managerId` already in schema)
  - Employees: list (name/email/dept/position/hire date/status/approver), edit profile (dept, position, hire date, leave approver), activate/deactivate (EMP-3), re-invite for INVITED (reuses invite flow)
  - Team approver resolution: `Employee.leaveApproverId` (explicit) else `department.managerId` — per request, applying during decide
  - Scope MANAGER inboxes (leave/expense/correction) to their team; ADMIN keeps company-wide. Add guards to decide actions
  - Shared helper `src/lib/team.ts` + admin pages under `app/admin/` + sidebar links. Position master-data model deferred (position stays free-text, see notes)
- **Progress so far**: policy decision + seed/live-DB apply done. Module implementation in progress.

- **Employee/org module — done** (no schema/migration needed; all fields already existed):
  - `src/lib/team.ts` — shared approval-authorization layer: `effectiveApproverId()` (explicit `Employee.leaveApproverId` → else `Department.managerId`), `canReviewEmployee()` (company match, no self-review, approver must be an ACTIVE employee with an active MANAGER/ADMIN user), `managedEmployeeWhere()` / `approvalInboxEmployeeWhere()` / `teamEmployeeWhere()` (Prisma `where` fragments for inbox/team queries), shared `approvalReviewerSelect` / `approvalTargetInclude` so every action projects the same reviewer fields
  - `src/lib/employee-validation.ts` — zod schemas for department create/update/delete, employee profile, status
  - `src/app/actions/employees.ts` — `createDepartment` / `updateDepartment` (name + manager, manager must be an eligible reviewer) / `deleteDepartment` (refused while employees are attached) / `updateEmployeeProfile` (dept, position, hire date, leave approver; self-approval refused) / `deactivateEmployee` / `reactivateEmployee` (flips `Employee.status` **and** `User.isActive` in one transaction; self-deactivation refused; INVITED cannot be activated)
  - `src/app/actions/auth.ts` — `inviteEmployee` and new `reinviteEmployee` now run in a transaction that expires prior unused invitations, so re-inviting an INVITED employee can no longer double-create
  - `src/app/app/admin/employees/` — `page.tsx` (server) + `employee-admin.tsx` (client): department section (create form + per-department rename/manager/delete) and employee cards (profile form, status badge, deactivate/reactivate, re-invite link generator for INVITED). Sidebar admin link added
  - Reviewer scoping wired through: `dal.ts` (`SessionUser` now carries `isActive` + employee company/status), `decideLeave` / `decideExpense` / `decideCorrection` re-check the reviewer **and** the target inside the transaction (status-only `updateMany` so a lost race cannot double-deduct), leave/expense/attendance pages scope inboxes + team views, expense CSV export scoped to the team
- **Bug found & fixed by the new tests**: the reviewer projection did not carry `User.isActive`, so a deactivated manager still passed `isApprovalReviewer`/`canReviewEmployee` at the page/action layer (they were only blocked by the session lookup and the `isActive: true` filter in the decide re-check). `approvalReviewerSelect` + `ApprovalReviewer` now include `isActive` and `canActAsAdmin`/`canManageEmployees` enforce it — a single gate for ADMIN, MANAGER, and approver checks.
- **Verification**:
  - `npm run lint` + `npx tsc --noEmit` clean
  - `_test-team.ts` (new, self-cleaning): 27/27 — approver resolution precedence, role gate, self-review refusal, company-mismatch refusal, non-reviewer "department manager" refusal, inbox self-exclusion, ADMIN company-wide scope, `teamEmployeeWhere` include-self, deactivated user + INACTIVE employee record refusal, and DB-executed `where` fragments
  - Live page checks with a minted MANAGER cookie and seeded pending requests: `/app/leave` shows the manager's own team member and **not** the other team's member, while the ADMIN cookie sees both; `/app/attendance` team view shows the team member; all pages 200 (`/app`, `/app/admin/employees`, `/app/admin/invite`, `/app/admin/balances`, `/app/attendance`, `/app/leave`, `/app/expenses`, `/app/expenses/export`) and the employees page renders 부서/직원 sections, approver selects, status controls. Fixtures removed afterwards
  - Regressions green: `_test-leave.ts`, `_test-expense.ts`, `_test-team.ts` re-run after cleanup with 0 leftover rows
- **Notes/ops**:
  - New dev helpers committed: `_test-team.ts` (durable authorization regression test), `_mint-cookie.ts` (mints a session cookie for GET checks — **use `curl.exe`**, PowerShell's `Invoke-WebRequest` drops a manual `Cookie` header and fakes a /login redirect). `_apply-policy.ts` and the throwaway inbox-E2E seeder were deleted after use
  - Docker Desktop was down at session start again (3rd occurrence) — relaunched, `hr_app_db` healthy; `next dev` restarted (`dev-server.log`)
  - Position stays free text (no master-data model); a department without a manager simply has no approver, so such requests are only decidable by an ADMIN
- **Checkpoint commit**: `98f7ab8 feat(admin,approvals): employee & org management, team-scoped approvals, expense CSV export` — covers Session 8 (CSV export) + Session 9. Local only; push still needs `gh auth login`. Working tree clean.
- **Result/next**: Session 9 complete — employee/org admin + team-scoped approvals implemented and verified. Next: ① settings module (SET-1..4: company profile, holidays for holiday-aware day counts, policy management) ② email notifications (NOT-1/2) once SMTP is configured ③ stable domain + `gh auth login` + GitHub push ④ pipelines/deploy runtime validation.

### Session 10 (2026-09-25): Settings module (SET-1..4) + holiday-aware leave day counting

> **Note**: Record updated incrementally while working (sessions keep getting cut).

- **Goal**: close the last admin gap — company profile, leave policy management, holiday calendar, expense categories — and make holidays actually affect leave day counts (deferred since Session 6, where the `Holiday` model existed but was unused).
- **Plan** (per `docs/REQUIREMENTS.md` §3.6 SET-1..4, permission matrix: ADMIN only):
  - SET-1 company name + timezone (IANA). **Decision: no `domain` column** — nothing in the MVP consumes it (`APP_URL` env is what builds invite links), so adding an unused column is rejected; recorded here instead
  - SET-2 leave policy edit (annualDays, carry-over cap, isPaid, requiresApproval, active) + an explicit "apply grantedDays to this year's balances" action (the one-off `_apply-policy.ts` from Session 9 becomes a real admin action)
  - SET-3 holiday calendar CRUD per year **and** holiday-aware `countWorkdays` (server action + client-side preview must agree)
  - SET-4 expense category CRUD, deactivate (not delete) when items reference it
  - New: `src/lib/settings-validation.ts`, `src/app/actions/settings.ts`, `src/lib/holidays.ts`, `/app/admin/settings` page + client components, sidebar link
- **Progress**: plan recorded; implementation starting.

- **Settings module — done** (SET-1..4, no schema/migration needed — every field already existed in `init`):
  - `src/lib/holidays.ts` — pure holiday helpers: `HolidaySet` (a `ReadonlySet` of `"YYYY-MM-DD"` keys), `isoDateKey()`, `toHolidaySet()` (DB rows → set), `isWorkday()` (the single weekend+holiday predicate every calculation shares)
  - `src/lib/holiday-store.ts` — `server-only` read layer: `getCompanyHolidays()` (set, for calculations), `getCompanyHolidayNames()` (map, for display), `getCompanyHolidayName()` (single-date lookup, for the half-day guard message)
  - `src/lib/settings-validation.ts` — zod schemas per action (company, policy update/apply, holiday create/delete, category create/update/delete) + shared `SettingsState` action-state type
  - `src/app/actions/settings.ts` — `updateCompanySettings` (IANA timezone validated via `Intl.DateTimeFormat`, no `domain` column — see the plan note), `updateLeavePolicy`, `applyPolicyToCurrentYear` (the Session 9 `_apply-policy.ts` one-off promoted to a real admin action: updates `grantedDays` on **existing** current-year balance rows only, never `usedDays`/`adjustDays`), `createHoliday`/`deleteHoliday`, `createExpenseCategory`/`updateExpenseCategory`/`deleteExpenseCategory` (in-use categories are refused and must be deactivated instead; P2002 → friendly Korean message)
  - `src/app/app/admin/settings/` — `page.tsx` (server) + `settings-client.tsx` (client, four `useActionState` sections): company info w/ full IANA timezone list, one editable card per leave policy (+ the "apply granted days to this year's balances" action), holiday calendar with `?year=YYYY` nav, expense category CRUD. Sidebar admin link added
- **Holiday-aware leave counting** (the piece deferred since Session 6, where the `Holiday` model existed but nothing read it):
  - `src/lib/leave.ts` — `countWorkdays(start, end, holidays?)` / `computeLeaveDays(..., holidays?)` take an optional holiday set and route every day through `isWorkday`
  - `src/app/actions/leave.ts` — loads the company holiday set and computes the request days holiday-aware; the "no workdays" error now reads `주말 또는 공휴일만 포함됨`
  - `src/app/app/leave/page.tsx` — passes the holiday date list to the request form and prints a `공휴일: 9월 7일 Labor Day` line under the month schedule; reads holidays through the store instead of an inline query (one place owns holiday reads)
  - `src/app/app/leave/leave-form.tsx` — live day preview subtracts holidays from the same set, so the client preview and the server action cannot disagree
  - **Extra guard found while doing this**: a half-day was accepted on any day, including a Saturday or a holiday, because half-day always resolves to 0.5 and therefore never trips the `days <= 0` check. `requestLeave` now refuses it (naming the holiday when there is one) and the form disables the submit button with the same predicate, so the button state matches the action
- **Verification**:
  - `npm run lint` clean, `npx tsc --noEmit` clean
  - `_test-settings.ts` (new, self-cleaning with a pre-run sweep): **23/23** — pure holiday counting (holiday inside the week drops the count, a holiday on a weekend changes nothing, a full holiday week is 0), the three half-day guard cases, holiday row persisted + duplicate rejected by the unique index, a real `LeaveRequest` stores 4 days for a Mon–Fri week with a Wednesday holiday while the balance is untouched, policy edit + apply (every row updated, `usedDays` preserved), expense category delete-when-unused vs FK-rejected-when-in-use; 0 leftovers after cleanup
  - Regressions green: `_test-leave.ts`, `_test-expense.ts`, `_test-team.ts` (27/27) re-run after the change
  - Live page checks with a minted admin cookie: `/app`, `/app/admin/settings`, `/app/admin/settings?year=2027`, `/app/leave`, `/app/leave?month=2026-10`, `/app/attendance`, `/app/expenses`, `/app/admin/employees`, `/app/admin/invite`, `/app/admin/balances`, `/app/expenses/export?month=2026-09` all 200; unauthenticated `/app/admin/settings` → 307 `/login`; no errors in the dev log. Rendered content asserted on the saved HTML: all four sections, the policy cards, the seeded holidays (설날 etc.), `2027년 0개` + `올해로` on the year nav, and the RSC payload carrying all 11 holiday dates into the form
  - Live DB left in the agreed state: PTO 10 / SICK 5, 11 holidays, 6 categories
- **Notes/ops**:
  - Fixed mojibake in the new settings UI (`예:교육비` → `예: 교육비`) — the same encoding trap as Session 1
  - Docker Desktop was down at session start again (4th occurrence) — relaunched, `hr_app_db` healthy
  - `next dev` also died with the shell that launched it (`Start-Job`), so a relaunch used `Start-Process cmd /c` to detach. **Dev helper note: launch the dev server detached, otherwise it stops when the launching shell exits**
  - Dead code removed while refactoring: `holidayNameOn()` (never called); the leave page now shares the store's `isoDateKey` instead of repeating the `toISOString().slice(0,10)` conversion
  - `applyPolicyToCurrentYear` deliberately does **not** create balance rows, so employees who never got a CSV import or a grant stay absent rather than silently appearing with a fresh 0 used-days balance. Grant-on-hire/carry-over remains open in "Open Decisions #2"
- **GitHub push setup**: confirmed the repo was absent from GitHub because **no remote was ever configured and `gh` was not logged in** (local commits only). Decided the repo name is **`hr-app`** (public, Apache-2.0), and the user runs `gh auth login` themselves so no token is shared.
- **Checkpoint commit**: `0b4a4db feat(settings): company profile, leave policy management, holiday calendar, expense categories + holiday-aware leave day counting` — covers all Session 10 work. Local only; the push needs `gh auth login` first.
- **Result/next**: Session 10 complete — **every MVP module is now implemented and verified**, including the settings module and holiday-aware leave counting. Remaining: ① push to the public `hr-app` repo (after `gh auth login`) ② email notifications (NOT-1/2) once SMTP is configured ③ browser E2E sweep of every form (still impossible via curl — known Next.js restriction) ④ stable domain via a free subdomain ⑤ pipelines/deploy runtime validation.

<!-- ====== Template for next sessions (copy & use) ======
### Session 5 (2026-09-24): <title>
- **Goal**: ...
- **Done**: ...
- **Result**: ...
- **Issues/notes**: ...
-->
