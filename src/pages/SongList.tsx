import { useState } from "react";
import Layout from "@/components/Layout";
import PageHero from "@/components/PageHero";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Check, Download, X, FileText, File, Copy, ChevronDown, Loader2, RefreshCw } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { genres, functions, decades, songKey, type Song } from "@/lib/songFilters";
import { exportSongsAsTxt, exportSongsAsHtml, copySongsToClipboard, printSongs } from "@/lib/songExport";
import { useSongs } from "@/hooks/useSongs";

const SongListPage = ({ embedded = false }: { embedded?: boolean }) => {
  const { data: songs = [], isLoading, isError, refetch } = useSongs();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeGenre, setActiveGenre] = useState("All");
  const [activeFunction, setActiveFunction] = useState("All");
  const [activeDecade, setActiveDecade] = useState("All");
  const [selectedSongs, setSelectedSongs] = useState<Set<string>>(new Set());

  const filteredSongs = songs.filter((song) => {
    const matchesSearch =
      song.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      song.artist.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGenre = activeGenre === "All" || song.genre === activeGenre;
    const matchesFunction = activeFunction === "All" || song.functions.includes(activeFunction);
    const matchesDecade = activeDecade === "All" || song.decade === activeDecade;
    return matchesSearch && matchesGenre && matchesFunction && matchesDecade;
  });

  const toggleSong = (song: Song) => {
    const key = songKey(song);
    setSelectedSongs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(key)) newSet.delete(key);
      else newSet.add(key);
      return newSet;
    });
  };

  const clearSelection = () => setSelectedSongs(new Set());

  const getSelectedSongsList = () =>
    songs.filter((song) => selectedSongs.has(songKey(song)));

  const exportTxt = () =>
    exportSongsAsTxt(getSelectedSongsList(), { grouped: true });
  const exportHtml = () =>
    exportSongsAsHtml(getSelectedSongsList(), { grouped: true });
  const copyList = () => {
    const selected = getSelectedSongsList();
    copySongsToClipboard(selected.length > 0 ? selected : filteredSongs, { grouped: true });
  };
  const printSelected = () => printSongs(getSelectedSongsList(), { grouped: true });

  const content = (
    <>
      {!embedded && (
        <PageHero
          eyebrow="REPERTOIRE"
          title="OUR SONG LIST"
          subtitle="From Motown classics to today's hits—we've got your soundtrack covered"
        />
      )}

      <section className="py-8 md:py-12">
        <div className="container px-6 max-w-4xl mx-auto">
          {/* Search and Filter */}
          <div className="mb-8 space-y-4">
            <div className="relative max-w-md mx-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Search songs or artists..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-card border-border"
              />
            </div>

            {/* Genre Filter */}
            <div className="flex flex-wrap justify-center gap-2">
              {genres.map((genre) => (
                <button
                  key={genre}
                  onClick={() => setActiveGenre(genre)}
                  className={`px-4 py-2 rounded-full text-sm font-display tracking-wide transition-all ${
                    activeGenre === genre
                      ? "bg-secondary text-foreground"
                      : "bg-secondary/30 text-muted-foreground hover:bg-secondary/50"
                  }`}
                >
                  {genre}
                </button>
              ))}
            </div>

            {/* Function Filter */}
            <div className="flex flex-wrap justify-center gap-2">
              {functions.map((fn) => (
                <button
                  key={fn}
                  onClick={() => setActiveFunction(fn)}
                  className={`px-4 py-2 rounded-full text-sm font-display tracking-wide transition-all ${
                    activeFunction === fn
                      ? "bg-primary text-primary-foreground"
                      : "bg-primary/10 text-muted-foreground hover:bg-primary/20"
                  }`}
                >
                  {fn}
                </button>
              ))}
            </div>

            {/* Decade Filter */}
            <div className="flex flex-wrap justify-center gap-2">
              {decades.map((decade) => (
                <button
                  key={decade}
                  onClick={() => setActiveDecade(decade)}
                  className={`px-4 py-2 rounded-full text-sm font-display tracking-wide transition-all ${
                    activeDecade === decade
                      ? "bg-accent text-accent-foreground"
                      : "bg-accent/20 text-muted-foreground hover:bg-accent/40"
                  }`}
                >
                  {decade}
                </button>
              ))}
            </div>
          </div>

          {/* Sticky Export Bar */}
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm py-4 border-b border-border mb-4">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-4">
                <p className="text-muted-foreground text-sm">
                  {filteredSongs.length} of {songs.length} songs
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const allFilteredKeys = filteredSongs.map(songKey);
                    const allSelected = allFilteredKeys.every((k) => selectedSongs.has(k));
                    setSelectedSongs((prev) => {
                      const newSet = new Set(prev);
                      if (allSelected) allFilteredKeys.forEach((k) => newSet.delete(k));
                      else allFilteredKeys.forEach((k) => newSet.add(k));
                      return newSet;
                    });
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                  disabled={filteredSongs.length === 0}
                >
                  <Check className="w-3.5 h-3.5 mr-1" />
                  {filteredSongs.length > 0 && filteredSongs.every((s) => selectedSongs.has(songKey(s)))
                    ? "Deselect All"
                    : "Select All"}
                </Button>
              </div>

              {selectedSongs.size > 0 ? (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-primary font-medium">
                    {selectedSongs.size} selected
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSelection}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Clear
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="hero" size="sm">
                        <Download className="w-4 h-4 mr-2" />
                        Export
                        <ChevronDown className="w-4 h-4 ml-2" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={printSelected}>
                        <File className="w-4 h-4 mr-2" />
                        Print / Save as PDF
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={exportHtml}>
                        <FileText className="w-4 h-4 mr-2" />
                        Download HTML
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={exportTxt}>
                        <FileText className="w-4 h-4 mr-2" />
                        Download TXT
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={copyList}>
                        <Copy className="w-4 h-4 mr-2" />
                        Copy to Clipboard
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">
                  Select songs to export your list
                </span>
              )}
            </div>
          </div>

          {/* Scrollable Song List Container */}
          <div className="h-[500px] overflow-y-auto rounded-lg border border-border bg-card/50 p-4">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin" />
                <p className="text-sm">Loading song list…</p>
              </div>
            ) : isError ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <p className="text-muted-foreground text-sm">Couldn't load the song list.</p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try again
                </Button>
              </div>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                {filteredSongs.map((song, index) => {
                  const isSelected = selectedSongs.has(songKey(song));
                  return (
                    <motion.div
                      key={songKey(song)}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: Math.min(index * 0.01, 0.5) }}
                      onClick={() => toggleSong(song)}
                      className={`flex items-center gap-4 p-4 rounded-lg cursor-pointer transition-all ${
                        isSelected
                          ? "bg-primary/10 border-2 border-primary"
                          : "bg-card border border-border hover:border-primary/50"
                      }`}
                    >
                      {/* Selection Indicator */}
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "border-2 border-muted-foreground/30"
                        }`}
                      >
                        {isSelected && <Check className="w-4 h-4" />}
                      </div>

                      {/* Song Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-display text-base truncate">{song.title}</h3>
                        <p className="text-sm text-muted-foreground truncate">{song.artist}</p>
                      </div>

                      {/* Tags */}
                      <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end max-w-[280px]">
                        <span className="text-xs px-2.5 py-1 bg-primary/15 text-primary rounded-full font-medium">
                          {song.genre}
                        </span>
                        {song.functions.map((fn) => (
                          <span key={fn} className="text-xs px-2.5 py-1 bg-secondary/50 text-muted-foreground rounded-full">
                            {fn}
                          </span>
                        ))}
                      </div>
                    </motion.div>
                  );
                })}

                {filteredSongs.length === 0 && (
                  <p className="text-center text-muted-foreground py-12">
                    No songs found. Try a different search or filter.
                  </p>
                )}
              </motion.div>
            )}
          </div>

          {/* Request Song CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-8 text-center p-6 bg-card border border-border rounded-lg"
          >
            <h3 className="font-display text-xl mb-2">DON'T SEE YOUR SONG?</h3>
            <p className="text-muted-foreground text-sm mb-4">
              We learn new songs for our clients all the time. Let us know what you'd like to hear!
            </p>
            <a
              href="/request-a-quote"
              className="inline-flex items-center gap-2 text-primary hover:text-primary/80 font-display tracking-wide transition-colors"
            >
              Request a Song →
            </a>
          </motion.div>
        </div>
      </section>
    </>
  );

  if (embedded) return content;

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://harborlineband.com/" },
      { "@type": "ListItem", "position": 2, "name": "Song List", "item": "https://harborlineband.com/songs" }
    ]
  };

  return (
    <Layout
      title="Song List & Repertoire | Harborline Baltimore Band"
      description="Browse Harborline's extensive song list featuring Motown, Top 40, rock classics, jazz standards, and more. Request your favorite songs for your event."
      canonical="https://harborlineband.com/songs"
    >
      <script type="application/ld+json">
        {JSON.stringify(breadcrumbSchema)}
      </script>
      {content}
    </Layout>
  );
};

export default SongListPage;
