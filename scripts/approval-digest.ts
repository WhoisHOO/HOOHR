/**
 * NOT-2 entry point: sends the batched approval digest.
 *
 * Intended to be run from cron (or an Airflow task, alongside the other
 * pipelines) rather than from the app. It is a plain script so it can be
 * scheduled on any host with the repo checked out, without adding a scheduler
 * to the application process.
 *
 *   npx tsx scripts/approval-digest.ts                 # send
 *   npx tsx scripts/approval-digest.ts --dry-run       # report only, no writes
 *   npx tsx scripts/approval-digest.ts --locale en
 *   npx tsx scripts/approval-digest.ts --company <cuid>
 *
 * Exit codes are the useful part for a cron job: 0 on success (including the
 * "nothing to send" and "SMTP not configured" cases, which are not errors),
 * 1 on a failure that needs attention. A cron entry that always exits 0 is how
 * a broken mailer goes unnoticed for months.
 */
import "dotenv/config";
// Installs the `server-only` stub as a side effect; see that file for why the
// lib imports below have to be dynamic.
import "./server-only-stub";

import { isLocale, DEFAULT_LOCALE, type Locale } from "@/i18n/config";

type Args = {
  dryRun: boolean;
  locale: Locale;
  companyId?: string;
};

function parseArgs(argv: string[]): Args {
  const args: Args = { dryRun: false, locale: DEFAULT_LOCALE };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--locale") {
      const value = argv[++i];
      if (!isLocale(value)) {
        throw new Error(`--locale must be "ko" or "en", got "${value}"`);
      }
      args.locale = value;
    } else if (arg === "--company") {
      const value = argv[++i];
      if (!value) throw new Error("--company needs a company id");
      args.companyId = value;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

async function main() {
  // Dynamic, so the `server-only` stub above is already installed by the time
  // these modules are evaluated.
  const { runApprovalDigest, collectDigestPlans } = await import(
    "@/lib/approval-digest"
  );
  const { mailEnabled } = await import("@/lib/mail");

  const args = parseArgs(process.argv.slice(2));

  // Dry run is checked first on purpose: previewing what *would* be sent is
  // exactly what you want while SMTP is still unconfigured, which is the state
  // this script is most often first run in.
  if (args.dryRun) {
    const plans = await collectDigestPlans({ companyId: args.companyId });
    const total = plans.reduce((n, p) => n + p.items.length, 0);
    console.log(`[digest] dry run — ${plans.length} reviewer(s), ${total} pending item(s)`);
    for (const plan of plans) {
      console.log(`  ${plan.reviewerEmail}  (${plan.items.length})`);
      for (const item of plan.items) {
        console.log(`    - ${item.kind}  ${item.requesterName}`);
      }
    }
    return 0;
  }

  if (!mailEnabled()) {
    // Not a failure: a deployment that has not configured SMTP yet should not
    // page whoever watches the cron log every morning.
    console.log("[digest] SMTP is not configured (SMTP_HOST is empty) — nothing to send.");
    console.log("[digest] set SMTP_HOST/SMTP_FROM in .env, or point SMTP_HOST at a local relay.");
    return 0;
  }

  const result = await runApprovalDigest({
    companyId: args.companyId,
    locale: args.locale,
  });

  console.log(
    `[digest] planned=${result.planned} sent=${result.sent} ` +
      `already-notified=${result.skippedAlreadyNotified} failed=${result.failed}`,
  );

  if (result.failed > 0) return 1;
  return 0;
}

main()
  .then((code) => {
    process.exit(code);
  })
  .catch((e) => {
    console.error("[digest] failed:", e);
    process.exit(1);
  });
