-- The country is now the single source of truth, but the currency/timezone
-- column defaults still described a US company while `country` defaulted to
-- "KR". A Company created without the seed or the settings action (a probe, a
-- future tenant bootstrap) would therefore claim to be Korean while billing in
-- USD and computing attendance days in New York time.
--
-- Only the DEFAULTs change. Existing rows keep whatever they already have: the
-- backfill in 20260930120000_company_country deliberately left real expense
-- currencies alone, and this migration keeps that promise.

ALTER TABLE "Company" ALTER COLUMN "timezone" SET DEFAULT 'Asia/Seoul';
ALTER TABLE "Company" ALTER COLUMN "currency" SET DEFAULT 'KRW';
