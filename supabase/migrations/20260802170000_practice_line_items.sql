-- Seed LINE items from Josh's own spreadsheet catalogue (mined 8/2, every
-- family + range evidenced in practice-taxonomy-mined-2026-08.md).
-- kind='line' + color_level=0 (unrated) — Josh sets mastery from the practice
-- row, which writes back here so the color IS the line's status, globally.
insert into practice_items (kind, title, color_level, notes)
select 'line', fam.name || ' ' || n, 0, 'Seeded 8/2 from the practice-sheet catalogue.'
from (values
  ('OpenStudio',27),('Harry',9),('Oscar',4),('Bill',5),
  ('Herbie',3),('Cedar',2),('Book line',5),('Bird',6),('Clifford',2)
) as fam(name,hi), generate_series(1,27) n
where n <= fam.hi
and not exists (
  select 1 from practice_items p where p.kind='line' and p.title = fam.name || ' ' || n
);
select kind, count(*) from practice_items group by kind;
