-- p351b: storage_path points each chart row at its object in the private 'charts'
-- bucket (sanitized folder_path/filename). Supersedes drive_web_view_link as the
-- canonical PDF source; the browser builds a signed URL from it.
alter table public.chart_index add column if not exists storage_path text;
