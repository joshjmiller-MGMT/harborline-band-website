// P13 — Trello → SMART pipeline.
//
// Two routes via ?action=:
//   - poll            → return open cards from Josh's "to-do" board, skipping
//                       cards that already carry the "✅ SMART-ified" label.
//   - mark-smartified → ensure the label exists on the board, attach it to a
//                       given card. Card stays on the board (no archive),
//                       paper trail preserved.
//
// Auth: TRELLO_API_KEY + TRELLO_API_TOKEN must be set as edge-function secrets
// in the Supabase dashboard. They are never read from / written to the repo.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TRELLO_KEY = Deno.env.get("TRELLO_API_KEY");
const TRELLO_TOKEN = Deno.env.get("TRELLO_API_TOKEN");

const SMART_LABEL_NAME = "✅ SMART-ified";
const SMART_LABEL_COLOR = "green";
const BOARD_NAME_MATCH = /^to[\s\-_]?do$/i; // matches "to-do", "to do", "To Do", "todo"

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
};

async function findBoard(): Promise<{ board: TrelloBoard | null; candidates: TrelloBoard[] }> {
  const res = await trelloGet("/members/me/boards", "filter=open&fields=id,name");
  if (!res.ok) throw new Error(`Trello boards fetch failed: ${res.status}`);
  const boards: TrelloBoard[] = await res.json();
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

async function pollBoard(): Promise<unknown> {
  const { board, candidates } = await findBoard();
  if (!board) {
    return {
      error: "board_not_found",
      message:
        candidates.length === 0
          ? "No open Trello boards visible to this token."
          : `No board matched /to[ -_]?do/i. Visible boards: ${candidates.map((b) => b.name).join(", ")}`,
      candidates: candidates.map((b) => ({ id: b.id, name: b.name })),
    };
  }

  const cardsRes = await trelloGet(
    `/boards/${board.id}/cards`,
    "filter=open&fields=id,name,desc,due,shortUrl,url,idList,idBoard&customFieldItems=false",
  );
  if (!cardsRes.ok) throw new Error(`Cards fetch failed: ${cardsRes.status}`);
  const allCards: TrelloCard[] = await cardsRes.json();

  // Per Josh: all lists, skip cards already SMART-ified.
  const pending = allCards.filter(
    (c) => !(c.labels || []).some((l) => l.name === SMART_LABEL_NAME),
  );

  return {
    board: { id: board.id, name: board.name },
    cards: pending.map((c) => ({
      id: c.id,
      name: c.name,
      desc: c.desc,
      due: c.due,
      url: c.shortUrl || c.url,
      list_id: c.idList,
    })),
    total_open: allCards.length,
    pending_count: pending.length,
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
