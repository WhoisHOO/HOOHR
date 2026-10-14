# HOOHR

<img src="HOO_Logo.jpg" alt="HOOHR logo" width="96" align="right" />

**Lightweight HR toolkit for startups and small teams** — leave and expense claims in one self-hosted app.

Built for a team of ~20 people, not for an enterprise HR suite. Open source under [Apache-2.0](./LICENSE).

> The install asks for the screen language. Language, currency and timezone are
> independent: Korean UI can run dollar amounts and vice versa. Amounts are
> plain numbers, dates use UTC, and the language is switchable any time in the
> sidebar. All documentation is in English.

---

## What it does

| Module | Features |
|---|---|
| **Leave** (휴가) | PTO / sick requests, full-day periods, request → admin approval (reject requires a reason), self-cancel before approval, monthly company schedule, CSV export by date range |
| **Expenses** (경비) | Draft reports with multiple line items, per-item receipt upload, submit → approve → pay workflow, protected receipt downloads, **CSV export** for accounting |
| **Employee admin** | Employee profiles, activate/deactivate, re-invite pending employees |
| **Settings** | Company name, weekend days, leave policy management (name, paid/approval flags), email alerts, company logo, notice, public-access status, one-click move |

### Roles

| Role | Sees | Can approve |
|---|---|---|
| **EMPLOYEE** | Own leave, expenses | — |
| **ADMIN** | Whole company | Everything, plus invites, settings, CSV export |

Approvals are assigned to the ADMIN role. Self-approval and cross-company approval are refused at both the page and the action layer. The creator of a request can cancel it while it is still pending, but cannot approve it themselves.

### Status flows

```
leave:    requested -> PENDING  -> APPROVED / REJECTED   (CANCELED by owner)

expense:  DRAFT -> SUBMITTED -> APPROVED -> PAID
                      |                     ^
                      +-----> REJECTED      +-- (ADMIN confirms payment)
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

## Quick start (Windows - one click)

### 1. Install Docker Desktop

The only prerequisite. <https://www.docker.com/products/docker-desktop/>

### 2. Get the code

**Code → Download ZIP**, then extract it anywhere (e.g. `C:\hoohr`).
<a name="windows-1"></a> *You do not need Git for this path.*

### 3. Double-click `start.bat`

That is the whole procedure. The window walks through it:

1. Starts Docker Desktop if it is not already running, and waits for the engine.
2. Asks two questions — **screen language** and whether it is a
   **personal computer or a server** — then creates a `.env` with a random
   session secret. Every question is two options, so there is nothing to read
   up on.
3. Builds the image, applies the database migrations, and seeds the company
   defaults (leave policies).
4. Waits until the app answers a real readiness check - not merely until the
   port is listening, so it never opens a browser onto a page that will 500.
5. If you answered **server**, opens a public HTTPS address and checks the app
   really answers through it. Otherwise just opens your browser.
6. Prints the address.

The first run takes 2-5 minutes (it downloads and builds a Node image); later
runs take seconds because the image is cached. Running `start.bat` again is
always safe: your data and settings are left alone.

```
==========================================================
  HOOHR 설치가 완료되었습니다.
==========================================================
  주소          : http://localhost:3000
  언어          : 한국어
==========================================================
```

Then the browser opens **your setup screen**: one wizard, three steps —
company + screen language, the first admin account, then email alerts (optional;
leave it empty to start without mail). That screen appears only once - after
the first account exists it is gone, and from then on you land on the login
page.

### 4. Watch the logs

Double-click **`start-logs.bat`**. It opens a second window that follows both
containers live, and simultaneously appends everything to `logs/hoohr.log` so
you can read back a message you missed. Closing that window does not stop the
app.

### 5. Stop it

```bash
docker compose down
```

### Sharing it with your team

Answering **server** to the second question publishes the app over a
[Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/):
free, no static IP, no domain to buy, HTTPS included. The window prints the
address, and the app is reachable at it from anywhere.

Two things to know:

- **A quick tunnel's address changes every time you restart.** It is for
  showing the app to someone. If you need an address that survives restarts,
  put it in a Cloudflare account and switch to a named tunnel: set
  `TUNNEL_MODE="named"` and `TUNNEL_TOKEN` in `.env`.
- **The address is written into `APP_URL`** so that the links in your invite
  emails and approval notifications point at the public address instead of
  `http://localhost:3000`. That is the step that is easy to forget and quietly
  breaks every link you send, so the script does it for you and then verifies
  the address from the outside before reporting success.

You can also do this later without reinstalling — double-click
**`start-tunnel.bat`**, which runs the same routine. To close the public
address again:

```bash
docker rm -f hoohr_tunnel
```

### Where things live

| Path | |
|---|---|
| `.env` | Generated on first run. Your secrets. Do not share it. |
| `logs/hoohr.log` | Log history; each session overwrites the previous one into `hoohr.prev.log` |
| `logs/tunnel.log` | History of public-address attempts, including the hostname each time |
| Receipt images | In the `uploads` Docker volume, not in the repo |

To wipe everything and start over (this deletes all data), add `-v`:
`docker compose down -v`.

---

## Quick start (developer - manual)

<details>
<summary>Node + local PostgreSQL, no Docker for the app</summary>

```bash
cp .env.example .env          # then set AUTH_SECRET (seed admin optional, dev only)
docker compose up -d db       # PostgreSQL only
npm ci
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Or run the whole stack in Docker directly, skipping the `.bat` wrappers:

```bash
docker compose up -d --build  # migrates and seeds via docker/entrypoint.sh
```

</details>

---

## Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | yes | — | PostgreSQL connection string |
| `AUTH_SECRET` | yes | — | Session cookie signing key. **The app throws at startup if unset** |
| `COMPANY_COUNTRY` | no | `KR` | `KR` or `US`. Seed display names only. Language, currency and timezone are independent of it |
| `RUNTIME_TARGET` | no | `personal` | `personal` keeps the app on this machine; `server` also opens a public HTTPS address via a Cloudflare Tunnel |
| `APP_URL` | no | `http://localhost:3000` | Public base URL; used to build invite links. The tunnel writes it for you |
| `TUNNEL_MODE` | no | — | `quick` (free, random hostname) or `named` (stable hostname, needs a Cloudflare account). `start.bat` picks `quick` when this is unset |
| `TUNNEL_TOKEN` | for `named` | — | The connector token from Cloudflare's "Install and run a connector" command |
| `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` | dev only | — | Set both to have `db:seed` create a ready admin for development and the E2E suites. Leave empty for a real install: the first admin is created on the setup screen |
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
│   │   ├── actions/      server actions (auth, leave, expense, employees, settings, locale)
│   │   ├── hoohr/        authenticated app shell + all pages
│   │   ├── invite/       invite acceptance
│   │   ├── login/
│   │   └── setup/        first-run wizard
│   ├── generated/        Prisma client (committed)
│   ├── lib/              prisma, session, DAL, validation schemas, pure domain helpers
│   └── proxy.ts          /app -> /hoohr redirect
├── scripts/              cron entry point for the approval digest
├── deploy/               EKS / external-access notes
├── docs/                 REQUIREMENTS.md, UX_RESEARCH.md, WORKFLOW.md
├── docker-compose.yml
├── Dockerfile
├── start.bat             one-click start (calls start.ps1)
├── start.ps1             one-click start: asks setup questions, checks for updates, waits on health, opens the browser
├── uninstall.bat         one-click stop + full data wipe (calls uninstall.ps1)
├── start-tunnel.ps1      public HTTPS address (called by start.ps1 in server mode)
├── start-tunnel.bat      ...or run it on its own later
└── logs/                 start.log, tunnel.log
```

Authenticated routes live under **`/hoohr`**. The pre-rename `/app` prefix still redirects there.

### Notable design points

- **DAL layer** (`src/lib/dal.ts`) — every page and action resolves the current user through one cached helper, so authorization cannot be forgotten at a call site.
- **Pure domain helpers** — day counting, UTC day boundaries, plain-number amounts, and approval rules are plain functions in `src/lib/`, unit-testable without a database. The leave form's live preview and the server action deliberately share the same weekend set so they cannot disagree.
- **Status-guarded writes** — approvals use a status-conditioned `updateMany` inside a transaction, so a lost race cannot double-approve or double-pay. Every user-triggered write resolves to a plain message, never an exception banner.
- **Times are stored and bounded in UTC**; amounts carry no currency and render as plain numbers.
- **i18n without a dependency** (`src/i18n/`) — the screen language is a `locale` cookie flipped with the sidebar switcher, defaulting to the company country. `<html lang>`, dates and numbers follow it. Copy lives in `src/i18n/dictionaries/`; the English dictionary is typed as `typeof` the Korean one, so a missing or extra key is a compile error rather than a runtime `undefined`. User-entered data (names, leave policies, memos) is deliberately never translated.
- **Email notifications are best-effort by design** (`src/lib/mail.ts`) — three properties are load-bearing. It is a **no-op when `SMTP_HOST` is unset**, so a fresh clone runs with no mail configured. It **never throws**: an approval is already committed by the time mail goes out, so an SMTP outage must not turn a successful decision into an error, and must not invite a retry that would double-approve. And it **cannot hang a request**: a blackholed SMTP port would otherwise pin a server action for the default 120s, so the timeouts are 10s/10s/20s.
- **The approval digest mirrors the inbox filters** (`src/lib/approval-digest.ts`) — pending leave and submitted expenses, excluding the reviewer's own, so the email cannot list something the inbox hides or miss something it shows. Each (recipient, request) pair is claimed by inserting a `Notification` row whose `(userId, link)` is unique, which makes a duplicate digest impossible under concurrent runs; a failed send releases its claim so the next run retries. The scope is deliberately *per recipient* — every request routes to the same ADMIN pool, so all admins are legitimately notified about the same request.

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Dev server on `:3000` |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type check |
| `npm run test:e2e` | Browser E2E: sidebar language switch (needs `npm run dev`) |
| `npm run test:e2e:forms` | Browser E2E: leave request/cancel forms |
| `npm run test:e2e:expenses` | Browser E2E: expense create → submit → decide → pay |
| `npm run db:migrate` | Create/apply a development migration |
| `npm run db:seed` | Seed the company defaults; creates the bootstrap admin only when `BOOTSTRAP_ADMIN_PASSWORD` is set |
| `npm run test:e2e:first-run` | Browser E2E: the very first setup screen flow |
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
| Leave requested | every active admin | Requester, kind, period, memo |
| Leave approved or rejected | the requester | Outcome, period, reviewer comment |
| Expense submitted | every active admin | Requester, title, amount |
| Expense approved, rejected, or paid | the requester | Outcome, amount, reviewer comment |
| Employee invited or re-invited | the invitee | The accept-invite link and its expiry |
| `npm run digest` | each reviewer with a non-empty inbox | One batched summary of everything pending |

The digest is safe to run repeatedly: each (recipient, request) pair is claimed in the
`Notification` table under a unique index, so a second run sends nothing and a failed
send is retried on the next run.

### DB test scripts

Self-cleaning scripts exercise the domain logic directly against PostgreSQL and remove their own fixtures:

```bash
npx tsx _test-expense.ts    # expense draft -> submit -> approve -> pay
npx tsx _test-storage.ts    # 11 checks - receipt MIME, size, errors, path traversal
npx tsx _test-mail.ts       # 58 checks - SMTP config, escaping, every template in ko/en
```
### Browser E2E

Some flows cannot be reached over `curl` because a Next.js **server action** is not
callable with a plain `POST`, and because page-level redirects render as
`200` + follow-in-browser navigation rather than a `307` status. So no HTTP-only
check can drive the forms or prove a redirect — only a real browser can. Forms
were the other case: a hand-rolled action POST returns
`500 Connection closed.`, which is a framework restriction rather than an app bug,
so no real form interaction had been tested since Session 5.

```bash
npm run dev            # terminal 1
npm run test:e2e:all   # terminal 2
```

`_e2e/` drives the Chrome or Edge already on the machine over the DevTools Protocol
using Node's built-in `WebSocket`, so it adds **no dependencies** and needs no
browser download.

The suite is also run against the **containerized** build (`docker compose up
-d --build`) - the artifact a user actually downloads - and against a cold
start with an empty volume. That is deliberate: the packaging layer has its own
class of break that unit tests cannot see, and it has had real instances (a seed
script importing a build artifact the runner stage did not copy, and a readiness
probe that reported healthy because `fetch` had followed a 307 to `/login`).

| Command | Covers |
|---|---|
| `npm run test:e2e` | Login + sidebar language switch, cookie persistence across pages (13 checks) |
| `npm run test:e2e:forms` | Leave request/cancel round trip (16 checks) |
| `npm run test:e2e:expenses` | Expense create/submit/approve/reject/pay/delete (40 checks) |
| `npm run test:e2e:first-run` | The very first setup screen flow (needs an empty database) |
| `npm run test:e2e:all` | The first three |

The language suite logs in with a real typed-in form, flips the sidebar
switcher, and asserts the UI, `<html lang>` and the `locale` cookie follow —
then flips back, so the browser is left the way it was found. The forms suite
exercises the leave request/cancel round trip. The expenses suite walks the full
expense lifecycle across two accounts, which is the only way to reach it:
self-review is forbidden. See [`_e2e/README.md`](./_e2e/README.md).

---

## Status and roadmap

The MVP feature set is implemented. Not done yet:

- **OCR receipt extraction** — deferred to v0.2
- **EKS deployment** — see [`deploy/`](./deploy)
- **Fine-grained per-request approval routing** — every request currently routes to the same ADMIN pool

## Contributing

Issues and pull requests are welcome. Please run `npm run lint` and `npx tsc --noEmit` before opening a PR, and keep written artifacts in English (UI copy must live in the dictionaries under `src/i18n/dictionaries/`, never inline).

## License

[Apache-2.0](./LICENSE) — see the file for the full text.
