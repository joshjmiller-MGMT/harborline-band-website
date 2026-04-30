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
import logoNew from "@/assets/logo-new.png";

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

const decades = [
  "All",
  "70s",
  "80s",
  "90s",
  "2000s",
  "2010s",
  "2020s",
];

type Song = {
  title: string;
  artist: string;
  genre: string;
  functions: string[];
  decade: string;
};

const songs: Song[] = [
  // FUNK & DISCO
  { title: "September", artist: "Earth, Wind & Fire", genre: "Funk & Disco", functions: ["Reception", "Party"], decade: "70s" },
  { title: "Superstition", artist: "Stevie Wonder", genre: "Funk & Disco", functions: ["Reception", "Party"], decade: "70s" },
  { title: "Dancing Queen", artist: "ABBA", genre: "Funk & Disco", functions: ["Reception", "Party"], decade: "70s" },
  { title: "I Wish", artist: "Stevie Wonder", genre: "Funk & Disco", functions: ["Reception", "Party"], decade: "70s" },
  { title: "Brick House", artist: "The Commodores", genre: "Funk & Disco", functions: ["Reception", "Party"], decade: "70s" },
  { title: "Disco Inferno", artist: "The Trammps", genre: "Funk & Disco", functions: ["Reception", "Party"], decade: "70s" },
  { title: "Higher Ground", artist: "Stevie Wonder", genre: "Funk & Disco", functions: ["Reception", "Party"], decade: "70s" },
  { title: "Boogie Shoes", artist: "KC & The Sunshine Band", genre: "Funk & Disco", functions: ["Reception", "Party"], decade: "70s" },
  { title: "That's the Way (I Like It)", artist: "KC & The Sunshine Band", genre: "Funk & Disco", functions: ["Reception", "Party"], decade: "70s" },
  { title: "Get Up Offa That Thing", artist: "James Brown", genre: "Funk & Disco", functions: ["Reception", "Party"], decade: "70s" },
  { title: "Papa's Got a Brand New Bag", artist: "James Brown", genre: "Funk & Disco", functions: ["Reception", "Party"], decade: "60s" },
  { title: "Canned Heat", artist: "Jamiroquai", genre: "Funk & Disco", functions: ["Reception", "Party", "Cocktail"], decade: "90s" },
  { title: "Cosmic Girl", artist: "Jamiroquai", genre: "Funk & Disco", functions: ["Reception", "Party"], decade: "90s" },
  { title: "Do It", artist: "Tuxedo", genre: "Funk & Disco", functions: ["Reception", "Party", "Cocktail"], decade: "2010s" },
  { title: "Jump On It (Apache)", artist: "Sugarhill Gang", genre: "Funk & Disco", functions: ["Reception", "Party"], decade: "80s" },
  { title: "Give It to Me Baby", artist: "Rick James", genre: "Funk & Disco", functions: ["Reception", "Party"], decade: "80s" },
  { title: "Gimme! Gimme! Gimme! (A Man After Midnight)", artist: "ABBA", genre: "Funk & Disco", functions: ["Reception", "Party"], decade: "70s" },
  { title: "Papa Don't Take No Mess", artist: "James Brown", genre: "Funk & Disco", functions: ["Reception", "Party"], decade: "70s" },

  // POP & TOP 40
  { title: "Blinding Lights", artist: "The Weeknd", genre: "Pop & Top 40", functions: ["Reception", "Party"], decade: "2020s" },
  { title: "Levitating", artist: "Dua Lipa", genre: "Pop & Top 40", functions: ["Reception", "Party"], decade: "2020s" },
  { title: "Dance the Night", artist: "Dua Lipa", genre: "Pop & Top 40", functions: ["Reception", "Party"], decade: "2020s" },
  { title: "Break My Soul", artist: "Beyoncé", genre: "Pop & Top 40", functions: ["Reception", "Party"], decade: "2020s" },
  { title: "Unwritten", artist: "Natasha Bedingfield", genre: "Pop & Top 40", functions: ["Reception", "Party", "Ceremony"], decade: "2000s" },
  { title: "Fireball", artist: "Pitbull", genre: "Pop & Top 40", functions: ["Reception", "Party"], decade: "2010s" },
  { title: "Give Me Everything", artist: "Pitbull", genre: "Pop & Top 40", functions: ["Reception", "Party"], decade: "2010s" },
  { title: "Starships", artist: "Nicki Minaj", genre: "Pop & Top 40", functions: ["Reception", "Party"], decade: "2010s" },
  { title: "360", artist: "Charli XCX", genre: "Pop & Top 40", functions: ["Reception", "Party"], decade: "2020s" },
  { title: "Lil Boo Thang", artist: "Paul Russell", genre: "Pop & Top 40", functions: ["Reception", "Party", "Cocktail"], decade: "2020s" },
  { title: "Low", artist: "Flo Rida", genre: "Pop & Top 40", functions: ["Reception", "Party"], decade: "2000s" },
  { title: "Everybody Wants to Rule the World", artist: "Tears for Fears", genre: "Pop & Top 40", functions: ["Cocktail", "Dinner"], decade: "80s" },
  { title: "Somebody That I Used to Know", artist: "Gotye ft. Kimbra", genre: "Pop & Top 40", functions: ["Cocktail", "Dinner"], decade: "2010s" },
  { title: "Attention", artist: "Charlie Puth", genre: "Pop & Top 40", functions: ["Reception", "Party", "Cocktail"], decade: "2010s" },
  { title: "Positions", artist: "Ariana Grande", genre: "Pop & Top 40", functions: ["Cocktail", "Reception"], decade: "2020s" },
  { title: "We Can't Be Friends (Wait for Your Love)", artist: "Ariana Grande", genre: "Pop & Top 40", functions: ["Cocktail", "Dinner"], decade: "2020s" },
  { title: "Out of Time", artist: "The Weeknd", genre: "Pop & Top 40", functions: ["Cocktail", "Dinner"], decade: "2020s" },
  { title: "Pink Pony Club", artist: "Chappell Roan", genre: "Pop & Top 40", functions: ["Reception", "Party"], decade: "2020s" },

  // R&B & SOUL
  { title: "Signed, Sealed, Delivered", artist: "Stevie Wonder", genre: "R&B & Soul", functions: ["Reception", "Party", "Ceremony"], decade: "70s" },
  { title: "Crazy in Love", artist: "Beyoncé", genre: "R&B & Soul", functions: ["Reception", "Party", "First Dance"], decade: "2000s" },
  { title: "Never Too Much", artist: "Luther Vandross", genre: "R&B & Soul", functions: ["Reception", "Party", "First Dance"], decade: "80s" },
  { title: "Mistletoe Jam", artist: "Luther Vandross", genre: "R&B & Soul", functions: ["Holiday", "Party", "Reception"], decade: "80s" },
  { title: "Best of My Love", artist: "The Emotions", genre: "R&B & Soul", functions: ["Reception", "Party"], decade: "70s" },
  { title: "Move On Up", artist: "Curtis Mayfield", genre: "R&B & Soul", functions: ["Reception", "Party", "Cocktail"], decade: "70s" },
  { title: "My Prerogative", artist: "Bobby Brown", genre: "R&B & Soul", functions: ["Reception", "Party"], decade: "80s" },
  { title: "Hydra", artist: "Grover Washington Jr.", genre: "R&B & Soul", functions: ["Cocktail", "Dinner"], decade: "70s" },
  { title: "Let's Stay Together", artist: "Al Green", genre: "R&B & Soul", functions: ["First Dance", "Ceremony", "Dinner", "Cocktail"], decade: "70s" },
  { title: "What You Won't Do for Love", artist: "Bobby Caldwell", genre: "R&B & Soul", functions: ["Cocktail", "Dinner", "First Dance"], decade: "70s" },
  { title: "Ain't No Sunshine", artist: "Bill Withers", genre: "R&B & Soul", functions: ["Cocktail", "Dinner", "Ceremony"], decade: "70s" },
  { title: "Valerie", artist: "Amy Winehouse", genre: "R&B & Soul", functions: ["Cocktail", "Reception"], decade: "2000s" },
  { title: "Can't Hide Love", artist: "Earth, Wind & Fire", genre: "R&B & Soul", functions: ["Cocktail", "Dinner", "Reception"], decade: "70s" },
  { title: "Everybody Loves the Sunshine", artist: "Roy Ayers", genre: "R&B & Soul", functions: ["Cocktail", "Dinner"], decade: "70s" },
  { title: "You Know I'm No Good", artist: "Amy Winehouse", genre: "R&B & Soul", functions: ["Cocktail", "Dinner"], decade: "2000s" },
  { title: "Know You Now", artist: "Amy Winehouse", genre: "R&B & Soul", functions: ["Cocktail", "Dinner"], decade: "2000s" },
  { title: "Drunk in Love", artist: "Beyoncé", genre: "R&B & Soul", functions: ["Reception", "Party"], decade: "2010s" },
  { title: "End of the Road", artist: "Boyz II Men", genre: "R&B & Soul", functions: ["Ceremony", "First Dance"], decade: "90s" },
  { title: "Spanish Joint", artist: "D'Angelo", genre: "R&B & Soul", functions: ["Cocktail", "Dinner"], decade: "2000s" },
  { title: "Feel Like Makin' Love", artist: "D'Angelo", genre: "R&B & Soul", functions: ["Cocktail", "Dinner", "First Dance"], decade: "2000s" },
  { title: "Pony", artist: "Ginuwine", genre: "R&B & Soul", functions: ["Reception", "Party"], decade: "90s" },
  { title: "Carried Away", artist: "H.E.R.", genre: "R&B & Soul", functions: ["Cocktail", "Dinner", "First Dance"], decade: "2020s" },
  { title: "I Keep Forgettin'", artist: "Michael McDonald", genre: "R&B & Soul", functions: ["Cocktail", "Dinner"], decade: "80s" },
  { title: "Pretty Brown Eyes", artist: "Mint Condition", genre: "R&B & Soul", functions: ["Cocktail", "Reception", "First Dance"], decade: "90s" },
  { title: "Nothing Can Come Between Us", artist: "Sade", genre: "R&B & Soul", functions: ["Cocktail", "Dinner", "First Dance"], decade: "80s" },
  { title: "Kiss of Life", artist: "Sade", genre: "R&B & Soul", functions: ["Cocktail", "Dinner"], decade: "90s" },
  { title: "Can We Talk", artist: "Tevin Campbell", genre: "R&B & Soul", functions: ["Cocktail", "Reception"], decade: "90s" },
  { title: "Lose Control", artist: "Teddy Swims", genre: "R&B & Soul", functions: ["Reception", "Party"], decade: "2020s" },

  // ROCK & ALTERNATIVE
  { title: "Message in a Bottle", artist: "The Police", genre: "Rock & Alternative", functions: ["Reception", "Party"], decade: "70s" },
  { title: "Roxanne", artist: "The Police", genre: "Rock & Alternative", functions: ["Reception", "Party"], decade: "70s" },
  { title: "Money for Nothing", artist: "Dire Straits", genre: "Rock & Alternative", functions: ["Cocktail", "Reception"], decade: "80s" },
  { title: "Another Brick in the Wall (Part 2)", artist: "Pink Floyd", genre: "Rock & Alternative", functions: ["Reception", "Party"], decade: "70s" },
  { title: "What a Fool Believes", artist: "The Doobie Brothers", genre: "Rock & Alternative", functions: ["Cocktail", "Dinner", "Reception"], decade: "70s" },
  { title: "Give Me One Reason", artist: "Tracy Chapman", genre: "Rock & Alternative", functions: ["Cocktail", "Reception"], decade: "90s" },
  { title: "Georgy Porgy", artist: "Toto", genre: "Rock & Alternative", functions: ["Cocktail", "Dinner"], decade: "70s" },
  { title: "Home at Last", artist: "Steely Dan", genre: "Rock & Alternative", functions: ["Cocktail", "Dinner"], decade: "70s" },
  { title: "Glamour Profession", artist: "Steely Dan", genre: "Rock & Alternative", functions: ["Cocktail", "Dinner"], decade: "80s" },
  { title: "Minute by Minute", artist: "The Doobie Brothers", genre: "Rock & Alternative", functions: ["Cocktail", "Dinner"], decade: "70s" },
  { title: "Reminiscing", artist: "Little River Band", genre: "Rock & Alternative", functions: ["Cocktail", "Dinner", "Reception"], decade: "70s" },

  // ELECTRONIC & DANCE
  { title: "Murder on the Dance Floor", artist: "Sophie Ellis-Bextor", genre: "Electronic & Dance", functions: ["Reception", "Party"], decade: "2000s" },
  { title: "Latch", artist: "Disclosure ft. Sam Smith", genre: "Electronic & Dance", functions: ["Reception", "Party"], decade: "2010s" },
  { title: "Everytime We Touch", artist: "Cascada", genre: "Electronic & Dance", functions: ["Reception", "Party"], decade: "2000s" },
  { title: "Move Your Feet", artist: "Junior Senior", genre: "Electronic & Dance", functions: ["Reception", "Party"], decade: "2000s" },
  { title: "Heads Will Roll (A-Trak Remix)", artist: "Yeah Yeah Yeahs", genre: "Electronic & Dance", functions: ["Reception", "Party"], decade: "2010s" },
  { title: "Remedy", artist: "Zedd", genre: "Electronic & Dance", functions: ["Reception", "Party"], decade: "2010s" },
  { title: "Middle", artist: "Zedd", genre: "Electronic & Dance", functions: ["Reception", "Party", "Cocktail"], decade: "2010s" },
  { title: "Stay", artist: "Zedd", genre: "Electronic & Dance", functions: ["Reception", "Party"], decade: "2010s" },

  // REGGAE
  { title: "Could You Be Loved", artist: "Bob Marley", genre: "Reggae", functions: ["Cocktail", "Reception", "Party"], decade: "80s" },

  // ADDITIONAL
  { title: "Eyes Without a Face", artist: "Billy Idol", genre: "Rock & Alternative", functions: ["Cocktail", "Dinner"], decade: "80s" },
  { title: "I Will Survive", artist: "Cake", genre: "Rock & Alternative", functions: ["Reception", "Party"], decade: "90s" },
  { title: "Short Skirt/Long Jacket", artist: "Cake", genre: "Rock & Alternative", functions: ["Cocktail", "Reception"], decade: "2000s" },
  { title: "The Distance", artist: "Cake", genre: "Rock & Alternative", functions: ["Reception", "Party"], decade: "90s" },
  { title: "Closer", artist: "The Chainsmokers", genre: "Electronic & Dance", functions: ["Reception", "Party"], decade: "2010s" },
  { title: "Crazy", artist: "Gnarls Barkley", genre: "R&B & Soul", functions: ["Cocktail", "Reception", "Party"], decade: "2000s" },
  { title: "25 or 6 to 4", artist: "Chicago", genre: "Rock & Alternative", functions: ["Reception", "Party"], decade: "70s" },
  { title: "The Night Me and Your Mama Met", artist: "Childish Gambino", genre: "R&B & Soul", functions: ["Cocktail", "Dinner"], decade: "2010s" },
  { title: "You Make My Dreams Come True", artist: "Daryl Hall & John Oates", genre: "Funk & Disco", functions: ["Reception", "Party"], decade: "80s" },
  { title: "Roadhouse Blues", artist: "The Doors", genre: "Rock & Alternative", functions: ["Reception", "Party"], decade: "70s" },
  { title: "Anyway", artist: "Duck Sauce", genre: "Electronic & Dance", functions: ["Reception", "Party"], decade: "2010s" },
  { title: "Before I Let Go", artist: "Frankie Beverly & Maze", genre: "R&B & Soul", functions: ["Reception", "Party"], decade: "80s" },
  { title: "Places to Be", artist: "Fred Again..", genre: "Electronic & Dance", functions: ["Reception", "Party"], decade: "2020s" },
  { title: "How Sweet It Is", artist: "James Taylor", genre: "R&B & Soul", functions: ["Cocktail", "Dinner", "Ceremony"], decade: "70s" },
  { title: "Feelin' Alright", artist: "Joe Cocker", genre: "Rock & Alternative", functions: ["Cocktail", "Reception"], decade: "60s" },
  { title: "D.A.N.C.E.", artist: "Justice", genre: "Electronic & Dance", functions: ["Reception", "Party"], decade: "2000s" },
  { title: "This Is It", artist: "Kenny Loggins", genre: "Pop & Top 40", functions: ["Cocktail", "Reception"], decade: "80s" },
  { title: "Stay", artist: "Kid LAROI & Justin Bieber", genre: "Pop & Top 40", functions: ["Reception", "Party"], decade: "2020s" },
  { title: "Carried Away", artist: "Passion Pit", genre: "Pop & Top 40", functions: ["Reception", "Party"], decade: "2010s" },
  { title: "Runnin' Away", artist: "The Pharcyde", genre: "R&B & Soul", functions: ["Cocktail", "Reception"], decade: "90s" },
  { title: "Passion", artist: "PinkPantheress", genre: "Pop & Top 40", functions: ["Cocktail", "Reception"], decade: "2020s" },
  { title: "Aeroplane", artist: "Red Hot Chili Peppers", genre: "Rock & Alternative", functions: ["Cocktail", "Reception"], decade: "90s" },
  { title: "Cissy Strut", artist: "The Meters", genre: "Funk & Disco", functions: ["Cocktail", "Reception", "Party"], decade: "70s" },
  { title: "Symptom of Life", artist: "Willow", genre: "R&B & Soul", functions: ["Cocktail", "Reception"], decade: "2020s" },
  { title: "Outstanding", artist: "The Gap Band", genre: "Funk & Disco", functions: ["Reception", "Party"], decade: "80s" },
  { title: "The Boys of Summer", artist: "Don Henley", genre: "Rock & Alternative", functions: ["Cocktail", "Reception"], decade: "80s" },
  { title: "Hold the Line", artist: "Toto", genre: "Rock & Alternative", functions: ["Cocktail", "Reception", "Party"], decade: "70s" },
  { title: "Owner of a Lonely Heart", artist: "Yes", genre: "Rock & Alternative", functions: ["Cocktail", "Reception"], decade: "80s" },
  { title: "Rosanna", artist: "Toto", genre: "Rock & Alternative", functions: ["Cocktail", "Reception", "Party"], decade: "80s" },
  { title: "Voyage to Atlantis", artist: "The Isley Brothers", genre: "R&B & Soul", functions: ["Cocktail", "Ceremony", "Reception"], decade: "70s" },
  { title: "Footsteps in the Dark", artist: "The Isley Brothers", genre: "R&B & Soul", functions: ["Cocktail", "Reception"], decade: "70s" },
  { title: "Little Red Corvette", artist: "Prince", genre: "Pop & Top 40", functions: ["Reception", "Party"], decade: "80s" },
  { title: "So Easy", artist: "Olivia Dean", genre: "R&B & Soul", functions: ["Cocktail", "Dinner", "First Dance"], decade: "2020s" },
  { title: "P.D.A. (We Just Don't Care)", artist: "John Legend", genre: "R&B & Soul", functions: ["Cocktail", "Dinner", "First Dance"], decade: "2000s" },
  { title: "Do I Do", artist: "Stevie Wonder", genre: "Funk & Disco", functions: ["Reception", "Party"], decade: "80s" },
  { title: "As", artist: "Stevie Wonder", genre: "R&B & Soul", functions: ["Ceremony", "First Dance", "Reception"], decade: "70s" },
  { title: "Bring on the Night", artist: "The Police", genre: "Rock & Alternative", functions: ["Cocktail", "Reception"], decade: "70s" },
  { title: "When the World Is Running Down...", artist: "The Police", genre: "Rock & Alternative", functions: ["Cocktail", "Reception"], decade: "80s" },
  { title: "Murder by Numbers", artist: "The Police", genre: "Rock & Alternative", functions: ["Cocktail", "Dinner"], decade: "80s" },
  { title: "Nights on Broadway", artist: "Bee Gees", genre: "Funk & Disco", functions: ["Reception", "Party", "Cocktail"], decade: "70s" },
  { title: "Shout", artist: "Tears for Fears", genre: "Pop & Top 40", functions: ["Reception", "Party"], decade: "80s" },
  { title: "In the Stone", artist: "Earth, Wind & Fire", genre: "Funk & Disco", functions: ["Reception", "Party"], decade: "70s" },
].sort((a, b) => a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title));

const SongListPage = ({ embedded = false }: { embedded?: boolean }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeGenre, setActiveGenre] = useState("All");
  const [activeFunction, setActiveFunction] = useState("All");
  const [activeDecade, setActiveDecade] = useState("All");
  const [selectedSongs, setSelectedSongs] = useState<Set<string>>(new Set());
  const printRef = useRef<HTMLDivElement>(null);

  const filteredSongs = songs.filter((song) => {
    const matchesSearch =
      song.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      song.artist.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGenre = activeGenre === "All" || song.genre === activeGenre;
    const matchesFunction = activeFunction === "All" || song.functions.includes(activeFunction);
    const matchesDecade = activeDecade === "All" || song.decade === activeDecade;
    return matchesSearch && matchesGenre && matchesFunction && matchesDecade;
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
    
    // Group by genre
    const songsByGenre = genres.slice(1).reduce((acc, genre) => {
      const genreSongs = selectedSongsList.filter(s => s.genre === genre);
      if (genreSongs.length > 0) {
        acc[genre] = genreSongs;
      }
      return acc;
    }, {} as Record<string, typeof songs>);
    
    let content = "";
    content += `Total Songs Selected: ${selectedSongsList.length}\n\n`;
    
    Object.entries(songsByGenre).forEach(([genre, genreSongs]) => {
      content += `${genre.toUpperCase()}\n`;
      content += "─".repeat(40) + "\n";
      genreSongs.forEach((song) => {
        content += `• ${song.title} - ${song.artist}\n`;
      });
      content += "\n";
    });
    
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
           www.harborlineband.com
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
    
    // Group by genre
    const songsByGenre = genres.slice(1).reduce((acc, genre) => {
      const genreSongs = selectedSongsList.filter(s => s.genre === genre);
      if (genreSongs.length > 0) {
        acc[genre] = genreSongs;
      }
      return acc;
    }, {} as Record<string, typeof songs>);

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Harborline - My Event Song Selections</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Cormorant+Garamond:wght@400;500;600&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Cormorant Garamond', Georgia, serif; 
      background: #1a1a1a; 
      color: #fff; 
      padding: 50px 40px;
      min-height: 100vh;
      line-height: 1.6;
    }
    .container { max-width: 800px; margin: 0 auto; }
    .header { 
      text-align: center; 
      margin-bottom: 40px; 
      padding-bottom: 30px;
      border-bottom: 1px solid #333;
    }
    .logo { width: 180px; margin-bottom: 20px; }
    .header-title { 
      font-family: 'Montserrat', sans-serif;
      font-size: 11px; 
      font-weight: 600;
      color: #7C3AED; 
      letter-spacing: 4px;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .subtitle { color: #888; font-size: 14px; font-style: italic; }
    .section { margin-bottom: 30px; }
    .section-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 2px solid #7C3AED;
    }
    .section-icon {
      width: 8px;
      height: 8px;
      background: linear-gradient(135deg, #7C3AED, #3B82F6);
      border-radius: 50%;
    }
    .section-title { 
      font-family: 'Montserrat', sans-serif;
      font-size: 11px; 
      font-weight: 600;
      color: #fff;
      letter-spacing: 3px;
      text-transform: uppercase;
    }
    .song-list { list-style: none; columns: 2; column-gap: 30px; }
    .song-item { 
      padding: 6px 0; 
      font-size: 12px;
      break-inside: avoid;
    }
    .song-title { font-weight: 600; }
    .song-artist { color: #888; font-size: 11px; font-style: italic; }
    .footer { 
      margin-top: 50px; 
      padding-top: 30px; 
      border-top: 1px solid #333;
      text-align: center;
    }
    .footer-logo { width: 100px; margin-bottom: 15px; opacity: 0.8; }
    .footer-tagline { 
      font-family: 'Montserrat', sans-serif;
      font-size: 9px; 
      letter-spacing: 3px;
      color: #666;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .footer-link { color: #7C3AED; text-decoration: none; font-family: 'Montserrat', sans-serif; font-size: 10px; }
    @media print {
      body { background: #fff; color: #000; }
      .song-item { border-bottom-color: #ddd; }
      .section-title { color: #1a1a1a; }
      .song-artist, .subtitle { color: #666; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${logoNew}" alt="Harborline" class="logo" onerror="this.style.display='none'">
      <p class="header-title">My Event Song Selections</p>
      <p class="subtitle">Curated playlist • ${selectedSongsList.length} songs</p>
    </div>
    
    ${Object.entries(songsByGenre).map(([genre, genreSongs]) => `
    <div class="section">
      <div class="section-header">
        <div class="section-icon"></div>
        <h2 class="section-title">${genre}</h2>
      </div>
      <ul class="song-list">
        ${genreSongs.map(song => `
          <li class="song-item">
            <span class="song-title">${song.title}</span><br>
            <span class="song-artist">${song.artist}</span>
          </li>
        `).join('')}
      </ul>
    </div>
    `).join('')}
    
    <div class="footer">
      <img src="${logoNew}" alt="Harborline" class="footer-logo" onerror="this.style.display='none'">
      <p class="footer-tagline">Baltimore's Premier Event Band</p>
      <a href="https://harborlineband.com" class="footer-link">harborlineband.com</a>
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
    const selectedSongsList = getSelectedSongsList();
    const songsToUse = selectedSongsList.length > 0 ? selectedSongsList : filteredSongs;
    const content = songsToUse.map(song => `• ${song.title} - ${song.artist}`).join('\n');

    navigator.clipboard.writeText(content).then(() => {
      toast.success("Song list copied to clipboard!");
    }).catch(() => {
      toast.error("Failed to copy to clipboard");
    });
  };

  const printList = async () => {
    const selectedSongsList = getSelectedSongsList();
    
    // Group by genre
    const songsByGenre = genres.slice(1).reduce((acc, genre) => {
      const genreSongs = selectedSongsList.filter(s => s.genre === genre);
      if (genreSongs.length > 0) {
        acc[genre] = genreSongs;
      }
      return acc;
    }, {} as Record<string, typeof songs>);

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
        img.src = logoNew;
      });
    };

    const logoBase64 = await getLogoBase64();
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error("Please allow popups to print");
      return;
    }

    // Build a flat sorted list grouped by genre for the compact layout
    const allSongRows = Object.entries(songsByGenre).flatMap(([genre, genreSongs]) =>
      genreSongs.map(song => ({ ...song, genre }))
    );

    // Split into 2 columns
    const colSize = Math.ceil(allSongRows.length / 2);
    const col1 = allSongRows.slice(0, colSize);
    const col2 = allSongRows.slice(colSize);

    const renderColumn = (colSongs: typeof allSongRows) => colSongs.map(song => `
      <div class="song-row">
        <span class="song-title">${song.title}</span>
        <span class="song-artist">${song.artist}</span>
      </div>
    `).join('');

    printWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
  <title>Harborline - Song Selections</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Cormorant+Garamond:wght@400;500;600&display=swap');
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body { 
      font-family: 'Cormorant Garamond', Georgia, serif; 
      padding: 25px 30px;
      color: #1a1a1a;
      background: #fff;
      line-height: 1.3;
    }
    
    .container { 
      max-width: 100%; 
      margin: 0 auto; 
    }
    
    .header { 
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 15px; 
      padding-bottom: 12px;
      border-bottom: 2px solid #7C3AED;
    }
    
    .header-left {
      display: flex;
      align-items: center;
      gap: 15px;
    }
    
    .header-logo {
      width: 100px;
      height: auto;
    }
    
    .header-text {}
    
    .header-title {
      font-family: 'Montserrat', sans-serif;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 3px;
      color: #7C3AED;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    
    .header-subtitle { 
      font-family: 'Cormorant Garamond', serif;
      color: #666; 
      font-size: 11px;
      font-style: italic;
    }
    
    .header-right {
      text-align: right;
    }
    
    .stat-number {
      font-family: 'Montserrat', sans-serif;
      font-size: 20px;
      font-weight: 700;
      color: #7C3AED;
      line-height: 1;
    }
    
    .stat-label {
      font-family: 'Montserrat', sans-serif;
      font-size: 7px;
      letter-spacing: 2px;
      color: #888;
      text-transform: uppercase;
    }
    
    .columns {
      display: flex;
      gap: 20px;
    }
    
    .column {
      flex: 1;
    }
    
    .song-row {
      padding: 2px 0;
      border-bottom: 1px solid #f0f0f0;
    }
    
    .song-title { 
      font-family: 'Montserrat', sans-serif;
      font-weight: 600;
      font-size: 7.5px;
      color: #1a1a1a;
      display: block;
      line-height: 1.3;
    }
    
    .song-artist { 
      font-family: 'Cormorant Garamond', serif;
      color: #888;
      font-size: 8px;
      font-style: italic;
      display: block;
      line-height: 1.2;
    }
    
    .footer { 
      margin-top: 12px; 
      padding-top: 8px; 
      border-top: 1px solid #e5e5e5;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .footer-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .footer-logo {
      width: 50px;
      height: auto;
      opacity: 0.8;
    }
    
    .footer-tagline {
      font-family: 'Montserrat', sans-serif;
      font-size: 7px;
      letter-spacing: 2px;
      color: #666;
      text-transform: uppercase;
    }
    
    .footer-contact {
      font-family: 'Montserrat', sans-serif;
      font-size: 8px;
      color: #7C3AED;
    }
    
    .footer-date {
      font-size: 8px;
      color: #aaa;
      font-style: italic;
    }
    
    @media print {
      body { 
        padding: 20px 25px;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      @page {
        size: letter;
        margin: 0.4in;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-left">
        ${logoBase64 ? `<img src="${logoBase64}" alt="Harborline" class="header-logo">` : ''}
        <div class="header-text">
          <p class="header-title">My Event Song Selections</p>
          <p class="header-subtitle">Curated playlist for your special occasion</p>
        </div>
      </div>
      <div class="header-right">
        <div class="stat-number">${selectedSongsList.length}</div>
        <div class="stat-label">Songs</div>
      </div>
    </div>
    
    <div class="columns">
      <div class="column">${renderColumn(col1)}</div>
      <div class="column">${renderColumn(col2)}</div>
    </div>
    
    <div class="footer">
      <div class="footer-left">
        ${logoBase64 ? `<img src="${logoBase64}" alt="Harborline" class="footer-logo">` : ''}
        <p class="footer-tagline">Baltimore's Premier Event Band</p>
      </div>
      <div>
        <p class="footer-contact">harborlineband.com</p>
        <p class="footer-date">Generated on ${today}</p>
      </div>
    </div>
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 200);
    };
  </script>
</body>
</html>`);
    printWindow.document.close();
  };

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
    </>
  );

  if (embedded) return content;

  return (
    <Layout
      title="Song List & Repertoire | Harborline Baltimore Band"
      description="Browse Harborline's extensive song list featuring Motown, Top 40, rock classics, jazz standards, and more. Request your favorite songs for your event."
      canonical="https://harborlineband.com/songs"
    >
      {content}
    </Layout>
  );
};

export default SongListPage;
