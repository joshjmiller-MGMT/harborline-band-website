// P337 — Scrub macOS Notes.app against the Trello to-do board.
// Surfaces notes whose title (or short body) doesn't appear to be tracked on
// any Trello card on Josh's board. Output is a dated markdown report under
// claude-code-plans/.
//
// Local-only — needs Notes.app's on-disk SQLite, so this is a Deno script
// (not an edge function). Run from anywhere via:
//
//   deno run --allow-read --allow-env --allow-net \
//     scripts/scrub-notes-vs-trello.ts
//
// Trello creds: TRELLO_API_KEY + TRELLO_API_TOKEN required in env (or a
// .env.local file colocated with this script). TRELLO_BOARD_ID is optional —
// the script falls back to a name-match on /to[ -_]?do$/i across boards
// visible to the token, same heuristic as supabase/functions/_shared/trello-client.ts.

const NOTES_DB =
  `${Deno.env.get("HOME")}/Library/Group Containers/group.com.apple.notes/NoteStore.sqlite`;
const SCRIPT_DIR = decodeURIComponent(new URL(".", import.meta.url).pathname);
const REPO_ROOT = decodeURIComponent(new URL("../", import.meta.url).pathname);
const REPORT_DIR =
  `${Deno.env.get("HOME")}/Documents/Claude/Projects/Harborline Website/claude-code-plans`;

// ---------------------------------------------------------------------------
// Env loading (.env.local optional)
// ---------------------------------------------------------------------------

async function loadDotEnvLocal(): Promise<void> {
  const path = `${SCRIPT_DIR}.env.local`;
  try {
    const raw = await Deno.readTextFile(path);
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+?)\s*$/);
      if (!m) continue;
      const [, k, vRaw] = m;
      const v = vRaw.replace(/^["']|["']$/g, "");
      if (!Deno.env.get(k)) Deno.env.set(k, v);
    }
  } catch {
    // file optional — ignore not-found / permission errors
  }
}

// ---------------------------------------------------------------------------
// Notes.app extraction (read-only sqlite3 shell-out, no native driver needed)
// ---------------------------------------------------------------------------

type Note = {
  id: number;
  title: string;
  snippet: string;
  folder: string;
  modified: string;
  identifier: string;
};

async function readNotes(): Promise<Note[]> {
  // Tab-separated for unambiguous parsing — note titles can contain pipes.
  const sql = `SELECT
      n.Z_PK,
      COALESCE(n.ZTITLE1, ''),
      COALESCE(n.ZSNIPPET, ''),
      COALESCE(f.ZTITLE2, ''),
      COALESCE(strftime('%Y-%m-%d', datetime(n.ZMODIFICATIONDATE1 + 978307200, 'unixepoch')), ''),
      COALESCE(n.ZIDENTIFIER, '')
    FROM ZICCLOUDSYNCINGOBJECT n
    LEFT JOIN ZICCLOUDSYNCINGOBJECT f ON n.ZFOLDER = f.Z_PK
    WHERE n.ZTITLE1 IS NOT NULL
      AND (n.ZMARKEDFORDELETION IS NULL OR n.ZMARKEDFORDELETION = 0)
      AND COALESCE(f.ZTITLE2, '') != 'Recently Deleted'
    ORDER BY n.ZMODIFICATIONDATE1 DESC;`;
  const cmd = new Deno.Command("sqlite3", {
    args: ["-separator", "\t", "-noheader", NOTES_DB, sql],
    stdout: "piped",
    stderr: "piped",
  });
  const { code, stdout, stderr } = await cmd.output();
  if (code !== 0) {
    const msg = new TextDecoder().decode(stderr);
    throw new Error(`sqlite3 failed (exit ${code}): ${msg}`);
  }
  const lines = new TextDecoder().decode(stdout).split("\n").filter((l) => l.length > 0);
  const notes: Note[] = [];
  for (const line of lines) {
    const parts = line.split("\t");
    if (parts.length < 6) continue;
    notes.push({
      id: parseInt(parts[0], 10),
      title: parts[1],
      snippet: parts[2],
      folder: parts[3],
      modified: parts[4],
      identifier: parts[5],
    });
  }
  return notes;
}

// ---------------------------------------------------------------------------
// Trello fetch — mirrors _shared/trello-client.ts board resolution
// ---------------------------------------------------------------------------

type TrelloBoard = { id: string; name: string };
type TrelloList = { id: string; name: string };
type TrelloCardRaw = {
  id: string;
  name: string;
  desc: string;
  idList: string;
  shortUrl: string;
  url: string;
  labels: { id: string; name: string; color: string | null }[];
  closed?: boolean;
  dateLastActivity?: string;
};
type TrelloCard = TrelloCardRaw & { listName: string };

const BOARD_NAME_MATCH = /to[\s\-_]?do$/i;

function trelloAuth(): string {
  const k = Deno.env.get("TRELLO_API_KEY");
  const t = Deno.env.get("TRELLO_API_TOKEN");
  if (!k || !t) {
    throw new Error(
      "TRELLO_API_KEY and TRELLO_API_TOKEN required. Set in env or .env.local next to this script.",
    );
  }
  return `key=${encodeURIComponent(k)}&token=${encodeURIComponent(t)}`;
}

async function trelloGet<T>(path: string, query = ""): Promise<T> {
  const sep = query ? "&" : "";
  const url = `https://api.trello.com/1${path}?${trelloAuth()}${sep}${query}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`Trello ${path} → ${res.status} ${await res.text().catch(() => "")}`);
  }
  return res.json() as Promise<T>;
}

async function resolveBoard(): Promise<TrelloBoard> {
  const pinned = Deno.env.get("TRELLO_BOARD_ID");
  const boards = await trelloGet<TrelloBoard[]>(
    "/members/me/boards",
    "filter=open&fields=id,name",
  );
  if (pinned) {
    const found = boards.find((b) => b.id === pinned);
    if (found) return found;
    throw new Error(
      `TRELLO_BOARD_ID=${pinned} not visible to token. Visible: ${boards.map((b) => b.name).join(", ")}`,
    );
  }
  const matches = boards.filter((b) => BOARD_NAME_MATCH.test(b.name.trim()));
  if (matches.length === 1) return matches[0];
  if (matches.length === 0) {
    throw new Error(`No board matched /to[ -_]?do$/i. Visible: ${boards.map((b) => b.name).join(", ")}`);
  }
  throw new Error(
    `Multiple boards matched: ${matches.map((b) => `${b.name} (${b.id})`).join(", ")}. Set TRELLO_BOARD_ID.`,
  );
}

async function readBoardCards(boardId: string): Promise<TrelloCard[]> {
  const [cards, lists] = await Promise.all([
    trelloGet<TrelloCardRaw[]>(
      `/boards/${boardId}/cards`,
      "filter=open&fields=id,name,desc,idList,shortUrl,url,labels,dateLastActivity",
    ),
    trelloGet<TrelloList[]>(`/boards/${boardId}/lists`, "filter=open&fields=id,name"),
  ]);
  const listById = new Map(lists.map((l) => [l.id, l.name]));
  return cards.map((c) => ({ ...c, listName: listById.get(c.idList) ?? "(unknown list)" }));
}

// ---------------------------------------------------------------------------
// Fuzzy match — normalize + token-set Jaccard + substring fallback
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "he",
  "in", "is", "it", "its", "of", "on", "that", "the", "to", "was", "were",
  "will", "with", "or", "but", "if", "this", "these", "those", "i", "me", "my",
  "we", "our", "you", "your", "&",
]);

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[`'"!?.,:;()\[\]{}<>\/\\@#$%^*+=~|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string): Set<string> {
  return new Set(
    normalize(s)
      .split(" ")
      .filter((t) => t.length > 1 && !STOPWORDS.has(t)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersect = 0;
  for (const x of a) if (b.has(x)) intersect++;
  return intersect / (a.size + b.size - intersect);
}

type Match = {
  card: TrelloCard;
  score: number;
  why: string;
};

function bestMatch(note: Note, cards: TrelloCard[]): Match | null {
  const noteTitle = normalize(note.title);
  const noteTitleTokens = tokens(note.title);
  if (noteTitleTokens.size === 0) return null;

  let best: Match | null = null;
  for (const card of cards) {
    const cardName = normalize(card.name);
    const cardDesc = normalize(card.desc);
    const cardTokens = new Set([...tokens(card.name), ...tokens(card.desc)]);

    // Direct substring hit on title is high confidence.
    let score = 0;
    let why = "";
    if (cardName === noteTitle) {
      score = 1.0;
      why = "exact title match";
    } else if (noteTitle.length >= 4 && cardName.includes(noteTitle)) {
      score = 0.9;
      why = `card name contains "${note.title}"`;
    } else if (noteTitle.length >= 6 && cardDesc.includes(noteTitle)) {
      score = 0.75;
      why = `card desc contains "${note.title}"`;
    } else {
      const titleScore = jaccard(noteTitleTokens, cardTokens);
      score = titleScore;
      if (titleScore > 0) why = `${(titleScore * 100).toFixed(0)}% token overlap`;
    }
    if (!best || score > best.score) {
      best = { card, score, why };
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Report writer
// ---------------------------------------------------------------------------

const MATCH_THRESHOLD = 0.5;
const WEAK_THRESHOLD = 0.25;

type Classification = "not_in_trello" | "weak_match" | "matched";

type ScrubRow = {
  note: Note;
  match: Match | null;
  classification: Classification;
};

function classify(match: Match | null): Classification {
  if (!match) return "not_in_trello";
  if (match.score >= MATCH_THRESHOLD) return "matched";
  if (match.score >= WEAK_THRESHOLD) return "weak_match";
  return "not_in_trello";
}

function escapeMd(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function renderReport(
  rows: ScrubRow[],
  boardName: string,
  cardCount: number,
  noteCount: number,
): string {
  const today = new Date().toISOString().slice(0, 10);
  const notInTrello = rows.filter((r) => r.classification === "not_in_trello");
  const weak = rows.filter((r) => r.classification === "weak_match");
  const matched = rows.filter((r) => r.classification === "matched");

  const lines: string[] = [];
  lines.push(`# Notes-vs-Trello scrub — ${today}`);
  lines.push("");
  lines.push(
    `Cross-references **${noteCount}** live notes (Apple Notes, excluding Recently Deleted) ` +
      `against **${cardCount}** open cards on Trello board **"${boardName}"**.`,
  );
  lines.push("");
  lines.push("**Method:** title + first-paragraph token-set Jaccard similarity " +
    "(plus exact / substring shortcuts for high-confidence matches). " +
    `Threshold ≥${MATCH_THRESHOLD * 100}% = "matched", ` +
    `${WEAK_THRESHOLD * 100}–${MATCH_THRESHOLD * 100}% = "weak match", ` +
    `<${WEAK_THRESHOLD * 100}% = "not in Trello".`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- 🟥 Not in Trello: **${notInTrello.length}**`);
  lines.push(`- 🟨 Weak match (review): **${weak.length}**`);
  lines.push(`- 🟩 Matched: **${matched.length}**`);
  lines.push("");
  lines.push(`Each row in §1 / §2 is a candidate for either (a) becoming a new Trello card OR ` +
    `(b) being archived in Notes as already-handled-elsewhere — Josh decides.`);
  lines.push("");

  lines.push("## § 1 — Notes-only (no Trello card found)");
  lines.push("");
  if (notInTrello.length === 0) {
    lines.push("_None. Every note has at least a weak match on the board._");
  } else {
    lines.push("| Note title | Folder | Modified | First line |");
    lines.push("|---|---|---|---|");
    for (const r of notInTrello) {
      lines.push(
        `| ${escapeMd(r.note.title)} | ${escapeMd(r.note.folder)} | ${r.note.modified} | ${escapeMd(r.note.snippet).slice(0, 120)} |`,
      );
    }
  }
  lines.push("");

  lines.push("## § 2 — Weak matches (likely notes-only — confirm)");
  lines.push("");
  if (weak.length === 0) {
    lines.push("_None._");
  } else {
    lines.push("| Note title | Closest Trello card | Score | Why |");
    lines.push("|---|---|---|---|");
    for (const r of weak) {
      const link = r.match
        ? `[${escapeMd(r.match.card.name)}](${r.match.card.shortUrl}) · _${r.match.card.listName}_`
        : "—";
      lines.push(
        `| ${escapeMd(r.note.title)} | ${link} | ${(r.match!.score * 100).toFixed(0)}% | ${escapeMd(r.match!.why)} |`,
      );
    }
  }
  lines.push("");

  lines.push("## § 3 — Matched (already on Trello — informational)");
  lines.push("");
  lines.push("<details><summary>Show ${matched.length} matched notes</summary>".replace("${matched.length}", String(matched.length)));
  lines.push("");
  lines.push("| Note title | Trello card | List | Score |");
  lines.push("|---|---|---|---|");
  for (const r of matched) {
    const link = r.match
      ? `[${escapeMd(r.match.card.name)}](${r.match.card.shortUrl})`
      : "—";
    lines.push(
      `| ${escapeMd(r.note.title)} | ${link} | ${escapeMd(r.match!.card.listName)} | ${(r.match!.score * 100).toFixed(0)}% |`,
    );
  }
  lines.push("");
  lines.push("</details>");
  lines.push("");

  lines.push("---");
  lines.push("");
  lines.push(`_Generated by [scripts/scrub-notes-vs-trello.ts](../candidates/harborline-ea4814d1-work/scripts/scrub-notes-vs-trello.ts) on ${today}._`);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  await loadDotEnvLocal();

  console.error("Reading Notes.app database...");
  const notes = await readNotes();
  console.error(`  → ${notes.length} live notes`);

  console.error("Resolving Trello board...");
  const board = await resolveBoard();
  console.error(`  → "${board.name}" (${board.id})`);

  console.error("Fetching Trello cards + lists...");
  const cards = await readBoardCards(board.id);
  console.error(`  → ${cards.length} open cards across ${new Set(cards.map((c) => c.listName)).size} lists`);

  console.error("Matching notes against cards...");
  const rows: ScrubRow[] = notes.map((note) => {
    const match = bestMatch(note, cards);
    return { note, match, classification: classify(match) };
  });
  const counts = rows.reduce(
    (acc, r) => ({ ...acc, [r.classification]: (acc[r.classification] ?? 0) + 1 }),
    {} as Record<Classification, number>,
  );
  console.error(`  → ${counts.not_in_trello ?? 0} not_in_trello, ${counts.weak_match ?? 0} weak, ${counts.matched ?? 0} matched`);

  // Reuse the same date the report will be filed under.
  const today = new Date().toISOString().slice(0, 10);
  const outFile = `${REPORT_DIR}/notes-not-in-trello-${today}.md`;
  const md = renderReport(rows, board.name, cards.length, notes.length);
  await Deno.mkdir(REPORT_DIR, { recursive: true });
  await Deno.writeTextFile(outFile, md);
  console.error(`Report written: ${outFile}`);

  // One-line stdout for piping / quick grep.
  console.log(JSON.stringify({
    report: outFile,
    notes: notes.length,
    cards: cards.length,
    notInTrello: counts.not_in_trello ?? 0,
    weakMatch: counts.weak_match ?? 0,
    matched: counts.matched ?? 0,
  }));
  void REPO_ROOT;
}

if (import.meta.main) {
  try {
    await main();
  } catch (e) {
    console.error(`scrub-notes-vs-trello failed: ${e instanceof Error ? e.message : e}`);
    Deno.exit(1);
  }
}
