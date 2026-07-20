// Social/content-ingest health adapter (Josh 2026-07-20).
//
// The IG-saved/DM ingest pipeline runs on JARSH (the home-studio PC). If that
// PC's browser tab gets closed, ingestion silently stops — Josh wanted a
// dashboard signal so he never has to wonder. This checks the freshness of
// content_ingest_log and grades it:
//   green  — a new item within the last 3 days (pipeline alive)
//   yellow — 3–7 days quiet (slowing / worth a glance)
//   red    — >7 days quiet (likely stopped — reopen Instagram on JARSH)

import type { Adapter, AdapterResult } from "./types.ts";

export const socialIngestAdapter: Adapter = async (ctx): Promise<AdapterResult[]> => {
  try {
    const { data, error } = await ctx.supabase
      .from("content_ingest_log")
      .select("ingested_at")
      .order("ingested_at", { ascending: false })
      .limit(1);
    if (error) {
      return [{
        integration: "social-ingest",
        status: "red",
        detail: `query_failed: ${error.message.slice(0, 160)}`,
        checked_at: new Date().toISOString(),
      }];
    }
    const last = data?.[0]?.ingested_at;
    if (!last) {
      return [{
        integration: "social-ingest",
        status: "red",
        detail: "no ingested content ever",
        checked_at: new Date().toISOString(),
      }];
    }
    const hours = (Date.now() - new Date(last).getTime()) / 3600000;
    const ago = hours < 24 ? `${Math.round(hours)}h ago` : `${Math.round(hours / 24)}d ago`;
    const status = hours <= 72 ? "green" : hours <= 168 ? "yellow" : "red";
    const detail =
      status === "red"
        ? `last item ${ago} — likely stopped; reopen Instagram on JARSH`
        : `last item ${ago}`;
    return [{
      integration: "social-ingest",
      status,
      metric: ago,
      detail,
      checked_at: new Date().toISOString(),
    }];
  } catch (err) {
    return [{
      integration: "social-ingest",
      status: "red",
      detail: `probe_threw: ${(err as Error).message?.slice(0, 160) ?? "unknown"}`,
      checked_at: new Date().toISOString(),
    }];
  }
};
