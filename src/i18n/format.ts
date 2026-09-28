export type MessageParams = Record<string, string | number>;

/**
 * Replaces `{name}` placeholders. Unknown keys are left in place so a missing
 * param is visible in the UI instead of silently rendering "undefined".
 */
export function interpolate(
  template: string,
  params?: MessageParams,
): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(params, key)
      ? String(params[key])
      : match,
  );
}
