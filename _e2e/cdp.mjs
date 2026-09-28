// Minimal Chrome DevTools Protocol driver.
// Zero dependencies: uses Node 22+ built-in WebSocket and fetch.
// Used to verify real user flows that cannot be exercised over curl,
// because Next.js server actions are not reachable with a plain POST.

import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CANDIDATES = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch({ port = 9222, headless = true } = {}) {
  const bin = CANDIDATES.find((p) => existsSync(p));
  if (!bin) throw new Error("no Chrome/Edge binary found");

  const profile = mkdtempSync(join(tmpdir(), "cdp-profile-"));
  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--disable-background-networking",
    "--disable-gpu",
    "--window-size=1280,1400",
    "about:blank",
  ];
  if (headless) args.unshift("--headless=new");

  const proc = spawn(bin, args, { stdio: "ignore", detached: false });

  // wait for the debugger endpoint
  let info = null;
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (r.ok) {
        info = await r.json();
        break;
      }
    } catch {
      /* not up yet */
    }
    await sleep(100);
  }
  if (!info) {
    proc.kill();
    throw new Error("devtools endpoint never came up");
  }

  return {
    bin,
    port,
    proc,
    profile,
    version: info["Browser"],
    async close() {
      try {
        proc.kill();
      } catch {}
      try {
        rmSync(profile, { recursive: true, force: true });
      } catch {}
    },
  };
}

class Session {
  constructor(ws, sessionId) {
    this.ws = ws;
    this.sessionId = sessionId;
    this.seq = 0;
    this.pending = new Map();
    this.listeners = new Set();
  }

  send(method, params = {}) {
    const id = ++this.seq;
    const msg = { id, method, params };
    if (this.sessionId) msg.sessionId = this.sessionId;
    this.ws.send(JSON.stringify(msg));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  on(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  handle(msg) {
    if (msg.id && this.pending.has(msg.id)) {
      const { resolve, reject } = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      if (msg.error) reject(new Error(`${msg.error.message} (${msg.error.code})`));
      else resolve(msg.result);
      return;
    }
    for (const fn of this.listeners) fn(msg);
  }
}

export async function connect(port) {
  const r = await fetch(`http://127.0.0.1:${port}/json/version`);
  const { webSocketDebuggerUrl } = await r.json();
  const ws = new WebSocket(webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener("open", res, { once: true });
    ws.addEventListener("error", rej, { once: true });
  });

  const root = new Session(ws, null);
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.sessionId) {
      root.emitSession?.(msg);
    }
    root.handle(msg);
  });

  const sessions = new Map();
  root.emitSession = (msg) => {
    const s = sessions.get(msg.sessionId);
    if (s) s.handle(msg);
  };

  return {
    ws,
    root,
    async newPage(url = "about:blank") {
      const { targetId } = await root.send("Target.createTarget", { url });
      const { sessionId } = await root.send("Target.attachToTarget", {
        targetId,
        flatten: true,
      });
      const s = new Session(ws, sessionId);
      sessions.set(sessionId, s);
      await s.send("Page.enable");
      await s.send("Runtime.enable");
      await s.send("Network.enable");
      return new Page(s, targetId);
    },
    async close() {
      try {
        ws.close();
      } catch {}
    },
  };
}

export class Page {
  constructor(session, targetId) {
    this.s = session;
    this.targetId = targetId;
  }

  async goto(url, { waitUntil = "load", timeout = 30000 } = {}) {
    const done = new Promise((resolve, reject) => {
      const ev = waitUntil === "load" ? "Page.loadEventFired" : "Page.domContentEventFired";
      const t = setTimeout(() => {
        off();
        reject(new Error(`goto timeout ${url}`));
      }, timeout);
      const off = this.s.on((msg) => {
        if (msg.method === ev) {
          clearTimeout(t);
          off();
          resolve();
        }
      });
    });
    const r = await this.s.send("Page.navigate", { url });
    if (r.errorText) throw new Error(`navigate failed: ${r.errorText}`);
    await done;
    return this;
  }

  async url() {
    const r = await this.s.send("Runtime.evaluate", {
      expression: "location.href",
      returnByValue: true,
    });
    return r.result.value;
  }

  async eval(expression) {
    const r = await this.s.send("Runtime.evaluate", {
      expression: `(() => { ${expression} })()`,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails) {
      const d = r.exceptionDetails;
      throw new Error(`eval: ${d.exception?.description || d.text}`);
    }
    return r.result.value;
  }

  async text() {
    return this.eval("return document.body.innerText;");
  }

  async cookies() {
    const r = await this.s.send("Network.getAllCookies");
    return r.cookies;
  }

  async close() {
    try {
      await this.s.send("Page.close");
    } catch {}
  }
}

export { sleep };
