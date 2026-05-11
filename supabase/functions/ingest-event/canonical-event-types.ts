// Shared types for Sub-Plan 03 v2 parsers.
// Matches the canonical_events table jsonb shapes 1:1.

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

// What every parser returns. All fields optional — only the parser-of-the-shape
// is expected to populate the fields native to its shape; the LLM enrichment
// pass (Cut 3) fills nulls.
export type CanonicalEventFields = {
  name?: string;
  event_date?: string;
  end_date?: string;
  organization?: string;
  event_type?: string;
  venue_name?: string;

  client?: ClientField;
  venue?: VenueField;
  contact?: ContactField;
  guests?: GuestsField;
  attire?: string;
  logistics?: LogisticsField;
  personnel?: PersonnelEntry[];
  vendors?: VendorEntry[];
  timeline?: TimelineEntry[];
  song_sections?: SongSectionField[];
  preferences?: PreferencesField;
};

export type ParseResult = {
  shape: Shape;
  fields: CanonicalEventFields;
  // Parser B/C set this when the input is a blank starter template (zero client signal).
  is_blank_starter?: boolean;
  // Confidence in the shape match (0-1). The shape detector + parser both vote.
  confidence: number;
  warnings: string[];
};
