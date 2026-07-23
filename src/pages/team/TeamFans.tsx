import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import TeamLayout from "@/components/TeamLayout";
import { HeartHandshake, RefreshCw, Mail, MessageCircle, Users, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// Fans — where smart-link signups land (Josh 7/22). Every row here also
// auto-flowed into /team/contacts (source 'fan-signup', tagged 'fan') via DB
// trigger; this page is the release-centric view: who signed up, from which
// link, text vs email. Fans are deliberately NOT pushed to the JJMM sheet —
// that's Josh's personal network; this list is the owned audience.

type FanRow = {
  id: string;
  slug: string;
  contact_type: "phone" | "email";
  contact_value: string;
  contact_id: string | null;
  created_at: string;
};

export default function TeamFans() {
  const [rows, setRows] = useState<FanRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [slugFilter, setSlugFilter] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as unknown as { from: (t: string) => any })
      .from("fan_signups")
      .select("id, slug, contact_type, contact_value, contact_id, created_at")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data ?? []) as FanRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const slugs = useMemo(() => Array.from(new Set(rows.map((r) => r.slug))).sort(), [rows]);
  const visible = useMemo(
    () => (slugFilter === "all" ? rows : rows.filter((r) => r.slug === slugFilter)),
    [rows, slugFilter],
  );
  const phones = useMemo(() => rows.filter((r) => r.contact_type === "phone").length, [rows]);
  const emails = rows.length - phones;

  const exportCsv = useCallback(() => {
    // contact_value is fan-supplied: double quotes per RFC 4180 and prefix
    // formula-leading chars (=+-@) so Excel never executes a "signup".
    const esc = (s: string) =>
      `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
    const lines = ["slug,type,contact,signed_up"];
    visible.forEach((r) =>
      lines.push(`${r.slug},${r.contact_type},${esc(r.contact_value)},${r.created_at}`));
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `fans-${slugFilter === "all" ? "all" : slugFilter}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [visible, slugFilter]);

  return (
    <TeamLayout>
      <div className="container mx-auto px-6 py-8">
        <div className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl tracking-wide-custom text-foreground flex items-center gap-3">
              <HeartHandshake className="w-7 h-7 text-primary" /> Fans
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {rows.length} signups from smart links · {phones} text · {emails} email · every fan
              is also in{" "}
              <Link to="/team/contacts" className="underline hover:text-foreground">Contacts</Link>{" "}
              tagged <span className="font-mono text-xs">fan</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={visible.length === 0}>
              Export CSV
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
        </div>

        {slugs.length > 1 && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSlugFilter("all")}
              className={`text-xs px-2.5 py-1.5 rounded border ${slugFilter === "all" ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/40"}`}
            >
              All ({rows.length})
            </button>
            {slugs.map((s) => (
              <button
                key={s}
                onClick={() => setSlugFilter(s)}
                className={`text-xs px-2.5 py-1.5 rounded border ${slugFilter === s ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/40"}`}
              >
                {s} ({rows.filter((r) => r.slug === s).length})
              </button>
            ))}
          </div>
        )}

        <div className="rounded-lg border border-border bg-card/40 divide-y divide-border/50">
          {visible.map((r) => (
            <div key={r.id} className="px-3 py-2 flex items-center gap-3">
              {r.contact_type === "phone"
                ? <MessageCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                : <Mail className="w-4 h-4 text-sky-400 shrink-0" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground truncate">
                  {r.contact_type === "phone"
                    ? <a href={`sms:${r.contact_value}`} className="hover:underline">{r.contact_value}</a>
                    : <a href={`mailto:${r.contact_value}`} className="hover:underline">{r.contact_value}</a>}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(r.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </p>
              </div>
              <Badge variant="outline" className="text-[10px] shrink-0">{r.slug}</Badge>
              <Link
                to={`/team/contacts?q=${encodeURIComponent(r.contact_value)}`}
                className="text-muted-foreground hover:text-foreground shrink-0"
                title="View in Contacts"
              >
                <Users className="w-4 h-4" />
              </Link>
              <a
                href={`/l/${r.slug}`}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-foreground shrink-0"
                title="Open the smart link"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          ))}
          {!loading && visible.length === 0 && (
            <p className="px-3 py-10 text-center text-sm text-muted-foreground">
              No signups yet. The capture block is live on every smart link — when someone drops
              a number or email on gethip.to, they land here.
            </p>
          )}
        </div>
      </div>
    </TeamLayout>
  );
}
