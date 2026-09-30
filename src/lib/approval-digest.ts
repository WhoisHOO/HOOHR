import "server-only";

/**
 * NOT-2: the batched "you have approvals waiting" digest.
 *
 * Two design points are worth stating up front.
 *
 * **The plan must match the inbox.** `collectDigestPlans` deliberately reuses
 * `approvalInboxEmployeeWhere` — the exact predicate the leave and expense
 * pages use to build their pending lists. A digest that mentioned a request the
 * inbox hides (or missed one it shows) would be worse than no email, so the
 * query is shared rather than reimplemented. This is also why the digest costs
 * one query pair per reviewer: correctness first, and the reviewer count is
 * bounded by the org chart.
 *
 * **Idempotency is enforced by the database, not by a check.** Each
 * (recipient, request) pair is claimed by inserting a `Notification` row whose
 * `link` is the natural key, and `link` carries a unique index (see migration
 * `notification_link_unique`). A second overlapping run hits P2002 and skips
 * instead of sending a duplicate. The claim is released again if the send then
 * fails, so a mail outage costs a run rather than a notification.
 *
 * That table is the same one NOT-3 will render in-app later, which is why the
 * rows carry a real `title`/`body` and `type` rather than a private marker.
 */

import { prisma } from "@/lib/prisma";
import {
  approvalInboxEmployeeWhere,
  approvalReviewerFromUser,
  isApprovalReviewer,
} from "@/lib/team";
import { getCompanyLocale } from "@/lib/company";
import { INTL_LOCALES, type Locale } from "@/i18n/config";
import { dictionaries } from "@/i18n/dictionaries";
import { interpolate } from "@/i18n/format";
import { formatLeaveRange } from "./leave";
import { formatMoney } from "./expense";
import { sendMail, type MailResult } from "./mail";
import { appUrl, escapeHtml, type ComposedMessage } from "./notifications";

export type DigestItem =
  | {
      kind: "leave";
      id: string;
      link: string;
      requesterName: string;
      leaveKind: "PTO" | "SICK" | "UNPAID";
      startDate: Date;
      endDate: Date;
      days: number;
    }
  | {
      kind: "expense";
      id: string;
      link: string;
      requesterName: string;
      title: string;
      totalAmountCents: number;
      currency: string;
    };

export type DigestPlan = {
  companyId: string;
  reviewerId: string;
  reviewerName: string;
  reviewerEmail: string;
  items: DigestItem[];
};

export type DigestResult = {
  planned: number;
  sent: number;
  skippedAlreadyNotified: number;
  failed: number;
  /** Set when SMTP is unconfigured, so the caller can say so rather than claim success. */
  disabled: boolean;
  dryRun: boolean;
};

function digestLink(kind: DigestItem["kind"], id: string): string {
  return `digest:${kind}:${id}`;
}

/** Prisma's unique-constraint violation. */
function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    (e as { code?: unknown }).code === "P2002"
  );
}

/**
 * Reads what each eligible reviewer is waiting on. Performs no writes, so this
 * is safe to call from a dry run and is the unit under test.
 */
export async function collectDigestPlans(opts?: {
  companyId?: string;
}): Promise<DigestPlan[]> {
  const reviewers = await prisma.user.findMany({
    where: {
      ...(opts?.companyId ? { companyId: opts.companyId } : {}),
      isActive: true,
      role: { in: ["MANAGER", "ADMIN"] },
    },
    select: {
      id: true,
      companyId: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      employee: { select: { id: true, companyId: true, status: true } },
    },
    orderBy: { id: "asc" },
  });

  const plans: DigestPlan[] = [];

  for (const reviewer of reviewers) {
    // Same gate the pages use; a MANAGER with no active employee record cannot
    // review anything, so their inbox is empty and they need no digest.
    const flat = approvalReviewerFromUser(reviewer);
    if (!isApprovalReviewer(flat)) continue;

    const scope = approvalInboxEmployeeWhere(flat);
    const [leaves, reports] = await Promise.all([
      prisma.leaveRequest.findMany({
        where: { companyId: reviewer.companyId, status: "PENDING", employee: scope },
        include: { policy: true, employee: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.expenseReport.findMany({
        where: { companyId: reviewer.companyId, status: "SUBMITTED", employee: scope },
        include: { employee: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const items: DigestItem[] = [
      ...leaves.map(
        (l): DigestItem => ({
          kind: "leave",
          id: l.id,
          link: digestLink("leave", l.id),
          requesterName: l.employee.name,
          leaveKind: l.policy.kind,
          startDate: l.startDate,
          endDate: l.endDate,
          days: l.days,
        }),
      ),
      ...reports.map(
        (r): DigestItem => ({
          kind: "expense",
          id: r.id,
          link: digestLink("expense", r.id),
          requesterName: r.employee.name,
          title: r.title,
          totalAmountCents: r.totalAmountCents,
          currency: r.currency,
        }),
      ),
    ];

    if (items.length > 0) {
      plans.push({
        companyId: reviewer.companyId,
        reviewerId: reviewer.id,
        reviewerName: reviewer.name,
        reviewerEmail: reviewer.email,
        items,
      });
    }
  }

  return plans;
}

/** Renders one reviewer's digest. Exported so the shape can be asserted in tests. */
export function renderDigest(plan: DigestPlan, locale: Locale): ComposedMessage {
  const { common, notifications: n } = dictionaries[locale];
  const intl = INTL_LOCALES[locale];

  const leaveItems = plan.items.filter((i) => i.kind === "leave");
  const expenseItems = plan.items.filter((i) => i.kind === "expense");
  const count = plan.items.length;

  const subject = interpolate(n.digest.subject, { app: n.appName, count });
  const leaveLines = leaveItems.map((i) =>
    interpolate(n.digest.leaveItem, {
      period: formatLeaveRange(i.startDate, i.endDate, intl),
      kind: common.leaveKind[i.leaveKind],
      days: interpolate(common.units.days, { n: i.days }),
      requester: i.requesterName,
    }),
  );
  const expenseLines = expenseItems.map((i) =>
    interpolate(n.digest.expenseItem, {
      title: i.title,
      amount: formatMoney(i.totalAmountCents, i.currency, intl),
      requester: i.requesterName,
    }),
  );

  const textSections = [
    interpolate(n.digest.greeting, { name: plan.reviewerName }),
    "",
    n.digest.intro,
  ];
  if (leaveLines.length > 0) {
    textSections.push("", n.digest.leaveHeading, ...leaveLines, "", n.digest.leaveCta, appUrl("/hoohr/leave"));
  }
  if (expenseLines.length > 0) {
    textSections.push("", n.digest.expenseHeading, ...expenseLines, "", n.digest.expenseCta, appUrl("/hoohr/expenses"));
  }
  if (count === 0) textSections.push("", n.digest.emptyNote);
  textSections.push("", n.digest.signature);

  // The HTML part escapes every interpolated value because requester names and
  // report titles are user input.
  const htmlSections = [
    `<p>${escapeHtml(interpolate(n.digest.greeting, { name: plan.reviewerName }))}</p>`,
    `<p>${escapeHtml(n.digest.intro)}</p>`,
  ];
  if (leaveLines.length > 0) {
    htmlSections.push(
      `<h3>${escapeHtml(n.digest.leaveHeading)}</h3><ul>${leaveLines
        .map((l) => `<li>${escapeHtml(l)}</li>`)
        .join("")}</ul><p><a href="${escapeHtml(appUrl("/hoohr/leave"))}">${escapeHtml(
        n.digest.leaveCta,
      )}</a></p>`,
    );
  }
  if (expenseLines.length > 0) {
    htmlSections.push(
      `<h3>${escapeHtml(n.digest.expenseHeading)}</h3><ul>${expenseLines
        .map((l) => `<li>${escapeHtml(l)}</li>`)
        .join("")}</ul><p><a href="${escapeHtml(appUrl("/hoohr/expenses"))}">${escapeHtml(
        n.digest.expenseCta,
      )}</a></p>`,
    );
  }
  if (count === 0) htmlSections.push(`<p>${escapeHtml(n.digest.emptyNote)}</p>`);
  htmlSections.push(`<p style="color:#888;font-size:12px">${escapeHtml(n.digest.signature)}</p>`);

  return { subject, text: textSections.join("\n"), html: htmlSections.join("") };
}

/**
 * Claims one (recipient, request) pair. Returns false when another run already
 * claimed it, which is the only signal used to suppress a duplicate send.
 */
async function claim(args: {
  companyId: string;
  userId: string;
  link: string;
  type: "LEAVE_REQUEST" | "EXPENSE_REQUEST";
  title: string;
  body: string;
}): Promise<boolean> {
  try {
    await prisma.notification.create({
      data: {
        companyId: args.companyId,
        userId: args.userId,
        link: args.link,
        type: args.type,
        title: args.title,
        body: args.body,
      },
    });
    return true;
  } catch (e) {
    if (isUniqueViolation(e)) return false;
    throw e;
  }
}

/**
 * Releases a claim so a failed send is retried on the next run.
 *
 * Scoped by `userId` as well as `link`. A plain `deleteMany({ where: { link } })`
 * would drop *every* recipient's claim for that link, including the ones whose
 * digests were delivered successfully in the same run — the failure of one
 * reviewer's send would silently unsubscribe the others.
 */
async function release(userId: string, link: string): Promise<void> {
  try {
    await prisma.notification.deleteMany({ where: { userId, link } });
  } catch (e) {
    console.error(`[digest] could not release claim ${userId}/${link}: ${e}`);
  }
}

export async function runApprovalDigest(opts?: {
  companyId?: string;
  locale?: Locale;
  dryRun?: boolean;
}): Promise<DigestResult> {
  // Same rule as the screens: the language is the company's country. `--locale`
  // is only an override, for previewing the other language in a cron log.
  const locale = opts?.locale ?? (await getCompanyLocale(opts?.companyId));
  const dryRun = opts?.dryRun ?? false;
  const result: DigestResult = {
    planned: 0,
    sent: 0,
    skippedAlreadyNotified: 0,
    failed: 0,
    disabled: false,
    dryRun,
  };

  const plans = await collectDigestPlans({ companyId: opts?.companyId });
  result.planned = plans.length;
  if (plans.length === 0) return result;

  // Probe the transport once: a deployment with no SMTP should report
  // `disabled` instead of counting a wall of silent no-ops as "sent".
  const probe = await sendMail({
    to: "",
    subject: "",
    text: "",
  });
  if (probe.sent === false && probe.reason === "not_configured") {
    result.disabled = true;
    return result;
  }

  for (const plan of plans) {
    const message = renderDigest(plan, locale);
    const claimed: DigestItem[] = [];

    for (const item of plan.items) {
      const description =
        item.kind === "leave"
          ? interpolate(dictionaries[locale].notifications.digest.leaveItem, {
              period: formatLeaveRange(item.startDate, item.endDate, INTL_LOCALES[locale]),
              kind: dictionaries[locale].common.leaveKind[item.leaveKind],
              days: interpolate(dictionaries[locale].common.units.days, { n: item.days }),
              requester: item.requesterName,
            })
          : interpolate(dictionaries[locale].notifications.digest.expenseItem, {
              title: item.title,
              amount: formatMoney(item.totalAmountCents, item.currency, INTL_LOCALES[locale]),
              requester: item.requesterName,
            });

      if (dryRun) {
        result.sent += 1;
        continue;
      }

      const ok = await claim({
        companyId: plan.companyId,
        userId: plan.reviewerId,
        link: item.link,
        type: item.kind === "leave" ? "LEAVE_REQUEST" : "EXPENSE_REQUEST",
        title:
          item.kind === "leave"
            ? dictionaries[locale].notifications.digest.leaveHeading
            : dictionaries[locale].notifications.digest.expenseHeading,
        body: description,
      });

      if (!ok) {
        result.skippedAlreadyNotified += 1;
        continue;
      }
      claimed.push(item);
    }

    if (dryRun) continue;

    // A plan whose items were all already claimed has nothing new to say, so
    // do not send an email that just repeats yesterday's.
    if (claimed.length === 0) continue;

    const sent: MailResult = await sendMail({
      to: plan.reviewerEmail,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });

    if (sent.sent) {
      result.sent += 1;
      continue;
    }

    // Release every claim so the whole plan is retried next run rather than
    // being partially delivered.
    result.failed += 1;
    for (const item of claimed) await release(plan.reviewerId, item.link);
  }

  return result;
}
