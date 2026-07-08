// P13 — Trello → SMART pipeline (P21 enriched). P325a refactor: HTTP / board /
// label / type primitives now live in _shared/trello-client.ts so that
// trello-route-cards (P325b) can reuse them.
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
import {
  attachLabelToCard,
  boardNotFoundReason,
  daysBetween,
  findBoard,
  findOrCreateLabel,
  getCardWithLabels,
  renderCustomFieldValue,
  trelloConfigured,
  trelloGet,
  truncate,
  type TrelloAction,
  type TrelloCard,
  type TrelloChecklist,
  type TrelloCustomFieldDef,
  type TrelloLabel,
  type TrelloList,
} from "../_shared/trello-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SMART_LABEL_NAME = "✅ SMART-ified";
const SMART_LABEL_COLOR = "green";

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

async function pollBoard(): Promise<unknown> {
  const { board, candidates } = await findBoard();
  if (!board) {
    return {
      error: "board_not_found",
      message: boardNotFoundReason(candidates),
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

  // Pending = the genuinely unprocessed inbox (fixed 2026-07-07 — the old
  // filter only knew the legacy "SMART-ified" label, so it counted nearly
  // every open card and the UI showed ~392):
  //   - only the STAY buckets (ported buckets — Daily's / Contacts / POC-F/U /
  //     To Listen/Learn/Watch — and Claude-execution buckets don't belong here)
  //   - exclude anything already routed / done-by-claude / legacy SMART-ified
  const INBOX_LISTS = new Set([
    "notes", "tasks random", "urgent", "other projects", "web & tech",
    "social / media / content", "harborline", "econ", "bse",
    "solo / personal dev / jazz",
  ]);
  const PROCESSED_LABELS = new Set([SMART_LABEL_NAME, "✅ routed", "✅ done by claude"]);
  const pending = allCards.filter((c) => {
    const listName = (listNameById.get(c.idList) || "").trim().toLowerCase();
    if (!INBOX_LISTS.has(listName)) return false;
    return !(c.labels || []).some((l) => l.name && PROCESSED_LABELS.has(l.name));
  });

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
  const cardOrErr = await getCardWithLabels(cardId);
  if ("error" in cardOrErr) return cardOrErr;
  const card = cardOrErr;

  // Already SMART-ified? No-op (idempotent).
  if ((card.labels || []).some((l: TrelloLabel) => l.name === SMART_LABEL_NAME)) {
    return { labeled: true, already: true, card_id: cardId };
  }

  const label = await findOrCreateLabel(card.idBoard, SMART_LABEL_NAME, SMART_LABEL_COLOR);
  const addRes = await attachLabelToCard(cardId, label.id);
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

  if (!trelloConfigured()) {
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
