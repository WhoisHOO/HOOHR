# Browser E2E harness

Real-browser checks for the flows that `curl` cannot reach.

## Why this exists

A Next.js **server action** cannot be invoked with a plain `POST`. Hand-rolling one
returns `500 Connection closed.`, which is a framework restriction, not an app bug.
That blocked one specific thing for a long time: proving the runtime locale
switcher actually writes its cookie. Setting the cookie by hand proves only the
*read* path, never the `setLocale` *write* path, so the switcher could have been
completely broken and every HTTP check would still have passed.

## How it works, with no new dependencies

`cdp.mjs` speaks the **Chrome DevTools Protocol** directly. It reuses:

- the Chrome or Edge already installed on the machine, and
- the `WebSocket` and `fetch` globals built into Node 22+.

So this adds nothing to `dependencies` or `devDependencies` and needs no
`npx playwright install` download. It launches a headless browser on a throwaway
profile, opens a page target, then navigates, reads DOM text, reads cookies, and
clicks elements.

## Usage

The dev server must be running first.

```bash
npm run dev        # terminal 1
npm run test:e2e   # terminal 2
```

Exit code is non-zero if any check fails, so it is usable in CI later.

| Variable | Default | Meaning |
|---|---|---|
| `E2E_BASE` | `http://localhost:3000` | App under test |
| `E2E_EMAIL` | `admin@example.com` | Login, defaults to the public seed admin |
| `E2E_PASSWORD` | `Admin1234!` | Login |
| `E2E_PORT` | `9222` | DevTools port |
| `E2E_HEADFUL` | *(unset)* | Set to `1` to watch the browser |

```bash
# watch it happen
E2E_HEADFUL=1 npm run test:e2e
```

## What `locale-switcher.mjs` covers

1. Login with a real typed-in form, not a pre-minted cookie
2. Dashboard renders Korean by default, and sets no `locale` cookie at all
3. Clicks **English** in the sidebar
4. Confirms the `setLocale` server action wrote `locale=en`, and that the cookie
   is `httpOnly` with `path=/`
5. Confirms the UI actually switched, then that English survives a hard reload and
   carries across `/hoohr/leave` and `/hoohr/expenses`
6. Clicks **한국어** to switch back, and confirms the cookie flips to `ko`
7. Confirms `<html lang>` follows the active locale
8. Signs out and lands on `/login`

Current result: **20/20**.

## Adding a case

`page.eval()` takes a function body, not an expression:

```js
const ok = await page.eval(`
  const btn = document.querySelector('button[type="submit"]');
  btn.click();
  return true;
`);
```

For React-controlled inputs, set the value through the native prototype setter and
fire an `input` event, otherwise React ignores the change:

```js
const set = (el, v) => {
  const desc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value");
  desc.set.call(el, v);
  el.dispatchEvent(new Event("input", { bubbles: true }));
};
```

Cookies are read with `Network.getAllCookies`, which is how the `httpOnly`
`locale` cookie is asserted even though `document.cookie` cannot see it.
