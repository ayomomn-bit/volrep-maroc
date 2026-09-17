-- Step 4 M1 — admin session tokens are hashed at rest.
--
-- admin_sessions.id changes from a raw uuid (which WAS the bearer token in
-- the cookie) to text holding SHA-256(rawToken). The app now generates a
-- 256-bit random token, stores only its hash here, and sends the raw token
-- to the browser.
--
-- Every pre-existing row stored a raw uuid as its id, so it can never match
-- a SHA-256 lookup again — those sessions are already dead weight. Delete
-- them explicitly rather than leaving unresolvable rows to age out: every
-- admin simply logs in again after deploy (12h TTL, handful of users).
DELETE FROM "admin_sessions";--> statement-breakpoint
ALTER TABLE "admin_sessions" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "admin_sessions" ALTER COLUMN "id" DROP DEFAULT;
