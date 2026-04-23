-- Extend claude_log to support both the existing TeamClaudeLog page and the dashboard ClaudeLogWidget
ALTER TABLE public.claude_log
  ADD COLUMN IF NOT EXISTS session_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS date date,
  ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'Cowork',
  ADD COLUMN IF NOT EXISTS topics text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tools_used text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS files_created text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS key_decisions text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS loose_ends text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS machine_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT '';