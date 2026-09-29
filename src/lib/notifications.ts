import "server-only";

/**
 * Builds and sends the NOT-1 notification emails.
 *
 * Every exported function here is best-effort: callers ignore the return value,
 * and `sendMail` does not throw. That is deliberate. A leave approval has
 * already been committed to the database by the time this runs, so an SMTP
 * outage must not turn a successful decision into a red error banner — and it
 * must not tempt anyone into a retry that would double-approve.
 *
 * Locale is an explicit argument rather than read from the request cookie,
 * because the NOT-2 digest runs from a cron job with no request at all.
 *
 * Both a `text` and an `html` part are sent. The HTML is hand-escaped with no
 * template dependency, which matters here specifically because report titles,
 * rejection reasons and employee names are all user input and are interpolated
 * straight into the markup.
 */

import { DEFAULT_LOCALE, INTL_LOCALES, type Locale } from "@/i18n/config";
import { dictionaries } from "@/i18n/dictionaries";
import { interpolate } from "@/i18n/format";
import { formatLeaveRange } from "./leave";
import { formatMoney } from "./expense";
import { sendMail, type MailResult } from "./mail";

export type LeaveDecisionOutcome = "APPROVED" | "REJECTED";
export type ExpenseDecisionOutcome = "APPROVED" | "REJECTED" | "PAID";

/** A composed message, ready to hand to `sendMail`. */
export type ComposedMessage = { subject: string; text: string; html: string };

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escapes text destined for the HTML part. Applied to every user-supplied value. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

function paragraph(lines: string[]): string {
  return `<p>${lines.map(escapeHtml).join("<br>")}</p>`;
}

/** Wraps already-escaped body HTML in a minimal, dependency-free shell. */
function htmlShell(title: string, bodyHtml: string, footer: string): string {
  return [
    "<!doctype html><html><body>",
    `<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.6">`,
    `<h2 style="font-size:16px;margin:0 0 12px">${escapeHtml(title)}</h2>`,
    bodyHtml,
    `<hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0 12px">`,
    `<p style="color:#888;font-size:12px">${escapeHtml(footer)}</p>`,
    "</div></body></html>",
  ].join("");
}

/** Absolute link helper. Mirrors the existing `APP_URL` convention in auth.ts. */
export function appUrl(path: string): string {
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
  return `${base}${path}`;
}

function dictFor(locale: Locale) {
  return dictionaries[locale];
}

function resolved(locale: Locale | undefined): Locale {
  return locale ?? DEFAULT_LOCALE;
}

// ============ NOT-1: 휴가 승인 / 반려 ============

export function buildLeaveDecisionMessage(args: {
  to: string;
  requesterName: string;
  reviewerName: string;
  kind: "PTO" | "SICK" | "UNPAID";
  startDate: Date;
  endDate: Date;
  days: number;
  decision: LeaveDecisionOutcome;
  comment?: string | null;
  locale?: Locale;
}): ComposedMessage {
  const locale = resolved(args.locale);
  const { common, notifications: n } = dictFor(locale);
  const intl = INTL_LOCALES[locale];

  const approved = args.decision === "APPROVED";
  const subject = interpolate(
    approved ? n.leaveDecision.approvedSubject : n.leaveDecision.rejectedSubject,
    { app: n.appName },
  );
  const period = formatLeaveRange(args.startDate, args.endDate, intl);
  const kind = common.leaveKind[args.kind];
  const days = interpolate(common.units.days, { n: args.days });
  const body = interpolate(
    approved ? n.leaveDecision.approvedBody : n.leaveDecision.rejectedBody,
    { period, kind, days },
  );
  const comment = args.comment?.trim();

  const text = [
    interpolate(n.leaveDecision.greeting, { name: args.requesterName }),
    "",
    body,
    "",
    `${n.leaveDecision.commentLabel}: ${comment || n.leaveDecision.noComment}`,
    `${args.reviewerName}`,
    "",
    `${n.leaveDecision.cta}: ${appUrl("/hoohr/leave")}`,
    "",
    n.footer,
  ].join("\n");

  const html = htmlShell(
    subject,
    [
      paragraph([interpolate(n.leaveDecision.greeting, { name: args.requesterName })]),
      paragraph([body]),
      paragraph([
        `${n.leaveDecision.commentLabel}: ${comment || n.leaveDecision.noComment}`,
        args.reviewerName,
      ]),
      `<p><a href="${escapeHtml(appUrl("/hoohr/leave"))}">${escapeHtml(
        n.leaveDecision.cta,
      )}</a></p>`,
    ].join(""),
    n.footer,
  );

  return { subject, text, html };
}

export async function notifyLeaveDecision(
  args: Parameters<typeof buildLeaveDecisionMessage>[0],
): Promise<MailResult> {
  return sendMail({ to: args.to, ...buildLeaveDecisionMessage(args) });
}

// ============ NOT-1: 지출 승인 / 반려 / 지급 완료 ============

export function buildExpenseDecisionMessage(args: {
  to: string;
  requesterName: string;
  reviewerName: string;
  title: string;
  totalAmountCents: number;
  currency: string;
  decision: ExpenseDecisionOutcome;
  comment?: string | null;
  locale?: Locale;
}): ComposedMessage {
  const locale = resolved(args.locale);
  const { notifications: n } = dictFor(locale);
  const intl = INTL_LOCALES[locale];

  const key =
    args.decision === "APPROVED"
      ? "approvedSubject"
      : args.decision === "PAID"
        ? "paidSubject"
        : "rejectedSubject";
  const bodyKey = args.decision === "PAID" ? "paidBody" : args.decision === "APPROVED" ? "approvedBody" : "rejectedBody";

  const subject = interpolate(n.expenseDecision[key], { app: n.appName });
  const body = interpolate(n.expenseDecision[bodyKey], { title: args.title });
  const amount = formatMoney(args.totalAmountCents, args.currency, intl);
  const comment = args.comment?.trim();

  // The reviewer comment only earns a line on the decision paths; the paid
  // notice is terminal, so replaying the approval opinion there is noise.
  const decisionLines =
    args.decision === "PAID"
      ? [`${n.expenseDecision.amountLabel}: ${amount}`]
      : [
          `${n.expenseDecision.amountLabel}: ${amount}`,
          `${n.expenseDecision.commentLabel}: ${comment || n.expenseDecision.noComment}`,
          args.reviewerName,
        ];

  const text = [
    interpolate(n.expenseDecision.greeting, { name: args.requesterName }),
    "",
    body,
    "",
    ...decisionLines,
    "",
    `${n.expenseDecision.cta}: ${appUrl("/hoohr/expenses")}`,
    "",
    n.footer,
  ].join("\n");

  const html = htmlShell(
    subject,
    [
      paragraph([interpolate(n.expenseDecision.greeting, { name: args.requesterName })]),
      paragraph([body]),
      paragraph(decisionLines),
      `<p><a href="${escapeHtml(appUrl("/hoohr/expenses"))}">${escapeHtml(
        n.expenseDecision.cta,
      )}</a></p>`,
    ].join(""),
    n.footer,
  );

  return { subject, text, html };
}

export async function notifyExpenseDecision(
  args: Parameters<typeof buildExpenseDecisionMessage>[0],
): Promise<MailResult> {
  return sendMail({ to: args.to, ...buildExpenseDecisionMessage(args) });
}

// ============ NOT-1: 초대 ============

export function buildInvitationMessage(args: {
  to: string;
  name: string;
  companyName: string;
  inviteUrl: string;
  expiresAt: Date;
  locale?: Locale;
}): ComposedMessage {
  const locale = resolved(args.locale);
  const { notifications: n } = dictFor(locale);

  const subject = interpolate(n.invite.subject, {
    app: n.appName,
    company: args.companyName,
  });
  // Rendered in UTC because the token was minted with an absolute 7 day
  // expiry, and the recipient may be in any timezone.
  const expiry = new Intl.DateTimeFormat(INTL_LOCALES[locale], {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(args.expiresAt);

  const text = [
    interpolate(n.invite.greeting, { name: args.name }),
    "",
    interpolate(n.invite.intro, { company: args.companyName }),
    "",
    `${n.invite.cta}: ${args.inviteUrl}`,
    interpolate(n.invite.expires, { date: expiry }),
    "",
    n.footer,
  ].join("\n");

  const html = htmlShell(
    subject,
    [
      paragraph([interpolate(n.invite.greeting, { name: args.name })]),
      paragraph([interpolate(n.invite.intro, { company: args.companyName })]),
      `<p><a href="${escapeHtml(args.inviteUrl)}">${escapeHtml(n.invite.cta)}</a></p>`,
      paragraph([interpolate(n.invite.expires, { date: expiry })]),
    ].join(""),
    n.footer,
  );

  return { subject, text, html };
}

export async function notifyInvitation(
  args: Parameters<typeof buildInvitationMessage>[0],
): Promise<MailResult> {
  return sendMail({ to: args.to, ...buildInvitationMessage(args) });
}
