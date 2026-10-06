import type { Locale } from "../config";
import { commonKo, commonEn } from "./common";
import { navKo, navEn } from "./nav";
import { authKo, authEn } from "./auth";
import { dashboardKo, dashboardEn } from "./dashboard";
import { leaveKo, leaveEn } from "./leave";
import { expensesKo, expensesEn } from "./expenses";
import { adminKo, adminEn } from "./admin";
import { settingsKo, settingsEn } from "./settings";
import { notificationsKo, notificationsEn } from "./notifications";
import { setupKo, setupEn } from "./setup";

const dictKo = {
  common: commonKo,
  nav: navKo,
  auth: authKo,
  dashboard: dashboardKo,
  leave: leaveKo,
  expenses: expensesKo,
  admin: adminKo,
  settings: settingsKo,
  notifications: notificationsKo,
  setup: setupKo,
};

// Typing the English composition against the Korean shape makes the compiler
// enforce full key parity across the two languages.
const dictEn: typeof dictKo = {
  common: commonEn,
  nav: navEn,
  auth: authEn,
  dashboard: dashboardEn,
  leave: leaveEn,
  expenses: expensesEn,
  admin: adminEn,
  settings: settingsEn,
  notifications: notificationsEn,
  setup: setupEn,
};

export type Dict = typeof dictKo;

export const dictionaries: Record<Locale, Dict> = {
  ko: dictKo,
  en: dictEn,
};
