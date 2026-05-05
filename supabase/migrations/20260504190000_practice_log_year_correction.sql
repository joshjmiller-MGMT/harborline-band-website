-- Year correction: imported sessions should be 2024/2025/2026 (not 2023/2024/2025).
-- Shifts all imported rows forward by 1 year. Idempotent via the marker preset_name;
-- if re-applied without re-importing, this would shift again — only run once after
-- the practice_log_sessions_import migration.
UPDATE practice_sessions
SET started_at = started_at + INTERVAL '1 year',
    ended_at = ended_at + INTERVAL '1 year'
WHERE preset_name = 'Imported (sheet)';
