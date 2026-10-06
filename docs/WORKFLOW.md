# Workflow - what a click actually guarantees

> Scope: every user-visible action in HOOHR, what it changes, what it refuses, and
> what it does **not** guarantee. Written after verifying the flows by running
> them, not by reading the code alone — the "Known gaps" section came out of that
> and is not visible from `npm run dev`.
>
> The product is two modules. Attendance was removed in Session 20, so every row
> below is leave or expenses.

## 0. The shape of the whole thing

```
                     install (start.bat)
                            |
                     2 questions: country? personal PC or server?
                            |
                            v
   LOGIN  <---------------- EMPLOYEE (onboards via emailed invite link)
     |                              |
     v                              v
  DASHBOARD (2 cards) --------> LEAVE / EXPENSES  (own requests)
     |
     +--> EMPLOYEES & ORG, INVITE, BALANCES, SETTINGS  (ADMIN only)

   a MANAGER or the ADMIN sees other people's pending items inline
   on the same LEAVE / EXPENSES pages, not in a separate inbox.
```

One company per deployment (multi-tenant by `companyId`, but a single install
serves one company). The country chosen at install decides the UI language, the
currency, the timezone and the weekend, and there is no switcher afterwards.

## 1. Authentication

| Click | Guaranteed | Refused / not guaranteed |
|---|---|---|
| **Log in** (email + password) | Password verified with bcrypt; a signed session cookie is set; redirect to `/hoohr` | No rate limiting and no lockout. An inactive or unknown account is refused identically, so the form does not disclose which emails exist |
| **Sign out** | Session cookie cleared, redirect to `/login` | Nothing else. Already-issued cookies remain valid until they expire |
| **Open `/login`, `/hoohr/**` without a session** | Redirected to `/login` | — |
| **Accept an invite** (from the emailed link) | Within one transaction: `User` created, `Employee` created or flipped `INVITED`→`ACTIVE`, `Invitation` marked used. Then a session is created | An expired, unknown or already-used token. An email that already has an account. **Creates no `LeaveBalance` row — by design; the balance materializes on first approval (G1 fixed in Session 21)** |
| **Invite an employee** (ADMIN) | `Employee` row in `INVITED` state + `Invitation` with a 7-day expiry. An email is sent if SMTP is configured | The employee cannot do anything until they accept. **The invite link is also shown on screen, so mail is not required to onboard someone** |
| **Re-invite** (ADMIN) | Previous **unused** invitations for that email are expired, a fresh one minted, the mail re-sent, and the link shown again | Only an employee still in `INVITED` with **no linked account**. An employee who already accepted is refused — re-invite is not a reset, and an already-accepted employee can never be re-invited |

Invite links are built from `APP_URL`. Left at `http://localhost:3000`, every
invite email points at the *recipient's own machine* while the app behaves
perfectly — a silent failure. `start.ps1` in server mode sets it to the public
tunnel address and re-verifies from outside before claiming success.

## 2. Leave (PTO / sick / unpaid)

Status moves, and nothing else can move them:

```
                request            approve
   (none) ----------------> PENDING ----------> APPROVED
                              |  \                 |
                       cancel |   \ reject         | (terminal)
                              v    v               v
                          CANCELED  REJECTED     APPROVED
```

| Click | Guaranteed | Refused / not guaranteed |
|---|---|---|
| **Request leave** | Days computed by working-day count: weekends and configured holidays excluded, a half day counts 0.5. A `PENDING` row is created | Past dates, an end before the start, a half day spanning more than one day, a range with zero working days, a half day landing on a weekend/holiday, and **a request larger than the remaining balance**. **Unpaid leave skips the balance check entirely** — it is the only type a new hire can actually file |
| **Cancel** (own, while `PENDING`) | Status becomes `CANCELED` | After a decision. Someone else's request. Balance is untouched — nothing was ever deducted |
| **Approve / Reject** (MANAGER for their report, or ADMIN) | Inside one transaction: status set, `decidedById`/`decidedAt`/`decisionComment` recorded, and for PTO/sick the balance's `usedDays` incremented. A decision email goes to the employee | **You cannot decide your own request** — enforced in the action itself (`canReviewEmployee` rejects a target whose `employeeId` is the reviewer's), not merely hidden from the inbox. Also: not your employee's, a request that is no longer `PENDING` (someone else decided first), and a reject reason under 2 characters. **(G1 fixed in Session 21 — no `LeaveBalance` row no longer breaks approval)** |
| **Apply policy to current year** (ADMIN, Settings) | `grantedDays` is overwritten to the policy's `annualDays` for every existing balance row of that year | It **cannot create** a row for an employee who has none; that is the reported "0 rows" message. Note it overwrites rather than adds |
| **Import balances (CSV)** (ADMIN) | Per row, an upsert on (employee, policy, year). Lines naming an unknown employee are collected as errors and skipped; good lines are committed | A partially bad file commits the good lines and reports the rest — it is not all-or-nothing |

**Deduction happens only at approval**, never at request and never at cancel.
Requesting 10 days and cancelling leaves the balance untouched; requesting 5 and
getting approved costs 5.

## 3. Expenses (receipts)

```
   create              submit             approve           pay (ADMIN)
  -------> DRAFT ---------------> SUBMITTED ----------> APPROVED --------> PAID
              |                        |                    |
           delete                  reject                reject is not
           (own only)                  v                    possible here
                                    REJECTED
```

| Click | Guaranteed | Refused / not guaranteed |
|---|---|---|
| **Create a report** (title, period, one or more line items with a category and amount) | A `DRAFT` `ExpenseReport` plus its `ExpenseItem` rows; the total is computed server-side from the items (`expense.ts:158`), not trusted from the form. Each receipt is stored under a random UUID filename | A period whose end precedes its start. **A report with no items can be created but not submitted**, and it cannot be edited afterwards either (G7) |
| **Upload a receipt** (part of item entry) | Size and MIME checked against the allowlist, then written to the upload directory under a random name, so the original filename never becomes a path | Empty file, oversized file, a type outside the allowlist. The original filename is kept only as a display label |
| **Delete** (own, while `DRAFT`) | The report and its items go, and the stored receipts of removed items are deleted from disk | After submission. Someone else's report. **There is no edit at all — see gap G7** |
| **Submit** | Status becomes `SUBMITTED`, `submittedAt` stamped. It now appears in a reviewer's queue | An empty report. Re-submission of an already-submitted report |
| **Approve / Reject** (MANAGER for the report, or ADMIN) | Inside one transaction: status set, decider and comment recorded, decision email sent | Not your own report. A report that is not `SUBMITTED`. Reject needs a reason |
| **Pay** (**ADMIN only**) | Status becomes `PAID`; a payment notice goes to the owner | A MANAGER cannot pay, at all. A report that is not `APPROVED`. **A report cannot be rejected after approval** — the flow is one-directional from here |
| **Export CSV** (month picker) | A CSV with a UTF-8 BOM, so Korean opens correctly in Excel, plus the receipt filename | Only the chosen month (default: this month). Unauthenticated it returns **401**, not a login page — it is a plain `GET` route, not a page |

## 4. Settings (ADMIN)

| Click | Guaranteed | Refused / not guaranteed |
|---|---|---|
| **Save company (name, country, weekend)** | Name, country, weekend, and the currency + timezone **derived from the country** | **Changing the country reinterprets already-stored amounts — there is no FX conversion.** It is meant to be right once, at install; the field exists so a mis-pick is recoverable. A weekend of all seven days is refused, because it would make every leave request fail with "no working days" |
| **Save a leave policy** | The policy's own fields | It does **not** grant balances to anyone; use "apply to current year" or the CSV import for that |
| **Add / delete a holiday** | A `Holiday` row for that company, which working-day counts then exclude | Holidays are **not** seeded at install — a calendar is the company's own data, and guessing one from a country is the region-preset behaviour this product deliberately does not do |
| **Manage expense categories** | Categories can be renamed, deactivated and deleted; a category is needed before a receipt can be filed | — |
| **Departments** (Employees & org) | Create / rename / delete a department | A department that still has employees cannot be deleted |

## 5. What is **not** wired to anything

These are real gaps, not design choices:

| Gap | Effect |
|---|---|
 | **~~G1 — a new hire has no leave balance~~ ✅ Fixed (Session 21)** | `decideLeave` now `upsert`s the balance row (created on first approval with `grantedDays: 0` + the used days), so no `P2025` rollback. The request form no longer blocks on balance — it warns and lets the approver decide, and a missing balance renders as "잔여 없음" (no balance tracked) instead of "0 days". A company can still track exact quotas via Settings → CSV import; companies that do not track balances are fully supported. Verified by `_e2e/resilience.ts` (29 checks) and `_e2e/newhire.mjs` (20 checks) |
| **G2 — the digest is manual** | `npm run digest` batches pending approvals into one email. Nothing schedules it: no cron, no compose service, no `start.ps1` step. The script's own comment says "intended to be run from cron". Pending items therefore generate no email unless someone remembers |
| **G3 — notifications have no UI** | `approval-digest.ts` writes `Notification` rows and nothing ever reads them; there is no notifications page or nav entry. The table is a write-only sink |
| **G4 — `SMTP_HOST=localhost` cannot work under Docker** | Inside the app container `localhost` is the container, so a host-side mail server gives `connect ECONNREFUSED 127.0.0.1:<port>`. It must be `host.docker.internal` (Docker Desktop) or a reachable hostname. `.env.example` does not say so |
| **G5 — no OCR** | Receipts are filed by hand. Deliberately deferred to v0.2 |
| **G6 — quick-tunnel addresses are ephemeral** | The hostname changes on every restart. A real multi-user deployment needs a named tunnel with a stable hostname, which is implemented but has never been run (it needs a Cloudflare account and a `TUNNEL_TOKEN`) |
 | **~~G7 — a draft expense report cannot be edited, but the UI says it can~~ ✅ Fixed (Session 21)** | The false promise is removed from both locale dictionaries: the hint now says only "delete is available until submit" / "You can delete this until you submit". Real editing of a draft report remains unimplemented (delete-and-recreate is the current path) |

## 6. Notifications that do fire

| When | To | Content |
|---|---|---|
| Invite sent | The invitee | The invite link and its expiry |
| Leave decided | The requester | The outcome, the period, the comment, the decider |
| Expense decided / paid | The owner | The outcome, the amount, the comment |
| Digest (manual) | Each reviewer with pending items | One batched mail listing them |

All are best-effort by design: `sendMail` never throws and is always awaited
after the decision is committed, so a mail outage can never turn a successful
approval into a red error, and a lost notice cannot silently roll back a
decision. **Without `SMTP_HOST` every one of them is a silent no-op** — the
approval still succeeds, and no email is sent. Verified end to end on
2026-10-01 against a local SMTP server: the invite and the digest both arrived
with correct Korean text, HTML part and links.
