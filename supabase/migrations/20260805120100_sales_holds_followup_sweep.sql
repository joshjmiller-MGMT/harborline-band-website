-- =====================================================================
-- sales_holds: make the per-hold follow-up cadence actually run
-- 2026-08-05
-- =====================================================================
--
-- THE SYMPTOM
-- -----------
-- 16 of 21 `sales_holds` rows carried a `next_check_at` in the past, some by
-- more than a week. `last_checked_at` was NULL on every single row in the
-- table. The weekly check-in the schema promises had never happened once.
--
-- THE DIAGNOSIS
-- -------------
-- Three separate things were being confused for each other. Only the third
-- was actually broken.
--
-- 1. `sales-holds-auto-release-daily` (pg_cron job 16) works. It releases
--    open holds whose event_date has passed. Last run 2026-08-04 11:55 UTC,
--    status succeeded. Not the problem.
--
-- 2. `sales-holds-weekly-check` (pg_cron job 17) has `last_run = NULL`, which
--    looks alarming and is not. Its schedule is `5 12 * * 1` -- Mondays at
--    12:05 UTC. It was created during the overnight window of Tuesday
--    2026-08-04. The previous Monday (08-03) had already passed when the job
--    came into existence, so its first fire is Monday 2026-08-10. The job is
--    healthy; it simply is not due yet. (Job 18,
--    `social-queue-autoslot-weekly`, is NULL for exactly the same reason.)
--    Nothing to fix -- recording it here so the next person who reads a NULL
--    `last_run` does not go hunting for a bug that is not there.
--
-- 3. THE ACTUAL ROOT CAUSE: nothing in the entire system ever advanced
--    `next_check_at`. It is written exactly once, at INSERT, by the edge
--    function `supabase/functions/holds-from-calendar/index.ts` (line 149:
--    `next_check_at: new Date(Date.now() + 7 * 86400000)`), and that upsert
--    uses `{ onConflict: "calendar_event_id", ignoreDuplicates: true }`, so a
--    re-sync never touches an existing row. No pg_cron job, no database
--    function, and no other code path read the column at all --
--    `release_expired_sales_holds()` keys off `event_date`, and
--    `sales_holds_weekly_check()` audits the release job. Both ignore
--    `next_check_at`, `last_checked_at` and `followup_cadence` entirely.
--
--    Proof of the shape: for all 21 rows, `next_check_at` equals
--    `created_at + 7 days` to the millisecond, in four distinct batches
--    (07-20, 07-22, 07-23, 08-03). Set once, never moved. The three
--    follow-up columns were decorative from the day the table was created.
--
-- THE FIX
-- -------
-- `sales_holds_followup_sweep()`, scheduled daily, closes the loop:
--
--   * Clears `next_check_at` on holds that are no longer open. A released or
--     confirmed hold has no next check, and leaving a stale timestamp there
--     is what made two already-released rows show up in the overdue count.
--
--   * Finds every OPEN hold whose `next_check_at` has come due, and surfaces
--     them as ONE batched review card on /team/review, deduped by
--     `source_ref = 'sales-holds-followup'`. If a card is already open it is
--     REWRITTEN in place with the current list rather than skipped -- a
--     silent skip would swallow any hold that came due while the card sat
--     unresolved (classifier review-queue principle: uncertain or
--     unactioned, flag it; never silently drop).
--
--   * Advances the clock: `last_checked_at = now()` and `next_check_at =
--     now() + cadence`, honouring `followup_cadence`
--     (daily / weekly / biweekly / monthly, default weekly).
--
-- SEMANTICS, STATED PLAINLY so the column is not misread later:
-- `last_checked_at` means "the system last SURFACED this hold for a
-- check-in", not "Josh contacted the rep". The database cannot know the
-- latter. The review card is the honest artifact; the timestamp is only the
-- scheduler's bookkeeping. Naming it otherwise would be a fake-done.
--
-- A hold check-in means asking a sales rep whether a date is converting.
-- That is an outbound human action, so the sweep deliberately stops at
-- surfacing. It never marks a hold as followed-up on its own.
--
-- NOT CHANGED HERE, ON PURPOSE
-- ----------------------------
-- `ignoreDuplicates: true` in holds-from-calendar looks like a bug and is
-- load-bearing: a full upsert would overwrite `hold_status`, `notes` and
-- `next_check_at` on every 11:45 sync and wipe out the auto-release state
-- this file depends on. The correct fix is a narrow update of the
-- calendar-derived fields only (`event_date`, `event_label`), which is an
-- edge-function change with its own testing surface. Flagged, not bundled.
-- =====================================================================

create or replace function public.sales_holds_followup_sweep()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  cleaned    integer := 0;
  due_ids    uuid[];
  due_count  integer := 0;
  soonest    date;
  listing    text;
  prio       text;
  card_id    uuid;
  card_title text;
  card_body  text;
begin
  -- 1. a hold that is not open has no next check
  update public.sales_holds
     set next_check_at = null,
         updated_at    = now()
   where hold_status is distinct from 'open'
     and next_check_at is not null;
  get diagnostics cleaned = row_count;

  -- 2. what is due right now
  select array_agg(id order by event_date),
         count(*),
         min(event_date),
         string_agg(
           '  - ' || to_char(event_date, 'FMMM/FMDD/YY') || '  ' ||
           coalesce(nullif(event_label, ''), '(unlabelled)') ||
           coalesce(' [rep: ' || sales_rep || ']', '') ||
           coalesce(' [' || agency || ']', '') ||
           ' - due since ' || to_char(next_check_at, 'FMMM/FMDD'),
           E'\n' order by event_date)
    into due_ids, due_count, soonest, listing
    from public.sales_holds
   where hold_status = 'open'
     and next_check_at is not null
     and next_check_at <= now();

  if coalesce(due_count, 0) = 0 then
    return jsonb_build_object(
      'due', 0, 'released_rows_cleaned', cleaned, 'review_card', null);
  end if;

  -- an event inside 30 days is worth interrupting for; further out is not
  prio := case when soonest <= current_date + 30 then 'high' else 'normal' end;

  card_title := due_count || ' sales hold' || case when due_count = 1 then '' else 's' end
                || ' due for a check-in';
  card_body  :=
    'These holds have passed their follow-up date. A check-in means asking the '
    || 'sales rep whether the date is converting, so this needs you -- the sweep '
    || 'can only surface them.' || E'\n\n' || listing || E'\n\n'
    || 'Soonest event: ' || to_char(soonest, 'FMMM/FMDD/YY') || '. '
    || 'Resolve this card once you have worked the list; the next sweep will '
    || 'raise a fresh one when the following cycle comes due. '
    || 'Holds whose event date passes with no confirmation are auto-released '
    || 'daily by sales-holds-auto-release-daily.';

  select id into card_id
    from public.waiting_on_josh
   where source_ref = 'sales-holds-followup' and resolved_at is null
   order by queued_at desc
   limit 1;

  if card_id is null then
    insert into public.waiting_on_josh
      (title, detail, item_type, priority, source_session, source_ref)
    values
      (card_title, card_body, 'general', prio,
       'sales-holds-followup-sweep', 'sales-holds-followup')
    returning id into card_id;
  else
    -- rewrite the open card so nothing that came due gets swallowed
    update public.waiting_on_josh
       set title    = card_title,
           detail   = card_body,
           priority = prio
     where id = card_id;
  end if;

  -- 3. advance the cadence clock on everything we just surfaced
  update public.sales_holds s
     set last_checked_at = now(),
         next_check_at   = now() + case lower(coalesce(s.followup_cadence, 'weekly'))
                                     when 'daily'    then interval '1 day'
                                     when 'weekly'   then interval '7 days'
                                     when 'biweekly' then interval '14 days'
                                     when 'monthly'  then interval '1 month'
                                     else interval '7 days'
                                   end,
         updated_at      = now()
   where s.id = any(due_ids);

  return jsonb_build_object(
    'due',                   due_count,
    'released_rows_cleaned', cleaned,
    'review_card',           card_id,
    'priority',              prio,
    'soonest_event',         soonest);
end;
$function$;

-- cron owns this; nothing client-facing should reach it through PostgREST,
-- same posture as release_expired_sales_holds / sales_holds_weekly_check
revoke execute on function public.sales_holds_followup_sweep() from public, anon, authenticated;

-- Daily at 12:00 UTC. Deliberately ordered after holds-from-calendar (11:45)
-- and sales-holds-auto-release-daily (11:55), so the sweep sees newly synced
-- holds and never surfaces one that was about to be auto-released; and five
-- minutes before sales-holds-weekly-check (Mon 12:05), so on Mondays the
-- audit runs against an already-swept table.
-- cron.schedule upserts by jobname, so re-running this file is a no-op.
select cron.schedule(
  'sales-holds-followup-sweep-daily',
  '0 12 * * *',
  'select public.sales_holds_followup_sweep();'
);
