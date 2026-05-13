-- P4 (2026-05-12 Q1 = DELETE): drop claude_log table.
-- Widget removed from /team/dashboard; orphan TeamClaudeLog page deleted.
DROP TABLE IF EXISTS public.claude_log CASCADE;
