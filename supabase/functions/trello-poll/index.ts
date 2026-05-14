// P13 — Trello → SMART pipeline (P21 enriched).
//
// Two routes via ?action=:
//   - poll            → return open cards from Josh's "to-do" board, skipping
//                       cards that already carry the "✅ SMART-ified" label.
//                       Each card carries: list name (the "bucket"), labels,
//                       open checklist items, recent comments, age.
//   - mark-smartified → ensure the label exists on the board, attach it to a
//                       given card. Card stays on the board (no archive),
//                       paper trail preserved.
//
// Auth: TRELLO_API_KEY + TRELLO_API_TOKEN must be set as edge-function secrets
// in the Supabase dashboard. They are never read from / written to the repo.

import { requireOperator } from "../_shared/require-operator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TRELLO_KEY = Deno.env.get("TRELLO_API_KEY");
const TRELLO_TOKEN = Deno.env.get("TRELLO_API_TOKEN");
const TRELLO_BOARD_ID = Deno.env.get("TRELLO_BOARD_ID");

const SMART_LABEL_NAME = "✅ SMART-ified";
const SMART_LABEL_COLOR = "green";
// Fallback only — used when TRELLO_BOARD_ID is unset. Match-anywhere so "Josh's To Do" hits.
const BOARD_NAME_MATCH = /to[\s\-_]?do$/i;

// Limits on enriched payload — keep response small and avoid pathological cards.
const MAX_COMMENTS_PER_CARD = 3;
const MAX_COMMENT_CHARS = 280;
const MAX_OPEN_CHECKITEMS_PER_CARD = 8;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function trelloAuth(): string {
  return `key=${encodeURIComponent(TRELLO_KEY!)}&token=${encodeURIComponent(TRELLO_TOKEN!)}`;
}

async function trelloGet(path: string, query = ""): Promise<Response> {
  const sep = query ? "&" : "";
  const url = `https://api.trello.com/1${path}?${trelloAuth()}${sep}${query}`;
  return await fetch(url, { headers: { Accept: "application/json" } });
}

async function trelloPost(path: string, body: Record<string, string>): Promise<Response> {
  const form = new URLSearchParams({ key: TRELLO_KEY!, token: TRELLO_TOKEN!, ...body });
  return await fetch(`https://api.trello.com/1${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: form.toString(),
  });
}

type TrelloBoard = { id: string; name: string };
type TrelloLabel = { id: string; name: string; color: string | null };
type TrelloList = { id: string; name: string };
type TrelloCheckItem = { id: string; name: string; state: "complete" | "incomplete" };
type TrelloChecklist = {
  id: string;
  name: string;
  idCard: string;
  checkItems: TrelloCheckItem[];
};
type TrelloAction = {
  id: string;
  type: string;
  date: string;
  data: { text?: string; card?: { id: string } };
};
type TrelloCustomFieldOption = {
  id: string;
  value?: { text?: string };
};
type TrelloCustomFieldDef = {
  id: string;
  name: string;
  type: "text" | "number" | "date" | "checkbox" | "list" | string;
  options?: TrelloCustomFieldOption[];
};
type TrelloCustomFieldItem = {
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
type TrelloCard = {
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

async function findBoard(): Promise<{ board: TrelloBoard | null; candidates: TrelloBoard[] }> {
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

async function findOrCreateSmartLabel(boardId: string): Promise<TrelloLabel> {
  const res = await trelloGet(`/boards/${boardId}/labels`, "fields=id,name,color&limit=1000");
  if (!res.ok) throw new Error(`Labels fetch failed: ${res.status}`);
  const labels: TrelloLabel[] = await res.json();
  const existing = labels.find((l) => l.name === SMART_LABEL_NAME);
  if (existing) return existing;
  const createRes = await trelloPost("/labels", {
    name: SMART_LABEL_NAME,
    color: SMART_LABEL_COLOR,
    idBoard: boardId,
  });
  if (!createRes.ok) {
    const detail = await createRes.text();
    throw new Error(`Label create failed: ${createRes.status} ${detail}`);
  }
  return await createRes.json();
}

function daysBetween(iso: string, now: Date): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 0;
  const ms = now.getTime() - t;
  return Math.max(0, Math.round(ms / 86_400_000));
}

function truncate(s: string, max: number): string {
  const trimmed = s.replace(/\s+/g, " ").trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max - 1).trimEnd() + "…";
}

function renderCustomFieldValue(
  def: TrelloCustomFieldDef,
  item: TrelloCustomFieldItem,
): string | null {
  // Dropdown: resolve idValue against definition options.
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
  // Unknown future type: best-effort string from any populated key.
  const first = [v.text, v.number, v.date, v.checked].find(
    (x) => typeof x === "string" && x.trim().length > 0,
  );
  return first ? first.trim() : null;
}

async function pollBoard(): Promise<unknown> {
  const { board, candidates } = await findBoard();
  if (!board) {
    const reason = TRELLO_BOARD_ID
      ? `TRELLO_BOARD_ID=${TRELLO_BOARD_ID} not among visible boards`
      : "No board matched /to[ -_]?do$/i";
    return {
      error: "board_not_found",
      message:
        candidates.length === 0
          ? "No open Trello boards visible to this token."
          : `${reason}. Visible boards: ${candidates.map((b) => b.name).join(", ")}`,
      candidates: candidates.map((b) => ({ id: b.id, name: b.name })),
    };
  }

  // Parallel: cards, lists, checklists, recent comments, custom-field defs.
  // All board-scoped — O(1) calls regardless of card count.
  const [cardsRes, listsRes, checklistsRes, actionsRes, customFieldsRes] = await Promise.all([
    trelloGet(
      `/boards/${board.id}/cards`,
      "filter=open&fields=id,name,desc,due,shortUrl,url,idList,idBoard,labels,dateLastActivity&customFieldItems=true",
    ),
    trelloGet(`/boards/${board.id}/lists`, "filter=open&fields=id,name"),
    trelloGet(
      `/boards/${board.id}/checklists`,
      "fields=id,name,idCard&checkItems=all&checkItem_fields=name,state",
    ),
    trelloGet(
      `/boards/${board.id}/actions`,
      "filter=commentCard&limit=1000&fields=id,type,date,data",
    ),
    trelloGet(`/boards/${board.id}/customFields`, ""),
  ]);
  if (!cardsRes.ok) throw new Error(`Cards fetch failed: ${cardsRes.status}`);
  if (!listsRes.ok) throw new Error(`Lists fetch failed: ${listsRes.status}`);
  if (!checklistsRes.ok) throw new Error(`Checklists fetch failed: ${checklistsRes.status}`);
  if (!actionsRes.ok) throw new Error(`Actions fetch failed: ${actionsRes.status}`);
  // customFields is non-fatal: boards without any defined return [], and we
  // still want the rest of the payload if Trello errors on this endpoint.
  const customFieldDefs: TrelloCustomFieldDef[] = customFieldsRes.ok
    ? await customFieldsRes.json()
    : [];

  const allCards: TrelloCard[] = await cardsRes.json();
  const lists: TrelloList[] = await listsRes.json();
  const checklists: TrelloChecklist[] = await checklistsRes.json();
  const actions: TrelloAction[] = await actionsRes.json();

  const customFieldDefById = new Map(customFieldDefs.map((d) => [d.id, d]));

  const listNameById = new Map(lists.map((l) => [l.id, l.name]));

  // Bucket open checkitems by card id, capped per card.
  const openChecklistsByCard = new Map<string, { name: string; items: string[] }[]>();
  for (const cl of checklists) {
    const openItems = (cl.checkItems || [])
      .filter((i) => i.state === "incomplete")
      .map((i) => i.name.trim())
      .filter((n) => n.length > 0);
    if (openItems.length === 0) continue;
    const bucket = openChecklistsByCard.get(cl.idCard) || [];
    bucket.push({
      name: cl.name,
      items: openItems.slice(0, MAX_OPEN_CHECKITEMS_PER_CARD),
    });
    openChecklistsByCard.set(cl.idCard, bucket);
  }

  // Bucket recent comments by card id. Trello returns actions newest-first; keep top N.
  const commentsByCard = new Map<string, { text: string; date: string }[]>();
  for (const a of actions) {
    const cardId = a.data?.card?.id;
    const text = a.data?.text;
    if (!cardId || !text) continue;
    const bucket = commentsByCard.get(cardId) || [];
    if (bucket.length >= MAX_COMMENTS_PER_CARD) continue;
    bucket.push({ text: truncate(text, MAX_COMMENT_CHARS), date: a.date });
    commentsByCard.set(cardId, bucket);
  }

  // Per Josh: all lists, skip cards already SMART-ified.
  const pending = allCards.filter(
    (c) => !(c.labels || []).some((l) => l.name === SMART_LABEL_NAME),
  );

  const now = new Date();

  return {
    board: { id: board.id, name: board.name },
    cards: pending.map((c) => {
      const listName = listNameById.get(c.idList) || null;
      const labels = (c.labels || [])
        .filter((l) => l.name && l.name !== SMART_LABEL_NAME)
        .map((l) => ({ name: l.name, color: l.color }));
      const checklists_open = openChecklistsByCard.get(c.id) || [];
      const recent_comments = commentsByCard.get(c.id) || [];
      const age_days = daysBetween(c.dateLastActivity, now);
      const custom_fields: { name: string; value: string }[] = [];
      for (const item of c.customFieldItems || []) {
        const def = customFieldDefById.get(item.idCustomField);
        if (!def || !def.name) continue;
        const value = renderCustomFieldValue(def, item);
        if (value === null) continue;
        custom_fields.push({ name: def.name, value });
      }
      return {
        id: c.id,
        name: c.name,
        desc: c.desc,
        due: c.due,
        url: c.shortUrl || c.url,
        list_id: c.idList,
        list_name: listName,
        labels,
        checklists_open,
        recent_comments,
        custom_fields,
        date_last_activity: c.dateLastActivity,
        age_days,
      };
    }),
    total_open: allCards.length,
    pending_count: pending.length,
    lists: lists.map((l) => ({ id: l.id, name: l.name })),
  };
}

async function markSmartified(cardId: string): Promise<unknown> {
  if (!cardId) return { error: "card_id required" };

  // Need board context to ensure the label exists on the right board.
  const cardRes = await trelloGet(`/cards/${cardId}`, "fields=idBoard,labels");
  if (!cardRes.ok) {
    const detail = await cardRes.text();
    return {
      error: "card_fetch_failed",
      status: cardRes.status,
      detail: detail.slice(0, 300),
    };
  }
  const card: { idBoard: string; labels: TrelloLabel[] } = await cardRes.json();

  // Already SMART-ified? No-op (idempotent).
  if ((card.labels || []).some((l) => l.name === SMART_LABEL_NAME)) {
    return { labeled: true, already: true, card_id: cardId };
  }

  const label = await findOrCreateSmartLabel(card.idBoard);
  const addRes = await trelloPost(`/cards/${cardId}/idLabels`, { value: label.id });
  if (!addRes.ok) {
    const detail = await addRes.text();
    return {
      error: "label_attach_failed",
      status: addRes.status,
      detail: detail.slice(0, 300),
    };
  }
  return { labeled: true, card_id: cardId, label_id: label.id };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const denial = await requireOperator(req);
  if (denial) return denial;

  if (!TRELLO_KEY || !TRELLO_TOKEN) {
    return jsonResponse(
      {
        error: "trello_not_configured",
        message:
          "TRELLO_API_KEY and TRELLO_API_TOKEN must be set in Supabase Edge Function secrets.",
      },
      500,
    );
  }

  try {
    const url = new URL(req.url);
    const body = req.method === "POST"
      ? await req.json().catch(() => ({}))
      : {};
    const action = (
      url.searchParams.get("action") ||
      (typeof body?.action === "string" ? body.action : "") ||
      "poll"
    );

    if (action === "poll") {
      const result = await pollBoard();
      return jsonResponse(result);
    }

    if (action === "mark-smartified") {
      const cardId = typeof body?.card_id === "string" ? body.card_id : "";
      const result = await markSmartified(cardId);
      const status = (result as { error?: string }).error ? 400 : 200;
      return jsonResponse(result, status);
    }

    return jsonResponse({ error: "unknown action", action }, 400);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("trello-poll error", msg);
    return jsonResponse({ error: msg }, 500);
  }
});
