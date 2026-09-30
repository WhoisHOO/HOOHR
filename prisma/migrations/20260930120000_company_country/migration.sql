-- The country the admin picked at install time. Currency, timezone and the
-- on-screen language are all derived from this one column, so there is no
-- separate language setting to keep in sync.
--
-- Existing installations are backfilled to 'KR': the app's own UI and seed
-- content were Korean-first, and a US-flavoured default silently contradicted
-- them. The installer leaves an existing .env alone, so nothing is overwritten.
ALTER TABLE "Company" ADD COLUMN "country" TEXT NOT NULL DEFAULT 'KR';
