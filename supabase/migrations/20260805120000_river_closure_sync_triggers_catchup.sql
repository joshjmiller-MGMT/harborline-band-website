-- =====================================================================
-- CATCH-UP MIGRATION: river closure-sync + work-claim guard triggers
-- Written 2026-08-05. Documents behaviour that ALREADY EXISTS IN PROD.
-- =====================================================================
--
-- WHY THIS FILE EXISTS
-- --------------------
-- The 2026-08-05 brain lint (wiki/meta/brain-lint-2026-08-05.md, pattern 4)
-- found 45 triggers running in `public`. Fifteen of them -- every one that
-- carries behaviour rather than just touching an `updated_at` column -- had
-- no migration file at all. They were applied through the Supabase
-- Management API / MCP during earlier sessions and never written back.
--
-- Consequence: a fresh clone plus `supabase db reset` would silently lose
--   * all 11 `trg_river_*` closure-sync triggers (done-anywhere = done-
--     everywhere across claude_action_queue / smart_task_enrichments /
--     waiting_on_josh / agent_jobs), and
--   * `trg_enforce_done_evidence`, the database-level enforcement of the
--     no-fake-done rule on `work_claims`.
-- The repo described less than half of what the database actually did.
--
-- WHAT THIS FILE IS
-- -----------------
-- A faithful transcription of live production state as of 2026-08-05.
-- Every function body below was produced by `pg_get_functiondef()` and every
-- trigger by `pg_get_triggerdef()` against project mbqyznttpvebahgygsbx --
-- they are not reconstructions from memory.
--
-- It is DOCUMENTATION, not a change. Do not "apply" it to production: prod
-- already has all of this. It is written to be a NO-OP if re-applied --
-- `create or replace function` plus `drop trigger if exists` + `create
-- trigger` -- so that re-running it against the current database produces
-- byte-identical objects, and so that `supabase db reset` on a fresh clone
-- reproduces real behaviour instead of a hollow schema.
--
-- KNOWN GAP, DELIBERATELY NOT CLOSED HERE
-- ---------------------------------------
-- Four tables these triggers live on or write to are themselves missing from
-- supabase/migrations/ (found while writing this file -- second-order drift
-- of the same root cause):
--     work_claims, work_claim_events, smart_links, trello_writeback
-- (`sales_holds` is a fifth, outside this file's scope.)
--
-- Because a trigger cannot be created on a table that does not exist, the
-- three triggers on `work_claims` and `smart_links` are wrapped in
-- `to_regclass()` existence guards below. On production the guard passes and
-- the trigger is created exactly as it is today. On a fresh clone the guard
-- fails and raises a WARNING naming the missing table, so the gap announces
-- itself instead of hiding -- lint pattern 5, a system is healthy when it
-- produces output, not when it exits 0. Writing those four `create table`
-- statements back is separate follow-up work; inventing them here would mean
-- guessing at columns, constraints, indexes and RLS policies, and a guess
-- committed as a migration is worse than a documented gap.
--
-- ORDER OF OPERATIONS
-- -------------------
--   1. river_best_agent()          -- shared helper, three triggers call it
--   2. agent_jobs                  -- 1 trigger
--   3. agent_messages              -- 1 trigger
--   4. claude_action_queue         -- 3 triggers
--   5. smart_task_enrichments      -- 3 triggers
--   6. waiting_on_josh             -- 4 triggers
--   7. work_claims                 -- 2 triggers  (GUARDED, table missing)
--   8. smart_links                 -- 1 trigger   (GUARDED, table missing)
--   9. self-verification           -- warns on anything that did not land
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Shared helper: river_best_agent()
-- ---------------------------------------------------------------------
-- Routes a free-text card/title to one of the seven field agents on
-- /team/members by keyword. Called by river_own_queue, river_own_review and
-- river_own_smart to stamp agent_id on insert. Depends on agent_teammates,
-- created in 20260712160000_agent_teammates.sql. Also had no migration file.

CREATE OR REPLACE FUNCTION public.river_best_agent(txt text)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare t text := lower(coalesce(txt,'')); s text;
begin
  s := case
    when t ~ '(website fix|web fix|web & tech|web tech|to claude|bug|rbac|doc generator|page broken|button|calendar fix)' then 'webb'
    when t ~ '(booking|venue|lead|outreach|agency|inquiry|rfi|festival|wedding client|quote|poc|follow.?up|f/u|contact)' then 'booker'
    when t ~ '(social|instagram|\yig\y|reel|caption|tiktok|\ydm\y|posting|blue house)' then 'sonny'
    when t ~ '(finance|statement|tax|invoice|1099|w9|budget|merchant|bank)' then 'frankie'
    when t ~ '(staffing|gear|warehouse|run of show|schedule|rehearsal|load.?in|backline|daily)' then 'lou'
    when t ~ '(chart|library|fakebook|forscore|ireal|setlist|media catalog|\ydam\y|brain|wiki|archive|note|to listen|to watch|to learn|listen|watch|learn|feed)' then 'libby'
    when t ~ '(grant|epk|brand|press|release|joshjmiller|playlist|distrokid|jjm)' then 'marlo'
    else 'marlo' end;
  return (select id from agent_teammates where slug = s);
end $function$;


-- ---------------------------------------------------------------------
-- 2. agent_jobs
-- ---------------------------------------------------------------------
-- trg_river_job_done: when a Trello-sourced agent job flips to done, close
-- the matching claude_action_queue row and carry its result across.
-- pg_trigger_depth() guards the closure loop against recursion.

CREATE OR REPLACE FUNCTION public.river_job_done()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if pg_trigger_depth() > 1 then return new; end if;
  if new.status='done' and coalesce(old.status,'')<>'done' and new.source_ref like 'trello:%' then
    update claude_action_queue set status='done', completed_at=now(),
      result_artifact=coalesce(new.result_md, result_artifact)
      where trello_card_id = split_part(new.source_ref,':',2) and status<>'done';
  end if;
  return new;
end $function$;

drop trigger if exists trg_river_job_done on public.agent_jobs;
CREATE TRIGGER trg_river_job_done AFTER UPDATE ON public.agent_jobs FOR EACH ROW EXECUTE FUNCTION river_job_done();


-- ---------------------------------------------------------------------
-- 3. agent_messages
-- ---------------------------------------------------------------------
-- agent_messages_autotag: backfill ticket_ref from job_id so every agent
-- message is addressable by ticket even when the writer forgot to set it.

CREATE OR REPLACE FUNCTION public.agent_messages_autotag()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if new.ticket_ref is null and new.job_id is not null then
    new.ticket_ref := new.job_id::text;
  end if;
  return new;
end $function$;

drop trigger if exists agent_messages_autotag on public.agent_messages;
CREATE TRIGGER agent_messages_autotag BEFORE INSERT ON public.agent_messages FOR EACH ROW EXECUTE FUNCTION agent_messages_autotag();


-- ---------------------------------------------------------------------
-- 4. claude_action_queue
-- ---------------------------------------------------------------------
-- trg_river_own_queue    (BEFORE INSERT) assign an owning agent + post the
--                        ingest ticket into that agent's message feed.
-- trg_river_queue_done   (AFTER UPDATE)  done here => Done on the SMART
--                        board, and enqueue a Trello write-back.
-- trg_river_queue_event  (AFTER UPDATE)  narrate every status change into
--                        the owning agent's feed.

CREATE OR REPLACE FUNCTION public.river_own_queue()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.agent_id is null then
    new.agent_id := river_best_agent(coalesce(new.list_name,'')||' '||coalesce(new.card_name,''));
  end if;
  insert into agent_messages (agent_id, role, kind, body, ticket_ref)
  values (new.agent_id, 'system', 'ticket',
    '🎫 Trello card ingested ['||coalesce(new.list_name,'?')||']: '||left(coalesce(new.card_name,''),90),
    'trello:'||new.trello_card_id);
  return new;
end $function$;

drop trigger if exists trg_river_own_queue on public.claude_action_queue;
CREATE TRIGGER trg_river_own_queue BEFORE INSERT ON public.claude_action_queue FOR EACH ROW EXECUTE FUNCTION river_own_queue();

CREATE OR REPLACE FUNCTION public.river_queue_done()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if pg_trigger_depth() > 1 then return new; end if;
  if new.status = 'done' and coalesce(old.status,'') <> 'done' then
    update smart_task_enrichments set board_bucket='Done'
      where trello_card_id = new.trello_card_id and board_bucket <> 'Done';
    insert into trello_writeback(card_id, note)
      values (new.trello_card_id, coalesce(new.result_artifact,'closed in queue'))
      on conflict do nothing;
  end if;
  return new;
end $function$;

drop trigger if exists trg_river_queue_done on public.claude_action_queue;
CREATE TRIGGER trg_river_queue_done AFTER UPDATE ON public.claude_action_queue FOR EACH ROW EXECUTE FUNCTION river_queue_done();

CREATE OR REPLACE FUNCTION public.river_queue_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.status is distinct from old.status and new.agent_id is not null then
    insert into agent_messages (agent_id, role, kind, body, ticket_ref)
    values (new.agent_id, 'system', 'ticket',
      '🎫 '||left(coalesce(new.card_name,''),70)||' → '||new.status||
      case when new.result_artifact is not null and new.status='done' then ' ('||left(new.result_artifact,90)||')' else '' end,
      'trello:'||new.trello_card_id);
  end if;
  return new;
end $function$;

drop trigger if exists trg_river_queue_event on public.claude_action_queue;
CREATE TRIGGER trg_river_queue_event AFTER UPDATE ON public.claude_action_queue FOR EACH ROW EXECUTE FUNCTION river_queue_event();


-- ---------------------------------------------------------------------
-- 5. smart_task_enrichments
-- ---------------------------------------------------------------------
-- trg_river_own_smart       (BEFORE INSERT) inherit agent_id from the queue
--                           row for the same card, else route by keyword.
-- trg_river_enrichment_done (AFTER UPDATE) moving a card to the Done bucket
--                           closes the queue row and queues a Trello write-
--                           back -- unless the card id is an `ingest:` synthetic.
-- trg_river_smart_event     (AFTER UPDATE) narrate bucket moves into the feed.

CREATE OR REPLACE FUNCTION public.river_own_smart()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.agent_id is null then
    select agent_id into new.agent_id from claude_action_queue where trello_card_id = new.trello_card_id limit 1;
    if new.agent_id is null then new.agent_id := river_best_agent(coalesce(new.trello_card_id,'')); end if;
  end if;
  return new;
end $function$;

drop trigger if exists trg_river_own_smart on public.smart_task_enrichments;
CREATE TRIGGER trg_river_own_smart BEFORE INSERT ON public.smart_task_enrichments FOR EACH ROW EXECUTE FUNCTION river_own_smart();

CREATE OR REPLACE FUNCTION public.river_enrichment_done()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if pg_trigger_depth() > 1 then return new; end if;
  if new.board_bucket = 'Done' and coalesce(old.board_bucket,'') <> 'Done' then
    if new.trello_card_id is not null then
      update claude_action_queue set status='done', completed_at=now(),
        status_notes=coalesce(status_notes,'')||' [river: closed via SMART board]'
        where trello_card_id = new.trello_card_id and status <> 'done';
      if new.trello_card_id not like 'ingest:%' then
        insert into trello_writeback(card_id, note)
          values (new.trello_card_id, 'closed on SMART board')
          on conflict do nothing;
      end if;
    end if;
  end if;
  return new;
end $function$;

drop trigger if exists trg_river_enrichment_done on public.smart_task_enrichments;
CREATE TRIGGER trg_river_enrichment_done AFTER UPDATE ON public.smart_task_enrichments FOR EACH ROW EXECUTE FUNCTION river_enrichment_done();

CREATE OR REPLACE FUNCTION public.river_smart_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.board_bucket is distinct from old.board_bucket and new.agent_id is not null then
    insert into agent_messages (agent_id, role, kind, body, ticket_ref)
    values (new.agent_id, 'system', 'ticket',
      '🎫 SMART board: → '||coalesce(new.board_bucket,'?'), 'trello:'||new.trello_card_id);
  end if;
  return new;
end $function$;

drop trigger if exists trg_river_smart_event on public.smart_task_enrichments;
CREATE TRIGGER trg_river_smart_event AFTER UPDATE ON public.smart_task_enrichments FOR EACH ROW EXECUTE FUNCTION river_smart_event();


-- ---------------------------------------------------------------------
-- 6. waiting_on_josh (the review board)
-- ---------------------------------------------------------------------
-- trg_river_own_review      (BEFORE INSERT) assign an owning agent + ticket.
-- trg_river_review_event    (AFTER UPDATE) narrate the resolution.
-- trg_river_review_resolved (AFTER UPDATE) route Josh's answer BACK to
--                           whatever was blocked on it, keyed by source_ref
--                           (work_claims.<key> | agent_jobs.<uuid> / job:<uuid>
--                           | trello:<card_id>). This is what unblocks lanes.
-- trg_river_review_to_smart (AFTER UPDATE) a resolved card becomes a SMART
--                           board row -- 'everything flows to the ocean'.
--                           Skips auto-resolvers, explicit dismissals, and
--                           cards that already have a SMART row.

CREATE OR REPLACE FUNCTION public.river_own_review()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.agent_id is null then
    new.agent_id := river_best_agent(coalesce(new.title,'')||' '||coalesce(new.prompt,''));
  end if;
  insert into agent_messages (agent_id, role, kind, body, ticket_ref)
  values (new.agent_id, 'system', 'ticket', '🎫 Review card opened: '||left(coalesce(new.title,'(untitled)'),90), 'review:'||new.id);
  return new;
end $function$;

drop trigger if exists trg_river_own_review on public.waiting_on_josh;
CREATE TRIGGER trg_river_own_review BEFORE INSERT ON public.waiting_on_josh FOR EACH ROW EXECUTE FUNCTION river_own_review();

CREATE OR REPLACE FUNCTION public.river_review_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.resolved_at is not null and old.resolved_at is null and new.agent_id is not null then
    insert into agent_messages (agent_id, role, kind, body, ticket_ref)
    values (new.agent_id, 'system', 'ticket',
      '🎫 Resolved by '||coalesce(new.resolved_by,'?')||': '||left(coalesce(new.title,''),70)||
      case when new.resolution_note is not null then ' — '||left(new.resolution_note,110) else '' end,
      'review:'||new.id);
  end if;
  return new;
end $function$;

drop trigger if exists trg_river_review_event on public.waiting_on_josh;
CREATE TRIGGER trg_river_review_event AFTER UPDATE ON public.waiting_on_josh FOR EACH ROW EXECUTE FUNCTION river_review_event();

CREATE OR REPLACE FUNCTION public.river_review_resolved()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if pg_trigger_depth() > 1 then return new; end if;
  if new.resolved_at is not null and old.resolved_at is null and new.source_ref is not null then
    if new.source_ref like 'work_claims.%' then
      update work_claims set status='available', notes=coalesce(notes,'')||' [river: Josh answered '||coalesce(new.resolution_note,'')||']'
        where work_key = split_part(new.source_ref,'.',2) and status='blocked';
    elsif new.source_ref like 'agent_jobs.%' or new.source_ref like 'job:%' then
      update agent_jobs set status='queued', blocked_reason=null,
        instruction = instruction||E'\n[Josh answered via review: '||coalesce(new.resolution_note,'(see card)')||']'
        where id::text = coalesce(nullif(split_part(new.source_ref,':',2),''), split_part(new.source_ref,'.',2))
          and status='blocked';
    elsif new.source_ref like 'trello:%' then
      update claude_action_queue set status='done', completed_at=now()
        where trello_card_id = split_part(new.source_ref,':',2) and status<>'done';
    end if;
  end if;
  return new;
end $function$;

drop trigger if exists trg_river_review_resolved on public.waiting_on_josh;
CREATE TRIGGER trg_river_review_resolved AFTER UPDATE ON public.waiting_on_josh FOR EACH ROW EXECUTE FUNCTION river_review_resolved();

CREATE OR REPLACE FUNCTION public.river_review_to_smart()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if pg_trigger_depth() > 1 then return new; end if;
  if new.resolved_at is not null and old.resolved_at is null then
    -- auto-resolvers (staleness audits etc.) don't create work
    if coalesce(new.resolved_by,'') in ('morning-audit','orchestrator-audit') then
      return new;
    end if;
    -- explicit dismissals don't create work
    if coalesce(new.resolution_note,'') ~* '^(skip|dismiss|no action|drop|ignore|n/?a)\y' then
      return new;
    end if;
    -- dedupe: this card already has a SMART row
    if exists (select 1 from smart_task_enrichments s
               where s.trello_card_id = 'review:' || new.id) then
      return new;
    end if;
    insert into smart_task_enrichments
      (raw_input, revised_title, definition_of_done, measure, blockers, effort,
       trello_card_id, board_bucket, board_venture)
    values (
      'From review card: ' || new.title
        || case when nullif(new.resolution_note,'') is not null
                then E'\n\nJosh''s resolution: ' || new.resolution_note else '' end,
      left(regexp_replace(new.title, '^[^[:alnum:]]+', ''), 120),
      'Act on Josh''s review resolution (Smartify to sharpen)',
      'Marked done on the SMART board', 'None', '1-4hr',
      'review:' || new.id,
      'Needs SMART',
      'Personal'
    );
  end if;
  return new;
end $function$;

drop trigger if exists trg_river_review_to_smart on public.waiting_on_josh;
CREATE TRIGGER trg_river_review_to_smart AFTER UPDATE ON public.waiting_on_josh FOR EACH ROW EXECUTE FUNCTION river_review_to_smart();


-- ---------------------------------------------------------------------
-- 7. work_claims  -- GUARDED, see KNOWN GAP above
-- ---------------------------------------------------------------------
-- trg_enforce_done_evidence (BEFORE INSERT OR UPDATE) is the no-fake-done
--   rule enforced in the database: a lane cannot reach status='done' without
--   a non-blank pr_url or done_evidence, and without released_at set. This is
--   the single most important trigger in this file and it had no migration.
-- trg_log_work_claim_event  (AFTER INSERT OR UPDATE) appends every status or
--   evidence change to work_claim_events as an append-only audit trail.
-- 
-- Functions are created unconditionally (plpgsql resolves table names at
-- runtime, so this succeeds even with the tables absent); only the triggers
-- need the guard.

CREATE OR REPLACE FUNCTION public.enforce_done_evidence()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if NEW.status = 'done'
     and nullif(btrim(coalesce(NEW.pr_url,'')), '') is null
     and nullif(btrim(coalesce(NEW.done_evidence,'')), '') is null then
    raise exception
      'Lane "%" cannot be marked done without evidence. Set pr_url or done_evidence to a verifiable artifact (PR link, merged commit sha, row count, tagged-card count, etc.). No lane is done without finishing.',
      NEW.work_key
      using errcode = 'check_violation';
  end if;
  if NEW.status = 'done' and NEW.released_at is null then
    raise exception
      'Lane "%" cannot be marked done without released_at. Set released_at (normally now()) when closing the lane — done rows must record when they were released.',
      NEW.work_key
      using errcode = 'check_violation';
  end if;
  return NEW;
end;
$function$;

CREATE OR REPLACE FUNCTION public.log_work_claim_event()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if TG_OP = 'INSERT' then
    insert into public.work_claim_events(work_key, old_status, new_status, claimed_by, pr_url, done_evidence, note)
    values (NEW.work_key, null, NEW.status, NEW.claimed_by, NEW.pr_url, NEW.done_evidence, 'created');
  elsif (NEW.status is distinct from OLD.status)
     or (NEW.pr_url is distinct from OLD.pr_url)
     or (NEW.done_evidence is distinct from OLD.done_evidence) then
    insert into public.work_claim_events(work_key, old_status, new_status, claimed_by, pr_url, done_evidence, note)
    values (NEW.work_key, OLD.status, NEW.status, NEW.claimed_by, NEW.pr_url, NEW.done_evidence,
      case when NEW.status is distinct from OLD.status
           then 'status ' || OLD.status || ' -> ' || NEW.status
           else 'evidence updated' end);
  end if;
  return NEW;
end;
$function$;

do $guard$
begin
  if to_regclass('public.work_claims') is null then
    raise warning '[catch-up 20260805] public.work_claims does not exist -- skipped trg_enforce_done_evidence, trg_log_work_claim_event. The no-fake-done guard and the work_claim audit trail are NOT active in this database.';
  else
    execute 'drop trigger if exists trg_enforce_done_evidence on public.work_claims';
    execute 'CREATE TRIGGER trg_enforce_done_evidence BEFORE INSERT OR UPDATE ON public.work_claims FOR EACH ROW EXECUTE FUNCTION enforce_done_evidence()';
    execute 'drop trigger if exists trg_log_work_claim_event on public.work_claims';
    execute 'CREATE TRIGGER trg_log_work_claim_event AFTER INSERT OR UPDATE ON public.work_claims FOR EACH ROW EXECUTE FUNCTION log_work_claim_event()';
  end if;
end
$guard$;


-- ---------------------------------------------------------------------
-- 8. smart_links  -- GUARDED, see KNOWN GAP above
-- ---------------------------------------------------------------------
-- smart_links_touch: an ordinary updated_at touch, included only because it
-- too was applied out-of-band and would otherwise vanish on a reset.

CREATE OR REPLACE FUNCTION public.touch_smart_links()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$ begin new.updated_at = now(); return new; end $function$;

do $guard$
begin
  if to_regclass('public.smart_links') is null then
    raise warning '[catch-up 20260805] public.smart_links does not exist -- skipped smart_links_touch. smart_links.updated_at will not self-maintain.';
  else
    execute 'drop trigger if exists smart_links_touch on public.smart_links';
    execute 'CREATE TRIGGER smart_links_touch BEFORE UPDATE ON public.smart_links FOR EACH ROW EXECUTE FUNCTION touch_smart_links()';
  end if;
end
$guard$;

-- ---------------------------------------------------------------------
-- 9. Self-verification
-- ---------------------------------------------------------------------
-- Lint pattern 5: do not trust a clean exit. Count what actually landed and
-- say so out loud. On production this must report 15 of 15.

do $verify$
declare
  expected text[] := array[
    'trg_river_job_done','agent_messages_autotag','trg_river_own_queue',
    'trg_river_queue_done','trg_river_queue_event','trg_river_own_smart',
    'trg_river_enrichment_done','trg_river_smart_event','trg_river_own_review',
    'trg_river_review_event','trg_river_review_resolved','trg_river_review_to_smart',
    'trg_enforce_done_evidence','trg_log_work_claim_event','smart_links_touch'];
  found integer;
  missing text;
begin
  select count(*) into found
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
   where not t.tgisinternal and n.nspname = 'public' and t.tgname = any(expected);

  select string_agg(e, ', ') into missing
    from unnest(expected) e
   where not exists (
     select 1 from pg_trigger t
       join pg_class c on c.oid = t.tgrelid
       join pg_namespace n on n.oid = c.relnamespace
      where not t.tgisinternal and n.nspname = 'public' and t.tgname = e);

  if found = array_length(expected, 1) then
    raise notice '[catch-up 20260805] OK - all % behaviour triggers present.', found;
  else
    raise warning '[catch-up 20260805] % of % present. MISSING: % (expected on a fresh clone until the missing tables are written back).',
      found, array_length(expected, 1), missing;
  end if;
end
$verify$;
