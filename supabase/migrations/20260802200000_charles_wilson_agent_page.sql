-- Charles Wilson — managed EXTERNAL artist (Josh = booking agent, ~10% commission).
-- Approved by Josh 2026-07-19 ("go ahead with everything... EVERYTHING SHOULD EXIST
-- AS INTERACTABLE ITEM ON THIS WEBSITE"). Backend-touchpoint rule: /team/charles-wilson.
-- Background: wiki/harborline/charles-wilson-agent-opportunity-2026-07.md +
-- booking-agencies-target-list-2026-07.md § 4.
--
-- Three tables (why three: submissions are a per-agency STATE machine, outreach is
-- an append-only LOG, bookings carry money math — mixing them makes each view lie).

create table if not exists wilson_submissions (
  id uuid primary key default gen_random_uuid(),
  target text not null,
  category text not null default 'agency', -- agency | festival | network | existing-rep
  region text,
  submit_path text, -- url or email for the submission
  status text not null default 'not_submitted', -- not_submitted | submitted | in_conversation | listed | declined | dead
  submitted_at date,
  notes text,
  sort integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists wilson_outreach (
  id uuid primary key default gen_random_uuid(),
  target text,
  channel text, -- email | form | phone | in-person
  direction text not null default 'out', -- out | in
  summary text not null,
  happened_at date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists wilson_bookings (
  id uuid primary key default gen_random_uuid(),
  event_date date,
  venue text,
  buyer text,
  fee numeric, -- gross fee; Josh's commission = fee * commission_pct / 100
  commission_pct numeric not null default 10,
  status text not null default 'pitched', -- pitched | hold | confirmed | played | paid | lost
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table wilson_submissions enable row level security;
alter table wilson_outreach enable row level security;
alter table wilson_bookings enable row level security;

-- Reads for any signed-in teammate; writes operator-only (owner/manager via the
-- RBAC step-1 is_operator() helper) — commission money data is management-tier.
create policy wilson_submissions_read on wilson_submissions for select to authenticated using (true);
create policy wilson_submissions_write on wilson_submissions for all to authenticated
  using (is_operator()) with check (is_operator());
create policy wilson_outreach_read on wilson_outreach for select to authenticated using (true);
create policy wilson_outreach_write on wilson_outreach for all to authenticated
  using (is_operator()) with check (is_operator());
create policy wilson_bookings_read on wilson_bookings for select to authenticated using (true);
create policy wilson_bookings_write on wilson_bookings for all to authenticated
  using (is_operator()) with check (is_operator());

-- Seed — existing reps first (he is NOT starting from zero), then the July-2026
-- target list (booking-agencies-target-list-2026-07.md § 4, statuses fresh).
insert into wilson_submissions (target, category, region, submit_path, status, notes, sort) values
  ('Southeastern Attractions', 'existing-rep', 'Southeast', null, 'listed', 'Pre-existing rep — listed before Josh came on.', 10),
  ('Celebrity Direct Entertainment', 'existing-rep', 'National', null, 'listed', 'Pre-existing rep.', 11),
  ('stlblues.net', 'existing-rep', 'Midwest', null, 'listed', 'Pre-existing listing.', 12),
  ('Intrepid Artists International', 'agency', 'National (Charlotte NC)', 'https://intrepidartists.com/submissions/', 'not_submitted', 'TOP PICK — real submission channel; roster already has soul acts (Curtis Salgado, John Nemeth). 3x Best Agency. Anchor agency; let the agent work the big festivals.', 20),
  ('Jus'' Blues Music Foundation', 'network', 'Southeast (Atlanta GA)', 'https://www.jusblues.org/contact.html', 'not_submitted', 'His exact peer world (Little Milton / Bobby Rush lineage). Pitch awards/conference programming; $50 membership = networking-in.', 30),
  ('King Biscuit Blues Festival', 'festival', 'Southeast (Helena AR)', 'booking@kingbiscuitfestival.com', 'not_submitted', 'Largest blues fest in the South; real booking email. Early-mid Oct — pitch months ahead.', 40),
  ('Legendary Rhythm & Blues Cruise', 'festival', 'National (KC MO base)', 'Bluesin@BluesCruise.com', 'not_submitted', 'Has run Soul-Blues sailings; no open form but fields artist inquiries.', 41),
  ('Tennessee Blues Society', 'network', 'Nashville / TN (home base)', 'tennesseebluessociety@gmail.com', 'not_submitted', 'Warm home-market relationship + connective tissue to Nashville venues. Not an agency.', 31),
  ('Waterfront Blues Festival', 'festival', 'National (Portland OR)', 'info@waterfrontbluesfest.com', 'not_submitted', 'One of the largest US blues fests; pitch the talent buyer via info@ (or via agent).', 42),
  ('Briggs Farm Blues Festival', 'festival', 'Northeast (Nescopeck PA)', 'https://www.briggsfarm.com/', 'not_submitted', 'PA''s largest blues fest. No public form surfaced — pitch via site Contact; book 4-6 mo ahead.', 43),
  ('Blind Raccoon (Betsie Brown)', 'network', 'National (Memphis TN)', 'https://blindraccoon.com/about-us/', 'not_submitted', 'Publicity/radio promo hub (not booking); raises profile so agents/festivals come to him. Confirm intake.', 32),
  ('Beale Street Music Festival', 'festival', 'Southeast (Memphis TN)', 'https://bealestreet.com/do/beale-street-music-festival', 'not_submitted', 'Books via agents/talent buyers — no open submission. Route via agent once on Intrepid.', 44),
  ('Chicago Blues Festival (DCASE)', 'festival', 'National (Chicago IL)', 'dcase@cityofchicago.org', 'not_submitted', 'Largest free blues festival in the world; DCASE-curated, typically via agents. Inquire / agent-route only.', 45),
  ('The Blues Foundation', 'network', 'National (Memphis TN)', 'https://blues.org/become-a-member/', 'not_submitted', 'He is a 2019 HoF inductee — credibility asset. Membership keeps him visible. Leverage, not booking.', 33),
  ('Southern Soul RNB (Daddy B. Nice)', 'network', 'National (Southeast-heavy)', 'daddybnice@southernsoulrnb.com', 'not_submitted', 'Editorial/charts platform; reviews/charting raise festival demand. Promotion path, not booking.', 34)
on conflict do nothing;
