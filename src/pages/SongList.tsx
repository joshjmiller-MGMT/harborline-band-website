import { useState } from "react";
import Layout from "@/components/Layout";
import PageHero from "@/components/PageHero";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Check, X, Copy } from "lucide-react";
import { toast } from "sonner";

const genres = [
  "All",
  "Funk & Disco",
  "Pop & Top 40",
  "R&B & Soul",
  "Rock & Alternative",
  "Electronic & Dance",
  "Reggae",
];

const functions = [
  "All",
  "Cocktail",
  "Ceremony",
  "Reception",
  "Party",
  "Dinner",
  "First Dance",
  "Holiday",
];

type Song = {
  title: string;
  artist: string;
  genre: string;
  functions: string[];
};

const songs: Song[] = [
  // FUNK & DISCO
  { title: "September", artist: "Earth, Wind & Fire", genre: "Funk & Disco", functions: ["Reception", "Party"] },
  { title: "Superstition", artist: "Stevie Wonder", genre: "Funk & Disco", functions: ["Reception", "Party"] },
  { title: "Dancing Queen", artist: "ABBA", genre: "Funk & Disco", functions: ["Reception", "Party"] },
  { title: "I Wish", artist: "Stevie Wonder", genre: "Funk & Disco", functions: ["Reception", "Party"] },
  { title: "Brick House", artist: "The Commodores", genre: "Funk & Disco", functions: ["Reception", "Party"] },
  { title: "Disco Inferno", artist: "The Trammps", genre: "Funk & Disco", functions: ["Reception", "Party"] },
  { title: "Higher Ground", artist: "Stevie Wonder", genre: "Funk & Disco", functions: ["Reception", "Party"] },
  { title: "Boogie Shoes", artist: "KC & The Sunshine Band", genre: "Funk & Disco", functions: ["Reception", "Party"] },
  { title: "That's the Way (I Like It)", artist: "KC & The Sunshine Band", genre: "Funk & Disco", functions: ["Reception", "Party"] },
  { title: "Get Up Offa That Thing", artist: "James Brown", genre: "Funk & Disco", functions: ["Reception", "Party"] },
  { title: "Papa's Got a Brand New Bag", artist: "James Brown", genre: "Funk & Disco", functions: ["Reception", "Party"] },
  { title: "Canned Heat", artist: "Jamiroquai", genre: "Funk & Disco", functions: ["Reception", "Party", "Cocktail"] },
  { title: "Cosmic Girl", artist: "Jamiroquai", genre: "Funk & Disco", functions: ["Reception", "Party"] },
  { title: "Do It", artist: "Tuxedo", genre: "Funk & Disco", functions: ["Reception", "Party", "Cocktail"] },
  { title: "Jump On It (Apache)", artist: "Sugarhill Gang", genre: "Funk & Disco", functions: ["Reception", "Party"] },
  { title: "Give It to Me Baby", artist: "Rick James", genre: "Funk & Disco", functions: ["Reception", "Party"] },
  { title: "Gimme! Gimme! Gimme! (A Man After Midnight)", artist: "ABBA", genre: "Funk & Disco", functions: ["Reception", "Party"] },
  { title: "Papa Don't Take No Mess", artist: "James Brown", genre: "Funk & Disco", functions: ["Reception", "Party"] },

  // POP & TOP 40
  { title: "Blinding Lights", artist: "The Weeknd", genre: "Pop & Top 40", functions: ["Reception", "Party"] },
  { title: "Levitating", artist: "Dua Lipa", genre: "Pop & Top 40", functions: ["Reception", "Party"] },
  { title: "Dance the Night", artist: "Dua Lipa", genre: "Pop & Top 40", functions: ["Reception", "Party"] },
  { title: "Break My Soul", artist: "Beyoncé", genre: "Pop & Top 40", functions: ["Reception", "Party"] },
  { title: "Unwritten", artist: "Natasha Bedingfield", genre: "Pop & Top 40", functions: ["Reception", "Party", "Ceremony"] },
  { title: "Fireball", artist: "Pitbull", genre: "Pop & Top 40", functions: ["Reception", "Party"] },
  { title: "Give Me Everything", artist: "Pitbull", genre: "Pop & Top 40", functions: ["Reception", "Party"] },
  { title: "Starships", artist: "Nicki Minaj", genre: "Pop & Top 40", functions: ["Reception", "Party"] },
  { title: "360", artist: "Charli XCX", genre: "Pop & Top 40", functions: ["Reception", "Party"] },
  { title: "Lil Boo Thang", artist: "Paul Russell", genre: "Pop & Top 40", functions: ["Reception", "Party", "Cocktail"] },
  { title: "Low", artist: "Flo Rida", genre: "Pop & Top 40", functions: ["Reception", "Party"] },
  { title: "Everybody Wants to Rule the World", artist: "Tears for Fears", genre: "Pop & Top 40", functions: ["Cocktail", "Dinner"] },
  { title: "Somebody That I Used to Know", artist: "Gotye ft. Kimbra", genre: "Pop & Top 40", functions: ["Cocktail", "Dinner"] },
  { title: "Attention", artist: "Charlie Puth", genre: "Pop & Top 40", functions: ["Reception", "Party", "Cocktail"] },
  { title: "Positions", artist: "Ariana Grande", genre: "Pop & Top 40", functions: ["Cocktail", "Reception"] },
  { title: "We Can't Be Friends (Wait for Your Love)", artist: "Ariana Grande", genre: "Pop & Top 40", functions: ["Cocktail", "Dinner"] },
  { title: "Out of Time", artist: "The Weeknd", genre: "Pop & Top 40", functions: ["Cocktail", "Dinner"] },
  { title: "Pink Pony Club", artist: "Chappell Roan", genre: "Pop & Top 40", functions: ["Reception", "Party"] },

  // R&B & SOUL
  { title: "Signed, Sealed, Delivered", artist: "Stevie Wonder", genre: "R&B & Soul", functions: ["Reception", "Party", "Ceremony"] },
  { title: "Crazy in Love", artist: "Beyoncé", genre: "R&B & Soul", functions: ["Reception", "Party", "First Dance"] },
  { title: "Never Too Much", artist: "Luther Vandross", genre: "R&B & Soul", functions: ["Reception", "Party", "First Dance"] },
  { title: "Mistletoe Jam", artist: "Luther Vandross", genre: "R&B & Soul", functions: ["Holiday", "Party", "Reception"] },
  { title: "Best of My Love", artist: "The Emotions", genre: "R&B & Soul", functions: ["Reception", "Party"] },
  { title: "Move On Up", artist: "Curtis Mayfield", genre: "R&B & Soul", functions: ["Reception", "Party", "Cocktail"] },
  { title: "My Prerogative", artist: "Bobby Brown", genre: "R&B & Soul", functions: ["Reception", "Party"] },
  { title: "Hydra", artist: "Grover Washington Jr.", genre: "R&B & Soul", functions: ["Cocktail", "Dinner"] },
  { title: "Let's Stay Together", artist: "Al Green", genre: "R&B & Soul", functions: ["First Dance", "Ceremony", "Dinner", "Cocktail"] },
  { title: "What You Won't Do for Love", artist: "Bobby Caldwell", genre: "R&B & Soul", functions: ["Cocktail", "Dinner", "First Dance"] },
  { title: "Ain't No Sunshine", artist: "Bill Withers", genre: "R&B & Soul", functions: ["Cocktail", "Dinner", "Ceremony"] },
  { title: "Valerie", artist: "Amy Winehouse", genre: "R&B & Soul", functions: ["Cocktail", "Reception"] },
  { title: "Can't Hide Love", artist: "Earth, Wind & Fire", genre: "R&B & Soul", functions: ["Cocktail", "Dinner", "Reception"] },
  { title: "Everybody Loves the Sunshine", artist: "Roy Ayers", genre: "R&B & Soul", functions: ["Cocktail", "Dinner"] },
  { title: "You Know I'm No Good", artist: "Amy Winehouse", genre: "R&B & Soul", functions: ["Cocktail", "Dinner"] },
  { title: "Know You Now", artist: "Amy Winehouse", genre: "R&B & Soul", functions: ["Cocktail", "Dinner"] },
  { title: "Drunk in Love", artist: "Beyoncé", genre: "R&B & Soul", functions: ["Reception", "Party"] },
  { title: "End of the Road", artist: "Boyz II Men", genre: "R&B & Soul", functions: ["Ceremony", "First Dance"] },
  { title: "Spanish Joint", artist: "D'Angelo", genre: "R&B & Soul", functions: ["Cocktail", "Dinner"] },
  { title: "Feel Like Makin' Love", artist: "D'Angelo", genre: "R&B & Soul", functions: ["Cocktail", "Dinner", "First Dance"] },
  { title: "Pony", artist: "Ginuwine", genre: "R&B & Soul", functions: ["Reception", "Party"] },
  { title: "Carried Away", artist: "H.E.R.", genre: "R&B & Soul", functions: ["Cocktail", "Dinner", "First Dance"] },
  { title: "I Keep Forgettin'", artist: "Michael McDonald", genre: "R&B & Soul", functions: ["Cocktail", "Dinner"] },
  { title: "Pretty Brown Eyes", artist: "Mint Condition", genre: "R&B & Soul", functions: ["Cocktail", "Reception", "First Dance"] },
  { title: "Nothing Can Come Between Us", artist: "Sade", genre: "R&B & Soul", functions: ["Cocktail", "Dinner", "First Dance"] },
  { title: "Kiss of Life", artist: "Sade", genre: "R&B & Soul", functions: ["Cocktail", "Dinner"] },
  { title: "Can We Talk", artist: "Tevin Campbell", genre: "R&B & Soul", functions: ["Cocktail", "Reception"] },
  { title: "Lose Control", artist: "Teddy Swims", genre: "R&B & Soul", functions: ["Reception", "Party"] },

  // ROCK & ALTERNATIVE
  { title: "Message in a Bottle", artist: "The Police", genre: "Rock & Alternative", functions: ["Reception", "Party"] },
  { title: "Roxanne", artist: "The Police", genre: "Rock & Alternative", functions: ["Reception", "Party"] },
  { title: "Money for Nothing", artist: "Dire Straits", genre: "Rock & Alternative", functions: ["Cocktail", "Reception"] },
  { title: "Another Brick in the Wall (Part 2)", artist: "Pink Floyd", genre: "Rock & Alternative", functions: ["Reception", "Party"] },
  { title: "What a Fool Believes", artist: "The Doobie Brothers", genre: "Rock & Alternative", functions: ["Cocktail", "Dinner", "Reception"] },
  { title: "Give Me One Reason", artist: "Tracy Chapman", genre: "Rock & Alternative", functions: ["Cocktail", "Reception"] },
  { title: "Georgy Porgy", artist: "Toto", genre: "Rock & Alternative", functions: ["Cocktail", "Dinner"] },
  { title: "Home at Last", artist: "Steely Dan", genre: "Rock & Alternative", functions: ["Cocktail", "Dinner"] },
  { title: "Glamour Profession", artist: "Steely Dan", genre: "Rock & Alternative", functions: ["Cocktail", "Dinner"] },
  { title: "Minute by Minute", artist: "The Doobie Brothers", genre: "Rock & Alternative", functions: ["Cocktail", "Dinner"] },
  { title: "Reminiscing", artist: "Little River Band", genre: "Rock & Alternative", functions: ["Cocktail", "Dinner", "Reception"] },

  // ELECTRONIC & DANCE
  { title: "Murder on the Dance Floor", artist: "Sophie Ellis-Bextor", genre: "Electronic & Dance", functions: ["Reception", "Party"] },
  { title: "Latch", artist: "Disclosure ft. Sam Smith", genre: "Electronic & Dance", functions: ["Reception", "Party"] },
  { title: "Everytime We Touch", artist: "Cascada", genre: "Electronic & Dance", functions: ["Reception", "Party"] },
  { title: "Move Your Feet", artist: "Junior Senior", genre: "Electronic & Dance", functions: ["Reception", "Party"] },
  { title: "Heads Will Roll (A-Trak Remix)", artist: "Yeah Yeah Yeahs", genre: "Electronic & Dance", functions: ["Reception", "Party"] },
  { title: "Remedy", artist: "Zedd", genre: "Electronic & Dance", functions: ["Reception", "Party"] },
  { title: "Middle", artist: "Zedd", genre: "Electronic & Dance", functions: ["Reception", "Party", "Cocktail"] },
  { title: "Stay", artist: "Zedd", genre: "Electronic & Dance", functions: ["Reception", "Party"] },

  // REGGAE
  { title: "Could You Be Loved", artist: "Bob Marley", genre: "Reggae", functions: ["Cocktail", "Reception", "Party"] },

  // ADDITIONAL
  { title: "Eyes Without a Face", artist: "Billy Idol", genre: "Rock & Alternative", functions: ["Cocktail", "Dinner"] },
  { title: "I Will Survive", artist: "Cake", genre: "Rock & Alternative", functions: ["Reception", "Party"] },
  { title: "Short Skirt/Long Jacket", artist: "Cake", genre: "Rock & Alternative", functions: ["Cocktail", "Reception"] },
  { title: "The Distance", artist: "Cake", genre: "Rock & Alternative", functions: ["Reception", "Party"] },
  { title: "Closer", artist: "The Chainsmokers", genre: "Electronic & Dance", functions: ["Reception", "Party"] },
  { title: "Crazy", artist: "Gnarls Barkley", genre: "R&B & Soul", functions: ["Cocktail", "Reception", "Party"] },
  { title: "25 or 6 to 4", artist: "Chicago", genre: "Rock & Alternative", functions: ["Reception", "Party"] },
  { title: "The Night Me and Your Mama Met", artist: "Childish Gambino", genre: "R&B & Soul", functions: ["Cocktail", "Dinner"] },
  { title: "You Make My Dreams Come True", artist: "Daryl Hall & John Oates", genre: "Funk & Disco", functions: ["Reception", "Party"] },
  { title: "Roadhouse Blues", artist: "The Doors", genre: "Rock & Alternative", functions: ["Reception", "Party"] },
  { title: "Anyway", artist: "Duck Sauce", genre: "Electronic & Dance", functions: ["Reception", "Party"] },
  { title: "Before I Let Go", artist: "Frankie Beverly & Maze", genre: "R&B & Soul", functions: ["Reception", "Party"] },
  { title: "Places to Be", artist: "Fred Again..", genre: "Electronic & Dance", functions: ["Reception", "Party"] },
  { title: "How Sweet It Is", artist: "James Taylor", genre: "R&B & Soul", functions: ["Cocktail", "Dinner", "Ceremony"] },
  { title: "Feelin' Alright", artist: "Joe Cocker", genre: "Rock & Alternative", functions: ["Cocktail", "Reception"] },
  { title: "D.A.N.C.E.", artist: "Justice", genre: "Electronic & Dance", functions: ["Reception", "Party"] },
  { title: "This Is It", artist: "Kenny Loggins", genre: "Pop & Top 40", functions: ["Cocktail", "Reception"] },
  { title: "Stay", artist: "Kid LAROI & Justin Bieber", genre: "Pop & Top 40", functions: ["Reception", "Party"] },
  { title: "Carried Away", artist: "Passion Pit", genre: "Pop & Top 40", functions: ["Reception", "Party"] },
  { title: "Runnin' Away", artist: "The Pharcyde", genre: "R&B & Soul", functions: ["Cocktail", "Reception"] },
  { title: "Passion", artist: "PinkPantheress", genre: "Pop & Top 40", functions: ["Cocktail", "Reception"] },
  { title: "Aeroplane", artist: "Red Hot Chili Peppers", genre: "Rock & Alternative", functions: ["Cocktail", "Reception"] },
  { title: "Cissy Strut", artist: "The Meters", genre: "Funk & Disco", functions: ["Cocktail", "Reception", "Party"] },
  { title: "Symptom of Life", artist: "Willow", genre: "R&B & Soul", functions: ["Cocktail", "Reception"] },
  { title: "Outstanding", artist: "The Gap Band", genre: "Funk & Disco", functions: ["Reception", "Party"] },
  { title: "The Boys of Summer", artist: "Don Henley", genre: "Rock & Alternative", functions: ["Cocktail", "Reception"] },
  { title: "Hold the Line", artist: "Toto", genre: "Rock & Alternative", functions: ["Cocktail", "Reception", "Party"] },
  { title: "Owner of a Lonely Heart", artist: "Yes", genre: "Rock & Alternative", functions: ["Cocktail", "Reception"] },
  { title: "Rosanna", artist: "Toto", genre: "Rock & Alternative", functions: ["Cocktail", "Reception", "Party"] },
  { title: "Voyage to Atlantis", artist: "The Isley Brothers", genre: "R&B & Soul", functions: ["Cocktail", "Ceremony", "Reception"] },
  { title: "Footsteps in the Dark", artist: "The Isley Brothers", genre: "R&B & Soul", functions: ["Cocktail", "Reception"] },
  { title: "Little Red Corvette", artist: "Prince", genre: "Pop & Top 40", functions: ["Reception", "Party"] },
].sort((a, b) => a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title));

const SongListPage = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeGenre, setActiveGenre] = useState("All");
  const [activeFunction, setActiveFunction] = useState("All");
  const [selectedSongs, setSelectedSongs] = useState<Set<string>>(new Set());
  

  const filteredSongs = songs.filter((song) => {
    const matchesSearch =
      song.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      song.artist.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGenre = activeGenre === "All" || song.genre === activeGenre;
    const matchesFunction = activeFunction === "All" || song.functions.includes(activeFunction);
    return matchesSearch && matchesGenre && matchesFunction;
  });

  const getSongKey = (song: typeof songs[0]) => `${song.title}-${song.artist}`;

  const toggleSong = (song: typeof songs[0]) => {
    const key = getSongKey(song);
    setSelectedSongs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const clearSelection = () => {
    setSelectedSongs(new Set());
  };

  const getSelectedSongsList = () => {
    return songs.filter((song) => selectedSongs.has(getSongKey(song)));
  };


  const copyToClipboard = () => {
    const selectedSongsList = getSelectedSongsList();
    const content = selectedSongsList
      .map((song) => `• ${song.title} – ${song.artist}`)
      .join("\n\n");

    navigator.clipboard.writeText(content).then(() => {
      toast.success("Song list copied to clipboard!");
    }).catch(() => {
      toast.error("Failed to copy to clipboard");
    });
  };


  return (
    <Layout
      title="Song List & Repertoire | Harborline Baltimore Band"
      description="Browse Harborline's extensive song list featuring Motown, Top 40, rock classics, jazz standards, and more. Request your favorite songs for your event."
      canonical="https://harborlinemusic.com/songs"
    >
      <PageHero
        eyebrow="REPERTOIRE"
        title="OUR SONG LIST"
        subtitle="From Motown classics to today's hits—we've got your soundtrack covered"
      />

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
                    const allFilteredKeys = filteredSongs.map(getSongKey);
                    const allSelected = allFilteredKeys.every(k => selectedSongs.has(k));
                    if (allSelected) {
                      setSelectedSongs(prev => {
                        const newSet = new Set(prev);
                        allFilteredKeys.forEach(k => newSet.delete(k));
                        return newSet;
                      });
                    } else {
                      setSelectedSongs(prev => {
                        const newSet = new Set(prev);
                        allFilteredKeys.forEach(k => newSet.add(k));
                        return newSet;
                      });
                    }
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  <Check className="w-3.5 h-3.5 mr-1" />
                  {filteredSongs.every(s => selectedSongs.has(getSongKey(s))) ? "Deselect All" : "Select All"}
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
                  <Button variant="hero" size="sm" onClick={copyToClipboard}>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy to Clipboard
                  </Button>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">
                  Select songs to export your list
                </span>
              )}
            </div>
          </div>

          {/* Scrollable Song List Container */}
          <div 
            className="h-[500px] overflow-y-auto rounded-lg border border-border bg-card/50 p-4"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-2"
            >
              {filteredSongs.map((song, index) => {
                const isSelected = selectedSongs.has(getSongKey(song));
                return (
                  <motion.div
                    key={getSongKey(song)}
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
    </Layout>
  );
};

export default SongListPage;
