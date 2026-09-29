-- The digest (NOT-2) claims each (recipient, request) pair by inserting a
-- Notification row, then sends the mail. This unique index is what makes that
-- claim race-safe: a second concurrent run gets a P2002 and skips instead of
-- sending a duplicate digest.
--
-- The index is on (userId, link), not on `link` alone. An admin's approval inbox
-- overlaps a manager's — canActAsAdmin() gives an admin the whole company — so
-- the same request legitimately appears in both plans and both recipients must
-- be notified. A global unique on `link` would let the first plan to claim it
-- silence every other reviewer for good.
--
-- `link` is nullable, and under this constraint NULLs remain distinct, so rows
-- that do not carry a link (the in-app notifications NOT-3 will add) are not
-- forced to collide.
DROP INDEX IF EXISTS "Notification_link_key";

CREATE UNIQUE INDEX "Notification_userId_link_key" ON "Notification"("userId", "link");
