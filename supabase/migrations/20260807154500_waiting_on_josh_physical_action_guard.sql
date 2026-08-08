-- Only Josh can close a card that asks Josh to do a physical-world thing.
--
-- The morning-audit routine auto-resolved f3fe4bd5 ("Plug GLYPH into JARSH")
-- on 2026-08-06 and again on 2026-08-07, both times by reading tables that
-- contain GLYPH *records* (a 2026-06-08 offline snapshot loaded 7/21) and
-- concluding the *drive* was mounted. No GLYPH volume has ever been present;
-- Win32_LogicalDisk shows only C:, D: and the four Google Drive letters.
--
-- Closing a Josh ask is worse than leaving it open: the work goes invisible,
-- he never does it, and the board reports it unblocked. work_claims already
-- has enforce_done_evidence; waiting_on_josh had no equivalent.

alter table public.waiting_on_josh
  add column if not exists requires_josh_action boolean not null default false;

comment on column public.waiting_on_josh.requires_josh_action is
  'True when the ask is a physical/external act only Josh can perform (plug in a drive, sign a contract, click through a vendor dashboard). Such rows can only be resolved by Josh himself - see enforce_josh_action_resolution.';

create or replace function public.enforce_josh_action_resolution()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.resolved_at is not null
     and old.resolved_at is null
     and new.requires_josh_action
     and coalesce(new.resolved_by, '') not in ('josh', 'Josh') then
    raise exception
      'Card % requires a physical action only Josh can perform and cannot be auto-resolved by "%". Verify against the real world and leave it open. (enforce_josh_action_resolution)',
      new.id, coalesce(new.resolved_by, '<null>');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_josh_action_resolution on public.waiting_on_josh;
create trigger trg_enforce_josh_action_resolution
  before update on public.waiting_on_josh
  for each row
  execute function public.enforce_josh_action_resolution();

-- Seeded flags: the open cards that are external-dashboard or physical acts.
-- f3fe4bd5 GLYPH - ae9b778f Instagram Meta dashboard - 9a988c30 MSAC account
-- c765b6b4 iPad forScore - c681915c Charles Wilson agreement - 96c2ef77 Twilio rotate
