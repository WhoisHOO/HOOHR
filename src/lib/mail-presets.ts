/**
 * Mail provider presets: picking Gmail/Naver/Outlook fills host, port and
 * encryption automatically, so the admin only types their email address and
 * password. "Custom" leaves everything editable. Client-safe (no secrets).
 */

export const MAIL_PROVIDERS = ["gmail", "naver", "outlook", "custom"] as const;

export type MailProvider = (typeof MAIL_PROVIDERS)[number];

export const MAIL_PRESETS: Record<
  Exclude<MailProvider, "custom">,
  { host: string; port: string; secure: boolean }
> = {
  gmail: { host: "smtp.gmail.com", port: "587", secure: false },
  naver: { host: "smtp.naver.com", port: "587", secure: false },
  outlook: { host: "smtp.office365.com", port: "587", secure: false },
};

export function isMailProvider(value: unknown): value is MailProvider {
  return (
    typeof value === "string" &&
    (MAIL_PROVIDERS as readonly string[]).includes(value)
  );
}

/** Matches a stored host back to a preset, so the form opens on it. */
export function presetForHost(host: string): MailProvider {
  const h = host.trim().toLowerCase();
  if (!h) return "gmail";
  for (const [key, preset] of Object.entries(MAIL_PRESETS)) {
    if (preset.host === h) return key as MailProvider;
  }
  return "custom";
}
