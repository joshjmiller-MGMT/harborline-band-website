-- Brands
CREATE TABLE public.social_brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#8b5cf6',
  platforms text[] NOT NULL DEFAULT ARRAY['instagram','tiktok','facebook'],
  voice_notes text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.social_brands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view social_brands" ON public.social_brands FOR SELECT USING (true);
CREATE POLICY "Anyone can insert social_brands" ON public.social_brands FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update social_brands" ON public.social_brands FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete social_brands" ON public.social_brands FOR DELETE USING (true);

CREATE TRIGGER social_brands_updated_at
BEFORE UPDATE ON public.social_brands
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sources (recurring or one-off content prompts)
CREATE TABLE public.social_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.social_brands(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  kind text NOT NULL CHECK (kind IN ('recurring','oneoff')),
  cadence text CHECK (cadence IN ('weekly','biweekly','monthly')),
  day_of_week int CHECK (day_of_week BETWEEN 0 AND 6),
  event_date date,
  last_generated_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.social_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view social_sources" ON public.social_sources FOR SELECT USING (true);
CREATE POLICY "Anyone can insert social_sources" ON public.social_sources FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update social_sources" ON public.social_sources FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete social_sources" ON public.social_sources FOR DELETE USING (true);

CREATE TRIGGER social_sources_updated_at
BEFORE UPDATE ON public.social_sources
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Posts (kanban cards)
CREATE TABLE public.social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.social_brands(id) ON DELETE CASCADE,
  source_id uuid REFERENCES public.social_sources(id) ON DELETE SET NULL,
  title text NOT NULL,
  notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'idea' CHECK (status IN ('idea','drafting','scheduled','posted')),
  scheduled_for timestamptz,
  posted_at timestamptz,
  captions jsonb NOT NULL DEFAULT '{}'::jsonb,
  platform_status jsonb NOT NULL DEFAULT '{}'::jsonb,
  asset_urls text[] NOT NULL DEFAULT '{}',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view social_posts" ON public.social_posts FOR SELECT USING (true);
CREATE POLICY "Anyone can insert social_posts" ON public.social_posts FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update social_posts" ON public.social_posts FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete social_posts" ON public.social_posts FOR DELETE USING (true);

CREATE TRIGGER social_posts_updated_at
BEFORE UPDATE ON public.social_posts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_social_posts_brand_status ON public.social_posts(brand_id, status);
CREATE INDEX idx_social_sources_brand ON public.social_sources(brand_id);

-- Seed the three brands
INSERT INTO public.social_brands (slug, name, color, sort_order) VALUES
  ('harborline', 'Harborline', '#8b5cf6', 0),
  ('the-economy', 'The Economy', '#3b82f6', 1),
  ('solo', 'Solo (Josh Miller)', '#ec4899', 2);