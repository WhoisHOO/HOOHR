// TEMPORARY: verifies receipt storage still works after the turbopackIgnore
// change. The change only affects the bundler's static analysis, so the runtime
// behaviour of saveReceipt/removeReceipt/receiptPath must be identical.
import "dotenv/config";
import { mkdirSync, existsSync } from "fs";
import path from "path";
import { createRequire } from "module";

// src/lib/storage.ts starts with `import "server-only"`, which deliberately
// throws outside a React Server Component so the module can never reach a client
// bundle. Next.js aliases it to an empty module for the server build; do the
// same here, otherwise the guard fires before a single assertion runs.
const nodeRequire = createRequire(__filename);
const serverOnlyPath = nodeRequire.resolve("server-only");
nodeRequire.cache[serverOnlyPath] = {
  id: serverOnlyPath,
  filename: serverOnlyPath,
  loaded: true,
  exports: {},
  children: [],
  paths: [],
} as unknown as NodeModule;

const dir = path.join(process.cwd(), "uploads");
mkdirSync(dir, { recursive: true });

const results: [string, boolean, string][] = [];
function check(label: string, ok: boolean, detail = "") {
  results.push([label, ok, detail]);
}

async function main() {
const { saveReceipt, removeReceipt, receiptPath } = await import("./src/lib/storage");

// A tiny real PNG so the MIME whitelist is exercised, not stubbed.
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const file = new File([png], "receipt.png", { type: "image/png" });

const saved = await saveReceipt(file);
check("valid PNG is accepted", saved.ok, JSON.stringify(saved.ok ? saved.stored.storedName : saved.error));
if (!saved.ok) {
  console.error("aborting: valid receipt was rejected");
  process.exit(1);
}

const name = saved.stored.storedName;
check("file exists on disk at receiptPath", existsSync(receiptPath(name)));
check(
  "original filename is preserved for display",
  saved.stored.filename === "receipt.png",
  saved.stored.filename,
);
check("mime type recorded", saved.stored.mimeType === "image/png", saved.stored.mimeType);
check("size recorded", saved.stored.size === png.length, `${saved.stored.size}`);

const empty = await saveReceipt(new File([], "e.png", { type: "image/png" }));
check("empty file rejected as EMPTY", !empty.ok && empty.error === "EMPTY", String(!empty.ok && empty.error));

const big = await saveReceipt(
  new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.png", { type: "image/png" }),
);
check("oversized file rejected as TOO_LARGE", !big.ok && big.error === "TOO_LARGE", String(!big.ok && big.error));

const bad = await saveReceipt(new File([png], "x.exe", { type: "application/x-msdownload" }));
check("wrong type rejected as UNSUPPORTED_TYPE", !bad.ok && bad.error === "UNSUPPORTED_TYPE", String(!bad.ok && bad.error));

// Path traversal must stay contained: basename() is what stops "../../etc/x".
const traversal = receiptPath("../../../etc/passwd");
check("path traversal is contained by basename()", !traversal.includes(".."), traversal);

await removeReceipt(name);
check("removeReceipt deletes the file", !existsSync(receiptPath(name)));
await removeReceipt(name);
check("removeReceipt on a missing file is a no-op", true);

let failed = 0;
for (const [label, ok, detail] of results) {
  if (!ok) failed++;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${label}${detail ? "  " + detail : ""}`);
}
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
