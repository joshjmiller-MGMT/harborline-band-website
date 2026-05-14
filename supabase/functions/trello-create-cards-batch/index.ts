// Batch-create Trello cards from a JSON payload.
//
// Input: { board_id?: string, cards: Array<{ bucket_name: string, title: string, description: string }> }
//   board_id   — optional Trello board id; defaults to TRELLO_BOARD_ID env var.
//   bucket_name — matches against list names on the board (case-insensitive, trimmed).
//
// Output: { results: Array<{ title, bucket_name, success, card_id?, card_url?, error? }>,
//           lists?: Array<{ id, name }>, board_id }
//
// Auth: reuses the existing TRELLO_API_KEY + TRELLO_API_TOKEN edge-function secrets.

import { requireOperator } from "../_shared/require-operator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TRELLO_KEY = Deno.env.get("TRELLO_API_KEY");
const TRELLO_TOKEN = Deno.env.get("TRELLO_API_TOKEN");
const DEFAULT_BOARD_ID = Deno.env.get("TRELLO_BOARD_ID");

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function trelloAuth(): string {
  return `key=${encodeURIComponent(TRELLO_KEY!)}&token=${encodeURIComponent(TRELLO_TOKEN!)}`;
}

interface ListSummary {
  id: string;
  name: string;
}

async function fetchLists(boardId: string): Promise<ListSummary[]> {
  const url = `https://api.trello.com/1/boards/${boardId}/lists?${trelloAuth()}&filter=open&fields=id,name`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`fetchLists ${res.status}: ${text}`);
  }
  return await res.json();
}

interface CreatedCard {
  id: string;
  url: string;
}

async function createCard(
  idList: string,
  name: string,
  desc: string,
): Promise<CreatedCard> {
  const form = new URLSearchParams({
    key: TRELLO_KEY!,
    token: TRELLO_TOKEN!,
    idList,
    name,
    desc,
    pos: "top",
  });
  const res = await fetch("https://api.trello.com/1/cards", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`createCard ${res.status}: ${text}`);
  }
  const data = await res.json();
  return { id: data.id, url: data.url };
}

interface CardInput {
  bucket_name: string;
  title: string;
  description: string;
}

interface CardResult {
  title: string;
  bucket_name: string;
  success: boolean;
  card_id?: string;
  card_url?: string;
  error?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const denial = await requireOperator(req);
  if (denial) return denial;

  if (req.method !== "POST") {
    return jsonResponse({ error: "POST only" }, 405);
  }
  if (!TRELLO_KEY || !TRELLO_TOKEN) {
    return jsonResponse(
      { error: "TRELLO_API_KEY and/or TRELLO_API_TOKEN not configured" },
      500,
    );
  }

  let payload: { board_id?: string; cards?: CardInput[] };
  try {
    payload = await req.json();
  } catch (e) {
    return jsonResponse({ error: `Invalid JSON body: ${(e as Error).message}` }, 400);
  }

  const boardId = payload.board_id || DEFAULT_BOARD_ID;
  if (!boardId) {
    return jsonResponse(
      { error: "No board_id provided and TRELLO_BOARD_ID not set" },
      400,
    );
  }

  const cards = Array.isArray(payload.cards) ? payload.cards : [];
  if (cards.length === 0) {
    return jsonResponse({ error: "cards[] required and must be non-empty" }, 400);
  }

  let lists: ListSummary[];
  try {
    lists = await fetchLists(boardId);
  } catch (e) {
    return jsonResponse({ error: (e as Error).message, board_id: boardId }, 502);
  }

  // Case-insensitive, trim-tolerant lookup.
  const listByName = new Map<string, ListSummary>();
  for (const list of lists) {
    listByName.set(list.name.toLowerCase().trim(), list);
  }

  const availableBuckets = lists.map((l) => l.name).join(", ");
  const results: CardResult[] = [];

  for (const card of cards) {
    const key = (card.bucket_name || "").toLowerCase().trim();
    const target = listByName.get(key);
    if (!target) {
      results.push({
        title: card.title || "(missing title)",
        bucket_name: card.bucket_name,
        success: false,
        error: `bucket "${card.bucket_name}" not found on board ${boardId}. Available: ${availableBuckets}`,
      });
      continue;
    }
    if (!card.title) {
      results.push({
        title: "(missing title)",
        bucket_name: card.bucket_name,
        success: false,
        error: "card.title required",
      });
      continue;
    }
    try {
      const created = await createCard(
        target.id,
        card.title,
        card.description || "",
      );
      results.push({
        title: card.title,
        bucket_name: card.bucket_name,
        success: true,
        card_id: created.id,
        card_url: created.url,
      });
    } catch (e) {
      results.push({
        title: card.title,
        bucket_name: card.bucket_name,
        success: false,
        error: (e as Error).message,
      });
    }
  }

  return jsonResponse({
    board_id: boardId,
    lists: lists.map((l) => ({ id: l.id, name: l.name })),
    results,
  });
});
