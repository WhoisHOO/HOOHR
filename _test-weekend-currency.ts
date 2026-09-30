import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./src/generated/prisma/client";
import {
  currencyOptions,
  formatWeekendDays,
  isValidCurrency,
  parseWeekendDays,
} from "./src/lib/company-defaults";
import { isWorkday, isoDateKey, toWeekendSet } from "./src/lib/holidays";
import { COUNTRIES, COUNTRY_DEFAULTS, DEFAULT_COUNTRY } from "./src/lib/country";
import { computeLeaveDays, countWorkdays } from "./src/lib/leave";
import { settingsKo } from "./src/i18n/dictionaries/settings";
import { commonKo } from "./src/i18n/dictionaries/common";
import { companySettingsSchema } from "./src/lib/settings-validation";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const results: string[] = [];

function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push(
    `${ok ? "PASS" : "FAIL"} ${label} (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`,
  );
}

function ok(label: string, condition: boolean): void {
  results.push(`${condition ? "PASS" : "FAIL"} ${label}`);
}

function utc(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d));
}

async function main() {
  // --- 1) weekend string round-trip ----------------------------------------
  check("parse 0,6", [...(parseWeekendDays("0,6") ?? [])].sort(), [0, 6]);
  check("parse single day", [...(parseWeekendDays("5") ?? [])], [5]);
  check("format sorts ascending", formatWeekendDays(new Set([6, 0])), "0,6");
  check(
    "format of 5 days",
    formatWeekendDays(new Set([0, 1, 2, 3, 4])),
    "0,1,2,3,4",
  );
  check("parse rejects out-of-range", parseWeekendDays("7"), null);
  check("parse rejects negative", parseWeekendDays("-1"), null);
  check("parse rejects empty", parseWeekendDays(""), null);
  check("parse rejects all-whitespace", parseWeekendDays("   "), null);
  check("parse rejects non-numeric", parseWeekendDays("abc"), null);
  check("parse rejects trailing comma set of one ok", [
    ...(parseWeekendDays("0,") ?? []),
  ], [0]);

  // --- 2) toWeekendSet fallback ---------------------------------------------
  // 설정이 깨져도 근무일 계산이 멈추지 않고 이전 동작(토·일)을 유지해야 한다.
  check("toWeekendSet falls back on garbage", [...toWeekendSet("nonsense")], [0, 6]);
  check("toWeekendSet falls back on null", [...toWeekendSet(null)], [0, 6]);
  check("toWeekendSet honours stored value", [...toWeekendSet("5,6")], [5, 6]);

  // --- 3) isWorkday with a non-default weekend ------------------------------
  // 이게 이 파일의 핵심: 주말이 토·일로 하드코딩돼 있으면 금·토 휴무 회사가
  // 이월 휴가 일수를 틀리게 계산한다.
  const saturday = utc(2026, 9, 5); // 2026-09-05 is a Saturday
  const sunday = utc(2026, 9, 6);
  const friday = utc(2026, 9, 4);
  check("2026-09-05 is Saturday", saturday.getUTCDay(), 6);

  check("Sat is a non-workday by default", isWorkday(saturday), false);
  check("Sun is a non-workday by default", isWorkday(sunday), false);
  check("Fri is a workday by default", isWorkday(friday), true);

  // 5일만 휴무로 두면 토요일은 근무일이다. (주말 하드코딩이 제거됐다는 증거)
  const fridayOff = toWeekendSet("5");
  check("Sat becomes a workday when Fri/Sat off", isWorkday(saturday, undefined, fridayOff), true);
  check("Sun stays a workday when only Fri is off", isWorkday(sunday, undefined, fridayOff), true);
  check("Fri becomes a non-workday", isWorkday(friday, undefined, fridayOff), false);

  // 주말을 옮기는 회사가 실제로 존재한다 (예: 금·토 휴무).
  const friSatOff = toWeekendSet("5,6");
  check("Fri non-workday under Fri/Sat weekend", isWorkday(friday, undefined, friSatOff), false);
  check("Sun workday under Fri/Sat weekend", isWorkday(sunday, undefined, friSatOff), true);

  // 회사가 직접 등록한 휴일은 주휴일 설정과 무관하게 항상 제외된다.
  const holidays = new Set([isoDateKey(friday)]);
  check("holiday excluded even on a working weekday", isWorkday(friday, holidays, fridayOff), false);

  // --- 4) leave day counting honours the weekend ---------------------------
  // 2026-09-04(Fri) ~ 2026-09-07(Mon): 4일 구간.
  const rangeEnd = utc(2026, 9, 7);
  check("default weekend counts 2 workdays", countWorkdays(friday, rangeEnd), 2);
  check(
    "Fri/Sat off counts 3 workdays",
    countWorkdays(friday, rangeEnd, undefined, fridayOff),
    3,
  );
  check(
    "holiday subtracted",
    countWorkdays(friday, rangeEnd, holidays),
    1,
  );
  check("half day is always 0.5", computeLeaveDays(friday, friday, true, holidays, fridayOff), 0.5);

  // 7일 전부 휴무는 UI에서 막지만, 저장은 가능하다. 그 상태에서 근무일 수는 0 이며
  // 휴가 신청이 전부 "근무일 없음"으로 실패한다 — companySettingsSchema 가 이 값을 거부한다.
  check(
    "all-weekend config yields zero workdays (guard lives in validation)",
    countWorkdays(friday, rangeEnd, undefined, toWeekendSet("0,1,2,3,4,5,6")),
    0,
  );

  // --- 5) currency validation ----------------------------------------------
  ok("KRW is valid", isValidCurrency("KRW"));
  ok("USD is valid", isValidCurrency("USD"));
  ok("lowercase accepted", isValidCurrency("krw"));
  // Intl 은 3글자 구조만 검사하므로 "ZZZ" 도 통과시킨다. 그 값이 회계용 CSV
  // export 까지 흘러가므로 실제 ISO 4217 목록 기준으로 막아야 한다.
  ok("too long rejected", !isValidCurrency("KRWW"));
  ok("numeric rejected", !isValidCurrency("123"));
  ok("unknown-but-well-formed code rejected", !isValidCurrency("ZZZ"));
  ok("empty rejected", !isValidCurrency(""));

  const options = currencyOptions();
  const values = options.map((c) => c.value);
  ok("currency options include the codes companies actually use", ["KRW", "USD", "EUR"].every((c) => values.includes(c)));
  ok("currency options exclude unknown codes", !values.includes("ZZZ"));
  ok("currency options are sorted", JSON.stringify(values) === JSON.stringify([...values].sort()));
  ok("every option passes its own validator", options.every((c) => isValidCurrency(c.value)));

  // --- 6) weekend validation guards ----------------------------------------
  // 7일 전부 휴무는 모든 휴가 신청을 실패시키므로 UI 에서 거부되어야 한다.
  const schema = companySettingsSchema({
    ...settingsKo,
    required: commonKo.validation.required,
  });
  // 통화·시간대는 국가에서 파생되므로 더 이상 자유 입력 필드가 아니다. base 에
  // currency 를 넣어두면 "unknown currency is rejected" 같은 검사가 country 누락
  // 때문에 그냥 통과해버리는(거짓 초록) 검사가 된다.
  const base = { name: "ACME", country: "KR" };

  const zero = schema.safeParse({ ...base, weekend: [] });
  ok("no days off is rejected", !zero.success);
  const all = schema.safeParse({
    ...base,
    weekend: ["0", "1", "2", "3", "4", "5", "6"],
  });
  ok("all seven days off is rejected", !all.success);
  const dupes = schema.safeParse({ ...base, weekend: ["0", "0"] });
  ok("duplicate days are rejected", !dupes.success);
  const badCountry = schema.safeParse({ ...base, weekend: ["0"], country: "ZZ" });
  ok("unknown country is rejected", !badCountry.success);
  const noCountry = schema.safeParse({ name: "ACME", weekend: ["0", "6"] });
  ok("missing country is rejected", !noCountry.success);
  const good = schema.safeParse({ ...base, weekend: ["0", "6"] });
  ok("Sat+Sun off is accepted", good.success);
  const six = schema.safeParse({
    ...base,
    weekend: ["0", "1", "2", "3", "4", "6"],
  });
  ok("six days off is accepted", six.success);
  for (const code of COUNTRIES) {
    ok(`${code} is accepted`, schema.safeParse({ ...base, country: code, weekend: ["0", "6"] }).success);
  }

  // --- 7) DB round-trip: the settings action's write path -------------------
  await dbRoundTrip();

  console.log(results.join("\n"));
  const failed = results.filter((line) => line.startsWith("FAIL")).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);

  await prisma.$disconnect();
  if (failed > 0) process.exit(1);
}

/** Verifies the columns exist, round-trip, and default safely for legacy rows. */
async function dbRoundTrip(): Promise<void> {
  const company = await prisma.company.create({
    data: { name: "ZZ-WeekendProbe" },
  });
  try {
    check("default currency matches the default country", company.currency, COUNTRY_DEFAULTS[DEFAULT_COUNTRY].currency);
    check("default timezone matches the default country", company.timezone, COUNTRY_DEFAULTS[DEFAULT_COUNTRY].timezone);
    check("default country is KR", company.country, DEFAULT_COUNTRY);
    check("default weekend is Sat+Sun", company.weekendDays, "0,6");

    const updated = await prisma.company.update({
      where: { id: company.id },
      data: { currency: "KRW", weekendDays: "5,6" },
    });
    check("currency round-trips", updated.currency, "KRW");
    check("weekend round-trips", updated.weekendDays, "5,6");
    ok("stored weekend re-parses to the days that were selected", JSON.stringify([...toWeekendSet(updated.weekendDays)]) === "[5,6]");
  } finally {
    await prisma.leaveBalance.deleteMany({
      where: { employee: { companyId: company.id } },
    });
    await prisma.company.delete({ where: { id: company.id } });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
