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
import { prisma } from "./prisma";
import {
  effectiveMailConfig,
  sendMail,
  sendMailWithConfig,
  type CompanySmtpRow,
  type MailResult,
} from "./mail";

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

// ============ 회사 알림 설정으로 발송 ============

/**
 * Sends through the company's notification settings saved on the setup
 * screen, falling back to env when the deployment overrides them. Best
 * effort like everything else here: never throws, callers ignore the result.
 */
export async function sendCompanyMail(
  companyId: string,
  input: Parameters<typeof sendMail>[0],
  onSuccess?: (messageId?: string) => Promise<void> | void,
): Promise<MailResult> {
  let row: CompanySmtpRow | null = null;
  try {
    row = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        smtpHost: true,
        smtpPort: true,
        smtpUser: true,
        smtpPass: true,
        smtpFrom: true,
        smtpSecure: true,
      },
    });
  } catch {
    row = null;
  }
  return sendMailWithConfig(effectiveMailConfig(row), input, onSuccess);
}

/** Active admins of a company, as mail recipients for new submissions. */
export async function adminRecipients(
  companyId: string,
): Promise<{ email: string; name: string }[]> {
  try {
    const admins = await prisma.user.findMany({
      where: { companyId, role: "ADMIN", isActive: true },
      select: { email: true, name: true },
      orderBy: { createdAt: "asc" },
    });
    return admins.filter((a) => a.email.trim().length > 0);
  } catch {
    return [];
  }
}

// ============ NOT-1: 휴가 승인 / 반려 ============

export function buildLeaveDecisionMessage(args: {
  to: string;
  requesterName: string;
  reviewerName: string;
  kind: "PTO" | "SICK" | "UNPAID";
  startDate: Date;
  endDate: Date;
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
  const body = interpolate(
    approved ? n.leaveDecision.approvedBody : n.leaveDecision.rejectedBody,
    { period, kind },
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
  args: Parameters<typeof buildLeaveDecisionMessage>[0] & { companyId?: string },
): Promise<MailResult> {
  const { companyId, ...message } = args;
  if (companyId) return sendCompanyMail(companyId, { to: message.to, ...buildLeaveDecisionMessage(message) });
  return sendMail({ to: message.to, ...buildLeaveDecisionMessage(message) });
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
  args: Parameters<typeof buildExpenseDecisionMessage>[0] & { companyId?: string },
): Promise<MailResult> {
  const { companyId, ...message } = args;
  if (companyId) return sendCompanyMail(companyId, { to: message.to, ...buildExpenseDecisionMessage(message) });
  return sendMail({ to: message.to, ...buildExpenseDecisionMessage(message) });
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
  args: Parameters<typeof buildInvitationMessage>[0] & { companyId?: string },
): Promise<MailResult> {
  const { companyId, ...message } = args;
  if (companyId) return sendCompanyMail(companyId, { to: message.to, ...buildInvitationMessage(message) });
  return sendMail({ to: args.to, ...buildInvitationMessage(args) });
}

// ============ NOT-1: 새 휴가 신청 (직원 → 관리자) ============

export function buildLeaveSubmittedMessage(args: {
  adminName: string;
  requesterName: string;
  kind: "PTO" | "SICK" | "UNPAID";
  startDate: Date;
  endDate: Date;
  reason?: string | null;
  locale?: Locale;
}): ComposedMessage {
  const locale = resolved(args.locale);
  const { common, notifications: n } = dictFor(locale);
  const intl = INTL_LOCALES[locale];

  const period = formatLeaveRange(args.startDate, args.endDate, intl);
  const kind = common.leaveKind[args.kind];
  const subject = interpolate(n.leaveSubmitted.subject, {
    app: n.appName,
    requester: args.requesterName,
    period,
  });
  const reason = args.reason?.trim();
  const lines = [
    interpolate(n.leaveSubmitted.body, { requester: args.requesterName, kind, period }),
    ...(reason ? [interpolate(n.leaveSubmitted.reasonLine, { reason })] : []),
  ];

  const text = [
    interpolate(n.leaveSubmitted.greeting, { name: args.adminName }),
    "",
    ...lines,
    "",
    `${n.leaveSubmitted.cta}: ${appUrl("/hoohr/leave")}`,
    "",
    n.footer,
  ].join("\n");

  const html = htmlShell(
    subject,
    [
      paragraph([interpolate(n.leaveSubmitted.greeting, { name: args.adminName })]),
      paragraph(lines),
      `<p><a href="${escapeHtml(appUrl("/hoohr/leave"))}">${escapeHtml(
        n.leaveSubmitted.cta,
      )}</a></p>`,
    ].join(""),
    n.footer,
  );

  return { subject, text, html };
}

export async function notifyLeaveSubmitted(
  args: Parameters<typeof buildLeaveSubmittedMessage>[0] & {
    to: string | string[];
    companyId: string;
  },
): Promise<MailResult> {
  const { to, companyId, ...message } = args;
  return sendCompanyMail(companyId, { to, ...buildLeaveSubmittedMessage(message) });
}

// ============ NOT-1: 새 지출 제출 (직원 → 관리자) ============

export function buildExpenseSubmittedMessage(args: {
  adminName: string;
  requesterName: string;
  title: string;
  totalAmountCents: number;
  currency: string;
  locale?: Locale;
}): ComposedMessage {
  const locale = resolved(args.locale);
  const { notifications: n } = dictFor(locale);
  const intl = INTL_LOCALES[locale];

  const amount = formatMoney(args.totalAmountCents, args.currency, intl);
  const subject = interpolate(n.expenseSubmitted.subject, {
    app: n.appName,
    requester: args.requesterName,
    title: args.title,
  });
  const body = interpolate(n.expenseSubmitted.body, {
    requester: args.requesterName,
    title: args.title,
    amount,
  });

  const text = [
    interpolate(n.expenseSubmitted.greeting, { name: args.adminName }),
    "",
    body,
    "",
    `${n.expenseSubmitted.cta}: ${appUrl("/hoohr/expenses")}`,
    "",
    n.footer,
  ].join("\n");

  const html = htmlShell(
    subject,
    [
      paragraph([interpolate(n.expenseSubmitted.greeting, { name: args.adminName })]),
      paragraph([body]),
      `<p><a href="${escapeHtml(appUrl("/hoohr/expenses"))}">${escapeHtml(
        n.expenseSubmitted.cta,
      )}</a></p>`,
    ].join(""),
    n.footer,
  );

  return { subject, text, html };
}

export async function notifyExpenseSubmitted(
  args: Parameters<typeof buildExpenseSubmittedMessage>[0] & {
    to: string | string[];
    companyId: string;
  },
): Promise<MailResult> {
  const { to, companyId, ...message } = args;
  return sendCompanyMail(companyId, { to, ...buildExpenseSubmittedMessage(message) });
}
