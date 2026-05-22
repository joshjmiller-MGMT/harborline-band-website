// P325b — Trello-bucket dispatcher.
//
// Reads open Trello cards from the configured board, looks up the per-list
// route in `trello_bucket_routes`, dispatches each card through the named
// handler exactly once, and writes back a `✅ routed` label so the paper trail
// is legible on the Trello side. Phase-1 scope: one handler
// (`route_to_claude_action_queue`) wired to two lists (`To Claude` +
// `website fixes`); other lists are ignored until P325c introduces more
// handlers. Self-seeds those two routes on first run if the board has none.
//
// Ops (via ?action= or POST body):
//   - route     → live dispatch. Inserts trello_card_routes + claude_action_queue
//                 rows, attaches `✅ routed` on Trello.
//   - dry-run   → read-only preview. Reports planned seed + planned dispatch
//                 counts without writing to Supabase or POSTing to Trello.
//   - mark-done → P325c. Idempotently attaches `✅ done by claude` (purple) to
//                 a single Trello card. Body: { card_id }. Used by the
//                 orchestrator-pickup loop once a queued card's status flips
//                 to `done` / `not_applicable` / `failed`.
//
// Idempotency: trello_card_routes.trello_card_id is the PK; ON CONFLICT DO
// NOTHING keeps re-runs cheap. Cards already carrying the `✅ routed` label
// are also pre-filtered.
//
// Auth: requireOperator()-gated. Additionally honors an x-cron-secret header
// (P325cf) whose canonical value lives in public.cron_secrets — same pattern
// as P331a integration-health-check. Used by trigger_trello_mark_done() +
// trigger_trello_route() SQL fns so pg_net callers can invoke without an
// operator JWT. Service-role bypass via the existing requireOperator helper
// is also preserved for internal callers presenting that JWT.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireOperator } from "../_shared/require-operator.ts";
import {
  attachLabelToCard,
  boardNotFoundReason,
  findBoard,
  findOrCreateLabel,
  getCardWithLabels,
  trelloConfigured,
  trelloGet,
  type TrelloCard,
  type TrelloLabel,
  type TrelloList,
} from "../_shared/trello-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ROUTED_LABEL_NAME = "✅ routed";
const ROUTED_LABEL_COLOR = "blue";
const DONE_LABEL_NAME = "✅ done by claude";
const DONE_LABEL_COLOR = "purple";
const CLAUDE_HANDLER = "route_to_claude_action_queue";

type RouteRow = {
  id: string;
  board_id: string;
  list_name: string;
  list_id: string | null;
  action_handler: string;
  handler_config: Record<string, unknown>;
  enabled: boolean;
  priority: number;
};

// Phase-1 seed: the two lists the dispatcher self-seeds when the
// trello_bucket_routes table has no row for the discovered board.
const PHASE_1_SEEDS: Array<{
  list_name: string;
  action_handler: string;
  handler_config: Record<string, unknown>;
}> = [
  {
    list_name: "To Claude",
    action_handler: CLAUDE_HANDLER,
    handler_config: {},
  },
  {
    list_name: "website fixes",
    action_handler: CLAUDE_HANDLER,
    handler_config: { context: "harborline_website_repo" },
  },
];

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function loadRoutes(
  supabase: SupabaseClient,
  boardId: string,
): Promise<RouteRow[]> {
  const { data, error } = await supabase
    .from("trello_bucket_routes")
    .select("id, board_id, list_name, list_id, action_handler, handler_config, enabled, priority")
    .eq("board_id", boardId)
    .eq("enabled", true);
  if (error) throw new Error(`load_routes_failed: ${error.message}`);
  return (data ?? []) as RouteRow[];
}

async function seedPhase1Routes(
  supabase: SupabaseClient,
  boardId: string,
): Promise<{ seeded: number }> {
  const rows = PHASE_1_SEEDS.map((s) => ({
    board_id: boardId,
    list_name: s.list_name,
    action_handler: s.action_handler,
    handler_config: s.handler_config,
  }));
  const { error, count } = await supabase
    .from("trello_bucket_routes")
    .insert(rows, { count: "exact" });
  if (error) throw new Error(`seed_phase1_routes_failed: ${error.message}`);
  return { seeded: count ?? rows.length };
}

async function fetchBoardCardsAndLists(boardId: string): Promise<{
  cards: TrelloCard[];
  lists: TrelloList[];
}> {
  const [cardsRes, listsRes] = await Promise.all([
    trelloGet(
      `/boards/${boardId}/cards`,
      "filter=open&fields=id,name,desc,due,shortUrl,url,idList,idBoard,labels,dateLastActivity",
    ),
    trelloGet(`/boards/${boardId}/lists`, "filter=open&fields=id,name"),
  ]);
  if (!cardsRes.ok) throw new Error(`cards_fetch_failed: ${cardsRes.status}`);
  if (!listsRes.ok) throw new Error(`lists_fetch_failed: ${listsRes.status}`);
  const cards: TrelloCard[] = await cardsRes.json();
  const lists: TrelloList[] = await listsRes.json();
  return { cards, lists };
}

async function loadAlreadyRoutedIds(
  supabase: SupabaseClient,
  cardIds: string[],
): Promise<Set<string>> {
  if (cardIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from("trello_card_routes")
    .select("trello_card_id")
    .in("trello_card_id", cardIds);
  if (error) throw new Error(`load_routed_ids_failed: ${error.message}`);
  return new Set((data ?? []).map((r) => r.trello_card_id as string));
}

type CandidateCard = {
  card: TrelloCard;
  listName: string;
  route: RouteRow;
};

function selectCandidates(
  cards: TrelloCard[],
  lists: TrelloList[],
  routes: RouteRow[],
): CandidateCard[] {
  const listNameById = new Map(lists.map((l) => [l.id, l.name]));
  const routeByListName = new Map<string, RouteRow>();
  for (const r of routes) {
    if (r.action_handler !== CLAUDE_HANDLER) continue;
    routeByListName.set(r.list_name, r);
  }
  const out: CandidateCard[] = [];
  for (const card of cards) {
    const listName = listNameById.get(card.idList);
    if (!listName) continue;
    const route = routeByListName.get(listName);
    if (!route) continue;
    const hasRoutedLabel = (card.labels || []).some(
      (l: TrelloLabel) => l.name === ROUTED_LABEL_NAME,
    );
    if (hasRoutedLabel) continue;
    out.push({ card, listName, route });
  }
  return out;
}

type RouteOutcome = {
  card_id: string;
  list_name: string;
  routed: boolean;
  labeled: boolean;
  queue_inserted: boolean;
  reason?: string;
};

async function dispatchOne(
  supabase: SupabaseClient,
  candidate: CandidateCard,
  routedLabelId: string,
): Promise<RouteOutcome> {
  const { card, listName, route } = candidate;

  const snapshot = {
    id: card.id,
    name: card.name,
    desc: card.desc,
    due: card.due,
    url: card.shortUrl || card.url,
    list_id: card.idList,
    list_name: listName,
    labels: (card.labels || []).map((l) => ({ name: l.name, color: l.color })),
    date_last_activity: card.dateLastActivity,
  };

  // INSERT trello_card_routes — idempotent via PK conflict.
  const { error: routeErr } = await supabase
    .from("trello_card_routes")
    .upsert(
      {
        trello_card_id: card.id,
        route_id: route.id,
        action_handler: route.action_handler,
        raw_card_snapshot: snapshot,
      },
      { onConflict: "trello_card_id", ignoreDuplicates: true },
    );
  if (routeErr) {
    return {
      card_id: card.id,
      list_name: listName,
      routed: false,
      labeled: false,
      queue_inserted: false,
      reason: `trello_card_routes_upsert_failed: ${routeErr.message}`,
    };
  }

  // INSERT claude_action_queue — idempotent via unique(trello_card_id).
  const { error: queueErr } = await supabase
    .from("claude_action_queue")
    .upsert(
      {
        trello_card_id: card.id,
        card_name: card.name,
        card_desc: card.desc ?? null,
        card_url: card.shortUrl || card.url,
        list_name: listName,
        status: "queued",
      },
      { onConflict: "trello_card_id", ignoreDuplicates: true },
    );
  if (queueErr) {
    return {
      card_id: card.id,
      list_name: listName,
      routed: true,
      labeled: false,
      queue_inserted: false,
      reason: `claude_action_queue_upsert_failed: ${queueErr.message}`,
    };
  }

  // Attach ✅ routed label. Non-blocking: if Trello hiccups, the queue row
  // still exists and the next run will skip via trello_card_routes.
  const attachRes = await attachLabelToCard(card.id, routedLabelId);
  if (!attachRes.ok) {
    const detail = await attachRes.text();
    return {
      card_id: card.id,
      list_name: listName,
      routed: true,
      labeled: false,
      queue_inserted: true,
      reason: `label_attach_failed: ${attachRes.status} ${detail.slice(0, 120)}`,
    };
  }
  return {
    card_id: card.id,
    list_name: listName,
    routed: true,
    labeled: true,
    queue_inserted: true,
  };
}

async function handleRoute(supabase: SupabaseClient, dryRun: boolean) {
  const { board, candidates: boardCandidates } = await findBoard();
  if (!board) {
    return {
      response: json(
        404,
        {
          error: "board_not_found",
          message: boardNotFoundReason(boardCandidates),
          candidates: boardCandidates.map((b) => ({ id: b.id, name: b.name })),
        },
      ),
    };
  }

  // Self-seed routes if board has none. Dry-run reports the planned seed but
  // does not write to Supabase.
  let routes = await loadRoutes(supabase, board.id);
  let seeded = 0;
  if (routes.length === 0) {
    if (dryRun) {
      // Return planned seed alongside; dispatch preview still runs using
      // synthetic in-memory routes so Josh sees what would happen end-to-end.
      const syntheticRoutes: RouteRow[] = PHASE_1_SEEDS.map((s, i) => ({
        id: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
        board_id: board.id,
        list_name: s.list_name,
        list_id: null,
        action_handler: s.action_handler,
        handler_config: s.handler_config,
        enabled: true,
        priority: 100,
      }));
      routes = syntheticRoutes;
    } else {
      const { seeded: n } = await seedPhase1Routes(supabase, board.id);
      seeded = n;
      routes = await loadRoutes(supabase, board.id);
    }
  }

  const { cards, lists } = await fetchBoardCardsAndLists(board.id);
  const candidates = selectCandidates(cards, lists, routes);
  const candidateIds = candidates.map((c) => c.card.id);
  const alreadyRouted = await loadAlreadyRoutedIds(supabase, candidateIds);
  const fresh = candidates.filter((c) => !alreadyRouted.has(c.card.id));

  // Dry-run: no Supabase writes, no Trello POSTs.
  if (dryRun) {
    const planned = fresh.map((c) => ({
      card_id: c.card.id,
      card_name: c.card.name,
      list_name: c.listName,
      handler: c.route.action_handler,
      handler_config: c.route.handler_config,
    }));
    const skipped_already_routed = candidates.length - fresh.length;
    return {
      response: json(200, {
        mode: "dry-run",
        board: { id: board.id, name: board.name },
        seed: routes.length > 0 && seeded === 0 && routesAreNonSynthetic(routes)
          ? { action: "none", existing_routes: routes.length }
          : { action: "would_seed", rows: PHASE_1_SEEDS },
        total_cards: cards.length,
        phase1_candidates: candidates.length,
        skipped_already_routed,
        planned_dispatch_count: planned.length,
        planned_dispatch: planned,
        planned_label: {
          name: ROUTED_LABEL_NAME,
          color: ROUTED_LABEL_COLOR,
          action: "would_findOrCreate_then_attach_to_each_dispatched_card",
        },
      }),
    };
  }

  // Live route. Resolve label once per run.
  let routedLabel: TrelloLabel;
  try {
    routedLabel = await findOrCreateLabel(
      board.id,
      ROUTED_LABEL_NAME,
      ROUTED_LABEL_COLOR,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      response: json(500, {
        error: "routed_label_setup_failed",
        message: msg,
        board: { id: board.id, name: board.name },
        seeded_routes: seeded,
      }),
    };
  }

  const outcomes: RouteOutcome[] = [];
  for (const c of fresh) {
    const outcome = await dispatchOne(supabase, c, routedLabel.id);
    outcomes.push(outcome);
  }

  const routed_count = outcomes.filter((o) => o.routed).length;
  const labeled_count = outcomes.filter((o) => o.labeled).length;
  const queue_inserted_count = outcomes.filter((o) => o.queue_inserted).length;
  const failures = outcomes.filter((o) => !o.routed || !o.labeled || !o.queue_inserted);

  return {
    response: json(200, {
      mode: "route",
      board: { id: board.id, name: board.name },
      seeded_routes: seeded,
      total_cards: cards.length,
      phase1_candidates: candidates.length,
      skipped_already_routed: candidates.length - fresh.length,
      dispatched: fresh.length,
      routed_count,
      labeled_count,
      queue_inserted_count,
      failures: failures.length === 0 ? [] : failures,
      label: {
        name: routedLabel.name,
        id: routedLabel.id,
        color: routedLabel.color,
      },
    }),
  };
}

// Helper: synthetic routes (dry-run preview before seeding) all carry the
// well-known zero-UUID prefix; differentiate them from real DB rows so the
// dry-run summary reports the correct seed action.
function routesAreNonSynthetic(routes: RouteRow[]): boolean {
  return routes.every((r) => !r.id.startsWith("00000000-0000-0000-0000-"));
}

async function handleMarkDone(cardId: string) {
  const cardRes = await getCardWithLabels(cardId);
  if ("error" in cardRes) {
    return json(cardRes.status, {
      error: cardRes.error,
      status: cardRes.status,
      detail: cardRes.detail,
    });
  }
  const existing = (cardRes.labels || []).find(
    (l: TrelloLabel) => l.name === DONE_LABEL_NAME,
  );
  if (existing) {
    return json(200, {
      labeled: true,
      card_id: cardId,
      label_id: existing.id,
      already: true,
    });
  }
  let doneLabel: TrelloLabel;
  try {
    doneLabel = await findOrCreateLabel(
      cardRes.idBoard,
      DONE_LABEL_NAME,
      DONE_LABEL_COLOR,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return json(500, {
      error: "done_label_setup_failed",
      status: 500,
      detail: msg,
    });
  }
  const attachRes = await attachLabelToCard(cardId, doneLabel.id);
  if (!attachRes.ok) {
    const detail = await attachRes.text();
    return json(attachRes.status, {
      error: "label_attach_failed",
      status: attachRes.status,
      detail: detail.slice(0, 300),
    });
  }
  return json(200, {
    labeled: true,
    card_id: cardId,
    label_id: doneLabel.id,
  });
}

// Cron-secret cache + constant-time compare (mirrors P331a integration-health-check).
let cachedCronSecret: string | null = null;
async function loadCronSecret(supabase: SupabaseClient): Promise<string | null> {
  if (cachedCronSecret !== null) return cachedCronSecret;
  const { data, error } = await supabase
    .from("cron_secrets")
    .select("secret")
    .eq("name", "trello_route_cron_secret")
    .maybeSingle();
  if (error || !data?.secret) return null;
  cachedCronSecret = data.secret as string;
  return cachedCronSecret;
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Service-role supabase client — used for cron-secret lookup + route ops.
  // Same client serves both purposes; created once per request.
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Cron-secret bypass (pg_net caller via trigger_trello_*()). Secret lives in
  // public.cron_secrets (RLS-on, no policies — service-role read only).
  const cronHeader = req.headers.get("x-cron-secret");
  let isCron = false;
  if (cronHeader) {
    const expected = await loadCronSecret(supabase);
    if (expected && constantTimeEquals(cronHeader, expected)) isCron = true;
  }

  if (!isCron) {
    const denial = await requireOperator(req);
    if (denial) return denial;
  }

  if (!trelloConfigured()) {
    return json(500, {
      error: "trello_not_configured",
      message:
        "TRELLO_API_KEY and TRELLO_API_TOKEN must be set in Supabase Edge Function secrets.",
    });
  }

  try {
    const url = new URL(req.url);
    const body = req.method === "POST"
      ? await req.json().catch(() => ({}))
      : {};
    const action = (
      url.searchParams.get("action") ||
      (typeof body?.action === "string" ? body.action : "") ||
      "route"
    );

    if (action !== "route" && action !== "dry-run" && action !== "mark-done") {
      return json(400, { error: "unknown_action", action });
    }

    if (action === "mark-done") {
      const cardId = typeof body?.card_id === "string" ? body.card_id.trim() : "";
      if (!cardId) {
        return json(400, {
          error: "missing_card_id",
          status: 400,
          detail: "POST body must include a non-empty `card_id` string.",
        });
      }
      return await handleMarkDone(cardId);
    }

    // Re-use the supabase client created at the top of the handler.
    const { response } = await handleRoute(supabase, action === "dry-run");
    return response;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("trello-route-cards error", msg);
    return json(500, { error: "unhandled", message: msg });
  }
});
