-- p350a: songs table — moves the website songlist (formerly hard-coded in
-- src/pages/SongList.tsx) into the DB so it's queryable, org-taggable, and the
-- single source of truth for both /songs and the new setlist builder.
-- Array-column convention mirrors public.chart_index (tags/setlists text[]).

create table if not exists public.songs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text not null,
  genre text not null,
  functions text[] not null default '{}',          -- e.g. {Reception,Party}
  decade text,                                       -- free text (e.g. 70s, 60s)
  org_tags text[] not null default '{}',            -- subset of {bse,harborline,tsb}
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists songs_title_artist_key
  on public.songs (lower(title), lower(artist));
create index if not exists songs_genre_idx on public.songs (genre);
create index if not exists songs_functions_gin on public.songs using gin (functions);
create index if not exists songs_org_tags_gin on public.songs using gin (org_tags);

-- shared updated_at trigger fn (reused by setlists in p350b)
create or replace function public.tg_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists songs_set_updated_at on public.songs;
create trigger songs_set_updated_at before update on public.songs
  for each row execute function public.tg_touch_updated_at();

alter table public.songs enable row level security;

-- Public catalog is world-readable (matches chart_index "Anyone can view").
drop policy if exists "songs public read" on public.songs;
create policy "songs public read" on public.songs
  for select using (active = true);

-- Writes are service-role only (no song-manager UI yet); service role bypasses
-- RLS, so no write policy is defined.

-- ---------------------------------------------------------------------------
-- Seed: the 126 songs from src/pages/SongList.tsx, every song tagged into all
-- three orgs (bse/harborline/tsb) per the locked product decision. Generated
-- programmatically from the source array (scripts/gen-songs-seed is throwaway).
-- ---------------------------------------------------------------------------
insert into public.songs (title, artist, genre, functions, decade, org_tags) values
  ('September', 'Earth, Wind & Fire', 'Funk & Disco', array['Reception','Party'], '70s', array['bse','harborline','tsb']),
  ('Superstition', 'Stevie Wonder', 'Funk & Disco', array['Reception','Party'], '70s', array['bse','harborline','tsb']),
  ('Dancing Queen', 'ABBA', 'Funk & Disco', array['Reception','Party'], '70s', array['bse','harborline','tsb']),
  ('I Wish', 'Stevie Wonder', 'Funk & Disco', array['Reception','Party'], '70s', array['bse','harborline','tsb']),
  ('Brick House', 'The Commodores', 'Funk & Disco', array['Reception','Party'], '70s', array['bse','harborline','tsb']),
  ('Disco Inferno', 'The Trammps', 'Funk & Disco', array['Reception','Party'], '70s', array['bse','harborline','tsb']),
  ('Higher Ground', 'Stevie Wonder', 'Funk & Disco', array['Reception','Party'], '70s', array['bse','harborline','tsb']),
  ('Boogie Shoes', 'KC & The Sunshine Band', 'Funk & Disco', array['Reception','Party'], '70s', array['bse','harborline','tsb']),
  ('That''s the Way (I Like It)', 'KC & The Sunshine Band', 'Funk & Disco', array['Reception','Party'], '70s', array['bse','harborline','tsb']),
  ('Get Up Offa That Thing', 'James Brown', 'Funk & Disco', array['Reception','Party'], '70s', array['bse','harborline','tsb']),
  ('Papa''s Got a Brand New Bag', 'James Brown', 'Funk & Disco', array['Reception','Party'], '60s', array['bse','harborline','tsb']),
  ('Canned Heat', 'Jamiroquai', 'Funk & Disco', array['Reception','Party','Cocktail'], '90s', array['bse','harborline','tsb']),
  ('Cosmic Girl', 'Jamiroquai', 'Funk & Disco', array['Reception','Party'], '90s', array['bse','harborline','tsb']),
  ('Do It', 'Tuxedo', 'Funk & Disco', array['Reception','Party','Cocktail'], '2010s', array['bse','harborline','tsb']),
  ('Jump On It (Apache)', 'Sugarhill Gang', 'Funk & Disco', array['Reception','Party'], '80s', array['bse','harborline','tsb']),
  ('Give It to Me Baby', 'Rick James', 'Funk & Disco', array['Reception','Party'], '80s', array['bse','harborline','tsb']),
  ('Gimme! Gimme! Gimme! (A Man After Midnight)', 'ABBA', 'Funk & Disco', array['Reception','Party'], '70s', array['bse','harborline','tsb']),
  ('Papa Don''t Take No Mess', 'James Brown', 'Funk & Disco', array['Reception','Party'], '70s', array['bse','harborline','tsb']),
  ('Blinding Lights', 'The Weeknd', 'Pop & Top 40', array['Reception','Party'], '2020s', array['bse','harborline','tsb']),
  ('Levitating', 'Dua Lipa', 'Pop & Top 40', array['Reception','Party'], '2020s', array['bse','harborline','tsb']),
  ('Dance the Night', 'Dua Lipa', 'Pop & Top 40', array['Reception','Party'], '2020s', array['bse','harborline','tsb']),
  ('Break My Soul', 'Beyoncé', 'Pop & Top 40', array['Reception','Party'], '2020s', array['bse','harborline','tsb']),
  ('Unwritten', 'Natasha Bedingfield', 'Pop & Top 40', array['Reception','Party','Ceremony'], '2000s', array['bse','harborline','tsb']),
  ('Fireball', 'Pitbull', 'Pop & Top 40', array['Reception','Party'], '2010s', array['bse','harborline','tsb']),
  ('Give Me Everything', 'Pitbull', 'Pop & Top 40', array['Reception','Party'], '2010s', array['bse','harborline','tsb']),
  ('Starships', 'Nicki Minaj', 'Pop & Top 40', array['Reception','Party'], '2010s', array['bse','harborline','tsb']),
  ('360', 'Charli XCX', 'Pop & Top 40', array['Reception','Party'], '2020s', array['bse','harborline','tsb']),
  ('Lil Boo Thang', 'Paul Russell', 'Pop & Top 40', array['Reception','Party','Cocktail'], '2020s', array['bse','harborline','tsb']),
  ('Low', 'Flo Rida', 'Pop & Top 40', array['Reception','Party'], '2000s', array['bse','harborline','tsb']),
  ('Everybody Wants to Rule the World', 'Tears for Fears', 'Pop & Top 40', array['Cocktail','Dinner'], '80s', array['bse','harborline','tsb']),
  ('Somebody That I Used to Know', 'Gotye ft. Kimbra', 'Pop & Top 40', array['Cocktail','Dinner'], '2010s', array['bse','harborline','tsb']),
  ('Attention', 'Charlie Puth', 'Pop & Top 40', array['Reception','Party','Cocktail'], '2010s', array['bse','harborline','tsb']),
  ('Positions', 'Ariana Grande', 'Pop & Top 40', array['Cocktail','Reception'], '2020s', array['bse','harborline','tsb']),
  ('We Can''t Be Friends (Wait for Your Love)', 'Ariana Grande', 'Pop & Top 40', array['Cocktail','Dinner'], '2020s', array['bse','harborline','tsb']),
  ('Out of Time', 'The Weeknd', 'Pop & Top 40', array['Cocktail','Dinner'], '2020s', array['bse','harborline','tsb']),
  ('Pink Pony Club', 'Chappell Roan', 'Pop & Top 40', array['Reception','Party'], '2020s', array['bse','harborline','tsb']),
  ('Signed, Sealed, Delivered', 'Stevie Wonder', 'R&B & Soul', array['Reception','Party','Ceremony'], '70s', array['bse','harborline','tsb']),
  ('Crazy in Love', 'Beyoncé', 'R&B & Soul', array['Reception','Party','First Dance'], '2000s', array['bse','harborline','tsb']),
  ('Never Too Much', 'Luther Vandross', 'R&B & Soul', array['Reception','Party','First Dance'], '80s', array['bse','harborline','tsb']),
  ('Mistletoe Jam', 'Luther Vandross', 'R&B & Soul', array['Holiday','Party','Reception'], '80s', array['bse','harborline','tsb']),
  ('Best of My Love', 'The Emotions', 'R&B & Soul', array['Reception','Party'], '70s', array['bse','harborline','tsb']),
  ('Move On Up', 'Curtis Mayfield', 'R&B & Soul', array['Reception','Party','Cocktail'], '70s', array['bse','harborline','tsb']),
  ('My Prerogative', 'Bobby Brown', 'R&B & Soul', array['Reception','Party'], '80s', array['bse','harborline','tsb']),
  ('Hydra', 'Grover Washington Jr.', 'R&B & Soul', array['Cocktail','Dinner'], '70s', array['bse','harborline','tsb']),
  ('Let''s Stay Together', 'Al Green', 'R&B & Soul', array['First Dance','Ceremony','Dinner','Cocktail'], '70s', array['bse','harborline','tsb']),
  ('What You Won''t Do for Love', 'Bobby Caldwell', 'R&B & Soul', array['Cocktail','Dinner','First Dance'], '70s', array['bse','harborline','tsb']),
  ('Ain''t No Sunshine', 'Bill Withers', 'R&B & Soul', array['Cocktail','Dinner','Ceremony'], '70s', array['bse','harborline','tsb']),
  ('Valerie', 'Amy Winehouse', 'R&B & Soul', array['Cocktail','Reception'], '2000s', array['bse','harborline','tsb']),
  ('Can''t Hide Love', 'Earth, Wind & Fire', 'R&B & Soul', array['Cocktail','Dinner','Reception'], '70s', array['bse','harborline','tsb']),
  ('Everybody Loves the Sunshine', 'Roy Ayers', 'R&B & Soul', array['Cocktail','Dinner'], '70s', array['bse','harborline','tsb']),
  ('You Know I''m No Good', 'Amy Winehouse', 'R&B & Soul', array['Cocktail','Dinner'], '2000s', array['bse','harborline','tsb']),
  ('Know You Now', 'Amy Winehouse', 'R&B & Soul', array['Cocktail','Dinner'], '2000s', array['bse','harborline','tsb']),
  ('Drunk in Love', 'Beyoncé', 'R&B & Soul', array['Reception','Party'], '2010s', array['bse','harborline','tsb']),
  ('End of the Road', 'Boyz II Men', 'R&B & Soul', array['Ceremony','First Dance'], '90s', array['bse','harborline','tsb']),
  ('Spanish Joint', 'D''Angelo', 'R&B & Soul', array['Cocktail','Dinner'], '2000s', array['bse','harborline','tsb']),
  ('Feel Like Makin'' Love', 'D''Angelo', 'R&B & Soul', array['Cocktail','Dinner','First Dance'], '2000s', array['bse','harborline','tsb']),
  ('Pony', 'Ginuwine', 'R&B & Soul', array['Reception','Party'], '90s', array['bse','harborline','tsb']),
  ('Carried Away', 'H.E.R.', 'R&B & Soul', array['Cocktail','Dinner','First Dance'], '2020s', array['bse','harborline','tsb']),
  ('I Keep Forgettin''', 'Michael McDonald', 'R&B & Soul', array['Cocktail','Dinner'], '80s', array['bse','harborline','tsb']),
  ('Pretty Brown Eyes', 'Mint Condition', 'R&B & Soul', array['Cocktail','Reception','First Dance'], '90s', array['bse','harborline','tsb']),
  ('Nothing Can Come Between Us', 'Sade', 'R&B & Soul', array['Cocktail','Dinner','First Dance'], '80s', array['bse','harborline','tsb']),
  ('Kiss of Life', 'Sade', 'R&B & Soul', array['Cocktail','Dinner'], '90s', array['bse','harborline','tsb']),
  ('Can We Talk', 'Tevin Campbell', 'R&B & Soul', array['Cocktail','Reception'], '90s', array['bse','harborline','tsb']),
  ('Lose Control', 'Teddy Swims', 'R&B & Soul', array['Reception','Party'], '2020s', array['bse','harborline','tsb']),
  ('Message in a Bottle', 'The Police', 'Rock & Alternative', array['Reception','Party'], '70s', array['bse','harborline','tsb']),
  ('Roxanne', 'The Police', 'Rock & Alternative', array['Reception','Party'], '70s', array['bse','harborline','tsb']),
  ('Money for Nothing', 'Dire Straits', 'Rock & Alternative', array['Cocktail','Reception'], '80s', array['bse','harborline','tsb']),
  ('Another Brick in the Wall (Part 2)', 'Pink Floyd', 'Rock & Alternative', array['Reception','Party'], '70s', array['bse','harborline','tsb']),
  ('What a Fool Believes', 'The Doobie Brothers', 'Rock & Alternative', array['Cocktail','Dinner','Reception'], '70s', array['bse','harborline','tsb']),
  ('Give Me One Reason', 'Tracy Chapman', 'Rock & Alternative', array['Cocktail','Reception'], '90s', array['bse','harborline','tsb']),
  ('Georgy Porgy', 'Toto', 'Rock & Alternative', array['Cocktail','Dinner'], '70s', array['bse','harborline','tsb']),
  ('Home at Last', 'Steely Dan', 'Rock & Alternative', array['Cocktail','Dinner'], '70s', array['bse','harborline','tsb']),
  ('Glamour Profession', 'Steely Dan', 'Rock & Alternative', array['Cocktail','Dinner'], '80s', array['bse','harborline','tsb']),
  ('Minute by Minute', 'The Doobie Brothers', 'Rock & Alternative', array['Cocktail','Dinner'], '70s', array['bse','harborline','tsb']),
  ('Reminiscing', 'Little River Band', 'Rock & Alternative', array['Cocktail','Dinner','Reception'], '70s', array['bse','harborline','tsb']),
  ('Murder on the Dance Floor', 'Sophie Ellis-Bextor', 'Electronic & Dance', array['Reception','Party'], '2000s', array['bse','harborline','tsb']),
  ('Latch', 'Disclosure ft. Sam Smith', 'Electronic & Dance', array['Reception','Party'], '2010s', array['bse','harborline','tsb']),
  ('Everytime We Touch', 'Cascada', 'Electronic & Dance', array['Reception','Party'], '2000s', array['bse','harborline','tsb']),
  ('Move Your Feet', 'Junior Senior', 'Electronic & Dance', array['Reception','Party'], '2000s', array['bse','harborline','tsb']),
  ('Heads Will Roll (A-Trak Remix)', 'Yeah Yeah Yeahs', 'Electronic & Dance', array['Reception','Party'], '2010s', array['bse','harborline','tsb']),
  ('Remedy', 'Zedd', 'Electronic & Dance', array['Reception','Party'], '2010s', array['bse','harborline','tsb']),
  ('Middle', 'Zedd', 'Electronic & Dance', array['Reception','Party','Cocktail'], '2010s', array['bse','harborline','tsb']),
  ('Stay', 'Zedd', 'Electronic & Dance', array['Reception','Party'], '2010s', array['bse','harborline','tsb']),
  ('Could You Be Loved', 'Bob Marley', 'Reggae', array['Cocktail','Reception','Party'], '80s', array['bse','harborline','tsb']),
  ('Eyes Without a Face', 'Billy Idol', 'Rock & Alternative', array['Cocktail','Dinner'], '80s', array['bse','harborline','tsb']),
  ('I Will Survive', 'Cake', 'Rock & Alternative', array['Reception','Party'], '90s', array['bse','harborline','tsb']),
  ('Short Skirt/Long Jacket', 'Cake', 'Rock & Alternative', array['Cocktail','Reception'], '2000s', array['bse','harborline','tsb']),
  ('The Distance', 'Cake', 'Rock & Alternative', array['Reception','Party'], '90s', array['bse','harborline','tsb']),
  ('Closer', 'The Chainsmokers', 'Electronic & Dance', array['Reception','Party'], '2010s', array['bse','harborline','tsb']),
  ('Crazy', 'Gnarls Barkley', 'R&B & Soul', array['Cocktail','Reception','Party'], '2000s', array['bse','harborline','tsb']),
  ('25 or 6 to 4', 'Chicago', 'Rock & Alternative', array['Reception','Party'], '70s', array['bse','harborline','tsb']),
  ('The Night Me and Your Mama Met', 'Childish Gambino', 'R&B & Soul', array['Cocktail','Dinner'], '2010s', array['bse','harborline','tsb']),
  ('You Make My Dreams Come True', 'Daryl Hall & John Oates', 'Funk & Disco', array['Reception','Party'], '80s', array['bse','harborline','tsb']),
  ('Roadhouse Blues', 'The Doors', 'Rock & Alternative', array['Reception','Party'], '70s', array['bse','harborline','tsb']),
  ('Anyway', 'Duck Sauce', 'Electronic & Dance', array['Reception','Party'], '2010s', array['bse','harborline','tsb']),
  ('Before I Let Go', 'Frankie Beverly & Maze', 'R&B & Soul', array['Reception','Party'], '80s', array['bse','harborline','tsb']),
  ('Places to Be', 'Fred Again..', 'Electronic & Dance', array['Reception','Party'], '2020s', array['bse','harborline','tsb']),
  ('How Sweet It Is', 'James Taylor', 'R&B & Soul', array['Cocktail','Dinner','Ceremony'], '70s', array['bse','harborline','tsb']),
  ('Feelin'' Alright', 'Joe Cocker', 'Rock & Alternative', array['Cocktail','Reception'], '60s', array['bse','harborline','tsb']),
  ('D.A.N.C.E.', 'Justice', 'Electronic & Dance', array['Reception','Party'], '2000s', array['bse','harborline','tsb']),
  ('This Is It', 'Kenny Loggins', 'Pop & Top 40', array['Cocktail','Reception'], '80s', array['bse','harborline','tsb']),
  ('Stay', 'Kid LAROI & Justin Bieber', 'Pop & Top 40', array['Reception','Party'], '2020s', array['bse','harborline','tsb']),
  ('Carried Away', 'Passion Pit', 'Pop & Top 40', array['Reception','Party'], '2010s', array['bse','harborline','tsb']),
  ('Runnin'' Away', 'The Pharcyde', 'R&B & Soul', array['Cocktail','Reception'], '90s', array['bse','harborline','tsb']),
  ('Passion', 'PinkPantheress', 'Pop & Top 40', array['Cocktail','Reception'], '2020s', array['bse','harborline','tsb']),
  ('Aeroplane', 'Red Hot Chili Peppers', 'Rock & Alternative', array['Cocktail','Reception'], '90s', array['bse','harborline','tsb']),
  ('Cissy Strut', 'The Meters', 'Funk & Disco', array['Cocktail','Reception','Party'], '70s', array['bse','harborline','tsb']),
  ('Symptom of Life', 'Willow', 'R&B & Soul', array['Cocktail','Reception'], '2020s', array['bse','harborline','tsb']),
  ('Outstanding', 'The Gap Band', 'Funk & Disco', array['Reception','Party'], '80s', array['bse','harborline','tsb']),
  ('The Boys of Summer', 'Don Henley', 'Rock & Alternative', array['Cocktail','Reception'], '80s', array['bse','harborline','tsb']),
  ('Hold the Line', 'Toto', 'Rock & Alternative', array['Cocktail','Reception','Party'], '70s', array['bse','harborline','tsb']),
  ('Owner of a Lonely Heart', 'Yes', 'Rock & Alternative', array['Cocktail','Reception'], '80s', array['bse','harborline','tsb']),
  ('Rosanna', 'Toto', 'Rock & Alternative', array['Cocktail','Reception','Party'], '80s', array['bse','harborline','tsb']),
  ('Voyage to Atlantis', 'The Isley Brothers', 'R&B & Soul', array['Cocktail','Ceremony','Reception'], '70s', array['bse','harborline','tsb']),
  ('Footsteps in the Dark', 'The Isley Brothers', 'R&B & Soul', array['Cocktail','Reception'], '70s', array['bse','harborline','tsb']),
  ('Little Red Corvette', 'Prince', 'Pop & Top 40', array['Reception','Party'], '80s', array['bse','harborline','tsb']),
  ('So Easy', 'Olivia Dean', 'R&B & Soul', array['Cocktail','Dinner','First Dance'], '2020s', array['bse','harborline','tsb']),
  ('P.D.A. (We Just Don''t Care)', 'John Legend', 'R&B & Soul', array['Cocktail','Dinner','First Dance'], '2000s', array['bse','harborline','tsb']),
  ('Do I Do', 'Stevie Wonder', 'Funk & Disco', array['Reception','Party'], '80s', array['bse','harborline','tsb']),
  ('As', 'Stevie Wonder', 'R&B & Soul', array['Ceremony','First Dance','Reception'], '70s', array['bse','harborline','tsb']),
  ('Bring on the Night', 'The Police', 'Rock & Alternative', array['Cocktail','Reception'], '70s', array['bse','harborline','tsb']),
  ('When the World Is Running Down...', 'The Police', 'Rock & Alternative', array['Cocktail','Reception'], '80s', array['bse','harborline','tsb']),
  ('Murder by Numbers', 'The Police', 'Rock & Alternative', array['Cocktail','Dinner'], '80s', array['bse','harborline','tsb']),
  ('Nights on Broadway', 'Bee Gees', 'Funk & Disco', array['Reception','Party','Cocktail'], '70s', array['bse','harborline','tsb']),
  ('Shout', 'Tears for Fears', 'Pop & Top 40', array['Reception','Party'], '80s', array['bse','harborline','tsb']),
  ('In the Stone', 'Earth, Wind & Fire', 'Funk & Disco', array['Reception','Party'], '70s', array['bse','harborline','tsb'])
on conflict (lower(title), lower(artist)) do nothing;
