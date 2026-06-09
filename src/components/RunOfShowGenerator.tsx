import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileText, Download, Loader2, ExternalLink, AlertCircle, Music, Clock, Users, MapPin, CalendarDays, CheckCircle2, AlertTriangle, CircleCheck, Eye, Printer, Upload, ChevronDown, File, Copy, Table, Search, Hash, Sparkles, ArrowRight, X, Check, Plus, Trash2, Layers, ArrowDownLeft, ListMusic } from "lucide-react";
import { Link as RouterLink } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { operatorAuthHeader } from "@/integrations/supabase/operator-fetch";
import { toast } from "@/hooks/use-toast";
import { generateDocx, generateDocxBlob } from "@/utils/docxGenerator";
import { useGoogleDriveUpload } from "@/hooks/useGoogleDriveUpload";
import logoCircle from "@/assets/logo-harborline-doc.png";
import logoTextHarborline from "@/assets/logo-harborline-doc.png";
import logoTextBSE from "@/assets/logo-bse-dark.png";
import logoTextTSB from "@/assets/logo-tsb.webp";

// The Section-3 selector picks the ENSEMBLE / band entity, and also drives the
// document letterhead logo (the ensemble's brand). "Other" = a one-off name.
// Distinct from the doc's Organization field, which is the CLIENT's org and
// comes from the imported event.
type OrgKey = "harborline" | "bse" | "tsb" | "jmj" | "other";

const ORG_INFO: Record<OrgKey, { name: string; logoText: string }> = {
  harborline: { name: "Harborline", logoText: logoTextHarborline },
  bse: { name: "Baltimore Sound Entertainment", logoText: logoTextBSE },
  tsb: { name: "Tom Starr Band", logoText: logoTextTSB },
  jmj: { name: "JMJ", logoText: "" },
  // "Other" — user types a one-off ensemble name; no preset brand logo on the doc.
  other: { name: "Other (enter name)", logoText: "" },
};

type TemplateType = "wedding-ros" | "client-planner" | "corporate-ros" | "party-runsheet";

const TEMPLATE_INFO: Record<TemplateType, { name: string; description: string; audience: "internal" | "client" }> = {
  "wedding-ros": {
    name: "Wedding Ceremony",
    description: "Formal run of show with event details header, timeline sections, and song lists.",
    audience: "internal",
  },
  "client-planner": {
    name: "Client Planner",
    description: "Client-facing template for organizing ceremony music choices and event details.",
    audience: "client",
  },
  "corporate-ros": {
    name: "Corporate Event",
    description: "Multi-day scheduling, sound/production notes, and logistics.",
    audience: "internal",
  },
  "party-runsheet": {
    name: "Party Run Sheet",
    description: "Day-of run sheet with event details, timeline, team, songlist, and logistics.",
    audience: "internal",
  },
};

// Required fields per template type
const TEMPLATE_FIELDS: Record<TemplateType, { label: string; key: string }[]> = {
  "wedding-ros": [
    { label: "Event Name", key: "event name" },
    { label: "Event Date", key: "event date" },
    { label: "Setup Time", key: "setup time" },
    { label: "Start / End", key: "start / end" },
    { label: "Client", key: "client" },
    { label: "Event Type", key: "event type" },
    { label: "Venue", key: "venue" },
    { label: "Venue Address", key: "venue address" },
    { label: "Venue Type", key: "venue type" },
    { label: "Ensemble", key: "ensemble" },
    { label: "Musicians", key: "musicians" },
    { label: "Other Staff Members", key: "other staff members" },
    { label: "Guest Count", key: "guest count" },
    { label: "Attire", key: "attire" },
    { label: "Officiant", key: "officiant" },
    { label: "Coordinator", key: "coordinator" },
    { label: "Musician Food & Bev", key: "musician food & bev" },
    { label: "Audio Reinforcement", key: "audio reinforcement" },
    { label: "Project Lead", key: "project lead" },
    { label: "Musician POS", key: "musician pos" },
  ],
  "client-planner": [
    { label: "Event Name", key: "event name" },
    { label: "Event Date", key: "event date" },
    { label: "Event Type", key: "event type" },
    { label: "Venue", key: "venue" },
    { label: "Musicians", key: "musicians" },
    { label: "Ensemble", key: "ensemble" },
    { label: "Guest Count", key: "guest count" },
    { label: "Musician Salesperson", key: "musician salesperson" },
    { label: "Coordinator", key: "coordinator" },
  ],
  "corporate-ros": [
    { label: "Event Name", key: "event name" },
    { label: "Event Date", key: "event date" },
    { label: "Event Type", key: "event type" },
    { label: "Client", key: "client" },
    { label: "Organization", key: "organization" },
    { label: "Ensemble", key: "ensemble" },
    { label: "Venue", key: "venue" },
    { label: "Venue Address", key: "venue address" },
    { label: "Guest Count", key: "guest count" },
    { label: "Setup Time", key: "setup time" },
    { label: "Start / End", key: "start / end" },
    { label: "Load-in Time", key: "load-in time" },
    { label: "Soundcheck", key: "soundcheck" },
    { label: "Parking", key: "parking" },
    { label: "Attire", key: "attire" },
    { label: "Audio Reinforcement", key: "audio reinforcement" },
    { label: "Project Lead", key: "project lead" },
    { label: "Musician POS", key: "musician pos" },
  ],
  "party-runsheet": [
    { label: "Event Name", key: "event name" },
    { label: "Event Date", key: "event date" },
    { label: "Event Type", key: "event type" },
    { label: "Client", key: "client" },
    { label: "Venue", key: "venue" },
    { label: "Venue Address", key: "venue address" },
    { label: "Ensemble", key: "ensemble" },
    { label: "Guest Count", key: "guest count" },
    { label: "Setup Time", key: "setup time" },
    { label: "Start / End", key: "start / end" },
    { label: "Load-in Time", key: "load-in time" },
    { label: "Soundcheck", key: "soundcheck" },
    { label: "Parking", key: "parking" },
    { label: "Entrance", key: "entrance" },
    { label: "Officiant", key: "officiant" },
    { label: "Coordinator", key: "coordinator" },
    { label: "Project Lead", key: "project lead" },
    { label: "Musician POS", key: "musician pos" },
    { label: "Green Room", key: "green room" },
    { label: "Attire", key: "attire" },
    { label: "Posting", key: "posting" },
    { label: "Musician Food & Bev", key: "musician food & bev" },
    { label: "Audio Reinforcement", key: "audio reinforcement" },
  ],
};

const DETAIL_KEY_ALIASES: Record<string, string> = {
  "musicians salesperson": "musician salesperson",
  "musicians sales person": "musician salesperson",
  "musician sales person": "musician salesperson",
  salesperson: "musician salesperson",
  "sales person": "musician salesperson",
  "sales rep": "musician salesperson",
  "coordinator or on-site point of contact": "coordinator",
  "coordinator or on site point of contact": "coordinator",
  "on-site point of contact": "coordinator",
  "on site point of contact": "coordinator",
  "event coordinator": "coordinator",
  "day-of coordinator": "coordinator",
  "day of coordinator": "coordinator",
  "wedding coordinator": "coordinator",
  "band project lead": "project lead",
  "music project lead": "project lead",
  "musician project lead": "project lead",
  "on site poc": "musician pos",
  "on-site poc": "musician pos",
  onsite: "musician pos",
  "musician p o s": "musician pos",
  "musician poc": "musician pos",
  "musician point of contact": "musician pos",
  "musician on-site point of contact": "musician pos",
  "musician on site point of contact": "musician pos",
  "musician on-site poc": "musician pos",
  "musician on site poc": "musician pos",
  "musician onsite poc": "musician pos",
  "musician point person": "musician pos",
};

const normalizeDetailKey = (rawKey: string): string => {
  const cleaned = rawKey
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[.]/g, " ")
    .replace(/:$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (DETAIL_KEY_ALIASES[cleaned]) return DETAIL_KEY_ALIASES[cleaned];
  if (cleaned.includes("musician") && (cleaned.includes("salesperson") || cleaned.includes("sales person") || cleaned.includes("sales rep"))) {
    return "musician salesperson";
  }
  if (cleaned.includes("coordinator")) return "coordinator";
  if (cleaned.includes("project") && cleaned.includes("lead")) return "project lead";
  if (cleaned.includes("musician") && (cleaned.includes("pos") || cleaned.includes("poc") || cleaned.includes("point of contact") || cleaned.includes("point person"))) {
    return "musician pos";
  }

  return cleaned;
};

const normalizeDetails = (details: Record<string, string>): Record<string, string> => {
  return Object.entries(details).reduce<Record<string, string>>((acc, [key, value]) => {
    const normalizedKey = normalizeDetailKey(key);
    if (!value) return acc;
    if (!acc[normalizedKey] || value.length > acc[normalizedKey].length) {
      acc[normalizedKey] = value;
    }
    return acc;
  }, {});
};

interface SheetData {
  headers: string[];
  rows: string[][];
  sheetTitle: string;
}

interface ParsedEventData {
  eventName: string;
  details: Record<string, string>;
  personnel: { role: string; name: string }[];
  timeline: { time: string; description: string }[];
  songSections: { title: string; time: string; songs: any[] }[];
}

// P7 multi-source fusion: each ingest (URL, DJEP) becomes a Source. The
// review panel + export operate on a client-side merge of all sources
// (first-source-wins for scalars/details; dedup-merge for arrays), with
// per-field overrides letting Josh pick a later source's value when the
// default ordering loses information.
type SourceKind = "url" | "djep";

interface Source {
  id: string;
  kind: SourceKind;
  djepId?: string; // DJEP event id (kind === "djep") — identity key for dedup / load-once.
  label: string; // "Drive Sheet — Hoffman ROS", "DJEP — Smith Wedding", "CSV — payroll.csv", etc.
  sheetData: SheetData;
  parsedData: ParsedEventData | null;
}

interface MergedEvent extends ParsedEventData {
  // Maps detail-key (or "eventName") → source.id that supplied the active value.
  // Used to render provenance pills + the "use Source N value" override link.
  provenance: Record<string, string>;
}

interface DjepMatch {
  djep_id: string;
  title: string;
  event_date: string | null;
  fields: { label: string; value: string }[];
  source_url: string;
  match_score: number;
}

interface AutocorrectCorrection {
  line_index: number;
  original_label: string;
  original_value: string;
  corrected_label: string;
  corrected_value: string;
  reason: string;
}

// P7: merge N parsed sources into one event view.
// Scalars + details: first source that has a non-empty value wins, unless
//   fieldOverrides[key] points to a specific source.id. Mirrors the
//   "deterministic-parser wins, enrichment fills nulls" rule from v2's
//   ingest-event mergeFields() — the existing precedent for fusion.
// personnel/timeline/songSections: dedup-merge across sources using the
//   same identity keys v2 uses (name+role, time+desc, section title +
//   song title+artist).
function mergeSources(
  sources: Source[],
  fieldOverrides: Record<string, string>,
): MergedEvent {
  const merged: MergedEvent = {
    eventName: "",
    details: {},
    personnel: [],
    timeline: [],
    songSections: [],
    provenance: {},
  };
  if (sources.length === 0) return merged;

  const pickEventName = () => {
    const overrideId = fieldOverrides["eventName"];
    if (overrideId) {
      const s = sources.find((src) => src.id === overrideId);
      if (s?.parsedData?.eventName) {
        merged.eventName = s.parsedData.eventName;
        merged.provenance["eventName"] = s.id;
        return;
      }
    }
    for (const s of sources) {
      if (s.parsedData?.eventName) {
        merged.eventName = s.parsedData.eventName;
        merged.provenance["eventName"] = s.id;
        return;
      }
    }
  };
  pickEventName();

  const allDetailKeys = new Set<string>();
  for (const s of sources) {
    if (!s.parsedData) continue;
    for (const k of Object.keys(s.parsedData.details)) allDetailKeys.add(k);
  }
  for (const key of allDetailKeys) {
    const overrideId = fieldOverrides[key];
    if (overrideId) {
      const s = sources.find((src) => src.id === overrideId);
      const v = s?.parsedData?.details[key];
      if (v) {
        merged.details[key] = v;
        merged.provenance[key] = s.id;
        continue;
      }
    }
    for (const s of sources) {
      const v = s.parsedData?.details[key];
      if (v) {
        merged.details[key] = v;
        merged.provenance[key] = s.id;
        break;
      }
    }
  }

  const personnelKey = (p: { role: string; name: string }) =>
    `${(p.name || "").toLowerCase().trim()}|${(p.role || "").toLowerCase().trim()}`;
  const personnelSeen = new Set<string>();
  for (const s of sources) {
    for (const p of s.parsedData?.personnel || []) {
      const k = personnelKey(p);
      if (!personnelSeen.has(k)) {
        personnelSeen.add(k);
        merged.personnel.push(p);
      }
    }
  }

  const timelineKey = (t: { time: string; description: string }) =>
    `${(t.time || "").trim()}|${(t.description || "").toLowerCase().trim().slice(0, 60)}`;
  const timelineSeen = new Set<string>();
  for (const s of sources) {
    for (const t of s.parsedData?.timeline || []) {
      const k = timelineKey(t);
      if (!timelineSeen.has(k)) {
        timelineSeen.add(k);
        merged.timeline.push(t);
      }
    }
  }

  // Sections dedup by lower(title); songs within a section dedup by lower(title)+lower(artist).
  // First source to introduce a section sets its `time`. Songs from later sources append in order.
  const sectionMap = new Map<
    string,
    { title: string; time: string; songs: any[]; songKeys: Set<string> }
  >();
  for (const s of sources) {
    for (const sec of s.parsedData?.songSections || []) {
      const k = (sec.title || "").toLowerCase().trim();
      let entry = sectionMap.get(k);
      if (!entry) {
        entry = { title: sec.title, time: sec.time, songs: [], songKeys: new Set() };
        sectionMap.set(k, entry);
      }
      for (const song of sec.songs || []) {
        const songK = `${String(song.title || "").toLowerCase().trim()}|${String(song.artist || "").toLowerCase().trim()}`;
        if (!entry.songKeys.has(songK)) {
          entry.songKeys.add(songK);
          entry.songs.push(song);
        }
      }
    }
  }
  merged.songSections = Array.from(sectionMap.values()).map(({ songKeys: _drop, ...rest }) => rest);

  return merged;
}

// Which other sources also have a non-empty value for this field but lost
// the first-wins tiebreak? Used to render the "↓ use Source N value" link.
function competingSourcesForField(
  sources: Source[],
  fieldKey: string,
  winningSourceId: string | undefined,
): { source: Source; value: string }[] {
  const out: { source: Source; value: string }[] = [];
  for (const s of sources) {
    if (s.id === winningSourceId) continue;
    const v = fieldKey === "eventName"
      ? s.parsedData?.eventName
      : s.parsedData?.details?.[fieldKey];
    if (v && v.trim()) out.push({ source: s, value: v });
  }
  return out;
}

// P335: two values "agree" when their normalized (lowercased, whitespace-
// collapsed, trimmed) forms match. Anything else is a real disagreement and
// gets flagged for explicit resolution. Empty/missing on either side ≠
// conflict — that's just sparse data, handled by first-wins fall-through.
const normalizeForCompare = (v: string): string =>
  v.toLowerCase().trim().replace(/\s+/g, " ");

const valuesAgree = (a: string, b: string): boolean => {
  const na = normalizeForCompare(a);
  const nb = normalizeForCompare(b);
  if (!na || !nb) return true;
  return na === nb;
};

interface FieldConflict {
  fieldKey: string;
  fieldLabel: string;
  winningSourceId: string;
  winningValue: string;
  others: { sourceId: string; value: string }[];
}

// P335: identify the subset of template fields where ≥2 sources supplied
// genuinely different values. Fields with only one source, or where all
// sources agree after normalization, are NOT conflicts. A manual-overrides
// entry takes definitive precedence and exits the conflict set entirely.
function detectFieldConflicts(
  sources: Source[],
  mergedEvent: MergedEvent,
  fields: { label: string; key: string }[],
  manualOverrideKeys: Set<string>,
): FieldConflict[] {
  const out: FieldConflict[] = [];
  for (const f of fields) {
    if (manualOverrideKeys.has(f.key)) continue;
    const winningSourceId = mergedEvent.provenance[f.key];
    const winningValue = mergedEvent.details[f.key];
    if (!winningSourceId || !winningValue) continue;
    const competing = competingSourcesForField(sources, f.key, winningSourceId);
    const disagreeing = competing.filter((c) => !valuesAgree(winningValue, c.value));
    if (disagreeing.length === 0) continue;
    out.push({
      fieldKey: f.key,
      fieldLabel: f.label,
      winningSourceId,
      winningValue,
      others: disagreeing.map((d) => ({ sourceId: d.source.id, value: d.value })),
    });
  }
  return out;
}

const imageToBase64 = (src: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = src;
  });
};

export default function RunOfShowGenerator() {
  const [inputUrl, setInputUrl] = useState("");
  const [template, setTemplate] = useState<TemplateType>("party-runsheet");
  const [loading, setLoading] = useState(false);
  // P7: sources is the canonical multi-source state. The review panel + export
  // merge across all entries here. fieldOverrides lets Josh pick a non-first
  // source's value for a specific field when first-wins gives the wrong value.
  const [sources, setSources] = useState<Source[]>([]);
  const [fieldOverrides, setFieldOverrides] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [logosBase64, setLogosBase64] = useState<{ circle: string; text: string } | null>(null);
  const [organization, setOrganization] = useState<OrgKey>("harborline");
  const [customOrg, setCustomOrg] = useState("");
  const [manualOverrides, setManualOverrides] = useState("");
  const manualOverridesRef = useRef<HTMLTextAreaElement>(null);

  const mergedEvent: MergedEvent = useMemo(
    () => mergeSources(sources, fieldOverrides),
    [sources, fieldOverrides],
  );

  // P335: surface fields where sources disagree so Josh picks one explicitly
  // instead of trusting silent first-wins. A conflict is "resolved" when the
  // value flowing into the export came from an explicit choice — either a
  // fieldOverrides entry (resolve button) or a manual-overrides textarea
  // entry. Default first-wins without an explicit pick = still unresolved.
  const manualOverrideKeys = useMemo(() => {
    const keys = new Set<string>();
    if (!manualOverrides.trim()) return keys;
    for (const line of manualOverrides.split("\n")) {
      const colonIdx = line.indexOf(":");
      if (colonIdx <= 0) continue;
      const key = normalizeDetailKey(line.substring(0, colonIdx).trim());
      const value = line.substring(colonIdx + 1).trim();
      if (key && value) keys.add(key);
    }
    return keys;
  }, [manualOverrides]);

  const fieldConflicts = useMemo(
    () => detectFieldConflicts(sources, mergedEvent, TEMPLATE_FIELDS[template], manualOverrideKeys),
    [sources, mergedEvent, template, manualOverrideKeys],
  );

  const isFieldResolved = (fieldKey: string): boolean => {
    if (manualOverrideKeys.has(fieldKey)) return true;
    return fieldOverrides[fieldKey] !== undefined;
  };

  const unresolvedConflicts = fieldConflicts.filter((c) => !isFieldResolved(c.fieldKey));

  // Autocorrect state (P6)
  const [autocorrectLoading, setAutocorrectLoading] = useState(false);
  const [autocorrectSuggestions, setAutocorrectSuggestions] = useState<AutocorrectCorrection[] | null>(null);

  // DJEP lookup state
  const [djepMode, setDjepMode] = useState<"search" | "id">("search");
  const [djepName, setDjepName] = useState("");
  const [djepDate, setDjepDate] = useState("");
  const [djepIdInput, setDjepIdInput] = useState("");
  const [djepLoading, setDjepLoading] = useState(false);
  const [djepMatches, setDjepMatches] = useState<DjepMatch[] | null>(null);
  const [djepNote, setDjepNote] = useState<string | null>(null);

  const { uploadToDrive, uploading: driveUploading } = useGoogleDriveUpload();
  const currentLogoText = ORG_INFO[organization].logoText;

  useEffect(() => {
    Promise.all([
      imageToBase64(logoCircle),
      // "Other" org has no preset logo — skip the text-logo load.
      currentLogoText ? imageToBase64(currentLogoText) : Promise.resolve(""),
    ])
      .then(([circle, text]) => setLogosBase64({ circle, text }))
      .catch(() => console.warn("Failed to preload logos"));
  }, [currentLogoText]);

  const detectUrlType = (url: string): string => {
    if (url.includes('docs.google.com/spreadsheets')) return 'Google Sheet';
    if (url.includes('docs.google.com/document')) return 'Google Doc';
    if (url.includes('.csv')) return 'CSV';
    return 'Webpage';
  };

  const decodeBase64Utf8 = (base64: string): string => {
    const binary = window.atob(base64);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder("utf-8").decode(bytes);
  };

  // Parse manual overrides text into key-value pairs
  const parseManualOverrides = (): Record<string, string> => {
    const overrides: Record<string, string> = {};
    if (!manualOverrides.trim()) return overrides;
    const lines = manualOverrides.split("\n");
    for (const line of lines) {
      const colonIdx = line.indexOf(":");
      if (colonIdx > 0) {
        const key = normalizeDetailKey(line.substring(0, colonIdx).trim());
        const value = line.substring(colonIdx + 1).trim();
        if (key && value) {
          overrides[key] = value;
        }
      }
    }
    return overrides;
  };

  // Get merged details (multi-source merged → details + manual overrides + org defaults).
  // P7: pulls from mergedEvent.details (first-wins across N sources) rather than a
  // single parsedData. Manual-overrides textarea + org defaults still layer on top.
  const getMergedDetails = (): Record<string, string> => {
    const base = normalizeDetails(mergedEvent.details);
    const overrides = parseManualOverrides();
    const merged = { ...base, ...overrides };

    // The Step-3 selector picks the ENSEMBLE (Harborline / BSE / TSB / JMJ, or a
    // custom name via "Other"). It's authoritative for the ensemble field —
    // DJEP doesn't carry it — though an explicit manual-override line still wins.
    // (Organization is the CLIENT's org and flows in from the imported event.)
    const ensembleName = organization === 'other'
      ? (customOrg.trim() || 'Other')
      : ORG_INFO[organization].name;
    merged['ensemble'] = overrides['ensemble'] || ensembleName;

    // Apply org-specific defaults for project lead
    if (!merged['project lead'] && !merged['bandleader']) {
      if (organization === 'tsb') merged['project lead'] = 'Tom Starr';
      else if (organization === 'harborline') merged['project lead'] = 'Josh Miller';
    }
    // Default musician POS to project lead / bandleader
    if (!merged['musician pos']) {
      if (merged['project lead']) merged['musician pos'] = merged['project lead'];
      else if (merged['bandleader']) merged['musician pos'] = merged['bandleader'];
    }

    return merged;
  };

  // Get the list of fields for the current template and their status
  const getFieldStatus = () => {
    const fields = TEMPLATE_FIELDS[template] || [];
    const merged = getMergedDetails();
    return fields.map(f => ({
      ...f,
      value: merged[f.key] || "",
      found: !!merged[f.key],
    }));
  };

  const runDjepLookup = async () => {
    const payload: { name?: string; date?: string; eventId?: string } = {};
    if (djepMode === "search") {
      if (!djepName.trim() && !djepDate.trim()) {
        toast({
          title: "Add a name or date",
          description: "Type at least an event name or pick a date to search DJEP.",
          variant: "destructive",
        });
        return;
      }
      if (djepName.trim()) payload.name = djepName.trim();
      if (djepDate.trim()) payload.date = djepDate.trim();
      // edge function requires `name` when there's no eventId; if Josh only
      // typed a date, send a wildcard token so server-side validation passes.
      if (!payload.name) payload.name = "_";
    } else {
      const id = djepIdInput.replace(/\D/g, "");
      if (!id) {
        toast({
          title: "Missing Event ID",
          description: "Enter a numeric DJEP Event ID.",
          variant: "destructive",
        });
        return;
      }
      payload.eventId = id;
    }

    setDjepLoading(true);
    setDjepMatches(null);
    setDjepNote(null);
    try {
      // Use fetch directly so we can read the body on a 404 — supabase-js
      // surfaces non-2xx as FunctionsHttpError without exposing the payload's
      // `note` field (which carries the helpful cache-miss guidance). P328:
      // operatorAuthHeader() carries the signed-in operator's JWT — the anon
      // publishable key gets 403 against djep-event-lookup's requireOperator
      // gate.
      const supaUrl = import.meta.env.VITE_SUPABASE_URL;
      const auth = await operatorAuthHeader();
      const resp = await fetch(`${supaUrl}/functions/v1/djep-event-lookup`, {
        method: "POST",
        headers: {
          "Authorization": auth,
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await resp.json().catch(() => ({} as Record<string, unknown>));
      if (resp.status >= 500) {
        throw new Error(typeof data?.error === "string" ? data.error : `DJEP lookup failed (${resp.status})`);
      }
      const matches: DjepMatch[] = Array.isArray(data?.matches) ? data.matches : [];
      setDjepMatches(matches);
      if (data?.note) setDjepNote(String(data.note));
      if (matches.length === 0) {
        toast({
          title: "No DJEP matches",
          description: String(data?.note || "Try different terms or refresh the DJEP cache."),
        });
      } else if (matches.length === 1) {
        // Single match (always the case for an event-ID lookup) — load it
        // straight into sources so Josh doesn't have to click it a second time.
        // applyDjepMatch's own load-once guard makes this safe to fire-and-forget.
        void applyDjepMatch(matches[0]);
      }
    } catch (err: any) {
      toast({
        title: "DJEP lookup failed",
        description: err.message || "Could not reach DJEP cache.",
        variant: "destructive",
      });
    } finally {
      setDjepLoading(false);
    }
  };

  // Translate a DJEP cache match into the (headers, rows) shape v1's
  // generate-run-of-show already understands. Labels get a trailing colon so
  // parseSheetToEvent picks them up via its `cell.endsWith(':') && nextCell`
  // branch. We also synthesize a Client + Event Name from `match.title`
  // ("<next action> · <client>") because DJEP's events_list scrape doesn't
  // store a dedicated event-name field.
  const djepMatchToSheetData = (match: DjepMatch): SheetData => {
    const rows: string[][] = [];
    const findField = (re: RegExp) =>
      match.fields.find((f) => re.test(f.label.trim()))?.value?.trim() || "";
    // Prefer the REAL scraped Event Name / Client. match.title is only a
    // synthesized fallback — for an auto-cached / by-ID lookup it's the useless
    // stub "DJEP event <id>", which used to override the real values and show
    // up as the event name + client in the generated doc.
    const titleParts = match.title.split(" · ");
    const titleClient = titleParts.length >= 2
      ? titleParts.slice(1).join(" · ").trim()
      : match.title.trim();
    const eventName = findField(/^event\s*name$/i) || titleClient;
    const client = findField(/^client(\s*name)?$/i) || titleClient;
    if (eventName) rows.push(["Event Name:", eventName]);
    if (client) rows.push(["Client:", client]);
    for (const f of match.fields) {
      const label = f.label.trim();
      const value = (f.value || "").trim();
      if (!label || !value) continue;
      // Skip Status / Next Action / Next Action Date — those describe the
      // lead pipeline, not the run-of-show. They live in DJEP for sales ops,
      // not document generation. Event ID is kept for traceability.
      if (/^(status|next action|next action date)$/i.test(label)) continue;
      // Event Name + Client/Client Name are already emitted canonically above;
      // don't re-push them or the parser's first-wins picks the wrong one.
      if (/^(event\s*name|client(\s*name)?)$/i.test(label)) continue;
      // DJEP labels its combined window "Start / End Times"; the templates
      // expect "Start / End". Rename so it maps instead of exporting blank.
      const outLabel = /^start\s*\/\s*end\s*times$/i.test(label) ? "Start / End" : label;
      rows.push([`${outLabel}:`, value]);
    }
    return {
      headers: ["Field", "Value"],
      rows,
      sheetTitle: `DJEP — ${client || match.djep_id}`,
    };
  };

  const applyDjepMatch = async (match: DjepMatch) => {
    // Load-once guard: a DJEP event can only be added as a source one time.
    // Lookups now auto-load a single match and the match list locks added
    // events, but this is the backstop that stops a duplicate source (and a
    // duplicate generate-run-of-show call) from ever being created.
    if (sources.some((s) => s.kind === "djep" && s.djepId === match.djep_id)) {
      toast({ title: "Already loaded", description: `${match.title} is already in your sources.` });
      return;
    }
    setLoading(true);
    try {
      const synthesized = djepMatchToSheetData(match);

      const { data: genData, error: genError } = await supabase.functions.invoke(
        "generate-run-of-show",
        { body: { sheetData: synthesized, template, format: "html", logos: logosBase64, organization } },
      );
      if (genError) throw genError;
      if (genData?.error) throw new Error(genData.error);

      const newSource: Source = {
        id: `djep-${match.djep_id}-${Date.now()}`,
        kind: "djep",
        djepId: match.djep_id,
        label: synthesized.sheetTitle,
        sheetData: synthesized,
        parsedData: genData?.parsedData || null,
      };
      setSources((prev) => [...prev, newSource]);
      toast({ title: "DJEP event loaded", description: synthesized.sheetTitle });
    } catch (err: any) {
      toast({
        title: "Failed to apply DJEP match",
        description: err.message || "Something went wrong loading that event.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async () => {
    if (!inputUrl.trim()) {
      toast({ title: "Missing URL", description: "Please paste a URL to import.", variant: "destructive" });
      return;
    }
    const submittedUrl = inputUrl;

    setLoading(true);
    try {
      const isSheet = submittedUrl.includes('docs.google.com/spreadsheets');
      const sheetIdMatch = submittedUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);

      const { data, error } = await supabase.functions.invoke("fetch-google-sheet", {
        body: isSheet && sheetIdMatch
          ? { sheetId: sheetIdMatch[1], url: submittedUrl }
          : { url: submittedUrl },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const { data: genData, error: genError } = await supabase.functions.invoke("generate-run-of-show", {
        body: { sheetData: data, template, format: "html", logos: logosBase64, organization },
      });
      if (genError) throw genError;
      if (genData?.error) throw new Error(genData.error);

      const detected = data?.sourceType || detectUrlType(submittedUrl);
      const newSource: Source = {
        id: `url-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        kind: "url",
        label: data?.sheetTitle ? `${detected} — ${data.sheetTitle}` : detected,
        sheetData: data,
        parsedData: genData?.parsedData || null,
      };
      setSources((prev) => [...prev, newSource]);
      setInputUrl("");

      toast({ title: "Source added", description: `Imported from ${detected}.` });
    } catch (err: any) {
      toast({
        title: "Failed to fetch",
        description: err.message || "Make sure the link is publicly accessible.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const removeSource = (id: string) => {
    setSources((prev) => prev.filter((s) => s.id !== id));
    // Drop overrides that pointed at the removed source.
    setFieldOverrides((prev) => {
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(prev)) {
        if (v !== id) next[k] = v;
      }
      return next;
    });
  };

  const setFieldOverride = (fieldKey: string, sourceId: string | null) => {
    setFieldOverrides((prev) => {
      const next = { ...prev };
      if (sourceId === null) delete next[fieldKey];
      else next[fieldKey] = sourceId;
      return next;
    });
  };

  // P7: pack the request body for generate-run-of-show. With 1 source we keep
  // the original single-source path (so the edge function still parses + we
  // get the run_of_show row upsert side-effect that's keyed on the parsed
  // event). With 2+ sources we send preMergedEvent so the edge function
  // skips parse and renders the client-merged event directly.
  const buildExportBody = (opts: {
    sources: Source[];
    mergedEvent: MergedEvent;
    template: TemplateType;
    logos: { circle: string; text: string } | null;
    overrides: Record<string, string>;
    organization: OrgKey;
    requiredFields: { label: string; key: string }[];
  }) => {
    const baseBody = {
      template: opts.template,
      format: "html" as const,
      logos: opts.logos,
      overrides: opts.overrides,
      organization: opts.organization,
      requiredFields: opts.requiredFields,
    };
    // Ensemble comes from the Step-3 selector; DJEP doesn't carry it and it's not
    // a backend param, so inject it into the data the edge function renders.
    const ensembleVal = opts.organization === "other"
      ? (customOrg.trim() || "Other")
      : ORG_INFO[opts.organization].name;
    if (opts.sources.length <= 1) {
      const src = opts.sources[0]?.sheetData || { headers: [], rows: [], sheetTitle: "Untitled" };
      // Prepend the ensemble row so it wins the parser's first-wins. A manual
      // override (applied by the edge fn last) still takes precedence.
      const sheetData = ensembleVal
        ? { ...src, rows: [["Ensemble:", ensembleVal], ...(src.rows || [])] }
        : src;
      return { ...baseBody, sheetData };
    }
    // Strip provenance — the edge function only knows the EventData shape.
    const { provenance: _drop, ...eventData } = opts.mergedEvent;
    return {
      ...baseBody,
      // Empty sheetData satisfies any defensive validation; preMergedEvent is
      // the load-bearing field.
      sheetData: { headers: [], rows: [], sheetTitle: opts.sources.map((s) => s.label).join(" + ") },
      preMergedEvent: { ...eventData, details: { ...eventData.details, ensemble: ensembleVal || eventData.details?.ensemble } },
    };
  };

  const buildWrappedHtml = (html: string, title: string, mode: "preview" | "print") => {
    const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
    const originalStyles = styleMatch ? styleMatch[1] : "";
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/);
    const bodyContent = bodyMatch ? bodyMatch[1] : html;

    return `<!DOCTYPE html><html lang="en"><head>
      <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        ${originalStyles}
        html, body { margin: 0; padding: 0; background: #1a1a1a; min-height: 100vh; }
        .page-shell { max-width: 780px; margin: 40px auto; background: white; box-shadow: 0 4px 40px rgba(0,0,0,0.5); border-radius: 4px; overflow: hidden; padding: 0; }
        @media print { html, body { background: white; } .page-shell { margin: 0; box-shadow: none; border-radius: 0; max-width: none; } }
      </style>
      ${mode === "print" ? `<script>
        window.addEventListener("load", () => {
          const runPrint = () => {
            window.focus();
            window.print();
          };

          if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(() => setTimeout(runPrint, 150));
          } else {
            setTimeout(runPrint, 300);
          }
        });
      <\/script>` : ""}
    </head><body><div class="page-shell">${bodyContent}</div></body></html>`;
  };

  const writePreviewWindow = (previewWindow: Window, html: string) => {
    previewWindow.document.open();
    previewWindow.document.write(html);
    previewWindow.document.close();
  };

  const writeLoadingPreview = (previewWindow: Window, mode: "preview" | "print") => {
    writePreviewWindow(
      previewWindow,
      `<!DOCTYPE html><html lang="en"><head>
        <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Preparing ${mode === "print" ? "print view" : "preview"}...</title>
        <style>
          html, body { margin: 0; min-height: 100%; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #111827; color: white; }
          body { display: grid; place-items: center; padding: 24px; }
          .shell { text-align: center; max-width: 420px; }
          .spinner { width: 32px; height: 32px; margin: 0 auto 16px; border: 3px solid rgba(255,255,255,0.2); border-top-color: white; border-radius: 50%; animation: spin 0.8s linear infinite; }
          .copy { color: rgba(255,255,255,0.72); font-size: 14px; line-height: 1.5; }
          @keyframes spin { to { transform: rotate(360deg); } }
        </style>
      </head><body>
        <div class="shell">
          <div class="spinner"></div>
          <h1 style="margin: 0 0 10px; font-size: 20px; font-weight: 600;">Preparing ${mode === "print" ? "print view" : "preview"}…</h1>
          <div class="copy">This tab was opened early so Safari allows the document to load correctly.</div>
        </div>
      </body></html>`,
    );
  };

  // P335: gate every export path on resolving multi-source conflicts. The
  // Trello card phrasing — "dont allow multiple versions of the same info
  // through" — wants an affirmative pick on each disputed field. We allow
  // Josh to override with a confirm() so the rare "just ship the default"
  // case still works, but the silent path is gone.
  const confirmConflictsBeforeExport = (): boolean => {
    if (unresolvedConflicts.length === 0) return true;
    const list = unresolvedConflicts.map((c) => c.fieldLabel).join(", ");
    return window.confirm(
      `${unresolvedConflicts.length} field${unresolvedConflicts.length !== 1 ? "s have" : " has"} conflicting values across sources: ${list}.\n\nThe first-source value will be used for each unresolved field. Export anyway?`,
    );
  };

  const generateDocument = async (mode: "download" | "preview" | "print" | "docx") => {
    if (!confirmConflictsBeforeExport()) return;
    const needsPreviewWindow = mode === "preview" || mode === "print";
    const previewWindow = needsPreviewWindow ? window.open("", "_blank") : null;

    if (needsPreviewWindow && !previewWindow) {
      toast({
        title: "Popup blocked",
        description: "Safari blocked the preview tab. Please allow pop-ups for this site and try again.",
        variant: "destructive",
      });
      return;
    }

    if (previewWindow && (mode === "preview" || mode === "print")) {
      writeLoadingPreview(previewWindow, mode);
    }

    setGenerating(true);
    try {
      const overrides = parseManualOverrides();
      // P7: when 2+ sources, send the client-side merged event directly so the
      // edge function skips parsing and just renders. With 1 source, fall back
      // to the original single-source path for full backward-compat.
      const exportBody = buildExportBody({
        sources,
        mergedEvent,
        template,
        logos: logosBase64,
        overrides,
        organization,
        requiredFields: TEMPLATE_FIELDS[template].map(f => ({ label: f.label, key: f.key })),
      });

      if (mode === "docx") {
        const { data, error } = await supabase.functions.invoke("generate-run-of-show", {
          body: exportBody,
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        const eventData = data?.parsedData || (sources.length > 0 ? mergedEvent : null);
        if (!eventData) throw new Error("No parsed data available for DOCX export.");

        if (overrides && typeof overrides === "object") {
          for (const [key, value] of Object.entries(overrides)) {
            if (value.trim()) {
              eventData.details[key.toLowerCase()] = value.trim();
              if (key.toLowerCase() === "event name") eventData.eventName = value.trim();
            }
          }
        }

        await generateDocx(
          eventData,
          template,
          organization,
          TEMPLATE_FIELDS[template],
          currentLogoText,
        );
        toast({ title: "Downloaded!", description: "DOCX file saved — ready for Google Drive." });
        return;
      }

      const { data, error } = await supabase.functions.invoke("generate-run-of-show", {
        body: exportBody,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.file) throw new Error("No document was returned.");

      const html = decodeBase64Utf8(data.file);

      if (mode === "download") {
        const blob = new Blob([html], { type: "text/html;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${data.filename || "run-of-show"}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast({ title: "Downloaded!", description: "HTML file saved." });
        return;
      }

      if (!previewWindow || (mode !== "preview" && mode !== "print")) {
        throw new Error("Preview window was unavailable.");
      }

      const wrappedHtml = buildWrappedHtml(html, data.filename || "Document", mode);
      writePreviewWindow(previewWindow, wrappedHtml);
      previewWindow.focus();

      toast({ title: mode === "print" ? "Print dialog opened" : "Preview opened", description: "Opened in a new tab." });
    } catch (err: any) {
      if (previewWindow && !previewWindow.closed) {
        writePreviewWindow(
          previewWindow,
          `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Preview failed</title></head><body style="font-family: system-ui, sans-serif; padding: 24px; line-height: 1.5;"><h1 style="margin-top: 0;">Preview failed</h1><p>${(err?.message || "Something went wrong generating the document.").replace(/[<>&]/g, "")}</p></body></html>`,
        );
      }

      toast({
        title: "Generation failed",
        description: err.message || "Something went wrong generating the document.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleDriveUpload = async () => {
    if (!confirmConflictsBeforeExport()) return;
    setGenerating(true);
    try {
      const overrides = parseManualOverrides();
      const exportBody = buildExportBody({
        sources,
        mergedEvent,
        template,
        logos: logosBase64,
        overrides,
        organization,
        requiredFields: TEMPLATE_FIELDS[template].map(f => ({ label: f.label, key: f.key })),
      });

      const { data, error } = await supabase.functions.invoke("generate-run-of-show", {
        body: exportBody,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const eventData = data?.parsedData || (sources.length > 0 ? mergedEvent : null);
      if (!eventData) throw new Error("No parsed data available for DOCX export.");

      if (overrides && typeof overrides === "object") {
        for (const [key, value] of Object.entries(overrides)) {
          if (value.trim()) {
            eventData.details[key.toLowerCase()] = value.trim();
            if (key.toLowerCase() === "event name") eventData.eventName = value.trim();
          }
        }
      }

      const { blob, filename } = await generateDocxBlob(
        eventData,
        template,
        organization,
        TEMPLATE_FIELDS[template],
        currentLogoText,
      );

      uploadToDrive({ fileName: filename, fileBlob: blob });
    } catch (err: any) {
      toast({ title: "Error preparing document", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const getExportData = (): ParsedEventData | null => (sources.length > 0 ? mergedEvent : null);

  const exportAsPlainText = () => {
    if (!confirmConflictsBeforeExport()) return;
    const data = getExportData();
    if (!data) { toast({ title: "No data", description: "Import a sheet first.", variant: "destructive" }); return; }
    let text = `${data.eventName || "Run of Show"}\n${"=".repeat(40)}\n\n`;
    const details = data.details || {};
    for (const [key, value] of Object.entries(details)) { if (value) text += `${key}: ${value}\n`; }
    if (Object.keys(details).length > 0) text += "\n";
    for (const section of data.songSections || []) {
      text += `--- ${section.title} ---\n`;
      for (const song of section.songs) {
        text += `  ${song.time || ""} ${song.title}${song.artist ? ` - ${song.artist}` : ""}${song.notes ? ` (${song.notes})` : ""}\n`;
      }
      text += "\n";
    }
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${data.eventName || "run-of-show"}.txt`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    toast({ title: "Downloaded!", description: "TXT file saved." });
  };

  const exportAsCsv = () => {
    const data = getExportData();
    if (!data) { toast({ title: "No data", description: "Import a sheet first.", variant: "destructive" }); return; }
    const rows: string[][] = [["Section", "Time", "Song", "Artist", "Notes"]];
    for (const section of data.songSections || []) {
      for (const song of section.songs) {
        rows.push([section.title, song.time || "", song.title || "", song.artist || "", song.notes || ""]);
      }
    }
    const csv = rows.map(r => r.map(c => `"${(c || "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${data.eventName || "run-of-show"}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    toast({ title: "Downloaded!", description: "CSV file saved." });
  };

  const copyToClipboard = () => {
    const data = getExportData();
    if (!data) { toast({ title: "No data", description: "Import a sheet first.", variant: "destructive" }); return; }
    let text = "";
    for (const section of data.songSections || []) {
      for (const song of section.songs) { text += `• ${song.title}${song.artist ? ` - ${song.artist}` : ""}\n`; }
    }
    navigator.clipboard.writeText(text.trim()).then(() => {
      toast({ title: "Copied!", description: "Song list copied to clipboard." });
    });
  };

  const totalSongs = mergedEvent.songSections.reduce((sum, s) => sum + s.songs.length, 0);
  const fieldStatus = getFieldStatus();
  const missingFields = fieldStatus.filter(f => !f.found);
  const foundFields = fieldStatus.filter(f => f.found);
  const hasAnySource = sources.length > 0;

  const focusManualOverrides = () => {
    window.requestAnimationFrame(() => {
      const textarea = manualOverridesRef.current;
      if (!textarea) return;
      textarea.focus();
      const cursor = textarea.value.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  };

  const addManualEntry = () => {
    setManualOverrides((prev) => {
      const existingKeys = new Set(
        prev
          .split("\n")
          .map((line) => line.split(":")[0]?.trim())
          .filter(Boolean)
          .map((key) => normalizeDetailKey(key)),
      );

      const linesToAdd = missingFields
        .filter((field) => !existingKeys.has(field.key))
        .map((field) => `${field.label}: `);

      if (linesToAdd.length === 0) return prev;
      return prev.trimEnd() ? `${prev.trimEnd()}\n${linesToAdd.join("\n")}` : linesToAdd.join("\n");
    });

    focusManualOverrides();
  };

  // P6: LLM autocorrect for the manual-overrides textarea.
  // Rewrites a single line at a given index without disturbing other lines,
  // so applying one suggestion doesn't invalidate the others' line_index.
  const replaceLineAt = (text: string, idx: number, replacement: string): string => {
    const lines = text.split("\n");
    if (idx < 0 || idx >= lines.length) return text;
    lines[idx] = replacement;
    return lines.join("\n");
  };

  const runAutocorrect = async () => {
    if (!manualOverrides.trim()) {
      toast({
        title: "Nothing to clean up",
        description: "Add some manual entries first.",
      });
      return;
    }
    setAutocorrectLoading(true);
    setAutocorrectSuggestions(null);
    try {
      const { data, error } = await supabase.functions.invoke("manual-overrides-autocorrect", {
        body: {
          overrides: manualOverrides,
          template_fields: TEMPLATE_FIELDS[template],
          template_label: template,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const corrections: AutocorrectCorrection[] = Array.isArray(data?.corrections) ? data.corrections : [];
      if (corrections.length === 0) {
        toast({
          title: "Looks clean",
          description: "No fixes suggested for your manual entries.",
        });
        setAutocorrectSuggestions(null);
        return;
      }
      setAutocorrectSuggestions(corrections);
    } catch (err: any) {
      console.error("autocorrect failed", err);
      toast({
        title: "Autocorrect failed",
        description: err?.message || "Could not reach the autocorrect service.",
        variant: "destructive",
      });
    } finally {
      setAutocorrectLoading(false);
    }
  };

  const applyCorrection = (correction: AutocorrectCorrection) => {
    const replacement = `${correction.corrected_label}: ${correction.corrected_value}`;
    setManualOverrides((prev) => replaceLineAt(prev, correction.line_index, replacement));
    setAutocorrectSuggestions((prev) => {
      if (!prev) return prev;
      const next = prev.filter((c) => c.line_index !== correction.line_index);
      return next.length === 0 ? null : next;
    });
  };

  const applyAllCorrections = () => {
    if (!autocorrectSuggestions || autocorrectSuggestions.length === 0) return;
    setManualOverrides((prev) => {
      let next = prev;
      for (const c of autocorrectSuggestions) {
        next = replaceLineAt(next, c.line_index, `${c.corrected_label}: ${c.corrected_value}`);
      }
      return next;
    });
    setAutocorrectSuggestions(null);
  };

  const dismissCorrection = (lineIndex: number) => {
    setAutocorrectSuggestions((prev) => {
      if (!prev) return prev;
      const next = prev.filter((c) => c.line_index !== lineIndex);
      return next.length === 0 ? null : next;
    });
  };

  const dismissAllCorrections = () => setAutocorrectSuggestions(null);

  return (
    <div className="container mx-auto px-6 py-10 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-4xl font-display tracking-display text-foreground mb-2">
          Doc Generator
        </h1>
        <p className="text-muted-foreground">
          Import event data and export branded documents — internal run sheets or client-facing planners.
        </p>
      </div>

      {/* Step 1: Import Data */}
      <Card className="mb-6 bg-card border-border">
        <CardHeader>
          <CardTitle className="text-xl font-display tracking-wide-custom flex items-center gap-2">
            <span className="text-primary">1.</span> Import Data
          </CardTitle>
          <CardDescription>
            Paste a URL to import — Google Sheets, Google Docs, CSV files, or any public webpage.
            {hasAnySource && " Add more sources to merge fields across them — first source wins on conflicts; you can override per field below."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              placeholder={hasAnySource ? "Add another source URL…" : "https://docs.google.com/spreadsheets/d/... or any URL"}
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              className="flex-1 bg-secondary/50 border-border"
            />
            <Button onClick={fetchData} disabled={loading || !inputUrl}>
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : hasAnySource ? (
                <Plus className="w-4 h-4" />
              ) : (
                <ExternalLink className="w-4 h-4" />
              )}
              {loading ? "Fetching..." : hasAnySource ? "Add source" : "Fetch"}
            </Button>
          </div>
          {inputUrl && !loading && !hasAnySource && (
            <p className="text-xs text-muted-foreground mt-2">
              Detected: {detectUrlType(inputUrl)}
            </p>
          )}

          {hasAnySource && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Layers className="w-3.5 h-3.5" />
                <span>
                  {sources.length} source{sources.length !== 1 ? "s" : ""} — fields merged below (first source wins on conflicts)
                </span>
              </div>
              {sources.map((src, idx) => {
                const detailCount = src.parsedData ? Object.keys(src.parsedData.details).length : 0;
                const personnelCount = src.parsedData?.personnel.length || 0;
                const timelineCount = src.parsedData?.timeline.length || 0;
                const songCount = (src.parsedData?.songSections || []).reduce((sum, s) => sum + s.songs.length, 0);
                return (
                  <div
                    key={src.id}
                    className="p-3 rounded-lg bg-secondary/30 border border-border flex items-start gap-3"
                  >
                    <div className="text-[10px] font-semibold uppercase tracking-wide bg-primary/15 text-primary px-1.5 py-0.5 rounded shrink-0 mt-0.5">
                      Source {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm">
                        {src.kind === "djep" ? (
                          <Hash className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        ) : (
                          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        )}
                        <span className="text-foreground font-medium truncate">{src.label}</span>
                      </div>
                      {src.parsedData && (
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px] text-muted-foreground">
                          {detailCount > 0 && <span>{detailCount} fields</span>}
                          {personnelCount > 0 && (
                            <span className="flex items-center gap-0.5">
                              <Users className="w-3 h-3" /> {personnelCount}
                            </span>
                          )}
                          {timelineCount > 0 && (
                            <span className="flex items-center gap-0.5">
                              <Clock className="w-3 h-3" /> {timelineCount}
                            </span>
                          )}
                          {songCount > 0 && (
                            <span className="flex items-center gap-0.5">
                              <Music className="w-3 h-3" /> {songCount}
                            </span>
                          )}
                          {src.parsedData.eventName && (
                            <span className="truncate">"{src.parsedData.eventName}"</span>
                          )}
                        </div>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      aria-label={`Remove source ${idx + 1}`}
                      onClick={() => removeSource(src.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Optional: Import from DJEP (alternative to Step 1) */}
      <Card className="mb-6 bg-card border-border">
        <CardHeader>
          <CardTitle className="text-xl font-display tracking-wide-custom flex items-center gap-2">
            <span className="text-muted-foreground">or</span> Import from DJEP
          </CardTitle>
          <CardDescription>
            Pull an event from the DJEP events cache by name + date, or by Event ID. Covers all BSE salespeople (Brandon / Jeff / Miller / Rachel / Stan / Alex / Tom / Eric / Chelsea / Master Admin).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-3">
            <Button
              type="button"
              variant={djepMode === "search" ? "default" : "outline"}
              size="sm"
              onClick={() => { setDjepMode("search"); setDjepMatches(null); setDjepNote(null); }}
            >
              <Search className="w-3.5 h-3.5 mr-1.5" /> Search
            </Button>
            <Button
              type="button"
              variant={djepMode === "id" ? "default" : "outline"}
              size="sm"
              onClick={() => { setDjepMode("id"); setDjepMatches(null); setDjepNote(null); }}
            >
              <Hash className="w-3.5 h-3.5 mr-1.5" /> Event ID
            </Button>
          </div>

          {djepMode === "search" ? (
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="Event or client name (e.g. Hoffman)"
                value={djepName}
                onChange={(e) => setDjepName(e.target.value)}
                className="flex-1 bg-secondary/50 border-border"
              />
              <Input
                type="date"
                value={djepDate}
                onChange={(e) => setDjepDate(e.target.value)}
                className="sm:w-44 bg-secondary/50 border-border"
              />
              <Button onClick={runDjepLookup} disabled={djepLoading}>
                {djepLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {djepLoading ? "Searching..." : "Search DJEP"}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="DJEP Event ID (digits only, e.g. 420812)"
                value={djepIdInput}
                onChange={(e) => setDjepIdInput(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                pattern="\d+"
                className="flex-1 bg-secondary/50 border-border"
              />
              <Button onClick={runDjepLookup} disabled={djepLoading}>
                {djepLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Hash className="w-4 h-4" />}
                {djepLoading ? "Fetching..." : "Fetch"}
              </Button>
            </div>
          )}

          {djepNote && (
            <p className="text-xs text-amber-500 mt-2 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {djepNote}
            </p>
          )}

          {djepMatches && djepMatches.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs text-muted-foreground">
                {djepMatches.length} match{djepMatches.length !== 1 ? "es" : ""}
                {djepMatches.length === 1 ? " — loaded automatically" : " — click to load"}
              </p>
              {djepMatches.map((m) => {
                const eventDateField = m.fields.find((f) => f.label.toLowerCase() === "event date");
                const venueField = m.fields.find((f) => f.label.toLowerCase() === "venue");
                const eventNameField = m.fields.find((f) => f.label.toLowerCase() === "event name");
                // Prefer the real scraped event name over the backend stub title
                // ("DJEP event <id>") so the tile reads e.g. "Robinette Wedding".
                const displayTitle = eventNameField?.value?.trim() || m.title;
                const alreadyAdded = sources.some((s) => s.kind === "djep" && s.djepId === m.djep_id);
                return (
                  <button
                    key={m.djep_id}
                    onClick={() => applyDjepMatch(m)}
                    disabled={loading || alreadyAdded}
                    className={`w-full text-left p-3 rounded-lg border transition-colors disabled:cursor-not-allowed ${
                      alreadyAdded
                        ? "border-primary/40 bg-primary/5"
                        : "border-border bg-secondary/30 hover:bg-secondary/60 hover:border-muted-foreground/40 disabled:opacity-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm text-foreground font-medium truncate">{displayTitle}</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                          {eventDateField && <span>Event: {eventDateField.value}</span>}
                          {venueField && <span>Venue: {venueField.value}</span>}
                          <span className="opacity-70">{m.djep_id}</span>
                        </div>
                      </div>
                      {alreadyAdded ? (
                        <span className="text-[10px] uppercase font-semibold text-primary shrink-0 flex items-center gap-1">
                          <Check className="w-3 h-3" /> Loaded
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase font-semibold text-muted-foreground shrink-0">
                          {Math.round(m.match_score * 100)}%
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Choose Template */}
      <Card className="mb-6 bg-card border-border">
        <CardHeader>
          <CardTitle className="text-xl font-display tracking-wide-custom flex items-center gap-2">
            <span className="text-primary">2.</span> Choose Template
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {(Object.entries(TEMPLATE_INFO) as [TemplateType, { name: string; description: string; audience: "internal" | "client" }][]).map(([key, info]) => (
              <button
                key={key}
                onClick={() => setTemplate(key)}
                className={`text-left p-4 rounded-lg border-2 transition-all ${
                  template === key
                    ? "border-primary bg-primary/10"
                    : "border-border bg-secondary/20 hover:border-muted-foreground/30"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <p className={`font-medium text-sm ${template === key ? "text-primary" : "text-foreground"}`}>
                    {info.name}
                  </p>
                  <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                    info.audience === "client"
                      ? "bg-accent/20 text-accent-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {info.audience === "client" ? "Client-Facing" : "Internal"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{info.description}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Step 3: Ensemble (band entity — also drives the letterhead) */}
      <Card className="mb-6 bg-card border-border">
        <CardHeader>
          <CardTitle className="text-xl font-display tracking-wide-custom flex items-center gap-2">
            <span className="text-primary">3.</span> Ensemble
          </CardTitle>
          <CardDescription>
            The performing ensemble — fills the Ensemble field and sets the document letterhead. Pick "Other" to enter a one-off name. (The client's organization comes from the imported event.)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={organization} onValueChange={(v) => setOrganization(v as OrgKey)}>
            <SelectTrigger className="w-full bg-secondary/50 border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(ORG_INFO) as [OrgKey, { name: string }][]).map(([key, info]) => (
                <SelectItem key={key} value={key}>{info.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {organization === "other" && (
            <Input
              className="mt-3 bg-secondary/50 border-border"
              placeholder="Ensemble name (appears on the document)"
              value={customOrg}
              onChange={(e) => setCustomOrg(e.target.value)}
            />
          )}
        </CardContent>
      </Card>

      {/* Step 4: Review */}
      <Card className="mb-6 bg-card border-border">
        <CardHeader>
          <CardTitle className="text-xl font-display tracking-wide-custom flex items-center gap-2">
            <span className="text-primary">4.</span> Review Fields
          </CardTitle>
          <CardDescription>
            Check which fields were found in the imported data. Missing fields will export as blanks unless you add them with Manual entry below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* P335: conflict banner — surfaces fields where sources disagree
              so Josh picks one before silent first-wins ships the wrong
              value. Resolution writes to fieldOverrides (or manual entry). */}
          {fieldConflicts.length > 0 && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                <div className="text-sm font-medium text-destructive">
                  {unresolvedConflicts.length > 0
                    ? `${unresolvedConflicts.length} of ${fieldConflicts.length} conflict${fieldConflicts.length !== 1 ? "s" : ""} need resolving`
                    : `${fieldConflicts.length} conflict${fieldConflicts.length !== 1 ? "s" : ""} — all resolved`}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Sources disagree on these fields. Pick one value per field — the chosen value is what flows into the exported doc. Other values are discarded.
              </p>
              <ul className="space-y-2">
                {fieldConflicts.map((conflict) => {
                  const resolved = isFieldResolved(conflict.fieldKey);
                  const isManualResolved = manualOverrideKeys.has(conflict.fieldKey);
                  const choices = [
                    { sourceId: conflict.winningSourceId, value: conflict.winningValue },
                    ...conflict.others,
                  ];
                  const activeOverride = fieldOverrides[conflict.fieldKey];
                  return (
                    <li
                      key={conflict.fieldKey}
                      className="rounded-md bg-card border border-border p-2.5"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-xs font-semibold text-foreground">{conflict.fieldLabel}</span>
                        {resolved ? (
                          <span className="text-[10px] uppercase tracking-wide text-primary inline-flex items-center gap-0.5">
                            <Check className="w-3 h-3" /> Resolved
                          </span>
                        ) : (
                          <span className="text-[10px] uppercase tracking-wide text-destructive font-semibold">
                            Pick one
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {choices.map((choice) => {
                          const idx = sources.findIndex((s) => s.id === choice.sourceId);
                          const isPicked = !isManualResolved && activeOverride === choice.sourceId;
                          return (
                            <button
                              key={choice.sourceId}
                              type="button"
                              onClick={() => setFieldOverride(conflict.fieldKey, choice.sourceId)}
                              disabled={isManualResolved}
                              className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded text-left text-xs transition-colors ${
                                isPicked
                                  ? "bg-primary/20 border border-primary/60 text-foreground"
                                  : "bg-secondary/40 border border-border hover:bg-secondary/70 disabled:opacity-50 disabled:cursor-not-allowed"
                              }`}
                            >
                              <span className="flex items-center gap-1.5 min-w-0">
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground shrink-0">
                                  Source {idx + 1}
                                </span>
                                <span className="font-mono truncate text-foreground">{choice.value}</span>
                              </span>
                              {isPicked && <Check className="w-3 h-3 text-primary shrink-0" />}
                            </button>
                          );
                        })}
                        {isManualResolved ? (
                          <p className="text-[10px] text-muted-foreground pl-1">
                            Manual entry below overrides all source values.
                          </p>
                        ) : (
                          <p className="text-[10px] text-muted-foreground pl-1">
                            Or type a custom value in the manual-overrides textarea below.
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Field status report */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {fieldStatus.map((field) => {
              const manualOverrideMap = parseManualOverrides();
              const isManual = !!manualOverrideMap[field.key];
              const winningSourceId = !isManual ? mergedEvent.provenance[field.key] : undefined;
              const winningSourceIdx = winningSourceId
                ? sources.findIndex((s) => s.id === winningSourceId)
                : -1;
              const competing = !isManual && hasAnySource
                ? competingSourcesForField(sources, field.key, winningSourceId)
                : [];
              const showProvenance = sources.length >= 2 && (isManual || winningSourceId);
              const isOverridden = !!fieldOverrides[field.key];
              const fieldConflict = fieldConflicts.find((c) => c.fieldKey === field.key);
              const hasUnresolvedConflict = !!fieldConflict && !isFieldResolved(field.key);

              return (
                <div
                  key={field.key}
                  className={`flex flex-col gap-1 text-sm px-3 py-2 rounded-md ${
                    !field.found
                      ? "bg-destructive/5 text-muted-foreground"
                      : hasUnresolvedConflict
                        ? "bg-destructive/10 text-foreground border border-destructive/40"
                        : "bg-primary/5 text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {!field.found ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
                    ) : hasUnresolvedConflict ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
                    ) : (
                      <CircleCheck className="w-3.5 h-3.5 text-primary shrink-0" />
                    )}
                    <span className="font-medium text-xs">{field.label}</span>
                    {hasUnresolvedConflict && (
                      <span className="text-[10px] uppercase tracking-wide text-destructive font-semibold ml-1">
                        Conflict
                      </span>
                    )}
                    {field.found && (
                      <span className="text-xs text-muted-foreground truncate ml-auto max-w-[140px]">
                        {field.value}
                      </span>
                    )}
                  </div>
                  {showProvenance && (
                    <div className="flex flex-wrap items-center gap-1.5 pl-5.5 text-[10px]">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-secondary/60 text-muted-foreground uppercase tracking-wide">
                        {isManual
                          ? "manual"
                          : isOverridden
                            ? `Source ${winningSourceIdx + 1} (override)`
                            : `Source ${winningSourceIdx + 1}`}
                      </span>
                      {!isManual && isOverridden && (
                        <button
                          type="button"
                          className="text-[10px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                          onClick={() => setFieldOverride(field.key, null)}
                          aria-label={`Reset ${field.label} to first-source-wins`}
                        >
                          reset
                        </button>
                      )}
                      {!isManual && competing.map(({ source: cs, value: cv }) => {
                        const csIdx = sources.findIndex((s) => s.id === cs.id);
                        return (
                          <button
                            key={cs.id}
                            type="button"
                            className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-secondary/30 text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                            onClick={() => setFieldOverride(field.key, cs.id)}
                            title={`Use Source ${csIdx + 1}: "${cv}"`}
                          >
                            <ArrowDownLeft className="w-2.5 h-2.5" />
                            Source {csIdx + 1}: <span className="font-mono truncate max-w-[100px]">{cv}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Summary */}
          <div className="flex flex-col gap-3 pt-2 border-t border-border/50 sm:flex-row sm:items-center sm:justify-between">
            {missingFields.length === 0 ? (
              <span className="text-primary flex items-center gap-1 text-xs">
                <CircleCheck className="w-3.5 h-3.5" />
                All {fieldStatus.length} fields populated
              </span>
            ) : (
              <span className="text-destructive flex items-center gap-1 text-xs">
                <AlertTriangle className="w-3.5 h-3.5" />
                {missingFields.length} of {fieldStatus.length} fields missing — will appear as blank lines
              </span>
            )}

            {missingFields.length > 0 && (
              <Button type="button" variant="outline" size="sm" onClick={addManualEntry}>
                Manual entry
              </Button>
            )}
          </div>

          {/* Manual overrides */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-foreground">
                Add or override fields manually
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={runAutocorrect}
                disabled={autocorrectLoading || !manualOverrides.trim()}
              >
                {autocorrectLoading ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                )}
                Clean up entries
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              Enter one field per line as <code className="bg-secondary/50 px-1 py-0.5 rounded text-[11px]">Label: Value</code>.
              {missingFields.length > 0 && (
                <> Missing: {missingFields.map(f => f.label).join(", ")}</>
              )}
            </p>
            <Textarea
              ref={manualOverridesRef}
              placeholder={`Event Name: Smith Wedding\nVenue: Baltimore Country Club\nEvent Date: April 24, 2026\nClient: John Smith`}
              value={manualOverrides}
              onChange={(e) => {
                setManualOverrides(e.target.value);
                // Pending corrections reference line indices that may shift on edit.
                if (autocorrectSuggestions) setAutocorrectSuggestions(null);
              }}
              className="bg-secondary/50 border-border font-mono text-sm min-h-[100px]"
            />

            {autocorrectSuggestions && autocorrectSuggestions.length > 0 && (
              <div className="mt-3 border border-border rounded-md bg-secondary/30">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                  <div className="flex items-center gap-2 text-sm">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    <span className="font-medium">
                      {autocorrectSuggestions.length} suggested {autocorrectSuggestions.length === 1 ? "fix" : "fixes"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={dismissAllCorrections}>
                      Dismiss all
                    </Button>
                    <Button type="button" variant="default" size="sm" onClick={applyAllCorrections}>
                      <Check className="w-3.5 h-3.5 mr-1.5" />
                      Apply all
                    </Button>
                  </div>
                </div>
                <ul className="divide-y divide-border">
                  {autocorrectSuggestions.map((c) => (
                    <li key={c.line_index} className="px-3 py-2 flex items-center gap-3">
                      <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-x-3 gap-y-1 font-mono text-xs">
                        <span className="text-muted-foreground line-through truncate">
                          {c.original_label}: {c.original_value}
                        </span>
                        <ArrowRight className="hidden sm:block w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-foreground truncate">
                          {c.corrected_label}: {c.corrected_value}
                        </span>
                      </div>
                      <span className="hidden md:inline text-[10px] uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                        {c.reason}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          aria-label="Dismiss this suggestion"
                          onClick={() => dismissCorrection(c.line_index)}
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          aria-label="Apply this suggestion"
                          onClick={() => applyCorrection(c)}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Step 5: Export */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-xl font-display tracking-wide-custom flex items-center gap-2">
            <span className="text-primary">5.</span> Export Document
          </CardTitle>
          {missingFields.length > 0 && !hasAnySource && (
            <CardDescription className="flex items-center gap-1 text-xs">
              <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground" />
              No data imported — document will have blank fields. You can still export.
            </CardDescription>
          )}
          {unresolvedConflicts.length > 0 && (
            <CardDescription className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              {unresolvedConflicts.length} unresolved conflict{unresolvedConflicts.length !== 1 ? "s" : ""} ({unresolvedConflicts.map((c) => c.fieldLabel).join(", ")}). Resolve above or you'll be asked to confirm before export.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="hero" size="sm">
                  {(generating || driveUploading) ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                  Export
                  <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-52">
                <DropdownMenuItem onClick={() => generateDocument("preview")}>
                  <Eye className="w-4 h-4 mr-2" />
                  Preview
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => generateDocument("print")}>
                  <Printer className="w-4 h-4 mr-2" />
                  Print / Save as PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => generateDocument("docx")}>
                  <File className="w-4 h-4 mr-2" />
                  Download DOCX
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => generateDocument("download")}>
                  <FileText className="w-4 h-4 mr-2" />
                  Download HTML
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportAsPlainText}>
                  <FileText className="w-4 h-4 mr-2" />
                  Download TXT
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportAsCsv}>
                  <Table className="w-4 h-4 mr-2" />
                  Download CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={copyToClipboard}>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy to Clipboard
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDriveUpload}>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload to Google Drive
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {mergedEvent.songSections.some((s) => (s.songs?.length ?? 0) > 0) && (
              <RouterLink
                to="/team/setlist-builder"
                state={{
                  eventName: mergedEvent.eventName,
                  eventDate: (mergedEvent.details["event date"] || "").slice(0, 10),
                  venue: mergedEvent.details["venue"] || "",
                  rawInput: mergedEvent.songSections
                    .flatMap((s) => (s.songs || []).map((song: any) => song?.title).filter(Boolean))
                    .join("\n"),
                }}
                className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline inline-flex items-center gap-1.5"
              >
                <ListMusic className="w-3.5 h-3.5" />
                Also build a setlist folder with these songs →
              </RouterLink>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
