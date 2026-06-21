import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTeamAuth } from "@/hooks/useTeamAuth";
import { useSongs } from "@/hooks/useSongs";
import {
  genres,
  functions as functionOptions,
  decades,
  ORG_OPTIONS,
  orgLabel,
  songKey,
  type Song,
  type SetlistOrg,
} from "@/lib/songFilters";
import {
  exportSongsAsTxt,
  exportSongsAsHtml,
  copySongsToClipboard,
  printSongs,
} from "@/lib/songExport";
import SetlistLoadDialog, { type SavedSetlist } from "@/components/setlist/SetlistLoadDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Search,
  Plus,
  X,
  GripVertical,
  Download,
  ChevronDown,
  Save,
  FolderOpen,
  FileDown,
  Send,
  Loader2,
  RefreshCw,
  Music,
} from "lucide-react";
import { toast } from "sonner";

type IncomingState = {
  setlistSongs?: { title: string; artist?: string }[];
  rawInput?: string;
  eventName?: string;
  eventDate?: string;
  venue?: string;
  org?: SetlistOrg;
} | null;

function SortableSetlistRow({
  song,
  index,
  onRemove,
}: {
  song: Song;
  index: number;
  onRemove: () => void;
}) {
  const id = songKey(song);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-lg border bg-card p-2.5 ${
        isDragging ? "border-primary shadow-lg" : "border-border"
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
        aria-label="Drag to reorder"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <span className="w-6 text-right text-xs text-muted-foreground tabular-nums">{index + 1}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{song.title}</p>
        <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-destructive flex-shrink-0"
        onClick={onRemove}
        aria-label="Remove from setlist"
      >
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}

const SetlistBuilder = () => {
  const { session } = useTeamAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [org, setOrg] = useState<SetlistOrg>("harborline");
  const { data: songs = [], isLoading, isError, refetch } = useSongs(org);

  const [searchTerm, setSearchTerm] = useState("");
  const [activeGenre, setActiveGenre] = useState("All");
  const [activeFunction, setActiveFunction] = useState("All");
  const [activeDecade, setActiveDecade] = useState("All");

  const [items, setItems] = useState<Song[]>([]);
  const [setlistName, setSetlistName] = useState("");
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [venue, setVenue] = useState("");
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);
  const [unmatched, setUnmatched] = useState<string[]>([]);

  const consumedState = useRef(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const itemKeys = useMemo(() => new Set(items.map(songKey)), [items]);

  const filteredSongs = useMemo(
    () =>
      songs.filter((song) => {
        const matchesSearch =
          song.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          song.artist.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesGenre = activeGenre === "All" || song.genre === activeGenre;
        const matchesFunction = activeFunction === "All" || song.functions.includes(activeFunction);
        const matchesDecade = activeDecade === "All" || song.decade === activeDecade;
        return matchesSearch && matchesGenre && matchesFunction && matchesDecade;
      }),
    [songs, searchTerm, activeGenre, activeFunction, activeDecade]
  );

  // Songs in the current setlist that aren't tagged for the selected org.
  const orphanCount = useMemo(
    () => items.filter((s) => s.org_tags && !s.org_tags.includes(org)).length,
    [items, org]
  );

  // Consume incoming router state once songs have loaded (e.g. from the
  // Run-of-Show "also build a setlist" link, which passes rawInput titles).
  useEffect(() => {
    if (consumedState.current) return;
    const s = location.state as IncomingState;
    if (!s || songs.length === 0) return;
    consumedState.current = true;

    if (s.eventName) setEventName(s.eventName);
    if (s.eventDate) setEventDate(s.eventDate);
    if (s.venue) setVenue(s.venue);
    if (s.org) setOrg(s.org);

    const titleLines = [
      ...(s.setlistSongs?.map((x) => x.title) ?? []),
      ...(s.rawInput
        ? s.rawInput
            .split("\n")
            .map((l) => l.replace(/^\s*\d+[.)]\s*/, "").trim())
            .filter(Boolean)
        : []),
    ];
    if (titleLines.length) {
      const byTitle = new Map(songs.map((sg) => [sg.title.toLowerCase(), sg]));
      const matched: Song[] = [];
      const missed: string[] = [];
      for (const line of titleLines) {
        const hit = byTitle.get(line.toLowerCase());
        if (hit && !matched.some((m) => songKey(m) === songKey(hit))) matched.push(hit);
        else if (!hit) missed.push(line);
      }
      if (matched.length) setItems(matched);
      if (missed.length) setUnmatched(missed);
    }
    // Clear the state so a refresh doesn't re-import.
    window.history.replaceState({}, "");
  }, [songs, location.state]);

  const addSong = (song: Song) => {
    if (itemKeys.has(songKey(song))) return;
    setItems((prev) => [...prev, song]);
  };

  const removeSong = (key: string) => {
    setItems((prev) => prev.filter((s) => songKey(s) !== key));
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const oldIdx = prev.findIndex((s) => songKey(s) === active.id);
      const newIdx = prev.findIndex((s) => songKey(s) === over.id);
      if (oldIdx < 0 || newIdx < 0) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
  };

  const resetBuilder = () => {
    setItems([]);
    setSetlistName("");
    setEventName("");
    setEventDate("");
    setVenue("");
    setCurrentId(null);
    setUnmatched([]);
  };

  const handleSave = async (asNew = false) => {
    if (!session?.user) {
      toast.error("You must be signed in to save");
      return;
    }
    if (!setlistName.trim()) {
      toast.error("Give the setlist a name first");
      return;
    }
    if (items.length === 0) {
      toast.error("Add some songs first");
      return;
    }
    setSaving(true);
    const payload = {
      ...(asNew || !currentId ? {} : { id: currentId }),
      name: setlistName.trim(),
      org,
      event_name: eventName.trim() || null,
      event_date: eventDate || null,
      venue: venue.trim() || null,
      song_ids: items.map((s) => s.id).filter(Boolean) as string[],
      song_snapshot: items.map((s) => ({
        title: s.title,
        artist: s.artist,
        genre: s.genre,
        functions: s.functions,
        decade: s.decade,
      })),
      created_by: session.user.id,
    };
    const { data, error } = await supabase
      .from("setlists")
      .upsert(payload)
      .select("id")
      .single();
    setSaving(false);
    if (error) {
      toast.error(`Save failed: ${error.message}`);
      return;
    }
    setCurrentId(data.id);
    toast.success(asNew || !currentId ? "Setlist saved" : "Setlist updated");
  };

  const handleLoad = (sl: SavedSetlist) => {
    setOrg(sl.org);
    setSetlistName(sl.name);
    setEventName(sl.event_name ?? "");
    setEventDate(sl.event_date ?? "");
    setVenue(sl.venue ?? "");
    setCurrentId(sl.id);
    setUnmatched([]);
    const snapshot = (Array.isArray(sl.song_snapshot) ? sl.song_snapshot : []) as Song[];
    setItems(snapshot.map((s, i) => ({ ...s, id: sl.song_ids?.[i] })));
    toast.success(`Loaded "${sl.name}"`);
  };

  const exportTitle = setlistName.trim() || "Setlist";
  const fileBase = `harborline-${(setlistName.trim() || "setlist").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

  const sendToRunOfShow = () => {
    if (items.length === 0) {
      toast.error("Add some songs first");
      return;
    }
    navigate("/team/run-of-show", {
      state: {
        setlistSongs: items.map((s) => ({ title: s.title, artist: s.artist })),
        eventName: eventName.trim() || setlistName.trim(),
        org,
      },
    });
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-display tracking-wide flex items-center gap-2">
          <Music className="w-6 h-6 text-primary" />
          Setlist Builder
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Pick an organization, search the song list, and build a setlist you can save, export, or send to a run-of-show.
        </p>
      </div>

      {/* Top controls: org + setlist name + event meta */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-5">
        <div>
          <Label className="text-xs">Organization</Label>
          <Select value={org} onValueChange={(v) => setOrg(v as SetlistOrg)}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ORG_OPTIONS.map((o) => (
                <SelectItem key={o.key} value={o.key}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Setlist name</Label>
          <Input
            className="mt-1"
            placeholder="e.g. Smith Wedding — Set 1"
            value={setlistName}
            onChange={(e) => setSetlistName(e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs">Event / client (optional)</Label>
          <Input
            className="mt-1"
            placeholder="Event name"
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Date</Label>
            <Input className="mt-1" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Venue</Label>
            <Input className="mt-1" placeholder="Venue" value={venue} onChange={(e) => setVenue(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* LEFT: song catalog */}
        <div>
          <div className="space-y-3 mb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={`Search ${orgLabel(org)} songs or artists...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {genres.map((g) => (
                <button
                  key={g}
                  onClick={() => setActiveGenre(g)}
                  className={`px-2.5 py-1 rounded-full text-xs transition-all ${
                    activeGenre === g ? "bg-secondary text-foreground" : "bg-secondary/30 text-muted-foreground hover:bg-secondary/50"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {functionOptions.map((fn) => (
                <button
                  key={fn}
                  onClick={() => setActiveFunction(fn)}
                  className={`px-2.5 py-1 rounded-full text-xs transition-all ${
                    activeFunction === fn ? "bg-primary text-primary-foreground" : "bg-primary/10 text-muted-foreground hover:bg-primary/20"
                  }`}
                >
                  {fn}
                </button>
              ))}
              {decades.map((d) => (
                <button
                  key={d}
                  onClick={() => setActiveDecade(d)}
                  className={`px-2.5 py-1 rounded-full text-xs transition-all ${
                    activeDecade === d ? "bg-accent text-accent-foreground" : "bg-accent/20 text-muted-foreground hover:bg-accent/40"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground mb-2">
            {filteredSongs.length} of {songs.length} {orgLabel(org)} songs
          </p>

          <div className="h-[460px] overflow-y-auto rounded-lg border border-border bg-card/50 p-2 space-y-1.5">
            {isLoading ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : isError ? (
              <div className="flex flex-col items-center justify-center h-full gap-2">
                <p className="text-sm text-muted-foreground">Couldn't load songs.</p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  <RefreshCw className="w-4 h-4 mr-2" /> Try again
                </Button>
              </div>
            ) : filteredSongs.length === 0 ? (
              <p className="text-center text-muted-foreground py-12 text-sm">No songs found.</p>
            ) : (
              filteredSongs.map((song) => {
                const added = itemKeys.has(songKey(song));
                return (
                  <button
                    key={songKey(song)}
                    onClick={() => addSong(song)}
                    disabled={added}
                    className={`w-full flex items-center gap-3 rounded-lg border p-2.5 text-left transition-all ${
                      added
                        ? "border-primary/30 bg-primary/5 opacity-60 cursor-default"
                        : "border-border bg-card hover:border-primary/50"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{song.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {song.artist} · {song.genre}
                      </p>
                    </div>
                    {added ? (
                      <span className="text-xs text-primary flex-shrink-0">Added</span>
                    ) : (
                      <Plus className="w-4 h-4 text-primary flex-shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT: the setlist */}
        <div>
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <p className="text-sm font-medium">
              Setlist <span className="text-muted-foreground">({items.length})</span>
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setLoadOpen(true)}>
                <FolderOpen className="w-4 h-4 mr-1.5" /> Load
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleSave(false)} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
                {currentId ? "Update" : "Save"}
              </Button>
              {currentId && (
                <Button variant="ghost" size="sm" onClick={() => handleSave(true)} disabled={saving}>
                  Save as new
                </Button>
              )}
            </div>
          </div>

          {orphanCount > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-500 mb-2">
              {orphanCount} song{orphanCount > 1 ? "s" : ""} in this setlist {orphanCount > 1 ? "aren't" : "isn't"} tagged for {orgLabel(org)}.
            </p>
          )}

          {unmatched.length > 0 && (
            <div className="mb-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs">
              <p className="font-medium mb-1">Couldn't match {unmatched.length} imported line(s):</p>
              <p className="text-muted-foreground">{unmatched.join(", ")}</p>
              <button className="text-primary mt-1" onClick={() => setUnmatched([])}>
                Dismiss
              </button>
            </div>
          )}

          <div className="h-[400px] overflow-y-auto rounded-lg border border-border bg-card/50 p-2">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-1">
                <Music className="w-6 h-6 opacity-40" />
                <p>Click songs on the left to add them.</p>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={items.map(songKey)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-1.5">
                    {items.map((song, i) => (
                      <SortableSetlistRow
                        key={songKey(song)}
                        song={song}
                        index={i}
                        onRemove={() => removeSong(songKey(song))}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>

          {/* Setlist actions */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="hero" size="sm" disabled={items.length === 0}>
                  <Download className="w-4 h-4 mr-1.5" /> Export <ChevronDown className="w-4 h-4 ml-1.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem onClick={() => printSongs(items, { title: exportTitle, grouped: false })}>
                  <FileDown className="w-4 h-4 mr-2" /> Print / Save as PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportSongsAsHtml(items, { title: exportTitle, grouped: false, fileBase })}>
                  <FileDown className="w-4 h-4 mr-2" /> Download HTML
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportSongsAsTxt(items, { title: exportTitle, grouped: false, fileBase })}>
                  <FileDown className="w-4 h-4 mr-2" /> Download TXT
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => copySongsToClipboard(items, { grouped: false })}>
                  <FileDown className="w-4 h-4 mr-2" /> Copy to Clipboard
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="outline" size="sm" onClick={sendToRunOfShow} disabled={items.length === 0}>
              <Send className="w-4 h-4 mr-1.5" /> Send to Run-of-Show
            </Button>

            {(items.length > 0 || currentId) && (
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={resetBuilder}>
                New setlist
              </Button>
            )}
          </div>
        </div>
      </div>

      <SetlistLoadDialog open={loadOpen} onOpenChange={setLoadOpen} onLoad={handleLoad} />
    </div>
  );
};

export default SetlistBuilder;
