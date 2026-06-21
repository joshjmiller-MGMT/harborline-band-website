// Shared song types + filter constants. Single source of truth for the public
// /songs page and the team setlist builder. (Previously inlined in SongList.tsx.)

export type Song = {
  id?: string;
  title: string;
  artist: string;
  genre: string;
  functions: string[];
  decade: string | null;
  org_tags?: string[];
};

export const genres = [
  "All",
  "Funk & Disco",
  "Pop & Top 40",
  "R&B & Soul",
  "Rock & Alternative",
  "Electronic & Dance",
  "Reggae",
];

export const functions = [
  "All",
  "Cocktail",
  "Ceremony",
  "Reception",
  "Party",
  "Dinner",
  "First Dance",
  "Holiday",
];

export const decades = [
  "All",
  "70s",
  "80s",
  "90s",
  "2000s",
  "2010s",
  "2020s",
];

// Organizations the setlist builder can scope a setlist to. Matches the org_tags
// stored on each song and the org check on the setlists table.
export type SetlistOrg = "bse" | "harborline" | "tsb";

export const ORG_OPTIONS: { key: SetlistOrg; label: string }[] = [
  { key: "harborline", label: "Harborline" },
  { key: "bse", label: "BSE" },
  { key: "tsb", label: "TSB" },
];

export const orgLabel = (org: SetlistOrg) =>
  ORG_OPTIONS.find((o) => o.key === org)?.label ?? org;

// Stable identity for a song when no DB id is available (public page can run
// against either source). Title+artist is unique per the DB constraint.
export const songKey = (s: Pick<Song, "id" | "title" | "artist">) =>
  s.id ?? `${s.title}-${s.artist}`;
