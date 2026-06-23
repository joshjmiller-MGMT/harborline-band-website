-- p92d — close the two remaining deliberate public reads.
--
-- p92b kept the public SELECT on chart_index + visual_assets (they had explicit
-- "Anyone can view" / "Anyone read" policies, so I flagged rather than reversed
-- them). Josh confirmed 2026-06-22: close both to authenticated — no public
-- (logged-out) consumer exists, and it's consistent with the rest of the p92
-- anon-close. Role-only change; authenticated /team reads + service-role edge
-- fns are unaffected.

alter policy "Anyone can view chart_index" on public.chart_index to authenticated;
alter policy "Anyone read visual_assets"   on public.visual_assets to authenticated;
