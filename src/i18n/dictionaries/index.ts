import type { Locale } from "../config";
import { commonKo, commonEn } from "./common";
import { navKo, navEn } from "./nav";
import { authKo, authEn } from "./auth";
import { dashboardKo, dashboardEn } from "./dashboard";
import { attendanceKo, attendanceEn } from "./attendance";
import { leaveKo, leaveEn } from "./leave";
import { expensesKo, expensesEn } from "./expenses";
import { adminKo, adminEn } from "./admin";
import { settingsKo, settingsEn } from "./settings";
import { notificationsKo, notificationsEn } from "./notifications";

const dictKo = {
  common: commonKo,
  nav: navKo,
  auth: authKo,
  dashboard: dashboardKo,
  attendance: attendanceKo,
  leave: leaveKo,
  expenses: expensesKo,
  admin: adminKo,
  settings: settingsKo,
  notifications: notificationsKo,
};

// Typing the English composition against the Korean shape makes the compiler
// enforce full key parity across the two languages.
const dictEn: typeof dictKo = {
  common: commonEn,
  nav: navEn,
  auth: authEn,
  dashboard: dashboardEn,
  attendance: attendanceEn,
  leave: leaveEn,
  expenses: expensesEn,
  admin: adminEn,
  settings: settingsEn,
  notifications: notificationsEn,
};

export type Dict = typeof dictKo;

export const dictionaries: Record<Locale, Dict> = {
  ko: dictKo,
  en: dictEn,
};
