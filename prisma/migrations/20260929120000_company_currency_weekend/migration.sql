-- Company-level currency and a configurable weekend, so the two values that
-- actually affect what the app does are company data instead of constants.
-- Every column is additive with a default, so existing companies stay valid and
-- keep the previous implicit behaviour (USD, Sat+Sun off) until an admin changes
-- them in Settings.
ALTER TABLE "Company" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE "Company" ADD COLUMN "weekendDays" TEXT NOT NULL DEFAULT '0,6';
