-- p352: distinct-genre helper for the /team/resources genre filter.
-- chart_index has ~10k rows; a direct PostgREST distinct-select hits the 1000-row
-- cap and would miss rarer genres. This RPC returns the full distinct, non-null,
-- non-empty genre set (ordered) in one cheap call. Read-only, safe for anon/team.
create or replace function public.chart_index_genres()
returns table (genre text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct genre
  from public.chart_index
  where genre is not null and btrim(genre) <> ''
  order by genre;
$$;

grant execute on function public.chart_index_genres() to anon, authenticated;
