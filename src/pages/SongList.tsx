import { useState } from "react";
import Layout from "@/components/Layout";
import PageHero from "@/components/PageHero";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

const genres = [
  "All",
  "Motown & Soul",
  "Top 40",
  "Rock Classics",
  "Jazz & Standards",
  "R&B & Funk",
  "Country",
];

const songs = [
  { title: "September", artist: "Earth, Wind & Fire", genre: "R&B & Funk" },
  { title: "Superstition", artist: "Stevie Wonder", genre: "Motown & Soul" },
  { title: "Uptown Funk", artist: "Bruno Mars", genre: "Top 40" },
  { title: "Don't Stop Believin'", artist: "Journey", genre: "Rock Classics" },
  { title: "Signed, Sealed, Delivered", artist: "Stevie Wonder", genre: "Motown & Soul" },
  { title: "Sweet Caroline", artist: "Neil Diamond", genre: "Rock Classics" },
  { title: "Fly Me to the Moon", artist: "Frank Sinatra", genre: "Jazz & Standards" },
  { title: "I Gotta Feeling", artist: "Black Eyed Peas", genre: "Top 40" },
  { title: "Respect", artist: "Aretha Franklin", genre: "Motown & Soul" },
  { title: "Livin' on a Prayer", artist: "Bon Jovi", genre: "Rock Classics" },
  { title: "Sir Duke", artist: "Stevie Wonder", genre: "Motown & Soul" },
  { title: "Wagon Wheel", artist: "Darius Rucker", genre: "Country" },
  { title: "Shake It Off", artist: "Taylor Swift", genre: "Top 40" },
  { title: "My Girl", artist: "The Temptations", genre: "Motown & Soul" },
  { title: "The Way You Look Tonight", artist: "Frank Sinatra", genre: "Jazz & Standards" },
  { title: "Crazy in Love", artist: "Beyoncé", genre: "R&B & Funk" },
  { title: "Brown Eyed Girl", artist: "Van Morrison", genre: "Rock Classics" },
  { title: "Can't Stop the Feeling", artist: "Justin Timberlake", genre: "Top 40" },
  { title: "Get Lucky", artist: "Daft Punk", genre: "R&B & Funk" },
  { title: "I Want You Back", artist: "Jackson 5", genre: "Motown & Soul" },
  { title: "Dancing Queen", artist: "ABBA", genre: "Rock Classics" },
  { title: "At Last", artist: "Etta James", genre: "Jazz & Standards" },
  { title: "Happy", artist: "Pharrell Williams", genre: "Top 40" },
  { title: "Le Freak", artist: "Chic", genre: "R&B & Funk" },
  { title: "Ain't No Mountain High Enough", artist: "Marvin Gaye", genre: "Motown & Soul" },
  { title: "Tennessee Whiskey", artist: "Chris Stapleton", genre: "Country" },
  { title: "Boogie Wonderland", artist: "Earth, Wind & Fire", genre: "R&B & Funk" },
  { title: "L-O-V-E", artist: "Nat King Cole", genre: "Jazz & Standards" },
  { title: "Treasure", artist: "Bruno Mars", genre: "Top 40" },
  { title: "Brick House", artist: "The Commodores", genre: "R&B & Funk" },
];

const SongListPage = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeGenre, setActiveGenre] = useState("All");

  const filteredSongs = songs.filter((song) => {
    const matchesSearch =
      song.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      song.artist.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGenre = activeGenre === "All" || song.genre === activeGenre;
    return matchesSearch && matchesGenre;
  });

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
        <div className="container px-6 max-w-5xl mx-auto">
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

            <div className="flex flex-wrap justify-center gap-2">
              {genres.map((genre) => (
                <button
                  key={genre}
                  onClick={() => setActiveGenre(genre)}
                  className={`px-4 py-2 rounded-full text-sm font-display tracking-wide transition-all ${
                    activeGenre === genre
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {genre}
                </button>
              ))}
            </div>
          </div>

          {/* Song Grid */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {filteredSongs.map((song, index) => (
              <motion.div
                key={`${song.title}-${song.artist}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.02 }}
                className="p-4 bg-card border border-border rounded-lg hover:border-primary/50 transition-colors"
              >
                <h3 className="font-display text-lg">{song.title}</h3>
                <p className="text-sm text-muted-foreground">{song.artist}</p>
                <span className="inline-block mt-2 text-xs px-2 py-1 bg-secondary/50 rounded-full text-muted-foreground">
                  {song.genre}
                </span>
              </motion.div>
            ))}
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
              href="/contact"
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
