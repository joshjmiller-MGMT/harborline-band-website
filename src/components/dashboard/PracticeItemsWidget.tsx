import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Library, Plus, Trash2, Search, TrendingUp, Sparkles } from "lucide-react";
import {
  COLOR_SCALE,
  KIND_LABELS,
  KIND_OPTIONS,
  type PracticeItem,
  type PracticeItemKind,
  colorSpec,
  daysSincePracticed,
  recommendItems,
  recommendationScore,
} from "@/lib/practice-mastery";

type KindFilter = "all" | PracticeItemKind;

function relativeAge(item: Pick<PracticeItem, "last_practiced_at">) {
  if (!item.last_practiced_at) return "never";
  const d = daysSincePracticed(item);
  if (d < 1) return "today";
  if (d < 2) return "1d ago";
  if (d < 7) return `${Math.round(d)}d ago`;
  if (d < 30) return `${Math.round(d / 7)}w ago`;
  if (d < 365) return `${Math.round(d / 30)}mo ago`;
  return `${Math.round(d / 365)}y ago`;
}

export default function PracticeItemsWidget() {
  const [items, setItems] = useState<PracticeItem[]>([]);
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [colorFilter, setColorFilter] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newArtist, setNewArtist] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newKind, setNewKind] = useState<PracticeItemKind>("song");

  const load = async () => {
    const { data } = await supabase
      .from("practice_items")
      .select("*")
      .is("archived_at", null)
      .order("color_level", { ascending: true })
      .order("last_practiced_at", { ascending: true, nullsFirst: true });
    setItems((data as PracticeItem[]) || []);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("practice_items_widget")
      .on("postgres_changes", { event: "*", schema: "public", table: "practice_items" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const add = async () => {
    if (!newTitle.trim()) return;
    const { error } = await supabase.from("practice_items").insert({
      title: newTitle.trim(),
      artist: newArtist.trim(),
      key: newKey.trim(),
      kind: newKind,
    });
    if (error) {
      toast({ title: "Could not add item", description: error.message, variant: "destructive" });
      return;
    }
    setNewTitle("");
    setNewArtist("");
    setNewKey("");
    load();
  };

  const setColor = async (it: PracticeItem, level: number) => {
    if (level === it.color_level) return;
    const { error } = await supabase
      .from("practice_items")
      .update({ color_level: level, color_level_updated_at: new Date().toISOString() })
      .eq("id", it.id);
    if (error) {
      toast({ title: "Couldn't update color", description: error.message, variant: "destructive" });
      return;
    }
    const spec = colorSpec(level);
    toast({ title: `${spec.name} — ${spec.meaning}` });
  };

  const remove = async (it: PracticeItem) => {
    await supabase
      .from("practice_items")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", it.id);
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((it) => {
      if (kindFilter !== "all" && it.kind !== kindFilter) return false;
      if (colorFilter !== null && it.color_level !== colorFilter) return false;
      if (!needle) return true;
      return (
        it.title.toLowerCase().includes(needle) ||
        it.artist.toLowerCase().includes(needle) ||
        it.key.toLowerCase().includes(needle) ||
        it.notes.toLowerCase().includes(needle)
      );
    });
  }, [items, kindFilter, colorFilter, q]);

  const todaysPull = useMemo(() => recommendItems(items, { count: 3 }), [items]);
  const colorCounts = useMemo(() => {
    const c = new Array(7).fill(0) as number[];
    items.forEach((it) => {
      const lvl = Math.max(0, Math.min(6, it.color_level));
      c[lvl] += 1;
    });
    return c;
  }, [items]);

  const kindCounts = useMemo(() => {
    const c: Record<string, number> = {};
    items.forEach((it) => {
      c[it.kind] = (c[it.kind] || 0) + 1;
    });
    return c;
  }, [items]);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Library className="w-4 h-4 text-primary" /> Practice Library
          <Badge variant="secondary" className="ml-auto text-xs">
            {items.length} items
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Today's pull */}
        {todaysPull.length > 0 && (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>Today's pull — what to practice first</span>
              <span className="text-muted-foreground font-normal">(weighted by color × time-since-practice)</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {todaysPull.map((it) => {
                const spec = colorSpec(it.color_level);
                return (
                  <div
                    key={it.id}
                    className={`rounded border bg-card p-2 flex items-start gap-2 ${spec.borderTint}`}
                  >
                    <div className={`w-2 h-full min-h-[28px] rounded-sm ${spec.swatchBg} flex-shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{it.title}</div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1 flex-wrap">
                        <span>{KIND_LABELS[it.kind as PracticeItemKind] ?? it.kind}</span>
                        {it.artist && <span>· {it.artist}</span>}
                        <span>· {relativeAge(it)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Add */}
        <div className="flex gap-1 flex-wrap">
          <Select value={newKind} onValueChange={(v) => setNewKind(v as PracticeItemKind)}>
            <SelectTrigger className="h-8 w-[110px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KIND_OPTIONS.map((k) => (
                <SelectItem key={k} value={k} className="text-xs">
                  {KIND_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Title"
            className="h-8 text-xs flex-1 min-w-[140px]"
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <Input
            value={newArtist}
            onChange={(e) => setNewArtist(e.target.value)}
            placeholder={newKind === "song" ? "Artist" : "Source"}
            className="h-8 text-xs flex-1 min-w-[100px]"
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <Input
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="Key"
            className="h-8 text-xs w-16"
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <Button size="sm" onClick={add} className="h-8 gap-1 text-xs">
            <Plus className="w-3 h-3" /> Add
          </Button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <Tabs value={kindFilter} onValueChange={(v) => setKindFilter(v as KindFilter)}>
            <TabsList className="h-8 flex-wrap">
              <TabsTrigger value="all" className="text-xs h-6">
                All ({items.length})
              </TabsTrigger>
              {KIND_OPTIONS.filter((k) => (kindCounts[k] ?? 0) > 0).map((k) => (
                <TabsTrigger key={k} value={k} className="text-xs h-6">
                  {KIND_LABELS[k]} ({kindCounts[k]})
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="relative flex-1 min-w-[140px]">
            <Search className="absolute left-2 top-2 w-3 h-3 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search…"
              className="h-8 text-xs pl-7"
            />
          </div>
        </div>

        {/* Color filter row */}
        <div className="flex items-center gap-1 flex-wrap text-xs">
          <TrendingUp className="w-3 h-3 text-muted-foreground" />
          <button
            type="button"
            onClick={() => setColorFilter(null)}
            className={`px-2 h-6 rounded-full border text-[10px] ${
              colorFilter === null ? "border-primary bg-primary/10" : "border-border bg-card"
            }`}
          >
            any color
          </button>
          {COLOR_SCALE.map((c) => (
            <button
              key={c.level}
              type="button"
              onClick={() => setColorFilter(colorFilter === c.level ? null : c.level)}
              title={`${c.name} — ${c.meaning}`}
              className={`px-2 h-6 rounded-full border text-[10px] flex items-center gap-1 ${
                colorFilter === c.level ? "border-foreground" : "border-border"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${c.swatchBg}`} />
              {c.name} ({colorCounts[c.level]})
            </button>
          ))}
        </div>

        {/* List */}
        <div className="space-y-1 max-h-[420px] overflow-y-auto pr-1">
          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">No items match.</p>
          )}
          {filtered.map((it) => {
            const spec = colorSpec(it.color_level);
            return (
              <div
                key={it.id}
                className={`flex items-stretch gap-2 rounded-md border p-2 text-sm bg-card ${spec.borderTint}`}
              >
                <div className={`w-1.5 rounded-sm ${spec.swatchBg} flex-shrink-0`} />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{it.title}</span>
                    {it.artist && (
                      <span className="text-xs text-muted-foreground truncate">— {it.artist}</span>
                    )}
                    {it.key && <Badge variant="outline" className="text-[10px] h-4 px-1">{it.key}</Badge>}
                    <Badge variant="secondary" className="text-[10px] h-4 px-1">
                      {KIND_LABELS[it.kind as PracticeItemKind] ?? it.kind}
                    </Badge>
                    {it.times_practiced > 0 && (
                      <span className="text-[10px] text-muted-foreground">×{it.times_practiced}</span>
                    )}
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {relativeAge(it)} · score {Math.round(recommendationScore(it))}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {COLOR_SCALE.map((c) => (
                      <button
                        key={c.level}
                        type="button"
                        title={`${c.name} — ${c.meaning}`}
                        onClick={() => setColor(it, c.level)}
                        className={`w-5 h-5 rounded-full ${c.swatchBg} transition-all ${
                          it.color_level === c.level
                            ? `ring-2 ring-offset-1 ring-offset-card ${c.swatchRing}`
                            : "opacity-40 hover:opacity-100"
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-muted-foreground hover:text-destructive self-start"
                  onClick={() => remove(it)}
                  title="Archive (soft-delete)"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
