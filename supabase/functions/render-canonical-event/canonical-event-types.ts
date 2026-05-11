// Mirror of ingest-event/canonical-event-types.ts. Duplicated because Deno
// edge functions deploy as self-contained units. Keep in sync.

export type Shape = "A" | "B" | "C" | "D" | "W";

export type ClientField = {
  primary?: string;
  secondary?: string;
  titles?: string[];
};

export type VenueField = {
  name?: string;
  address?: string;
  type?: "indoor" | "outdoor" | "both";
};

export type ContactField = {
  phone?: string;
  email?: string;
};

export type GuestsField = {
  count?: number;
  arrival_time?: string;
  party_arrival_time?: string;
};

export type LogisticsField = {
  load_in?: string;
  soundcheck?: string;
  setup_time?: string;
  parking?: string;
  green_room?: string;
  entrance?: string;
  meals?: string;
  audio_reinforcement?: string;
};

export type PersonnelEntry = {
  role: string;
  name: string;
  phone?: string;
  email?: string;
};

export type VendorEntry = {
  company: string;
  type?: string;
  contact?: string;
  ig_handle?: string;
};

export type TimelineEntry = {
  time: string;
  description: string;
  location?: string;
  notes?: string;
  vendor?: string;
  date?: string;
};

export type SongEntry = {
  order?: string;
  request?: boolean;
  artist?: string;
  title?: string;
  notes?: string;
  key?: string;
  bpm?: string;
  singer?: string;
  patches?: string;
};

export type SongSectionField = {
  title: string;
  time?: string;
  vibe?: string;
  tempo_arc?: string;
  songs: SongEntry[];
};

export type PreferencesField = {
  must_play?: string[];
  do_not_play?: string[];
  line_dances?: Record<string, "yes" | "no" | "maybe">;
  style_notes?: string;
};

export type CanonicalEvent = {
  id: string;
  event_date: string;
  end_date?: string;
  name: string;
  organization?: string;
  event_type?: string;
  venue_name?: string;
  client: ClientField;
  venue: VenueField;
  contact: ContactField;
  guests: GuestsField;
  attire?: string;
  logistics: LogisticsField;
  personnel: PersonnelEntry[];
  vendors: VendorEntry[];
  timeline: TimelineEntry[];
  song_sections: SongSectionField[];
  preferences: PreferencesField;
  source_files: unknown[];
  extractor_version?: string;
};

export type OutputType = "X" | "X-prime" | "Z";
