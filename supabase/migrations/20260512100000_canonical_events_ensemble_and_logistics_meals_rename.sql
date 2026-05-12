-- v2 input parity with v1: add ensemble + rename logistics.meals → logistics.musician_meals.
--
-- v1's TEMPLATE_FIELDS exposed Ensemble (e.g. "Sextet" / "Trio") as a scalar input
-- across all 4 templates, and "Musician Food & Bev" as a scalar that was clearly
-- about musician-side catering (not guest catering). v2's canonical_events schema
-- collapsed both into different shapes — ensemble was inferred from personnel[]
-- count in C-client only, and the catering field was named ambiguously as
-- logistics.meals. Restoring v1 input parity in the inline editor needs both:
--   1. A top-level ensemble scalar so users can override the derived count
--      and explicitly name the lineup ("Trio: piano / bass / drums").
--   2. An unambiguous logistics.musician_meals (rename from logistics.meals).

ALTER TABLE public.canonical_events
  ADD COLUMN ensemble text;

-- Move any existing logistics.meals values into logistics.musician_meals.
UPDATE public.canonical_events
SET logistics = jsonb_set(
  logistics - 'meals',
  '{musician_meals}',
  logistics->'meals'
)
WHERE logistics ? 'meals';
