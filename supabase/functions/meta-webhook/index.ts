// meta-webhook — Instagram DM ingest, server-side and permanent (2026-07-22).
//
// THE fix for the twice-stalled browser-tab ingest: Josh shares a reel to the
// Harborline pro account's DMs (one tap), Meta pushes it here, and it becomes
// a classified content_ingest_log row within seconds. No tab, no JARSH
// dependency, no Mac. Full chain:
//   webhook POST → insert raw row (dedup on shortcode UNIQUE)
//   → waitUntil: classify via Claude (haiku) → UPDATE route
//   → trg_route_ingest_at_insert routes it (reference default for artist-src,
//     urgent-only → review, teaching → Needs SMART, discovery → feed).
//
// AUTH — verify_jwt=false is REQUIRED and safe here: Meta cannot send Supabase
// JWTs. Instead:
//   GET  = subscription handshake: hub.verify_token must equal cron_secrets
//          meta_verify_token → echo hub.challenge.
//   POST = X-Hub-Signature-256 HMAC-SHA256 of the raw body with the app
//          secret (cron_secrets meta_app_secret), timing-safe compare.
//          Bad/absent signature → 403, body untouched.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const CLASSIFY_MODEL = "claude-haiku-4-5-20251001";

const db = createClient(SUPABASE_URL, SERVICE_KEY);

async function secret(name: string): Promise<string | null> {
  const { data } = await db.from("cron_secrets").select("secret").eq("name", name).single();
  return data?.secret ?? null;
}

async function hmacHex(key: string, body: Uint8Array): Promise<string> {
  const k = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", k, body);
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

// ── classifier (runs post-response via waitUntil) ─────────────────────
const CLASSIFY_TOOL = {
  name: "classify",
  description: "Classify one piece of saved social content for Josh's ops system.",
  input_schema: {
    type: "object",
    properties: {
      purpose: { type: "string", description: "One-word-ish content purpose: discovery, opportunity, learning, promo, personal, gear, business" },
      summary: { type: "string", description: "1-2 plain sentences: what this is" },
      application: { type: "string", description: "How Josh could use it (he runs Harborline wedding band, The Economy, JJM jazz)" },
      venture: { type: "string", enum: ["Harborline", "The Economy", "JMJ / jazz", "Solo / operator", "BSE", ""], description: "Best-fit venture, empty if none" },
      action: { type: "string", description: "The single next action if actionable, else empty" },
      route: { type: "string", enum: ["trello_card", "waiting_on_josh", "poc_followup", "brain_note", "passive_ref"], description: "waiting_on_josh ONLY for genuinely urgent/deadline decisions; artist/track discovery → passive_ref; teaching/how-to → brain_note; actionable idea → trello_card; a person to follow up → poc_followup" },
      tags: { type: "array", items: { type: "string" }, description: "3-6 topical tags, lowercase" },
      time_sensitivity: { type: "string", enum: ["urgent", "soon", "rolling", "none"] },
      confidence: { type: "number", description: "0-1" },
    },
    required: ["purpose", "summary", "application", "venture", "action", "route", "tags", "time_sensitivity", "confidence"],
  },
};

async function classifyRow(rowId: string, text: string) {
  try {
    if (!ANTHROPIC_API_KEY) throw new Error("no ANTHROPIC_API_KEY");
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: CLASSIFY_MODEL,
        max_tokens: 1024,
        system:
          "You classify social content Josh (Baltimore bandleader/keyboardist; ventures: Harborline wedding band, The Economy, Joshua J Miller jazz, BSE sideman work) DM'd to himself for ingestion. Content shared FROM an artist/band account is usually reference/discovery, not an action item. Be decisive and plain.",
        messages: [{ role: "user", content: `Classify this shared content:\n\n${text.slice(0, 4000)}` }],
        tools: [CLASSIFY_TOOL],
        tool_choice: { type: "tool", name: "classify" },
      }),
    });
    if (!resp.ok) throw new Error(`anthropic ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
    const data = await resp.json();
    const tu = (data.content || []).find((c: { type: string }) => c.type === "tool_use");
    const c = tu?.input as Record<string, unknown> | undefined;
    if (!c?.route) throw new Error("classifier returned no route");

    const baseTags = Array.isArray(c.tags) ? (c.tags as string[]).slice(0, 8) : [];
    if (typeof c.confidence === "number" && c.confidence < 0.5) baseTags.push("low-confidence");

    // Setting route fires trg_route_ingest_at_insert → the row routes itself.
    const { error } = await db.from("content_ingest_log").update({
      purpose: c.purpose ?? null,
      summary: c.summary ?? null,
      application: c.application ?? null,
      venture: (c.venture as string) || null,
      action: (c.action as string) || null,
      tags: baseTags,
      time_sensitivity: c.time_sensitivity ?? "none",
      confidence: typeof c.confidence === "number" ? c.confidence : null,
      route: c.route as string,
    }).eq("id", rowId);
    if (error) throw new Error(`route update failed: ${error.message}`);
  } catch (err) {
    // Honest failure: row stays visible with needs-classify; nightly sweep can retry.
    console.error("classify failed for", rowId, err);
    await db.from("content_ingest_log").update({
      tags: ["needs-classify"],
      summary: "(classification failed — will retry)",
    }).eq("id", rowId).is("route", null);
  }
}

// ── webhook payload shapes (the slice we consume) ─────────────────────
type IgAttachment = { type?: string; payload?: { url?: string; title?: string; reel_video_id?: string } };
type IgMessage = { mid?: string; text?: string; is_echo?: boolean; attachments?: IgAttachment[] };
type IgMessaging = { sender?: { id?: string }; recipient?: { id?: string }; timestamp?: number; message?: IgMessage };
type IgEntry = { id?: string; time?: number; messaging?: IgMessaging[] };

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // ── GET: Meta subscription handshake ────────────────────────────────
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    const expected = await secret("meta_verify_token");
    if (mode === "subscribe" && expected && token === expected && challenge) {
      return new Response(challenge, { status: 200 });
    }
    return new Response("forbidden", { status: 403 });
  }

  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  // ── POST: signature check on the RAW body ───────────────────────────
  const raw = new Uint8Array(await req.arrayBuffer());
  const appSecret = await secret("meta_app_secret");
  const sigHeader = req.headers.get("x-hub-signature-256") || "";
  if (!appSecret || !sigHeader.startsWith("sha256=")) {
    return new Response(JSON.stringify({ error: "missing signature" }), { status: 403 });
  }
  const expectedSig = await hmacHex(appSecret, raw);
  if (!timingSafeEqual(sigHeader.slice(7).toLowerCase(), expectedSig)) {
    return new Response(JSON.stringify({ error: "bad signature" }), { status: 403 });
  }

  let body: { object?: string; entry?: IgEntry[] };
  try {
    body = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return new Response(JSON.stringify({ error: "bad json" }), { status: 400 });
  }

  const classifyJobs: Promise<void>[] = [];
  let inserted = 0, skipped = 0;

  for (const entry of body.entry ?? []) {
    for (const ev of entry.messaging ?? []) {
      const msg = ev.message;
      if (!msg?.mid || msg.is_echo) continue; // echoes = our own sends

      const attachments = (msg.attachments ?? []).filter((a) => a?.payload);
      // One row per attachment; text-only DMs become a single text row.
      const units = attachments.length > 0
        ? attachments.map((a, i) => ({
            shortcode: attachments.length === 1 ? msg.mid! : `${msg.mid}-${i}`,
            url: a.payload?.url ?? `ig-dm:${msg.mid}`,
            caption: [a.payload?.title, msg.text].filter(Boolean).join(" — ") || null,
            kind: a.type ?? "share",
          }))
        : msg.text
          ? [{ shortcode: msg.mid!, url: `ig-dm:${msg.mid}`, caption: msg.text, kind: "text" }]
          : [];

      for (const u of units) {
        const { error, data } = await db.from("content_ingest_log").insert({
          shortcode: u.shortcode,
          platform: "instagram",
          source_account: "ig-dm",
          collection_name: `dm:${ev.sender?.id ?? "unknown"}`,
          url: u.url,
          uploader: u.kind,
          caption: u.caption,
          status: "new",
        }).select("id").single();
        if (error) {
          // 23505 = duplicate delivery (Meta retries) — correct to skip silently.
          if (error.code === "23505") { skipped++; continue; }
          console.error("insert failed", error.message);
          continue;
        }
        inserted++;
        const text = `Type: ${u.kind}\nCaption/title: ${u.caption ?? "(none)"}\nURL: ${u.url}`;
        classifyJobs.push(classifyRow(data.id, text));
      }
    }
  }

  // Respond fast (Meta retries slow endpoints); classification continues after.
  if (classifyJobs.length > 0) {
    // deno-lint-ignore no-explicit-any
    (globalThis as any).EdgeRuntime?.waitUntil?.(Promise.allSettled(classifyJobs))
      ?? await Promise.allSettled(classifyJobs);
  }
  return new Response(JSON.stringify({ ok: true, inserted, skipped }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
});
