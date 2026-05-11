// render-canonical-event — Cut 4 (Layer 5 of v2 architecture).
//
// Reads a canonical_events row by ID, dispatches to Output X / X' / Z renderer,
// returns HTML + base64 (same envelope as generate-run-of-show so the existing
// frontend download path works unchanged). Updates last_rendered_at and
// last_rendered_outputs on the canonical_events row.
//
// Output selection:
//   - Explicit `output_type` in request body wins.
//   - Otherwise auto-select from event.organization + event.event_type:
//       organization='harborline' OR event_type contains 'country-club'  → X-prime
//       Shape B-flavored input (detected by line_dances presence)        → Z
//       Default                                                          → X
//
// Request:  { canonical_event_id, output_type?: 'X' | 'X-prime' | 'Z' }
// Response: { html, base64, filename, output_type, canonical_event_id }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { renderOutputX } from "./render-output-x.ts";
import { renderOutputXPrime } from "./render-output-x-prime.ts";
import { renderOutputZ } from "./render-output-z.ts";
import type { CanonicalEvent, OutputType } from "./canonical-event-types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function autoSelectOutput(event: CanonicalEvent): OutputType {
  if (event.organization === "harborline") return "X-prime";
  if ((event.event_type || "").toLowerCase().includes("country-club")) return "X-prime";

  const hasLineDances = !!(
    event.preferences?.line_dances &&
    Object.keys(event.preferences.line_dances).length > 0
  );
  if (hasLineDances) return "Z";

  return "X";
}

function htmlToBase64(html: string): string {
  const bytes = new TextEncoder().encode(html);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function safeFilename(name: string, outputType: OutputType): string {
  const cleaned = (name || "run-of-show").replace(/[^a-zA-Z0-9-_]/g, "_");
  const suffix = outputType === "X-prime" ? "harborline-ros"
    : outputType === "Z" ? "dj-ros"
    : "bse-ros";
  return `${cleaned}-${suffix}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const id = typeof body?.canonical_event_id === "string" ? body.canonical_event_id : "";
    const requestedOutput = body?.output_type as OutputType | undefined;

    if (!id) return jsonResponse({ error: "canonical_event_id (string) required" }, 400);
    if (requestedOutput && !["X", "X-prime", "Z"].includes(requestedOutput)) {
      return jsonResponse({ error: "output_type must be X | X-prime | Z" }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { data: row, error: selErr } = await supabase
      .from("canonical_events")
      .select(
        "id, event_date, end_date, name, organization, event_type, venue_name, " +
        "client, venue, contact, guests, attire, logistics, personnel, vendors, " +
        "timeline, song_sections, preferences, source_files, extractor_version, " +
        "last_rendered_outputs",
      )
      .eq("id", id)
      .maybeSingle();
    if (selErr) throw new Error(`select failed: ${selErr.message}`);
    if (!row) return jsonResponse({ error: `canonical_event ${id} not found` }, 404);

    const event = row as unknown as CanonicalEvent;
    const outputType = requestedOutput ?? autoSelectOutput(event);

    let html: string;
    switch (outputType) {
      case "X-prime": html = renderOutputXPrime(event); break;
      case "Z": html = renderOutputZ(event); break;
      case "X":
      default: html = renderOutputX(event); break;
    }

    const base64 = htmlToBase64(html);
    const filename = safeFilename(event.name, outputType);

    // Record the render on the canonical row. Append unique output types.
    const prior = Array.isArray((row as { last_rendered_outputs?: string[] }).last_rendered_outputs)
      ? (row as { last_rendered_outputs: string[] }).last_rendered_outputs
      : [];
    const nextOutputs = Array.from(new Set([...prior, outputType]));
    await supabase
      .from("canonical_events")
      .update({
        last_rendered_at: new Date().toISOString(),
        last_rendered_outputs: nextOutputs,
      })
      .eq("id", id);

    return jsonResponse({
      canonical_event_id: id,
      output_type: outputType,
      auto_selected: !requestedOutput,
      filename,
      html,
      base64,
      format: "html",
      contentType: "text/html",
    });
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
});
