<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Language

- **Talk to the user in Korean.** Every question, explanation, status update and
  summary goes in Korean, including when the user writes in English.
- **Write code in English.** Identifiers, comments, docstrings, log messages,
  test names, commit messages and the repository's written artifacts (README,
  `docs/`) are all English. This is the same rule that decided the language of
  the app's own UI: one codebase, one language for the code, and Korean only
  where Korean is the product.
- Ask before assuming. Product questions ("should this be a feature", "which of
  these two") go to the user rather than being resolved silently.

## Where work gets recorded

`LOG.md` is the project's memory, and it is maintained rather than appended to
blindly. Per session: a `### Session N` heading, what was actually **verified**
(as opposed to what was intended), the defects that verification turned up, and
the result. The `## 📍 Current Status` block and `## 💡 Dev Conventions` at the
top must be corrected in the same commit, because a session log that disagrees
with the status block is worse than none. `docs/REQUIREMENTS.md` holds the
product decisions; code, and its comments, hold the reasoning next to the thing
it explains.

The standing habit worth keeping: **verify, do not assert.** A feature is done
when it was exercised — run the installer, open the browser, check the result
from outside the machine — not when the code compiles. Most defects in this
project were invisible from `npm run dev`.
