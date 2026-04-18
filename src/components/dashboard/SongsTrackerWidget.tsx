import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Music, Plus, Check, RotateCcw, Trash2, Search } from "lucide-react";

export interface PracticeSong {
  id: string;
  title: string;
  artist: string;
  key: string;
  status: string; // learning | learned
  notes: string;
  times_practiced: number;
  last_practiced_at: string | null;
  learned_at: string | null;
}

export default function SongsTrackerWidget() {
  const [songs, setSongs] = useState<PracticeSong[]>([]);
  const [tab, setTab] = useState<"learning" | "learned" | "all">("learning");
  const [q, setQ] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newArtist, setNewArtist] = useState("");
  const [newKey, setNewKey] = useState("");

  const load = async () => {
    const { data } = await supabase
      .from("practice_songs")
      .select("*")
      .order("status", { ascending: true })
      .order("title", { ascending: true });
    setSongs((data as PracticeSong[]) || []);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("practice_songs_widget")
      .on("postgres_changes", { event: "*", schema: "public", table: "practice_songs" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const add = async () => {
    if (!newTitle.trim()) return;
    const { error } = await supabase.from("practice_songs").insert({
      title: newTitle.trim(),
      artist: newArtist.trim(),
      key: newKey.trim(),
    });
    if (error) {
      toast({ title: "Could not add song", description: error.message, variant: "destructive" });
      return;
    }
    setNewTitle("");
    setNewArtist("");
    setNewKey("");
    load();
  };

  const setStatus = async (s: PracticeSong, status: "learning" | "learned") => {
    await supabase
      .from("practice_songs")
      .update({
        status,
        learned_at: status === "learned" ? new Date().toISOString() : null,
      })
      .eq("id", s.id);
    toast({ title: status === "learned" ? "Marked Learned 🎉" : "Back to Learning" });
  };

  const remove = async (s: PracticeSong) => {
    await supabase.from("practice_songs").delete().eq("id", s.id);
  };

  const filtered = songs.filter((s) => {
    if (tab !== "all" && s.status !== tab) return false;
    if (!q) return true;
    const needle = q.toLowerCase();
    return (
      s.title.toLowerCase().includes(needle) ||
      s.artist.toLowerCase().includes(needle) ||
      s.key.toLowerCase().includes(needle)
    );
  });

  const learningCount = songs.filter((s) => s.status === "learning").length;
  const learnedCount = songs.filter((s) => s.status === "learned").length;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Music className="w-4 h-4 text-primary" /> Songs Tracker
          <Badge variant="secondary" className="ml-auto text-xs">
            {learningCount} learning · {learnedCount} learned
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Add */}
        <div className="flex gap-1 flex-wrap">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Song title"
            className="h-8 text-xs flex-1 min-w-[140px]"
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <Input
            value={newArtist}
            onChange={(e) => setNewArtist(e.target.value)}
            placeholder="Artist"
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
        <div className="flex items-center gap-2">
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList className="h-8">
              <TabsTrigger value="learning" className="text-xs h-6">Learning ({learningCount})</TabsTrigger>
              <TabsTrigger value="learned" className="text-xs h-6">Learned ({learnedCount})</TabsTrigger>
              <TabsTrigger value="all" className="text-xs h-6">All</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2 w-3 h-3 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search…"
              className="h-8 text-xs pl-7"
            />
          </div>
        </div>

        {/* List */}
        <div className="space-y-1 max-h-[360px] overflow-y-auto pr-1">
          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">No songs here yet.</p>
          )}
          {filtered.map((s) => (
            <div
              key={s.id}
              className={`flex items-center gap-2 rounded-md border p-2 text-sm ${
                s.status === "learned" ? "bg-green-500/5 border-green-500/30" : "bg-card"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium truncate">{s.title}</span>
                  {s.artist && <span className="text-xs text-muted-foreground truncate">— {s.artist}</span>}
                  {s.key && (
                    <Badge variant="outline" className="text-[10px] h-4 px-1">{s.key}</Badge>
                  )}
                  {s.times_practiced > 0 && (
                    <span className="text-[10px] text-muted-foreground">×{s.times_practiced}</span>
                  )}
                </div>
              </div>
              {s.status === "learning" ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs gap-1 text-green-500 hover:text-green-400"
                  onClick={() => setStatus(s, "learned")}
                >
                  <Check className="w-3 h-3" /> Learned
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs gap-1"
                  onClick={() => setStatus(s, "learning")}
                >
                  <RotateCcw className="w-3 h-3" /> Re-learn
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-muted-foreground hover:text-destructive"
                onClick={() => remove(s)}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
