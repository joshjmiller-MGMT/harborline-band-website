-- social_content_queue weekly auto-slot (2026-08-04).
--
-- Why the queue froze for 32 days: all 10 items landed in one batch on 7/2
-- with scheduled_for NULL, and nothing anywhere assigned them to posting
-- slots. /team/social groups the queue by scheduled_for, so unscheduled
-- items never surfaced as "this week's plan" and the whole surface read as
-- dead. There was no broken mover to repair — a scheduler never existed.
--
-- Fix: autoslot_social_queue() fills the weekly cadence (Tue/Thu posts +
-- Tue/Wed/Thu/Fri stories) from the pool every Monday 10:00 UTC. Items
-- slotted in a past week but never posted re-enter the pool first (oldest
-- commitment wins), then unscheduled items oldest-first. Accounts are
-- inferred from the caption prefix when unset. Slotting marks notes with
-- [auto-slotted M/D]; statuses stay Josh-owned (queued/ready/posted/skipped
-- move via /team/social, never by this job).
--
-- This file records the already-applied prod state (applied via Mgmt API
-- during the 8/4 overnight window; first pass slotted 6 items into the week
-- of 8/3 — verified rows carry [auto-slotted 8/4]).

CREATE OR REPLACE FUNCTION public.autoslot_social_queue()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  slot_rec record;
  item_rec record;
  slotted integer := 0;
  inferred text[];
BEGIN
  FOR slot_rec IN
    SELECT s.slot_name,
           (current_date + ((s.dow - extract(dow from current_date)::int + 7) % 7))::date AS slot_date,
           s.ord
      FROM (VALUES
        ('tue_post', 2, 1), ('thu_post', 4, 2),
        ('tue_stories', 2, 3), ('wed_stories', 3, 4),
        ('thu_stories', 4, 5), ('fri_stories', 5, 6)
      ) AS s(slot_name, dow, ord)
     ORDER BY s.ord
  LOOP
    -- Skip slots already filled for that date
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.social_content_queue
       WHERE slot = slot_rec.slot_name
         AND scheduled_for = slot_rec.slot_date
         AND status <> 'skipped');

    -- Next pool item: missed-week items first (oldest commitment), then
    -- unscheduled oldest-first.
    SELECT * INTO item_rec
      FROM public.social_content_queue
     WHERE status IN ('queued', 'ready')
       AND (scheduled_for IS NULL OR scheduled_for < date_trunc('week', current_date)::date)
     ORDER BY scheduled_for ASC NULLS LAST, created_at ASC
     LIMIT 1;
    EXIT WHEN NOT FOUND;

    -- Infer accounts from the caption prefix when none set
    inferred := item_rec.accounts;
    IF inferred IS NULL OR cardinality(inferred) = 0 THEN
      IF item_rec.caption ILIKE 'harborline%' THEN inferred := ARRAY['harborline'];
      ELSIF item_rec.caption ILIKE '%economy%jmj%' OR item_rec.caption ILIKE '%economy+jmj%' THEN inferred := ARRAY['economy','personal'];
      ELSIF item_rec.caption ILIKE 'the economy%' OR item_rec.caption ILIKE 'economy%' THEN inferred := ARRAY['economy'];
      ELSIF item_rec.caption ILIKE 'jmj%' OR item_rec.caption ILIKE 'jjm%' THEN inferred := ARRAY['personal'];
      ELSE inferred := ARRAY['personal'];
      END IF;
    END IF;

    UPDATE public.social_content_queue
       SET scheduled_for = slot_rec.slot_date,
           slot = slot_rec.slot_name,
           accounts = inferred,
           notes = coalesce(notes, '') || ' [auto-slotted ' || to_char(current_date, 'FMMM/FMDD') || ']',
           updated_at = now()
     WHERE id = item_rec.id;
    slotted := slotted + 1;
  END LOOP;

  RETURN jsonb_build_object('slotted', slotted, 'run_date', current_date);
END;
$function$;

-- cron owns this; nothing client-facing should call it via PostgREST
revoke execute on function public.autoslot_social_queue() from public, anon, authenticated;

select cron.schedule(
  'social-queue-autoslot-weekly',
  '0 10 * * 1',
  'select public.autoslot_social_queue();'
);
