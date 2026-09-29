import "server-only";

/**
 * SMTP transport for the notification emails (NOT-1 / NOT-2).
 *
 * Three properties matter more than features here, and all three are load
 * bearing:
 *
 * 1. **It is a no-op when SMTP is not configured.** `SMTP_HOST` was already in
 *    `.env.example` as an empty placeholder, so a fresh clone runs with no mail
 *    at all. That has to keep working exactly as before, which is why every
 *    caller can ignore the result.
 *
 * 2. **It never throws.** An approval has already been committed by the time
 *    the mail goes out. If SMTP is down, the user's decision must not be
 *    reported as failed and must not be retried into a double approval. So a
 *    delivery failure is logged and swallowed.
 *
 * 3. **It cannot hang a request.** A blackholed SMTP port would otherwise pin a
 *    server action open for the default 120s. The timeouts below are short
 *    enough that a dead mail server degrades to a slow request, not a stuck one.
 *
 * The transport is created lazily and cached, so an unconfigured deployment
 * never loads nodemailer at all.
 */

import { createTransport, type Transporter } from "nodemailer";

export type MailConfig = {
  host: string;
  port: number;
  secure: boolean;
  auth?: { user: string; pass: string };
  from: string;
};

export type MailFailure = "not_configured" | "send_failed" | "no_recipient";

export type MailResult =
  | { sent: true; messageId?: string }
  | { sent: false; reason: MailFailure; detail?: string };

export type MailInput = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
};

let cached: Transporter | null = null;
let cachedFor: string | null = null;

/**
 * Returns the SMTP configuration, or null when mail is not set up.
 *
 * Host is the only required field: a local relay such as MailHog or a
 * credential-less relay on `localhost:1025` is a legitimate setup, so auth is
 * only attached when both a user and a password are present.
 */
export function mailConfig(): MailConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) return null;

  const port = Number(process.env.SMTP_PORT || 587) || 587;
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const explicitSecure = process.env.SMTP_SECURE?.trim();

  return {
    host,
    port,
    // Port 465 is implicit TLS. Everything else uses STARTTLS, which is why
    // `secure` must not be derived from the host being non-empty.
    secure: explicitSecure ? explicitSecure === "true" : port === 465,
    auth: user && pass ? { user, pass } : undefined,
    from: process.env.SMTP_FROM?.trim() || "HOOHR <no-reply@localhost>",
  };
}

export function mailEnabled(): boolean {
  return mailConfig() !== null;
}

function transporter(config: MailConfig): Transporter {
  // The config is derived from env, so keying the cache on it means a changed
  // host or port rebuilds the transport instead of silently reusing the old one.
  const key = `${config.host}:${config.port}:${config.secure}:${config.auth?.user ?? ""}`;
  if (cached && cachedFor === key) return cached;
  cached = createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
    // Short on purpose: see property 3 above.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  cachedFor = key;
  return cached;
}

/** Exposed for tests, so a stale cached transport cannot leak between cases. */
export function resetMailerForTests(): void {
  cached = null;
  cachedFor = null;
}

/**
 * Sends one message. Returns a result instead of throwing, always.
 *
 * @param onSuccess optional hook that runs only when the message was actually
 *   accepted by the server. The digest uses it to record delivery, so a failed
 *   send stays eligible for the next run instead of being marked as notified.
 */
export async function sendMail(
  input: MailInput,
  onSuccess?: (messageId?: string) => Promise<void> | void,
): Promise<MailResult> {
  const config = mailConfig();
  if (!config) return { sent: false, reason: "not_configured" };

  const recipients = (Array.isArray(input.to) ? input.to : [input.to]).filter(
    (a) => a.trim().length > 0,
  );
  if (recipients.length === 0) return { sent: false, reason: "no_recipient" };

  try {
    const info = await transporter(config).sendMail({
      from: config.from,
      to: recipients.join(", "),
      subject: input.subject,
      text: input.text,
      html: input.html,
      replyTo: input.replyTo,
    });
    const messageId = typeof info.messageId === "string" ? info.messageId : undefined;
    if (onSuccess) await onSuccess(messageId);
    return { sent: true, messageId };
  } catch (e) {
    // Deliberately not rethrown. See property 2 above.
    console.error(
      `[mail] send failed to ${recipients.join(", ")}: ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
    return {
      sent: false,
      reason: "send_failed",
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}
