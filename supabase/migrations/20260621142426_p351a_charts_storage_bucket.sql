-- p351a: private storage bucket for the 10k+ fakebook chart PDFs.
-- Copyright-gated: team (authenticated) read only, served via signed URLs.
-- Mirrors the existing private "review-media" bucket pattern.
insert into storage.buckets (id, name, public)
values ('charts', 'charts', false)
on conflict (id) do nothing;

-- Authenticated team users can read chart objects (frontend creates signed URLs).
drop policy if exists "charts authenticated read" on storage.objects;
create policy "charts authenticated read" on storage.objects
  for select to authenticated
  using (bucket_id = 'charts');
