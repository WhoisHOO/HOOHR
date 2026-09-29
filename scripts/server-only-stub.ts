/**
 * Neutralises the `server-only` guard for scripts that run outside Next.js.
 *
 * Modules such as `src/lib/mail.ts` begin with `import "server-only"`, whose
 * entire job is to throw when the module is reached from a Client Component
 * bundle. Next.js aliases it to an empty module for the server build; under a
 * bare `tsx` run there is no alias, so the real module throws before a single
 * line of the script executes.
 *
 * Import this for its side effect only, and only from a module whose own
 * `src/lib` imports are *dynamic*:
 *
 *   import "./server-only-stub";
 *   const { sendMail } = await import("../src/lib/mail");
 *
 * A static `import` would be hoisted and evaluated before this file's body runs,
 * so the guard would still fire. Keep the `await import()` inside the function.
 */
import { createRequire } from "module";

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

export const serverOnlyStubInstalled = true;
