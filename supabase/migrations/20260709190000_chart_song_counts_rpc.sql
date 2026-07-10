-- Song-level counts for the /team/resources browser (Trello card 6a4a9cb8:
-- "reflect the number of songs total without accounting for different versions
-- ... i dont want it counting autumn leaves as 10 songs because we have 10
-- versions. extrapolate that to the library").
--
-- song_key mirrors the UI's cleanSongTitle(): cut the title at the first
-- "[BookCode]", strip a trailing " (2)"-style dup marker, collapse whitespace,
-- lowercase. Falls back to the raw title when cleaning empties the string.
--
-- One call returns songs+charts at three levels via GROUPING SETS — replacing
-- the browser's 9 per-chip head-counts AND its client-side subfolder tally,
-- which silently truncated at PostgREST's 1000-row cap (fake-books has ~8k
-- rows). `level` disambiguates rollup rows from real NULL subfolders (a chart
-- sitting directly in a top folder, e.g. originals/, has folder_sub NULL at
-- level 'sub' — without GROUPING() that row is indistinguishable from the
-- top-level rollup).
--   level='total' → grand total (folder_top/folder_sub NULL)
--   level='top'   → per top-level folder
--   level='sub'   → per top/sub folder pair
drop function if exists public.chart_index_song_counts();
create function public.chart_index_song_counts()
returns table (level text, folder_top text, folder_sub text, songs bigint, charts bigint)
language sql
stable
security definer
set search_path = public
as $$
  with cleaned as (
    select
      split_part(folder_path, '/', 1) as folder_top,
      nullif(split_part(folder_path, '/', 2), '') as folder_sub,
      lower(
        coalesce(
          nullif(
            trim(
              regexp_replace(
                regexp_replace(split_part(title, '[', 1), '\s*\(\d+\)\s*$', ''),
                '\s+', ' ', 'g'
              )
            ),
            ''
          ),
          lower(title)
        )
      ) as song_key
    from public.chart_index
  )
  select
    case
      when grouping(folder_top) = 1 then 'total'
      when grouping(folder_sub) = 1 then 'top'
      else 'sub'
    end as level,
    folder_top, folder_sub,
    count(distinct song_key) as songs,
    count(*) as charts
  from cleaned
  group by grouping sets ((folder_top, folder_sub), (folder_top), ())
$$;

grant execute on function public.chart_index_song_counts() to authenticated;
