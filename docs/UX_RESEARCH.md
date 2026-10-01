# UX Pre-Research Report — Menu/Workflow Analysis of Existing Tools

> Purpose: before designing HOOHR (attendance + leave + expense tool for ~20 people), collect proven UX patterns as a reference baseline.
> Studied: open-source (Frappe HR, OpenHRApp, DutyDuke, Receipt Wrangler, open-expense, CogniClaim) + paid (BambooHR, Gusto, Rippling, Expensify, SAP Concur)
>
> **This is a snapshot of competitor patterns, kept as a reference.** The attendance
> section below describes what these tools do, not what HOOHR does: attendance was
> dropped from scope on 2026-10-01 and the app is now leave and expenses. The
> attendance patterns are left in place because they informed the approval-inbox
> and module-navigation patterns that the two remaining modules use.

---

## 1. Navigation (Menu Structure) Comparison

### 1.1. Two Screen Philosophies: "Admin-oriented" vs "Employee-oriented"
- **Frappe HR**: admins/managers use a **module desk** (9 modules + left sidebar); employees use a **mobile self-service app** (5 bottom tabs: Home/Attendance/Leaves/Expenses/Salary). **Both screens share the same data** → request/approval workflows match exactly.
- **open-expense**: a **task-based view switcher** "Submit / Process" within one screen. UI is separated by **task names, not role names** → suits "small teams where people hold multiple roles".
- **Conclusion (our project)**: at ~20 people, choose either open-expense-style "employee screen + management screen" or Frappe-style "mobile tabs + desk modules". The right answer: **simple screens for employees, dedicated dashboards for managers/admins**.

### 1.2. Example Navigations (reference)
| Tool | Nav style | Primary menu |
|---|---|---|
| BambooHR | Top tab bar | Home, My Info, People, Hiring, Time Off, Reports, Files |
| Gusto | Left sidebar | Payroll, People, Hiring, Time & Attendance (incl. Time off), Benefits |
| Rippling | Home = app tile launcher | Pay, People, Time, Expenses, Benefits, Devices… |
| Expensify | 5 tabs | Home, Inbox, Spend, Workspaces, Account |
| SAP Concur | Top menu bar | Home, Requests, Travel, Expense, Approvals, Reporting |
| Frappe HR | Per-module sidebar | (Shift&Attendance, Leaves, Expenses, etc. — 9 modules) |
| OpenHRApp | Role-filtered sidebar | Dashboard, My Attendance, Attendance Audit, Leave, Team, Org, Reports, Settings |

**Common principles:**
1. Each domain (attendance/leave/expense/approval) appears as a **top-level menu item**
2. **Dashboard/home shows "what I need right now" first** (pending approvals, upcoming leave, unreported expense reports)
3. Frappe's "module sidebar skeleton" (Home → Dashboard → main documents → Reports → Setup) lowers the learning cost of the structure

---

## 2. Leave (PTO) Workflow — Industry Standard

### 2.1. Request Flow (common across all tools)
```
[Employee] open request form
  → choose type + period
  → [real-time calc] show workdays / remaining balance / amount this request will deduct   ← key pattern
  → enter reason → submit
[Notify] email + in-app badge to manager
[Manager] one-click approve from pending queue (reason required on reject)
  → approval screen also shows the employee's current balance                          ← key pattern
[Notify] result email to employee (incl. approver comment)
[Calendar] reflected in team calendar (pending requests shown gray)                      ← key pattern
```

### 2.2. Balance Display (reference designs)
- **Frappe**: semicircle donut per card + `remaining/granted` (e.g., `12/20`)
- **Gusto**: **3-layer breakdown** inside the request form `current balance / other pending hours / this request's deduction` — the best confusion-avoidance pattern
- **BambooHR**: three sub-tables `Accruals / Balance History / Requests` + a balance calculator
- **Rippling**: per-leave-code balance + timecard with automatic holiday adjustment
- **DutyDuke**: status filter chips (Pending/Approved/Rejected)

### 2.3. Status Values (mostly the same pipeline)
`Requested → Approved/Denied/Canceled` (+ Superseded: re-request after editing an approval)
- **Balance deduction timing**: at final approval (OpenHRApp shows guidance text "approved but not yet confirmed while Pending HR")
- **Duplicate protection**: block double-request for the same dates (Gusto: API 422 + UI guard)

---

## 3. Attendance Workflow

| Tool | Method | Characteristics |
|---|---|---|
| Frappe HR | Single check-in/out button (toggle by last log) | Timestamp + geolocation on confirmation sheet, off-shift marker, missed-check warning banner |
| OpenHRApp | **Fullscreen punch page** (mandatory-type select → selfie → GPS) | Multiple punches in a day merged into 1 record (earliest IN, latest OUT), cron auto-close |
| BambooHR | Direct clock in/out from home widget | Kiosk (tablet), facial recognition, ID+PIN |
| Gusto | Clock-in from home tile → role select → clock-in | Separate breaks (meal/rest), manual entry requires note |
| Rippling | Punch only inside GPS radius (geofence) | Alerts: missed punch / overtime risk / early-leave warnings |

**Common patterns:**
1. **Check-in/out = top-priority speed UI** (dedicated page or fixed home widget, 1 click)
2. Missing-record correction: **correction request → manager approval** workflow (Frappe's Attendance Request)
3. Admin **monthly attendance sheet**: per-day grid + summary (Present/Absent/Leave/Holidays/Unmarked/Late)
4. Unmarked/unclosed states handled **automatically via cron + warning banner**

---

## 4. Expense Claim Workflow — Expensify/Concur at the top

### 4.1. Industry Best (Expensify scan-centric)
```
[Capture] photo / email forward (receipts@) / upload (30-image multi)
  → [OCR] auto-extract vendor·date·amount·currency·category
  → [auto-match] match with card transactions, real-time duplicate/discrepancy detection   ← Rippling same
[Review] fix auto-filled fields (low-confidence fields highlighted yellow)                  ← CogniClaim pattern
[Report] items auto-accumulate into reports (Auto-Report)
[Submit] → status: Draft → Submitted → Approved → Paid
  (per-screen green "the 1 next thing to do" button changes contextually)
[Approve] from chat/queue; reason required on reject; partial-amount adjust possible
[Pay] payment tied to ACH/payroll (only approved ones are paid)
```

### 4.2. Unique SAP Concur Patterns (adopt the idea only)
- **`+ New` quick-action bar**: shortcuts for Requests/Expenses/receipt upload
- **Approval worklist with count badges per tab**: "get the count to zero" as working instruction
- **Approval Flow visualization**: report shows who approved when along the path
- **`Available Expenses` inbox**: keeps captured but unreported items from being lost

### 4.3. Status Pipeline Comparison
| Tool | Pipeline |
|---|---|
| Expensify | Draft → Outstanding → Approved → Paid → Done |
| Concur | Open → Submitted → Approved → Paid |
| open-expense | draft → submitted → received (UI: "Validated") |
| Receipt Wrangler | Draft → Open → Resolved (+ Needs Attention) |
| CogniClaim | submit → approve/reject (audit timeline) |

---

## 5. Consolidated Common Patterns (10 verified across all tools)

1. **Module unit navigation + domains at top level** — attendance/leave/expense/approval at the top
2. **Dashboard = "what I need right now" aggregate** — pending approval counts, unsubmitted reports, who is off today
3. **Approval queue = tab/chip + count badge + 1-click approve + mandatory reason on reject**
4. **Real-time calculation inside request forms** — show the balance breakdown (Gusto's 3 layers) before submitting
5. **Approver screen also shows the employee's balance**
6. **"Who is off" team calendar + pending requests in gray (approvable right away)**
7. **Explicit status pipeline** — color-coded chips/badges; only deduct/drop money at the final status
8. **Capture is the fastest UI** — 1-click check-in, receipts via photo/email immediately
9. **Notifications = email + in-app** — with deep links on approvals; decision comments relayed to the requester
10. **Code human-error prevention into the UX** — no edits after approval (re-request instead), duplicate-date blocking, keep an audit timeline

---

## 6. Implications for Our Design

### 6.1. Navigation Draft (HOOHR)
```
[Employee screens]
  Home   : today's clock status, remaining-leave card, my recent requests/decision status
  Attendance : check-in/out buttons, monthly history
  Leave   : request, balance, my history, "who is off" calendar
  Expense : create claim (attach receipts), my claim history

[Admin/Manager screens - left sidebar]
  Dashboard     : pending approvals / monthly summary / team calendar
  Approval queue: leave·expense·correction tabs with count badges ("work to zero")
  Attendance    : monthly attendance sheet, correction approvals
  Employees     : profile, invite, deactivate
  Settings      : leave policy / holidays / categories / company info
```

### 6.2. Status Pipelines (HOOHR)
```
Leave    : requested → pending → approved/rejected (+ cancelled)
Expense  : draft → submitted → approved → paid / rejected   [partial approval excluded from MVP]
Attendance: recorded → correction requested → approved/rejected
```

### 6.3. Must-include Patterns in MVP (best value-for-effort)
1. ✅ Approval queue + count badges + 1-click approve + mandatory reason on reject
2. ✅ 3-layer balance breakdown in the request form (Gusto) + balance on approver screen
3. ✅ "Who is off" team calendar + pending requests in gray
4. ✅ Receipt upload → status pipeline (Draft → Submitted → Approved → Paid)
5. ✅ Real-time workday calculation (excluding weekends/holidays, shown while picking dates)
6. ✅ Email notifications + deep links, rejection comments relayed

### 6.4. v0.2+ Candidates (priority order)
1. Receipt OCR (AI) — Expensify-style capture → auto-extraction → highlight low-confidence fields
2. PWA mobile + offline drafts (IndexedDB)
3. GPS clock-in/out (optional)
4. iCal team-calendar integration, CSV/PDF export

### 6.5. Antipatterns to Avoid (observed in real reviews)
- 4 clicks to photograph a receipt (Rippling) → capture must be 1–2 actions max
- Wrong default pay period (Rippling) → date default = today
- Forced re-login when searching help (Rippling) → not needed by requirements
- Complex navigation / too many clicks (Concur old UI) → simplicity is the competitive edge for a 20-person tool

---

## 7. Reference Sources
- Frappe HR: https://github.com/frappe/hrms / docs.frappe.io/hr
- OpenHRApp: https://github.com/mimnets/OpenHRApp
- DutyDuke: https://github.com/Bitnoise/dutyduke
- Receipt Wrangler: https://github.com/Receipt-Wrangler/receipt-wrangler
- open-expense: https://github.com/yipfram/open-expense
- CogniClaim: https://github.com/ShindeSid/CogniClaim
- Comparative analysis: BambooHR/Gusto/Rippling (2026 pricing/features), Expensify / SAP Concur help & product docs