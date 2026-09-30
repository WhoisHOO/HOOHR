# HOOHR

**Lightweight HR toolkit for startups and small teams** — attendance, leave, and expense claims in one self-hosted app.

Built for a team of ~20 people, not for an enterprise HR suite. Open source under [Apache-2.0](./LICENSE).

> UI language is **Korean or English**, switchable at runtime from the sidebar (defaults to Korean). All documentation is in English.

---

## What it does

| Module | Features |
|---|---|
| **Attendance** (근태) | Check-in / check-out with server time, multiple work segments per day (lunch breaks), live worked-time total, correction requests with manager approval, own daily/monthly history, team view for reviewers |
| **Leave** (휴가) | PTO / sick / unpaid requests, full or half-day, live balance with over-request blocking, manager approval (reject requires a reason), self-cancel before approval, monthly company schedule, admin CSV balance import, **holiday-aware day counting** |
| **Expenses** (경비) | Draft reports with multiple line items, per-item receipt upload, submit → approve → pay workflow, protected receipt downloads, **CSV export** for accounting |
| **Employee & org admin** | Departments with managers, employee profiles, activate/deactivate, re-invite pending employees, **team-scoped approval inboxes** |
| **Settings** | Company name + timezone, leave policy management (annual days, carry-over, paid/approval flags), holiday calendar, expense categories |

### Roles

| Role | Sees | Can approve |
|---|---|---|
| **EMPLOYEE** | Own attendance, leave, expenses | — |
| **MANAGER** | Own + direct team | Own team's requests only |
| **ADMIN** | Whole company | Everything, plus invites, settings, CSV import/export |

Approval is scoped to the team: a manager resolves to the employee's explicit approver (`leaveApproverId`) or, failing that, their department manager. Self-approval and cross-company approval are refused at both the page and the action layer.

### Status flows

```
leave:    requested -> PENDING  -> APPROVED / REJECTED   (CANCELED by owner)
          balance is deducted only on APPROVED, and never for UNPAID

expense:  DRAFT -> SUBMITTED -> APPROVED -> PAID
                      |                     ^
                      +-----> REJECTED      +-- (ADMIN confirms payment)
attendance event:  CHECK_IN <-> CHECK_OUT  (many segments per day)
```

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | **Next.js 16** (App Router) + React 19 + TypeScript + Tailwind CSS v4 |
| Database | **PostgreSQL 16** + **Prisma 7** (generated client committed to the repo) |
| Auth | Email/password + invite links — `jose` session cookie, `bcryptjs` password hashing |
| Validation | `zod` at every form and server-action boundary |
| Storage | Receipt images on a local volume (an S3-compatible interface is the planned abstraction) |
| Runtime | Single server — Docker Compose now, Cloudflare Tunnel for remote access |

---

## Quick start

### Prerequisites

- Node.js 24+ and npm 11+
- Docker Desktop (for PostgreSQL)

### 1. Configure the environment

```bash
cp .env.example .env
```

Generate a session secret and put it in `.env`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

At minimum set `AUTH_SECRET` (app will refuse to start without it) and
`BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` (used by the seed script).

### 2. Start PostgreSQL

```bash
docker compose up -d db
```

### 3. Install, migrate, seed

```bash
npm ci
npx prisma migrate deploy   # or: npm run db:migrate
npm run db:seed
```

The seed creates the company, the leave policies, and the bootstrap admin.

### 4. Run the app

```bash
npm run dev
```

Open <http://localhost:3000> and log in with the bootstrap admin credentials.

### Run it all in Docker

```bash
docker compose up -d --build
```

This builds the app image and starts it alongside PostgreSQL (app on `:3000`, DB on `:5432`).

---

## Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | yes | — | PostgreSQL connection string |
| `AUTH_SECRET` | yes | — | Session cookie signing key. **The app throws at startup if unset** |
| `APP_URL` | no | `http://localhost:3000` | Public base URL; used to build invite links |
| `BOOTSTRAP_ADMIN_EMAIL` | for seed | — | Initial admin account |
| `BOOTSTRAP_ADMIN_PASSWORD` | for seed | — | Initial admin password |
| `SMTP_HOST` / `SMTP_PORT` | no | — / `587` | SMTP server. **Leaving `SMTP_HOST` empty disables all mail and the app works normally** |
| `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | no | — / — | SMTP credentials and sender. Auth is attached only when both user *and* pass are set |
| `SMTP_SECURE` | no | derived | Implicit TLS. Defaults to true on port 465, false elsewhere (STARTTLS) |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | no | `hr` / `hoohr_dev_password` / `hoohr` | Used by `docker-compose.yml` |
| `POSTGRES_PORT` / `APP_PORT` | no | `5432` / `3000` | Host port mappings |
| `UPLOAD_DIR` | no | `./uploads` | Where receipt images are written |

> `.env` is gitignored. Never commit real credentials.

---

## Project layout

```
├── prisma/               schema, migrations, seed
├── src/
│   ├── app/
│   │   ├── actions/      server actions (auth, attendance, leave, expense, employees, settings)
│   │   ├── hoohr/        authenticated app shell + all pages
│   │   ├── invite/       invite acceptance
│   │   ├── login/
│   │   └── generated/    Prisma client (committed)
│   ├── lib/              prisma, session, DAL, validation schemas, pure domain helpers
│   └── proxy.ts          route protection
├── scripts/              cron entry point for the approval digest
├── pipelines/            Airflow DAG + PySpark job (later phases)
├── deploy/               EKS / external-access notes
├── docs/                 REQUIREMENTS.md, UX_RESEARCH.md
├── docker-compose.yml
└── Dockerfile
```

Authenticated routes live under **`/hoohr`**. The pre-rename `/app` prefix still redirects there.

### Notable design points

- **DAL layer** (`src/lib/dal.ts`) — every page and action resolves the current user through one cached helper, so authorization cannot be forgotten at a call site.
- **Pure domain helpers** — day counting, timezone boundaries, money formatting, and approval rules are plain functions in `src/lib/`, unit-testable without a database. The leave form's live preview and the server action deliberately share the same holiday set so they cannot disagree.
- **Status-guarded writes** — approvals use a status-conditioned `updateMany` inside a transaction, so a lost race cannot double-deduct a leave balance.
- **Times are stored in UTC** and rendered in the company timezone configured in settings.
- **i18n without a dependency** (`src/i18n/`) — a `locale` cookie (`ko` default, `en` available) is read server-side, so `<html lang>`, dates, numbers and CSV headers all follow it. Copy lives in `src/i18n/dictionaries/`; the English dictionary is typed as `typeof` the Korean one, so a missing or extra key is a compile error rather than a runtime `undefined`. User-entered data (names, departments, leave policies, expense categories) is deliberately never translated.
- **Email notifications are best-effort by design** (`src/lib/mail.ts`) — three properties are load-bearing. It is a **no-op when `SMTP_HOST` is unset**, so a fresh clone runs with no mail configured. It **never throws**: an approval is already committed by the time mail goes out, so an SMTP outage must not turn a successful decision into an error, and must not invite a retry that would double-approve. And it **cannot hang a request**: a blackholed SMTP port would otherwise pin a server action for the default 120s, so the timeouts are 10s/10s/20s.
- **The approval digest reuses the inbox query** (`src/lib/approval-digest.ts`) — `collectDigestPlans` calls the same `approvalInboxEmployeeWhere` predicate the leave and expense pages use, so the email cannot list something the inbox hides or miss something it shows. Each (recipient, request) pair is claimed by inserting a `Notification` row whose `(userId, link)` is unique, which makes a duplicate digest impossible under concurrent runs; a failed send releases its claim so the next run retries. The scope is deliberately *per recipient* — an admin's inbox overlaps a manager's, so both are legitimately notified about the same request.

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Dev server on `:3000` |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type check |
| `npm run test:e2e` | Browser E2E: locale switcher (needs `npm run dev`) |
| `npm run test:e2e:forms` | Browser E2E: attendance + leave forms |
| `npm run test:e2e:expenses` | Browser E2E: expense create → submit → decide → pay |
| `npm run db:migrate` | Create/apply a development migration |
| `npm run db:seed` | Seed the bootstrap company, policies, and admin |
| `npm run db:studio` | Prisma Studio |
| `npm run digest` | Send the batched approval digest (NOT-2) — intended for cron |
| `npm run digest:dry` | Show what the digest *would* send, without writing or sending |

### Email notifications

`SMTP_HOST` being empty disables all mail; the app is fully functional without it and
invite links are still shown on screen. To see real mail locally, run any SMTP sink and
point the app at it:

```bash
docker run -d -p 1025:1025 -p 8025:8025 axllent/mailpit
# then in .env:
#   SMTP_HOST=localhost
#   SMTP_PORT=1025
#   SMTP_FROM=hr@localhost
#   (no SMTP_USER / SMTP_PASS — a local relay needs no auth)
```

Mailpit's web UI is then at <http://localhost:8025>.

What is sent:

| Trigger | Recipient | Mail |
|---|---|---|
| Leave approved or rejected | the requester | Outcome, period, reviewer comment |
| Expense approved, rejected, or paid | the requester | Outcome, amount, reviewer comment |
| Employee invited or re-invited | the invitee | The accept-invite link and its expiry |
| `npm run digest` | each reviewer with a non-empty inbox | One batched summary of everything pending |

The digest is safe to run repeatedly: each (recipient, request) pair is claimed in the
`Notification` table under a unique index, so a second run sends nothing and a failed
send is retried on the next run.

### DB test scripts

Self-cleaning scripts exercise the domain logic directly against PostgreSQL and remove their own fixtures:

```bash
npx tsx _test-team.ts       # 27 checks - approval scoping and authorization
npx tsx _test-settings.ts   # 23 checks - holiday-aware counting, policies, categories
npx tsx _test-leave.ts      # leave request -> approve -> deduct -> cancel
npx tsx _test-expense.ts    # expense draft -> submit -> approve -> pay
npx tsx _test-storage.ts    # 11 checks - receipt MIME, size, errors, path traversal
npx tsx _test-mail.ts       # 58 checks - SMTP config, escaping, every template in ko/en
npx tsx _test-digest.ts     # 34 checks - the digest against a real DB and SMTP conversation
npx tsx _test-weekend-currency.ts  # 50 checks - company weekend, workday maths, currency codes
```

`_test-digest.ts` starts a small in-process ESMTP server, so it verifies real delivery
and the real ledger without needing a credential or an external relay.

### Browser E2E

Some flows cannot be reached over `curl` because a Next.js **server action** is not
callable with a plain `POST`. The locale switcher was the notable case: setting the
cookie by hand only proves the read path, so the `setLocale` write path stayed
unverified. Forms were the other: a hand-rolled action POST returns
`500 Connection closed.`, which is a framework restriction rather than an app bug,
so no real form interaction had been tested since Session 5.

```bash
npm run dev            # terminal 1
npm run test:e2e:all   # terminal 2
```

`_e2e/` drives the Chrome or Edge already on the machine over the DevTools Protocol
using Node's built-in `WebSocket`, so it adds **no dependencies** and needs no
browser download.

| Command | Covers |
|---|---|
| `npm run test:e2e` | Login + locale switcher (20 checks) |
| `npm run test:e2e:forms` | Attendance check-in/out + leave request/cancel (21 checks) |
| `npm run test:e2e:expenses` | Expense create/submit/approve/reject/pay/delete (33 checks) |
| `npm run test:e2e:all` | All three |

The switcher suite logs in with a real typed-in form, clicks **English** and
**한국어**, and asserts the `httpOnly` `locale` cookie, the switched UI, persistence
across reloads, `<html lang>`, and sign-out. The forms suite exercises attendance
check-in/check-out and the leave request/cancel round trip. The expenses suite
walks the full expense lifecycle across two accounts, which is the only way to
reach it: self-review is forbidden and a second admin cannot be invited. See
[`_e2e/README.md`](./_e2e/README.md).

---

## Status and roadmap

The MVP feature set is implemented. Not done yet:

- **Email notifications** — SMTP is configured but no send path exists yet
- **OCR receipt extraction** — deferred to v0.2
- **Grant-on-hire / leave carry-over automation** — balances are currently granted explicitly
- **EKS + Airflow + Spark deployment** — see [`pipelines/`](./pipelines) and [`deploy/`](./deploy)

## Contributing

Issues and pull requests are welcome. Please run `npm run lint` and `npx tsc --noEmit` before opening a PR, and keep written artifacts in English (UI copy must live in the dictionaries under `src/i18n/dictionaries/`, never inline).

## License

[Apache-2.0](./LICENSE) — see the file for the full text.
