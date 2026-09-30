import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getDict, getLocale } from "@/i18n/server";
import { LocaleProvider } from "@/i18n/client";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "HOOHR",
    template: "%s · HOOHR",
  },
  description: "Leave and expense management for small teams",
};

// The language comes from the company's country row in the database, not from a
// cookie. Without this, /login and /invite/[token] would have no dynamic
// dependency left and be prerendered at build time - where there is no database
// - baking the default language into the served page.
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const d = await getDict();

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900">
        <LocaleProvider locale={locale} d={d}>
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
