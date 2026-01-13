import { useState, useRef } from "react";
import Layout from "@/components/Layout";
import PageHero from "@/components/PageHero";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Check, Download, X, FileText, File, Copy, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import logo from "@/assets/logo.png";
import logoBlack from "@/assets/logo-black.png";

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
  const printRef = useRef<HTMLDivElement>(null);

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

  const getSelectedSongsList = () => {
    return songs.filter((song) => selectedSongs.has(getSongKey(song)));
  };

  const generateContent = () => {
    const selectedSongsList = getSelectedSongsList();
    const receptionSongs = selectedSongsList.filter(s => s.category === "Reception");
    const cocktailSongs = selectedSongsList.filter(s => s.category === "Cocktail/Dinner");
    
    let content = "";
    content += `Total Songs Selected: ${selectedSongsList.length}\n\n`;
    
    if (receptionSongs.length > 0) {
      content += "RECEPTION SONGS\n";
      content += "─".repeat(40) + "\n";
      receptionSongs.forEach((song) => {
        content += `• ${song.title} - ${song.artist}\n`;
      });
      content += "\n";
    }
    
    if (cocktailSongs.length > 0) {
      content += "COCKTAIL/DINNER SONGS\n";
      content += "─".repeat(40) + "\n";
      cocktailSongs.forEach((song) => {
        content += `• ${song.title} - ${song.artist}\n`;
      });
      content += "\n";
    }
    
    return content;
  };

  const exportAsTxt = () => {
    const content = `
╔════════════════════════════════════════════════════════════╗
║           HARBORLINE - MY EVENT SONG SELECTIONS            ║
╚════════════════════════════════════════════════════════════╝

${generateContent()}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                    🎵 HARBORLINE 🎵
           Baltimore's Premier Event Band
           www.harborlinemusic.com
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "harborline-song-selections.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Song list exported as TXT!");
  };

  const exportAsHtml = () => {
    const selectedSongsList = getSelectedSongsList();
    const receptionSongs = selectedSongsList.filter(s => s.category === "Reception");
    const cocktailSongs = selectedSongsList.filter(s => s.category === "Cocktail/Dinner");

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Harborline - My Event Song Selections</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Georgia', serif; 
      background: #1a1a1a; 
      color: #fff; 
      padding: 40px;
      min-height: 100vh;
    }
    .container { max-width: 800px; margin: 0 auto; }
    .header { 
      text-align: center; 
      margin-bottom: 40px; 
      padding-bottom: 30px;
      border-bottom: 2px solid #D4AF37;
    }
    .logo { width: 150px; margin-bottom: 20px; }
    h1 { 
      font-size: 28px; 
      color: #D4AF37; 
      letter-spacing: 3px;
      margin-bottom: 10px;
    }
    .subtitle { color: #888; font-size: 14px; }
    .section { margin-bottom: 30px; }
    .section-title { 
      font-size: 18px; 
      color: #D4AF37; 
      margin-bottom: 15px;
      letter-spacing: 2px;
    }
    .song-list { list-style: none; }
    .song-item { 
      padding: 12px 0; 
      border-bottom: 1px solid #333;
      display: flex;
      justify-content: space-between;
    }
    .song-title { font-weight: bold; }
    .song-artist { color: #888; }
    .footer { 
      margin-top: 50px; 
      padding-top: 30px; 
      border-top: 2px solid #D4AF37;
      text-align: center;
    }
    .footer-logo { width: 100px; margin-bottom: 15px; opacity: 0.7; }
    .footer-text { color: #888; font-size: 14px; }
    .footer-link { color: #D4AF37; text-decoration: none; }
    @media print {
      body { background: #fff; color: #000; }
      .song-item { border-bottom-color: #ddd; }
      .section-title, h1 { color: #8B7355; }
      .song-artist, .subtitle, .footer-text { color: #666; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${logo}" alt="Harborline" class="logo" onerror="this.style.display='none'">
      <h1>MY EVENT SONG SELECTIONS</h1>
      <p class="subtitle">Total Songs: ${selectedSongsList.length}</p>
    </div>
    
    ${receptionSongs.length > 0 ? `
    <div class="section">
      <h2 class="section-title">RECEPTION SONGS</h2>
      <ul class="song-list">
        ${receptionSongs.map(song => `
          <li class="song-item">
            <span class="song-title">${song.title}</span>
            <span class="song-artist">${song.artist}</span>
          </li>
        `).join('')}
      </ul>
    </div>
    ` : ''}
    
    ${cocktailSongs.length > 0 ? `
    <div class="section">
      <h2 class="section-title">COCKTAIL/DINNER SONGS</h2>
      <ul class="song-list">
        ${cocktailSongs.map(song => `
          <li class="song-item">
            <span class="song-title">${song.title}</span>
            <span class="song-artist">${song.artist}</span>
          </li>
        `).join('')}
      </ul>
    </div>
    ` : ''}
    
    <div class="footer">
      <img src="${logo}" alt="Harborline" class="footer-logo" onerror="this.style.display='none'">
      <p class="footer-text">
        🎵 HARBORLINE - Baltimore's Premier Event Band<br>
        <a href="https://harborlinemusic.com" class="footer-link">www.harborlinemusic.com</a>
      </p>
    </div>
  </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "harborline-song-selections.html";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Song list exported as HTML! Open in browser and print to PDF.");
  };

  const copyToClipboard = () => {
    const content = `HARBORLINE - MY EVENT SONG SELECTIONS
=====================================

${generateContent()}
=====================================
🎵 HARBORLINE - Baltimore's Premier Event Band
www.harborlinemusic.com`;

    navigator.clipboard.writeText(content).then(() => {
      toast.success("Song list copied to clipboard!");
    }).catch(() => {
      toast.error("Failed to copy to clipboard");
    });
  };

  const printList = async () => {
    const selectedSongsList = getSelectedSongsList();
    const receptionSongs = selectedSongsList.filter(s => s.category === "Reception");
    const cocktailSongs = selectedSongsList.filter(s => s.category === "Cocktail/Dinner");

    // Convert logo to base64 for embedding in print window
    const getLogoBase64 = (): Promise<string> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0);
          resolve(canvas.toDataURL("image/png"));
        };
        img.onerror = () => resolve("");
        img.src = logoBlack;
      });
    };

    const logoBase64 = await getLogoBase64();

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error("Please allow popups to print");
      return;
    }

    printWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
  <title>Harborline - Song Selections</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Georgia', serif; 
      padding: 40px;
      color: #000;
    }
    .container { max-width: 700px; margin: 0 auto; }
    .header { 
      text-align: center; 
      margin-bottom: 30px; 
      padding-bottom: 20px;
      border-bottom: 2px solid #8B7355;
    }
    h1 { 
      font-size: 24px; 
      color: #8B7355; 
      letter-spacing: 2px;
      margin-bottom: 8px;
    }
    .subtitle { color: #666; font-size: 12px; }
    .section { margin-bottom: 25px; }
    .section-title { 
      font-size: 14px; 
      color: #8B7355; 
      margin-bottom: 12px;
      letter-spacing: 1px;
      font-weight: bold;
    }
    .song-list { list-style: none; }
    .song-item { 
      padding: 8px 0; 
      border-bottom: 1px solid #ddd;
      font-size: 12px;
    }
    .song-title { font-weight: bold; }
    .song-artist { color: #666; margin-left: 8px; }
    .footer { 
      margin-top: 40px; 
      padding-top: 20px; 
      text-align: center;
    }
    .footer-logo {
      width: 120px;
      height: auto;
      opacity: 0.8;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>HARBORLINE</h1>
      <p class="subtitle">MY EVENT SONG SELECTIONS • ${selectedSongsList.length} Songs</p>
    </div>
    
    ${receptionSongs.length > 0 ? `
    <div class="section">
      <h2 class="section-title">RECEPTION SONGS (${receptionSongs.length})</h2>
      <ul class="song-list">
        ${receptionSongs.map(song => `
          <li class="song-item">
            <span class="song-title">${song.title}</span>
            <span class="song-artist">— ${song.artist}</span>
          </li>
        `).join('')}
      </ul>
    </div>
    ` : ''}
    
    ${cocktailSongs.length > 0 ? `
    <div class="section">
      <h2 class="section-title">COCKTAIL/DINNER SONGS (${cocktailSongs.length})</h2>
      <ul class="song-list">
        ${cocktailSongs.map(song => `
          <li class="song-item">
            <span class="song-title">${song.title}</span>
            <span class="song-artist">— ${song.artist}</span>
          </li>
        `).join('')}
      </ul>
    </div>
    ` : ''}
    
    <div class="footer">
      ${logoBase64 ? `<img src="${logoBase64}" alt="Harborline" class="footer-logo">` : '<p style="color: #8B7355; font-weight: bold;">HARBORLINE</p>'}
    </div>
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 100);
    };
  </script>
</body>
</html>`);
    printWindow.document.close();
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

          {/* Sticky Export Bar */}
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm py-4 border-b border-border mb-4">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-4">
                <p className="text-muted-foreground text-sm">
                  {filteredSongs.length} of {songs.length} songs
                </p>
                <p className="text-xs text-muted-foreground">
                  Click songs to select
                </p>
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
                      <DropdownMenuItem onClick={printList}>
                        <File className="w-4 h-4 mr-2" />
                        Print / Save as PDF
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={exportAsHtml}>
                        <FileText className="w-4 h-4 mr-2" />
                        Download HTML
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={exportAsTxt}>
                        <FileText className="w-4 h-4 mr-2" />
                        Download TXT
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={copyToClipboard}>
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
          <div 
            ref={printRef}
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
