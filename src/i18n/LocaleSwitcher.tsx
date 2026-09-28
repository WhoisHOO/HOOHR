"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LOCALES, LOCALE_LABELS, type Locale } from "./config";
import { setLocale } from "./actions";
import { useI18n } from "./client";

export function LocaleSwitcher({
  label = "Language",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  const { locale } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function pick(next: Locale) {
    if (next === locale) return;
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  }

  return (
    <div
      className={`flex items-center gap-1 ${className}`}
      role="group"
      aria-label={label}
    >
      {LOCALES.map((option) => {
        const active = option === locale;
        return (
          <button
            key={option}
            type="button"
            onClick={() => pick(option)}
            disabled={pending}
            lang={option}
            aria-current={active ? "true" : undefined}
            className={
              active
                ? "rounded px-2 py-1 text-xs font-semibold bg-zinc-100 text-zinc-900"
                : "rounded px-2 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
            }
          >
            {LOCALE_LABELS[option]}
          </button>
        );
      })}
    </div>
  );
}
