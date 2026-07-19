// Shared Trello client — extracted from `trello-poll` so `trello-route-cards`
// (P325b) and any future Trello-touching fn can reuse the same HTTP plumbing,
// board resolution, and label management without duplicating env-handling.
//
// Auth: caller's environment must carry TRELLO_API_KEY + TRELLO_API_TOKEN.
// TRELLO_BOARD_ID is optional — when absent, findBoard() falls back to a
// name-match for the "to do" board (Josh's board).

const TRELLO_KEY = Deno.env.get("TRELLO_API_KEY");
const TRELLO_TOKEN = Deno.env.get("TRELLO_API_TOKEN");
const TRELLO_BOARD_ID = Deno.env.get("TRELLO_BOARD_ID");

const BOARD_NAME_MATCH = /to[\s\-_]?do$/i;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TrelloBoard = { id: string; name: string };
export type TrelloLabel = { id: string; name: string; color: string | null };
export type TrelloList = { id: string; name: string };
export type TrelloCheckItem = {
  id: string;
  name: string;
  state: "complete" | "incomplete";
};
export type TrelloChecklist = {
  id: string;
  name: string;
  idCard: string;
  checkItems: TrelloCheckItem[];
};
export type TrelloAction = {
  id: string;
  type: string;
  date: string;
  data: { text?: string; card?: { id: string } };
};
export type TrelloCustomFieldOption = {
  id: string;
  value?: { text?: string };
};
export type TrelloCustomFieldDef = {
  id: string;
  name: string;
  type: "text" | "number" | "date" | "checkbox" | "list" | string;
  options?: TrelloCustomFieldOption[];
};
export type TrelloCustomFieldItem = {
  id: string;
  idCustomField: string;
  idValue?: string | null;
  value?: {
    text?: string;
    number?: string;
    date?: string;
    checked?: string;
  } | null;
};
export type TrelloCard = {
  id: string;
  name: string;
  desc: string;
  due: string | null;
  shortUrl: string;
  url: string;
  idList: string;
  idBoard: string;
  labels: TrelloLabel[];
  dateLastActivity: string;
  customFieldItems?: TrelloCustomFieldItem[];
};

// ---------------------------------------------------------------------------
// HTTP plumbing
// ---------------------------------------------------------------------------

export function trelloConfigured(): boolean {
  return !!TRELLO_KEY && !!TRELLO_TOKEN;
}

function trelloAuth(): string {
  return `key=${encodeURIComponent(TRELLO_KEY!)}&token=${encodeURIComponent(TRELLO_TOKEN!)}`;
}

export async function trelloGet(path: string, query = ""): Promise<Response> {
  const sep = query ? "&" : "";
  const url = `https://api.trello.com/1${path}?${trelloAuth()}${sep}${query}`;
  return await fetch(url, { headers: { Accept: "application/json" } });
}

export async function trelloPost(
  path: string,
  body: Record<string, string>,
): Promise<Response> {
  const form = new URLSearchParams({
    key: TRELLO_KEY!,
    token: TRELLO_TOKEN!,
    ...body,
  });
  return await fetch(`https://api.trello.com/1${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: form.toString(),
  });
}

// ---------------------------------------------------------------------------
// Board resolution
// ---------------------------------------------------------------------------

export async function findBoard(): Promise<{
  board: TrelloBoard | null;
  candidates: TrelloBoard[];
}> {
  const res = await trelloGet("/members/me/boards", "filter=open&fields=id,name");
  if (!res.ok) throw new Error(`Trello boards fetch failed: ${res.status}`);
  const boards: TrelloBoard[] = await res.json();
  if (TRELLO_BOARD_ID) {
    const pinned = boards.find((b) => b.id === TRELLO_BOARD_ID);
    if (pinned) return { board: pinned, candidates: boards };
    return { board: null, candidates: boards };
  }
  const matches = boards.filter((b) => BOARD_NAME_MATCH.test(b.name.trim()));
  if (matches.length === 1) return { board: matches[0], candidates: boards };
  return { board: null, candidates: boards };
}

export function boardNotFoundReason(candidates: TrelloBoard[]): string {
  const reason = TRELLO_BOARD_ID
    ? `TRELLO_BOARD_ID=${TRELLO_BOARD_ID} not among visible boards`
    : "No board matched /to[ -_]?do$/i";
  return candidates.length === 0
    ? "No open Trello boards visible to this token."
    : `${reason}. Visible boards: ${candidates.map((b) => b.name).join(", ")}`;
}

// ---------------------------------------------------------------------------
// Label management
// ---------------------------------------------------------------------------

export async function findOrCreateLabel(
  boardId: string,
  name: string,
  color: string,
): Promise<TrelloLabel> {
  const res = await trelloGet(
    `/boards/${boardId}/labels`,
    "fields=id,name,color&limit=1000",
  );
  if (!res.ok) throw new Error(`Labels fetch failed: ${res.status}`);
  const labels: TrelloLabel[] = await res.json();
  const existing = labels.find((l) => l.name === name);
  if (existing) return existing;
  const createRes = await trelloPost("/labels", {
    name,
    color,
    idBoard: boardId,
  });
  if (!createRes.ok) {
    const detail = await createRes.text();
    throw new Error(`Label create failed: ${createRes.status} ${detail}`);
  }
  return await createRes.json();
}

export async function trelloDelete(path: string): Promise<Response> {
  const url = `https://api.trello.com/1${path}?${trelloAuth()}`;
  return await fetch(url, { method: "DELETE", headers: { Accept: "application/json" } });
}

export async function attachLabelToCard(
  cardId: string,
  labelId: string,
): Promise<Response> {
  return await trelloPost(`/cards/${cardId}/idLabels`, { value: labelId });
}

export async function getCardWithLabels(
  cardId: string,
): Promise<{ idBoard: string; labels: TrelloLabel[] } | { error: string; status: number; detail: string }> {
  const res = await trelloGet(`/cards/${cardId}`, "fields=idBoard,labels");
  if (!res.ok) {
    const detail = await res.text();
    return {
      error: "card_fetch_failed",
      status: res.status,
      detail: detail.slice(0, 300),
    };
  }
  return await res.json();
}

// ---------------------------------------------------------------------------
// Utils
// ---------------------------------------------------------------------------

export function daysBetween(iso: string, now: Date): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 0;
  const ms = now.getTime() - t;
  return Math.max(0, Math.round(ms / 86_400_000));
}

export function truncate(s: string, max: number): string {
  const trimmed = s.replace(/\s+/g, " ").trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max - 1).trimEnd() + "…";
}

export function renderCustomFieldValue(
  def: TrelloCustomFieldDef,
  item: TrelloCustomFieldItem,
): string | null {
  if (def.type === "list") {
    if (!item.idValue) return null;
    const opt = (def.options || []).find((o) => o.id === item.idValue);
    const text = opt?.value?.text?.trim();
    return text && text.length > 0 ? text : null;
  }
  const v = item.value;
  if (!v) return null;
  if (def.type === "text") {
    const s = (v.text ?? "").trim();
    return s.length > 0 ? s : null;
  }
  if (def.type === "number") {
    const s = (v.number ?? "").trim();
    return s.length > 0 ? s : null;
  }
  if (def.type === "date") {
    const s = (v.date ?? "").trim();
    return s.length > 0 ? s : null;
  }
  if (def.type === "checkbox") {
    if (v.checked === "true") return "yes";
    if (v.checked === "false") return "no";
    return null;
  }
  const first = [v.text, v.number, v.date, v.checked].find(
    (x) => typeof x === "string" && x.trim().length > 0,
  );
  return first ? first.trim() : null;
}
