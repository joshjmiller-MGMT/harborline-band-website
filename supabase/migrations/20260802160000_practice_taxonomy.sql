-- Practice structured detail (Josh 2026-08-02). Taxonomy lives in DATA so new
-- methods are an INSERT, not a deploy.
--
-- KEY DESIGN (from Josh's own correction): a method declares WHICH dimensions
-- follow it. Barry/Bill Evans voicings take chord QUALITIES; 4ths/quartal and
-- Belzer take PARENT SCALES (major / melodic minor / harmonic minor). So dim2
-- is per-method, not global.
--
-- ALSO: vocabulary is COLUMN-EXCLUSIVE. "Bill" as a voicing exercise and "Bill
-- Evans" as a line study are different entities that share a name — hence
-- applies_to scoping and separate rows, never one shared row.
create table if not exists practice_taxonomy (
  id           uuid primary key default gen_random_uuid(),
  dimension    text not null,              -- method | quality | parent_scale | voicing | spread
  parent_id    uuid references practice_taxonomy(id) on delete cascade,
  value        text not null,
  label        text not null,
  applies_to   text[] not null default '{}',   -- section categories: Chords, Scales, Lines...
  dim2         text,                       -- method rows: which dimension follows ('quality'|'parent_scale')
  dim3         text,                       -- method rows: third dropdown ('voicing'|'spread')
  sort_order   int not null default 0,
  active       boolean not null default true,
  notes        text,
  created_at   timestamptz not null default now()
);
create index if not exists practice_taxonomy_dim_idx on practice_taxonomy(dimension, parent_id);
alter table practice_taxonomy enable row level security;
drop policy if exists practice_taxonomy_read on practice_taxonomy;
create policy practice_taxonomy_read on practice_taxonomy for select to authenticated using (true);
drop policy if exists practice_taxonomy_write on practice_taxonomy;
create policy practice_taxonomy_write on practice_taxonomy for all to authenticated
  using (is_operator()) with check (is_operator());

-- Stackable detail rows: one chord block routinely holds several items
-- (Barry major drop 2 AND Bill min-maj drop 3), so this is a child table.
create table if not exists practice_segment_details (
  id            uuid primary key default gen_random_uuid(),
  segment_id    uuid not null references practice_session_segments(id) on delete cascade,
  method_id     uuid references practice_taxonomy(id),
  dim2_id       uuid references practice_taxonomy(id),   -- quality OR parent scale
  dim3_id       uuid references practice_taxonomy(id),   -- voicing OR spread
  bpm           int,
  keys_covered  text,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists practice_segment_details_seg_idx on practice_segment_details(segment_id);
alter table practice_segment_details enable row level security;
drop policy if exists practice_segment_details_all on practice_segment_details;
create policy practice_segment_details_all on practice_segment_details for all to authenticated
  using (true) with check (true);
