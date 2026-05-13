-- P317 — Instrument-hours track: calendar→hours classifier + review queue + 10k progress.
--
-- Two new tables:
--   `instrument_classifier_rules`     — editable band/keyword whitelist (UI-tunable)
--   `instrument_event_classifications`— per-event verdict cache + review queue rows
--
-- Reuses patterns from P11 (`staffing-snapshot` GCal+token plumbing) and P21
-- (`visual_assets.review_status` confidence-queue model). Goal: surface total
-- instrument-time across Josh's career — gigs, rehearsals, practice — toward
-- the 10,000-hour benchmark.

-- ============================================================================
-- 1. CLASSIFIER RULES — editable whitelist used by the scan edge fn.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.instrument_classifier_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('band', 'keyword', 'venue', 'exclude')),
  -- 'band'     → primary band-name match (e.g. "TSB", "Tom Starr Band"). Match means classify_as='gig'.
  -- 'keyword'  → secondary signal (e.g. "ceremony", "rehearsal", "practice"). Match adds confidence.
  -- 'venue'    → known venue tied to playing (e.g. "8x10"). Match adds confidence.
  -- 'exclude'  → negative match — title contains this → DON'T classify as instrument-time
  --              (e.g. "rehearsal dinner" should NOT count toward instrument-hours).
  pattern text NOT NULL,           -- Case-insensitive substring match against event title (+ description).
  active boolean NOT NULL DEFAULT true,
  match_priority integer NOT NULL DEFAULT 0,  -- Higher = matched first. Exclude rules should be high-priority.
  classify_as text CHECK (classify_as IN ('gig', 'rehearsal', 'practice', 'none')),
  -- The kind of instrument-time this rule signals when matched. NULL for 'keyword' rules that
  -- only add confidence to another rule's match. 'exclude' rules use classify_as='none'.
  genre_hint text,                  -- e.g. 'pop', 'wedding', 'jazz' — informs default-hours.
  default_hours numeric(4,2),       -- Per-event override of the venue heuristic (e.g. TSB weddings always 3hr).
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS instrument_classifier_rules_active_priority_idx
  ON public.instrument_classifier_rules (active, match_priority DESC)
  WHERE active = true;

CREATE UNIQUE INDEX IF NOT EXISTS instrument_classifier_rules_kind_pattern_uniq
  ON public.instrument_classifier_rules (kind, lower(pattern));

ALTER TABLE public.instrument_classifier_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone read instrument_classifier_rules"   ON public.instrument_classifier_rules FOR SELECT USING (true);
CREATE POLICY "Anyone write instrument_classifier_rules"  ON public.instrument_classifier_rules FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone update instrument_classifier_rules" ON public.instrument_classifier_rules FOR UPDATE USING (true);
CREATE POLICY "Anyone delete instrument_classifier_rules" ON public.instrument_classifier_rules FOR DELETE USING (true);

CREATE TRIGGER update_instrument_classifier_rules_updated_at
BEFORE UPDATE ON public.instrument_classifier_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 2. EVENT CLASSIFICATIONS — per-event verdict cache + review queue.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.instrument_event_classifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gcal_event_id text NOT NULL,
  gcal_account_email text NOT NULL,
  gcal_calendar_id text NOT NULL,
  event_title text NOT NULL,
  event_description text NOT NULL DEFAULT '',
  event_color_id text,
  event_start timestamptz NOT NULL,
  event_end timestamptz NOT NULL,
  block_hours numeric(5,2) NOT NULL,
  classified_as text NOT NULL CHECK (classified_as IN ('gig', 'rehearsal', 'practice', 'none', 'unsure')),
  confidence text NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  matched_rule_id uuid REFERENCES public.instrument_classifier_rules(id) ON DELETE SET NULL,
  matched_rule_pattern text,        -- Snapshot of the pattern at classify-time (history-stable).
  estimated_hours numeric(5,2) NOT NULL,
  estimation_source text NOT NULL DEFAULT '', -- e.g. "wedding 3hr base + cocktail extra", "block literal".
  review_status text NOT NULL DEFAULT 'auto'
    CHECK (review_status IN ('auto', 'needs-review', 'reviewed')),
  reviewed_at timestamptz,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS instrument_event_classifications_event_uniq
  ON public.instrument_event_classifications (gcal_event_id, gcal_account_email);

CREATE INDEX IF NOT EXISTS instrument_event_classifications_review_idx
  ON public.instrument_event_classifications (review_status)
  WHERE review_status = 'needs-review';

CREATE INDEX IF NOT EXISTS instrument_event_classifications_start_classified_idx
  ON public.instrument_event_classifications (event_start, classified_as);

ALTER TABLE public.instrument_event_classifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone read instrument_event_classifications"   ON public.instrument_event_classifications FOR SELECT USING (true);
CREATE POLICY "Anyone write instrument_event_classifications"  ON public.instrument_event_classifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone update instrument_event_classifications" ON public.instrument_event_classifications FOR UPDATE USING (true);
CREATE POLICY "Anyone delete instrument_event_classifications" ON public.instrument_event_classifications FOR DELETE USING (true);

CREATE TRIGGER update_instrument_event_classifications_updated_at
BEFORE UPDATE ON public.instrument_event_classifications
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 3. SEED RULES — canonical band roster from co-manager/01-pillars/bands-roster.md.
-- ============================================================================

INSERT INTO public.instrument_classifier_rules (kind, pattern, active, match_priority, classify_as, genre_hint, default_hours, notes)
VALUES
  -- ── Current Josh-owned ventures (high priority — most common) ──
  ('band',    'harborline',         true, 90,  'gig',       'wedding',  3.0, 'Harborline core venture — weddings + corporate. Default 3hr playing.'),
  ('band',    'economy',            true, 90,  'gig',       'original', 1.5, 'The Economy — co-owned with Jon Miller. Gig frequency ~2-3 months, set length usually 1-1.5hr.'),
  ('band',    'econ',               true, 85,  'gig',       'original', 1.5, 'Economy abbreviation.'),
  ('band',    'jmt',                true, 80,  'gig',       'jazz',     2.0, 'Josh Miller Jazz Trio.'),
  ('band',    'jm3',                true, 80,  'gig',       'jazz',     2.0, 'Josh Miller Jazz 3-piece.'),
  ('band',    'jm5',                true, 80,  'gig',       'jazz',     2.0, 'Josh Miller Jazz 5-piece.'),
  ('band',    'josh miller jazz',   true, 85,  'gig',       'jazz',     2.0, 'Full band name.'),
  -- ── Current sideman ──
  ('band',    'tsb',                true, 80,  'gig',       'pop',      NULL, 'Tom Starr Band — Josh on keys. Repertoire flexes pop/rock/jazz/wedding. Use venue heuristic.'),
  ('band',    'tom starr',          true, 80,  'gig',       'pop',      NULL, 'TSB full name.'),
  ('band',    'lovable idiots',     true, 80,  'gig',       NULL,       NULL, 'Sideman band Josh raised 2026-05-13.'),
  -- ── Former (calendar history will include these) ──
  ('band',    'brunswick',          true, 70,  'gig',       'pop',      NULL, 'Former — bandleader Marc Cashin. Pop, NOT a wedding band.'),
  ('band',    'bswk',               true, 70,  'gig',       'pop',      NULL, 'Brunswick abbreviation.'),
  ('band',    'hull williams',      true, 70,  'gig',       NULL,       NULL, 'Former band.'),
  ('band',    'hwb',                true, 70,  'gig',       NULL,       NULL, 'Hull Williams abbreviation.'),
  ('band',    'seventeller',        true, 70,  'gig',       NULL,       NULL, 'Yutzi Seventeller / Sam Teller / Sam Cochran — same project, multiple names.'),
  ('band',    'sam cochran',        true, 70,  'gig',       NULL,       NULL, 'Yutzi project naming variant.'),
  ('band',    'sam teller',         true, 70,  'gig',       NULL,       NULL, 'Yutzi project naming variant.'),
  ('band',    'higherkeys',         true, 70,  'gig',       NULL,       NULL, 'Former band.'),
  -- ── Generic keywords (venue/event-type signals — confidence boost) ──
  ('keyword', 'ceremony',           true, 50,  NULL,         'wedding', 1.0, 'Wedding ceremony slot — adds 1hr to base playing time.'),
  ('keyword', 'cocktail',           true, 50,  NULL,         'wedding', 1.0, 'Cocktail hour slot — adds 1hr to base playing time.'),
  ('keyword', 'reception',          true, 50,  NULL,         'wedding', 1.0, 'Wedding reception — adds 1hr (base 3hr already covers reception in most weddings, so additive math may overshoot; tune after first scan).'),
  ('keyword', 'wedding',            true, 60,  'gig',        'wedding', 3.0, 'Direct wedding match if title says "wedding" without a band tag.'),
  ('keyword', 'gig',                true, 40,  'gig',        NULL,      NULL, 'Generic "gig" tag — low default hours, surfaces to review queue.'),
  ('keyword', 'live music',         true, 50,  'gig',        NULL,      NULL, 'Live music slot.'),
  ('keyword', 'musician',           true, 30,  'gig',        NULL,      NULL, 'Weak signal — surfaces to review queue.'),
  -- ── Rehearsal + practice (separate classify_as) ──
  ('keyword', 'rehearsal',          true, 80,  'rehearsal',  NULL,      NULL, 'Rehearsal — trust block duration, no setup inflation. Orange colorId expected.'),
  ('keyword', 'practice',           true, 80,  'practice',   NULL,      NULL, 'Practice block — trust block duration.'),
  -- ── Exclude rules (negative matches) ──
  ('exclude', 'rehearsal dinner',   true, 100, 'none',       NULL,      NULL, 'Wedding rehearsal dinner — NOT a band rehearsal. Higher priority than the "rehearsal" keyword.'),
  ('exclude', 'cancelled',          true, 100, 'none',       NULL,      NULL, 'Cancelled gigs don''t count.')
ON CONFLICT (kind, lower(pattern)) DO NOTHING;
