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

## 📍 Current Status (as of 2026-09-24, end of Session 4)

**Progress: Auth implemented & verified. External access (Cloudflare quick tunnel) live. Repo ready for first public release (Apache-2.0).**

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
| Attendance/Leave/Expense modules | ⬜ **Next work** |

> **Key notes:**
> - **500 "Connection closed." when POSTing server actions via curl/fetch is a known Next.js restriction** — not an app bug. Test real flows via browser.
> - Quick-tunnel URL persists only while the same `cloudflared` process is alive; restart/reboot generates a **new random URL**. Unrelated to dev-server restarts.
> - This PC's router DNS (192.168.1.254) fails to resolve some trycloudflare hostnames → verify via `--resolve` or 8.8.8.8. Other devices are fine.

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

### 2. Leave policy rules — undecided
- Annual leave accrual: hire-date-based vs calendar-year? Carry-over cap? (baseline: N days/year by hire month, M-day carry-over cap)
- Sick leave: N paid days + mandatory proof?

### 3. Sick-leave vs expense linkage scenario
- "Claim expenses with receipts when on sick leave" — attach proof to leave request, or a separate expense claim? Needs separation

### 4. Project name/brand
- Working name: `hr-app` (internal folder name). Final name needed before release

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

<!-- ====== Template for next sessions (copy & use) ======
### Session 5 (2026-09-24): <title>
- **Goal**: ...
- **Done**: ...
- **Result**: ...
- **Issues/notes**: ...
-->