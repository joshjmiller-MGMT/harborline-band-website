// Media→content people chain (Josh's routing, 2026-07-20):
// raw media → EDITORS (edit it) → edited content returns → PUBLISHER per venture.
// Publisher rule: Harborline = Des or Nick · Economy = Josh or Jon ·
// Personal + JJM = Josh only.
//
// Brain doc: wiki/harborline/media-to-content-workflow.md
// Edge-fn mirror of the slugs: supabase/functions/_shared/social-people.ts — keep in sync.

export type ChainRole = "editor" | "publisher";

export type ChainPerson = {
  /** Stable id — stored in social_content_queue.assigned_to and used in handoff URLs. */
  slug: string;
  name: string;
  role: ChainRole;
  /** What they handle (medium for editors, venture(s) for publishers). */
  scope: string;
  note?: string;
};

export const PEOPLE_CHAIN: ChainPerson[] = [
  {
    slug: "brennan",
    name: "Brennan",
    role: "editor",
    scope: "Video",
    note: "Needs explicit direction — every item handed to Brennan must carry the full editor brief.",
  },
  { slug: "gabe", name: "Gabe Hoff", role: "editor", scope: "Video" },
  { slug: "dan-mears", name: "Dan Mears' team", role: "editor", scope: "Audio" },
  { slug: "des", name: "Des", role: "publisher", scope: "Harborline" },
  { slug: "nick", name: "Nick", role: "publisher", scope: "Harborline" },
  { slug: "jon", name: "Jon", role: "publisher", scope: "Economy" },
  { slug: "josh", name: "Josh", role: "publisher", scope: "Economy · Personal · JJM" },
];

export function personBySlug(slug: string | null | undefined): ChainPerson | undefined {
  return PEOPLE_CHAIN.find((p) => p.slug === slug);
}

export const PUBLISHER_RULE =
  "Publish: Harborline → Des or Nick · Economy → Josh or Jon · Personal + JJM → Josh only.";

/** Direction template — what every item handed to an editor must spell out. */
export const EDITOR_BRIEF: string[] = [
  "Source: exact clips/paths + timestamps to pull from",
  "Deliverable: format, aspect ratio (9:16 / 1:1 / 16:9), target length",
  "Vibe: a reference post or one line on the feel",
  "Text: exact on-screen text / overlays, if any",
  "Deadline, and send finished cuts back to Josh — they get attached to the item and routed to the venture publisher",
];
