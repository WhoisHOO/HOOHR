# Browser E2E harness

Real-browser checks for the flows that `curl` cannot reach.

## Why this exists

A Next.js **server action** cannot be invoked with a plain `POST`. Hand-rolling
one returns `500 Connection closed.`, which is a framework restriction, not an app bug.
That blocked every form's real interaction test from Session 5 until this harness
existed.

It has already paid for itself. `forms.mjs` found a bug that **every other layer
missed**: the leave request form could not be submitted at all.

## How it works, with no new dependencies

`cdp.mjs` speaks the **Chrome DevTools Protocol** directly. It reuses:

- the Chrome or Edge already installed on the machine, and
- the `WebSocket` and `fetch` globals built into Node 22+.

So this adds nothing to `dependencies` or `devDependencies` and needs no
`npx playwright install` download. It launches a headless browser on a throwaway
profile, opens a page target, then navigates, reads DOM text, reads cookies, and
clicks elements.

## Usage

The dev server must be running first. Next.js refuses a second dev server in the
same directory, so do not try to start one on another port.

```bash
npm run dev              # terminal 1
npm run test:e2e:all     # terminal 2
```

| Command | Covers |
|---|---|
| `npm run test:e2e` | Login + the locale switcher (20 checks) |
| `npm run test:e2e:forms` | Attendance check-in/out + leave request/cancel (21 checks) |
| `npm run test:e2e:all` | Both, in order |

Both exit non-zero on failure and exit early with a clear message if the dev
server is not up, so they are usable in CI later.

| Variable | Default | Meaning |
|---|---|---|
| `E2E_BASE` | `http://localhost:3000` | App under test |
| `E2E_EMAIL` | `admin@example.com` | Login, defaults to the public seed admin |
| `E2E_PASSWORD` | `Admin1234!` | Login |
| `E2E_PORT` | `9222` / `9223` | DevTools port, per suite |
| `E2E_HEADFUL` | *(unset)* | Set to `1` to watch the browser |

```bash
# watch it happen
E2E_HEADFUL=1 npm run test:e2e:forms
```

## The two suites

`locale-switcher.mjs` proves the `setLocale` **write** path, which no HTTP check
can reach, because every one of them would pass a `locale=en` cookie by hand:

1. Login with a real typed-in form, not a pre-minted cookie
2. Dashboard renders Korean by default, and sets no `locale` cookie at all
3. Clicks **English** in the sidebar
4. Confirms the server action wrote `locale=en`, and that the cookie is `httpOnly`
   with `path=/`
5. Confirms the UI switched, then that English survives a hard reload and carries
   across `/hoohr/leave` and `/hoohr/expenses`
6. Clicks **한국어**, confirms the cookie flips to `ko`
7. Confirms `<html lang>` follows the active locale
8. Signs out and lands on `/login`

`forms.mjs` exercises the real forms. It switches the UI to English right after
login and asserts only English copy, which keeps Korean literals out of the file
(a `Get-Content`/write round-trip already corrupted them once) and cross-checks the
non-default locale. It covers:

1. Attendance starts not-checked-in, with check-in enabled and check-out disabled.
   Both buttons are always in the DOM and are toggled with `disabled`, so the
   assertions are about disabled state, not about which button exists.
2. Check in, then check out, asserting the disabled flags swap, the panel goes to
   on-work and back to checked-out, both events are listed, and timestamps render.
3. The leave policy dropdown is populated.
4. The form accepts typed dates and a reason, and the live day-count preview shows
   the right number of workdays.
5. Submit: the request appears with the reason that was typed, reads
   *Awaiting approval*, and shows under *My leave requests*.
6. Cancel it through the UI, and confirm it reads *Canceled*.

## Cleanup

`forms.mjs` creates real records, so it removes them. `cleanup.ts` deletes leave
requests tagged with the harness reason and today's attendance record for the
login user (`AttendanceEvent` and `AttendanceCorrection` cascade from
`AttendanceRecord`). It runs **before** the suite too, so an interrupted previous
run cannot poison the next one: a leftover attendance row would leave the check-in
button disabled, and a leftover leave request would double-spend the balance.

```bash
npx tsx _e2e/cleanup.ts
```

## Adding a case

`page.eval()` takes a function body, not an expression:

```js
const ok = await page.eval(`
  const btn = document.querySelector('button[type="submit"]');
  btn.click();
  return true;
`);
```

Three things that will otherwise waste your time:

**Wait for hydration.** `waitForReact(page, selector)` is not optional. Before
hydration, writing a value into a controlled input leaves the DOM looking
correct — the native setter succeeds and no re-render follows to overwrite it — so
a naive round-trip check reports success while the server receives the default
value. `waitForReact` looks for React's `__reactFiber$` expando keys instead.

**Fill React-controlled inputs through the native setter.** A plain
`el.value = x` is ignored:

```js
const set = (el, v) => {
  const desc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value");
  desc.set.call(el, v);
  el.dispatchEvent(new Event("input", { bubbles: true }));
};
```

**Format dates from the local calendar fields.** `toISOString()` shifts a
local-midnight date back by a day on any machine ahead of UTC, which quietly turns
a "future" date into today and gets it rejected by past-date validation.

Cookies are read with `Network.getAllCookies`, which is how the `httpOnly` `locale`
cookie is asserted even though `document.cookie` cannot see it.

## Debugging a failure

The Next.js dev server writes to `.next/dev/logs/next-development.log`. When a
server action appears to do nothing, that log plus a temporary `console.log` in
the action is far faster than guessing from the client side. A `console.log` of an
object serializes as `{}` in that log, so log `JSON.stringify(...)` of primitives
instead.

Do not use `Get-Content`/`WriteAllText` to edit these files. PowerShell 5.1 reads
without an encoding by default, so the round-trip turns every Korean string into
mojibake. Use a real editor or a UTF-8-safe tool.

