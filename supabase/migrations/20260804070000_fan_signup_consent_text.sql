-- Consent-record stamping on fan signups (TCPA/CTIA pass, 2026-08-04).
--
-- The consent_text column already exists in prod (added directly around the
-- 8/1 security review, no migration file) — this is the catch-up so the repo's
-- migration history matches what's running. The lander (src/pages/SmartLink.tsx
-- FanSignup) stamps the EXACT disclosure copy shown at signup into
-- consent_text on every insert; created_at is the consent timestamp (the row
-- is created by the signup submission itself).
--
-- The three pre-7/26 rows have consent_text NULL and STAY null — we don't
-- know verbatim what those fans were shown, and fabricating a consent record
-- is worse than an honest gap. The public consent copy itself is untouched
-- here: wording is Josh's call pending the TCPA lawyer pass.

alter table fan_signups
  add column if not exists consent_text text;

comment on column fan_signups.consent_text is
  'Verbatim disclosure copy shown to the fan at signup (CTIA 5.1.2: record what was SHOWN, not just consent=true). Stamped by the lander on insert. NULL only on rows that predate stamping.';
comment on column fan_signups.created_at is
  'Consent timestamp — the row is created by the signup submission itself.';
