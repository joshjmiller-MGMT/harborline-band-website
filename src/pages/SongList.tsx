import { useState } from "react";
import Layout from "@/components/Layout";
import PageHero from "@/components/PageHero";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Check, Download, X } from "lucide-react";

const categories = ["All", "Reception", "Cocktail/Dinner"];

const genres = [
  "All",
  "Funk & Disco",
  "Pop & Top 40",
  "R&B & Soul",
  "Rock & Alternative",
  "Electronic & Dance",
  "Reggae",
];

const songs = [
  // RECEPTION MUSIC - Wedding hits first, then variety
  { title: "September", artist: "Earth, Wind & Fire", genre: "Funk & Disco", category: "Reception" },
  { title: "Superstition", artist: "Stevie Wonder", genre: "Funk & Disco", category: "Reception" },
  { title: "Dancing Queen", artist: "ABBA", genre: "Funk & Disco", category: "Reception" },
  { title: "Signed, Sealed, Delivered", artist: "Stevie Wonder", genre: "R&B & Soul", category: "Reception" },
  { title: "I Wish", artist: "Stevie Wonder", genre: "Funk & Disco", category: "Reception" },
  { title: "Brick House", artist: "The Commodores", genre: "Funk & Disco", category: "Reception" },
  { title: "Crazy in Love", artist: "Beyoncé", genre: "R&B & Soul", category: "Reception" },
  { title: "Blinding Lights", artist: "The Weeknd", genre: "Pop & Top 40", category: "Reception" },
  { title: "Levitating", artist: "Dua Lipa", genre: "Pop & Top 40", category: "Reception" },
  { title: "Disco Inferno", artist: "The Trammps", genre: "Funk & Disco", category: "Reception" },
  { title: "Never Too Much", artist: "Luther Vandross", genre: "R&B & Soul", category: "Reception" },
  { title: "Higher Ground", artist: "Stevie Wonder", genre: "Funk & Disco", category: "Reception" },
  { title: "Best of My Love", artist: "The Emotions", genre: "R&B & Soul", category: "Reception" },
  { title: "Dance the Night", artist: "Dua Lipa", genre: "Pop & Top 40", category: "Reception" },
  { title: "Boogie Shoes", artist: "KC & The Sunshine Band", genre: "Funk & Disco", category: "Reception" },
  { title: "That's the Way (I Like It)", artist: "KC & The Sunshine Band", genre: "Funk & Disco", category: "Reception" },
  { title: "Get Up Offa That Thing", artist: "James Brown", genre: "Funk & Disco", category: "Reception" },
  { title: "Papa's Got a Brand New Bag", artist: "James Brown", genre: "Funk & Disco", category: "Reception" },
  { title: "Move On Up", artist: "Curtis Mayfield", genre: "R&B & Soul", category: "Reception" },
  { title: "Murder on the Dance Floor", artist: "Sophie Ellis-Bextor", genre: "Electronic & Dance", category: "Reception" },
  { title: "Canned Heat", artist: "Jamiroquai", genre: "Funk & Disco", category: "Reception" },
  { title: "Cosmic Girl", artist: "Jamiroquai", genre: "Funk & Disco", category: "Reception" },
  { title: "Break My Soul", artist: "Beyoncé", genre: "Pop & Top 40", category: "Reception" },
  { title: "Do It", artist: "Tuxedo", genre: "Funk & Disco", category: "Reception" },
  { title: "Jump On It (Apache)", artist: "Sugarhill Gang", genre: "Funk & Disco", category: "Reception" },
  { title: "Give It to Me Baby", artist: "Rick James", genre: "Funk & Disco", category: "Reception" },
  { title: "Unwritten", artist: "Natasha Bedingfield", genre: "Pop & Top 40", category: "Reception" },
  { title: "Gimme! Gimme! Gimme! (A Man After Midnight)", artist: "ABBA", genre: "Funk & Disco", category: "Reception" },
  { title: "My Prerogative", artist: "Bobby Brown", genre: "R&B & Soul", category: "Reception" },
  { title: "Message in a Bottle", artist: "The Police", genre: "Rock & Alternative", category: "Reception" },
  { title: "Roxanne", artist: "The Police", genre: "Rock & Alternative", category: "Reception" },
  { title: "Fireball", artist: "Pitbull", genre: "Pop & Top 40", category: "Reception" },
  { title: "Give Me Everything", artist: "Pitbull", genre: "Pop & Top 40", category: "Reception" },
  { title: "Hydra", artist: "Grover Washington Jr.", genre: "R&B & Soul", category: "Reception" },
  { title: "Starships", artist: "Nicki Minaj", genre: "Pop & Top 40", category: "Reception" },
  { title: "360", artist: "Charli XCX", genre: "Pop & Top 40", category: "Reception" },
  { title: "Lil Boo Thang", artist: "Paul Russell", genre: "Pop & Top 40", category: "Reception" },
  { title: "Low", artist: "Flo Rida", genre: "Pop & Top 40", category: "Reception" },
  { title: "Latch", artist: "Disclosure ft. Sam Smith", genre: "Electronic & Dance", category: "Reception" },
  { title: "Money for Nothing", artist: "Dire Straits", genre: "Rock & Alternative", category: "Reception" },
  { title: "Another Brick in the Wall (Part 2)", artist: "Pink Floyd", genre: "Rock & Alternative", category: "Reception" },
  { title: "Everytime We Touch", artist: "Cascada", genre: "Electronic & Dance", category: "Reception" },
  { title: "Move Your Feet", artist: "Junior Senior", genre: "Electronic & Dance", category: "Reception" },
  { title: "Heads Will Roll (A-Trak Remix)", artist: "Yeah Yeah Yeahs", genre: "Electronic & Dance", category: "Reception" },
  { title: "Remedy", artist: "Zedd", genre: "Electronic & Dance", category: "Reception" },
  { title: "Could You Be Loved", artist: "Bob Marley", genre: "Reggae", category: "Reception" },

  // COCKTAIL/DINNER MUSIC - Classic vibes first
  { title: "Let's Stay Together", artist: "Al Green", genre: "R&B & Soul", category: "Cocktail/Dinner" },
  { title: "What You Won't Do for Love", artist: "Bobby Caldwell", genre: "R&B & Soul", category: "Cocktail/Dinner" },
  { title: "Ain't No Sunshine", artist: "Bill Withers", genre: "R&B & Soul", category: "Cocktail/Dinner" },
  { title: "Everybody Wants to Rule the World", artist: "Tears for Fears", genre: "Pop & Top 40", category: "Cocktail/Dinner" },
  { title: "What a Fool Believes", artist: "The Doobie Brothers", genre: "Rock & Alternative", category: "Cocktail/Dinner" },
  { title: "Valerie", artist: "Amy Winehouse", genre: "R&B & Soul", category: "Cocktail/Dinner" },
  { title: "Can't Hide Love", artist: "Earth, Wind & Fire", genre: "R&B & Soul", category: "Cocktail/Dinner" },
  { title: "Everybody Loves the Sunshine", artist: "Roy Ayers", genre: "R&B & Soul", category: "Cocktail/Dinner" },
  { title: "Give Me One Reason", artist: "Tracy Chapman", genre: "Rock & Alternative", category: "Cocktail/Dinner" },
  { title: "Georgy Porgy", artist: "Toto", genre: "Rock & Alternative", category: "Cocktail/Dinner" },
  { title: "Home at Last", artist: "Steely Dan", genre: "Rock & Alternative", category: "Cocktail/Dinner" },
  { title: "Glamour Profession", artist: "Steely Dan", genre: "Rock & Alternative", category: "Cocktail/Dinner" },
  { title: "Minute by Minute", artist: "The Doobie Brothers", genre: "Rock & Alternative", category: "Cocktail/Dinner" },
  { title: "Lose Control", artist: "Teddy Swims", genre: "R&B & Soul", category: "Cocktail/Dinner" },
  { title: "Somebody That I Used to Know", artist: "Gotye ft. Kimbra", genre: "Pop & Top 40", category: "Cocktail/Dinner" },
  { title: "Attention", artist: "Charlie Puth", genre: "Pop & Top 40", category: "Cocktail/Dinner" },
  { title: "You Know I'm No Good", artist: "Amy Winehouse", genre: "R&B & Soul", category: "Cocktail/Dinner" },
  { title: "Know You Now", artist: "Amy Winehouse", genre: "R&B & Soul", category: "Cocktail/Dinner" },
  { title: "Drunk in Love", artist: "Beyoncé", genre: "R&B & Soul", category: "Cocktail/Dinner" },
  { title: "Positions", artist: "Ariana Grande", genre: "Pop & Top 40", category: "Cocktail/Dinner" },
  { title: "We Can't Be Friends (Wait for Your Love)", artist: "Ariana Grande", genre: "Pop & Top 40", category: "Cocktail/Dinner" },
  { title: "Out of Time", artist: "The Weeknd", genre: "Pop & Top 40", category: "Cocktail/Dinner" },
  { title: "End of the Road", artist: "Boyz II Men", genre: "R&B & Soul", category: "Cocktail/Dinner" },
  { title: "Spanish Joint", artist: "D'Angelo", genre: "R&B & Soul", category: "Cocktail/Dinner" },
  { title: "Feel Like Makin' Love", artist: "D'Angelo", genre: "R&B & Soul", category: "Cocktail/Dinner" },
  { title: "Pony", artist: "Ginuwine", genre: "R&B & Soul", category: "Cocktail/Dinner" },
  { title: "Carried Away", artist: "H.E.R.", genre: "R&B & Soul", category: "Cocktail/Dinner" },
  { title: "Papa Don't Take No Mess", artist: "James Brown", genre: "Funk & Disco", category: "Cocktail/Dinner" },
  { title: "I Keep Forgettin'", artist: "Michael McDonald", genre: "R&B & Soul", category: "Cocktail/Dinner" },
  { title: "Pretty Brown Eyes", artist: "Mint Condition", genre: "R&B & Soul", category: "Cocktail/Dinner" },
  { title: "Nothing Can Come Between Us", artist: "Sade", genre: "R&B & Soul", category: "Cocktail/Dinner" },
  { title: "Kiss of Life", artist: "Sade", genre: "R&B & Soul", category: "Cocktail/Dinner" },
  { title: "Can We Talk", artist: "Tevin Campbell", genre: "R&B & Soul", category: "Cocktail/Dinner" },
  { title: "Middle", artist: "Zedd", genre: "Electronic & Dance", category: "Cocktail/Dinner" },
  { title: "Stay", artist: "Zedd", genre: "Electronic & Dance", category: "Cocktail/Dinner" },
];

const SongListPage = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeGenre, setActiveGenre] = useState("All");
  const [activeCategory, setActiveCategory] = useState("All");
  const [selectedSongs, setSelectedSongs] = useState<Set<string>>(new Set());

  const filteredSongs = songs.filter((song) => {
    const matchesSearch =
      song.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      song.artist.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGenre = activeGenre === "All" || song.genre === activeGenre;
    const matchesCategory = activeCategory === "All" || song.category === activeCategory;
    return matchesSearch && matchesGenre && matchesCategory;
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

  const exportSelectedSongs = () => {
    const selectedSongsList = songs.filter((song) => selectedSongs.has(getSongKey(song)));
    
    // Group by category
    const receptionSongs = selectedSongsList.filter(s => s.category === "Reception");
    const cocktailSongs = selectedSongsList.filter(s => s.category === "Cocktail/Dinner");
    
    let content = "HARBORLINE - MY EVENT SONG SELECTIONS\n";
    content += "=====================================\n\n";
    content += `Total Songs Selected: ${selectedSongsList.length}\n\n`;
    
    if (receptionSongs.length > 0) {
      content += "RECEPTION SONGS\n";
      content += "---------------\n";
      receptionSongs.forEach((song) => {
        content += `• ${song.title} - ${song.artist}\n`;
      });
      content += "\n";
    }
    
    if (cocktailSongs.length > 0) {
      content += "COCKTAIL/DINNER SONGS\n";
      content += "---------------------\n";
      cocktailSongs.forEach((song) => {
        content += `• ${song.title} - ${song.artist}\n`;
      });
      content += "\n";
    }
    
    content += "\n=====================================\n";
    content += "Questions? Contact us at harborlinemusic.com\n";

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "harborline-song-selections.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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

      <section className="py-20 md:py-24">
        <div className="container px-6 max-w-4xl mx-auto">
          {/* Search and Filter */}
          <div className="mb-12 space-y-6">
            <div className="relative max-w-md mx-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Search songs or artists..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-card border-border"
              />
            </div>

            {/* Category Filter */}
            <div className="flex justify-center gap-2 mb-4">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  className={`px-5 py-2.5 rounded-lg text-sm font-display tracking-wide transition-all ${
                    activeCategory === category
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {category}
                </button>
              ))}
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
          </div>

          {/* Song Count & Selection Info */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
            <p className="text-muted-foreground">
              Showing {filteredSongs.length} of {songs.length} songs
            </p>
            {selectedSongs.size > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-primary font-medium">
                  {selectedSongs.size} song{selectedSongs.size !== 1 ? "s" : ""} selected
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
                <Button
                  variant="hero"
                  size="sm"
                  onClick={exportSelectedSongs}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export List
                </Button>
              </div>
            )}
          </div>

          {/* Instruction */}
          <p className="text-center text-sm text-muted-foreground mb-6">
            Click on songs to select them for your event, then export your list
          </p>

          {/* Song List */}
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
                  transition={{ duration: 0.2, delay: index * 0.01 }}
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
                  <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs px-2 py-1 bg-secondary/50 rounded-full text-muted-foreground">
                      {song.genre}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      song.category === "Reception" 
                        ? "bg-primary/20 text-primary" 
                        : "bg-accent/50 text-accent-foreground"
                    }`}>
                      {song.category === "Cocktail/Dinner" ? "Cocktail" : song.category}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>

          {filteredSongs.length === 0 && (
            <p className="text-center text-muted-foreground py-12">
              No songs found. Try a different search or filter.
            </p>
          )}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-16 text-center p-8 bg-card border border-border rounded-lg"
          >
            <h3 className="font-display text-2xl mb-3">DON'T SEE YOUR SONG?</h3>
            <p className="text-muted-foreground mb-6">
              We learn new songs for our clients all the time. Let us know what you'd like to hear!
            </p>
            <a
              href="/#contact"
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
