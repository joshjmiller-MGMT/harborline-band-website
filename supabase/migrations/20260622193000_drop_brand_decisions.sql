-- Drop the orphaned brand_decisions table.
--
-- The website "Decision Log" panel and its brand_decisions fetch were removed in
-- PR #148 (decision log retired from the Admin/review page). No live code queries
-- this table anymore -- only the generated Supabase types (src/integrations/supabase/types.ts)
-- still referenced it, and this PR removes that reference too.
--
-- The 9 historical rows are preserved verbatim in the decision record
-- wiki/harborline/co-manager/05-decisions/2026-06-22-retire-website-decision-log.md
-- and the content is canonical in the co-manager pillars -- so this is no data loss.
--
-- cascade also drops the self-referential brand_decisions_superseded_by_fkey.

drop table if exists public.brand_decisions cascade;
