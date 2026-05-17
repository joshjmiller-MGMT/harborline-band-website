import { useCallback, useEffect, useMemo, useState } from "react";
import TeamLayout from "@/components/TeamLayout";
import { Phone, RefreshCw, ExternalLink, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ScrumBoard } from "@/components/board/ScrumBoard";
import {
  BOOKING_BUCKET_COLUMNS,
  BOOKING_BUCKETS,
  type BookingBucket,
} from "@/components/board/bookingBuckets";
import {
  BookingPipelineCard,
  type BookingPipelineCardData,
} from "@/components/board/BookingPipelineCard";

type ApiRow = {
  id: string;
  rowIndex: number;
  name: string;
  status: string;
  type: string;
  notes: string;
  link: string;
  lastContact: string;
  nextFollowup: string;
  nextFollowupDate: string | null;
  kind: "reachout" | "followup" | "unknown";
  bucket: string;
};

type ApiResponse = {
  configured?: boolean;
  rows?: ApiRow[];
  sheetId?: string;
  sheetUrl?: string;
  note?: string;
  error?: string;
};

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

function normalizeBucket(b: string): BookingBucket {
  return (BOOKING_BUCKETS as readonly string[]).includes(b)
    ? (b as BookingBucket)
    : "Reach Out";
}

export default function TeamBookingPipeline() {
  const [rows, setRows] = useState<ApiRow[]>([]);
  const [sheetId, setSheetId] = useState<string>("");
  const [sheetUrl, setSheetUrl] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const [showDone, setShowDone] = useState(false);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke<ApiResponse>(
        "booking-agent-rows",
      );
      if (error) {
        const ctx = (error as unknown as { context?: Response }).context;
        if (ctx) {
          try {
            const body = await ctx.json();
            throw new Error(body.error || body.message || error.message);
          } catch (_) {
            throw error;
          }
        }
        throw error;
      }
      const d = (data ?? {}) as ApiResponse;
      if (d.error) {
        setError(d.error);
      }
      setRows(d.rows ?? []);
      setSheetId(d.sheetId ?? "");
      setSheetUrl(d.sheetUrl ?? "");
      setRefreshedAt(new Date());
    } catch (e) {
      console.error("TeamBookingPipeline load error", e);
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRows();
    const t = setInterval(loadRows, REFRESH_INTERVAL_MS);
    return () => clearInterval(t);
  }, [loadRows]);

  const cards = useMemo<BookingPipelineCardData[]>(() => {
    return rows
      .filter((r) => (showDone ? true : r.bucket !== "Done"))
      .map((r) => ({
        id: `row-${r.rowIndex}`,
        columnId: normalizeBucket(r.bucket),
        rowIndex: r.rowIndex,
        name: r.name,
        status: r.status,
        type: r.type,
        notes: r.notes,
        link: r.link,
        lastContact: r.lastContact,
        nextFollowup: r.nextFollowup,
        nextFollowupDate: r.nextFollowupDate,
      }));
  }, [rows, showDone]);

  const handleCardMove = useCallback(
    async (cardId: string, _from: string, to: string) => {
      const rowIndex = Number(cardId.replace(/^row-/, ""));
      if (!Number.isInteger(rowIndex) || !sheetId) return;
      const bucket = normalizeBucket(to);

      // Optimistic local update.
      setRows((prev) =>
        prev.map((r) => (r.rowIndex === rowIndex ? { ...r, bucket } : r)),
      );

      try {
        const { error } = await supabase.functions.invoke("update-booking-bucket", {
          body: { sheet_id: sheetId, row_index: rowIndex, bucket },
        });
        if (error) {
          const ctx = (error as unknown as { context?: Response }).context;
          let detail = error.message;
          if (ctx) {
            try {
              const body = await ctx.json();
              detail = body.detail || body.error || body.message || detail;
            } catch (_) {
              /* swallow */
            }
          }
          throw new Error(detail);
        }
        toast.success(`Moved to ${bucket}`);
      } catch (e) {
        // Roll back to whatever the server last said for this row by reloading.
        toast.error(e instanceof Error ? e.message : "Failed to save bucket");
        loadRows();
      }
    },
    [sheetId, loadRows],
  );

  const totalLeads = rows.length;
  const visibleLeads = cards.length;

  return (
    <TeamLayout>
      <div className="container mx-auto px-6 py-8">
        <div className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl tracking-wide-custom text-foreground flex items-center gap-3">
              <Phone className="w-7 h-7 text-amber-500" /> Lead Pipeline
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {totalLeads
                ? `${visibleLeads} of ${totalLeads} leads · drag to move buckets`
                : "Cards flow Reach Out → Awaiting Reply → In Convo → Followup 2 → Confirmed → Done"}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-card/40">
              <Filter className="w-3.5 h-3.5 text-muted-foreground" />
              <Label htmlFor="show-done" className="text-xs text-muted-foreground cursor-pointer">
                Show Done
              </Label>
              <Switch id="show-done" checked={showDone} onCheckedChange={setShowDone} />
            </div>
            {sheetUrl && (
              <Button asChild variant="outline" size="sm">
                <a href={sheetUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Sheet
                </a>
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={loadRows} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {refreshedAt && (
          <p className="text-[11px] text-muted-foreground mb-3">
            Updated {refreshedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </p>
        )}

        {error && (
          <div className="mb-4 p-2.5 rounded text-xs bg-destructive/10 text-destructive border border-destructive/30">
            {error}
          </div>
        )}

        {!loading && totalLeads === 0 && !error ? (
          <p className="text-sm text-muted-foreground mt-8">
            No leads yet. Configure your Booking Agent sheet from the dashboard widget settings.
          </p>
        ) : (
          <ScrumBoard
            columns={BOOKING_BUCKET_COLUMNS}
            cards={cards}
            onCardMove={handleCardMove}
            renderCard={(card) => (
              <BookingPipelineCard card={card} sheetFallbackUrl={sheetUrl} />
            )}
            emptyColumnLabel="No leads"
          />
        )}
      </div>
    </TeamLayout>
  );
}
