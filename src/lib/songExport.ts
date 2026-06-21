// Shared song-list export helpers (TXT / HTML / print-to-PDF / clipboard),
// reused by the public /songs page (genre-grouped) and the team setlist builder
// (ordered, numbered). Templates lifted verbatim from the original SongList.tsx
// so the public output is byte-for-byte the same; ordered mode is the new path.

import { toast } from "sonner";
import logoNew from "@/assets/logo-new.png";
import { genres, type Song } from "@/lib/songFilters";

export type ExportOptions = {
  /** Header shown on the document, e.g. "My Event Song Selections" or a setlist name. */
  title?: string;
  /** true = group by genre (public page); false = keep the given order, numbered (setlist). */
  grouped?: boolean;
  /** Base filename (no extension). */
  fileBase?: string;
};

const DEFAULT_TITLE = "My Event Song Selections";

const groupByGenre = (songs: Song[]) =>
  genres.slice(1).reduce((acc, genre) => {
    const genreSongs = songs.filter((s) => s.genre === genre);
    if (genreSongs.length > 0) acc[genre] = genreSongs;
    return acc;
  }, {} as Record<string, Song[]>);

const triggerDownload = (content: string, mime: string, filename: string) => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const exportSongsAsTxt = (songs: Song[], opts: ExportOptions = {}) => {
  const title = opts.title ?? DEFAULT_TITLE;
  const fileBase = opts.fileBase ?? "harborline-song-selections";

  let body = `Total Songs: ${songs.length}\n\n`;
  if (opts.grouped) {
    Object.entries(groupByGenre(songs)).forEach(([genre, genreSongs]) => {
      body += `${genre.toUpperCase()}\n`;
      body += "─".repeat(40) + "\n";
      genreSongs.forEach((s) => {
        body += `• ${s.title} - ${s.artist}\n`;
      });
      body += "\n";
    });
  } else {
    songs.forEach((s, i) => {
      body += `${i + 1}. ${s.title} - ${s.artist}\n`;
    });
    body += "\n";
  }

  const content = `
╔════════════════════════════════════════════════════════════╗
║           HARBORLINE - ${title.toUpperCase()}
╚════════════════════════════════════════════════════════════╝

${body}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                    🎵 HARBORLINE 🎵
           Baltimore's Premier Event Band
           www.harborlineband.com
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
  triggerDownload(content, "text/plain", `${fileBase}.txt`);
  toast.success("Exported as TXT!");
};

export const exportSongsAsHtml = (songs: Song[], opts: ExportOptions = {}) => {
  const title = opts.title ?? DEFAULT_TITLE;
  const fileBase = opts.fileBase ?? "harborline-song-selections";

  const sectionsHtml = opts.grouped
    ? Object.entries(groupByGenre(songs))
        .map(
          ([genre, genreSongs]) => `
    <div class="section">
      <div class="section-header">
        <div class="section-icon"></div>
        <h2 class="section-title">${genre}</h2>
      </div>
      <ul class="song-list">
        ${genreSongs
          .map(
            (song) => `
          <li class="song-item">
            <span class="song-title">${song.title}</span><br>
            <span class="song-artist">${song.artist}</span>
          </li>
        `
          )
          .join("")}
      </ul>
    </div>
    `
        )
        .join("")
    : `
    <div class="section">
      <ol class="song-list ordered">
        ${songs
          .map(
            (song) => `
          <li class="song-item">
            <span class="song-title">${song.title}</span><br>
            <span class="song-artist">${song.artist}</span>
          </li>
        `
          )
          .join("")}
      </ol>
    </div>
    `;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Harborline - ${title}</title>
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
    .song-list.ordered { list-style: decimal inside; }
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
      <p class="header-title">${title}</p>
      <p class="subtitle">${opts.grouped ? "Curated playlist" : "Setlist"} • ${songs.length} songs</p>
    </div>
    ${sectionsHtml}
    <div class="footer">
      <img src="${logoNew}" alt="Harborline" class="footer-logo" onerror="this.style.display='none'">
      <p class="footer-tagline">Baltimore's Premier Event Band</p>
      <a href="https://harborlineband.com" class="footer-link">harborlineband.com</a>
    </div>
  </div>
</body>
</html>`;

  triggerDownload(htmlContent, "text/html", `${fileBase}.html`);
  toast.success("Exported as HTML! Open in browser and print to PDF.");
};

export const copySongsToClipboard = (songs: Song[], opts: ExportOptions = {}) => {
  const content = opts.grouped
    ? songs.map((s) => `• ${s.title} - ${s.artist}`).join("\n")
    : songs.map((s, i) => `${i + 1}. ${s.title} - ${s.artist}`).join("\n");
  navigator.clipboard
    .writeText(content)
    .then(() => toast.success("Copied to clipboard!"))
    .catch(() => toast.error("Failed to copy to clipboard"));
};

export const printSongs = async (songs: Song[], opts: ExportOptions = {}) => {
  const title = opts.title ?? DEFAULT_TITLE;

  // Convert logo to base64 for embedding in the print window.
  const getLogoBase64 = (): Promise<string> =>
    new Promise((resolve) => {
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

  const logoBase64 = await getLogoBase64();
  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    toast.error("Please allow popups to print");
    return;
  }

  // Build the row list: genre-flattened for grouped, given order for setlist.
  const rows = opts.grouped
    ? Object.entries(groupByGenre(songs)).flatMap(([genre, genreSongs]) =>
        genreSongs.map((song) => ({ ...song, genre }))
      )
    : songs;

  const colSize = Math.ceil(rows.length / 2);
  const col1 = rows.slice(0, colSize);
  const col2 = rows.slice(colSize);

  const renderColumn = (colSongs: Song[], startIndex: number) =>
    colSongs
      .map(
        (song, i) => `
      <div class="song-row">
        <span class="song-title">${
          opts.grouped ? "" : `${startIndex + i + 1}. `
        }${song.title}</span>
        <span class="song-artist">${song.artist}</span>
      </div>
    `
      )
      .join("");

  printWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
  <title>Harborline - ${title}</title>
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
    .container { max-width: 100%; margin: 0 auto; }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 15px;
      padding-bottom: 12px;
      border-bottom: 2px solid #7C3AED;
    }
    .header-left { display: flex; align-items: center; gap: 15px; }
    .header-logo { width: 100px; height: auto; }
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
    .header-right { text-align: right; }
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
    .columns { display: flex; gap: 20px; }
    .column { flex: 1; }
    .song-row { padding: 2px 0; border-bottom: 1px solid #f0f0f0; }
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
    .footer-left { display: flex; align-items: center; gap: 10px; }
    .footer-logo { width: 50px; height: auto; opacity: 0.8; }
    .footer-tagline {
      font-family: 'Montserrat', sans-serif;
      font-size: 7px;
      letter-spacing: 2px;
      color: #666;
      text-transform: uppercase;
    }
    .footer-contact { font-family: 'Montserrat', sans-serif; font-size: 8px; color: #7C3AED; }
    .footer-date { font-size: 8px; color: #aaa; font-style: italic; }
    @media print {
      body { padding: 20px 25px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      @page { size: letter; margin: 0.4in; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-left">
        ${logoBase64 ? `<img src="${logoBase64}" alt="Harborline" class="header-logo">` : ""}
        <div class="header-text">
          <p class="header-title">${title}</p>
          <p class="header-subtitle">${opts.grouped ? "Curated playlist for your special occasion" : "Performance setlist"}</p>
        </div>
      </div>
      <div class="header-right">
        <div class="stat-number">${songs.length}</div>
        <div class="stat-label">Songs</div>
      </div>
    </div>
    <div class="columns">
      <div class="column">${renderColumn(col1, 0)}</div>
      <div class="column">${renderColumn(col2, colSize)}</div>
    </div>
    <div class="footer">
      <div class="footer-left">
        ${logoBase64 ? `<img src="${logoBase64}" alt="Harborline" class="footer-logo">` : ""}
        <p class="footer-tagline">Baltimore's Premier Event Band</p>
      </div>
      <div>
        <p class="footer-contact">harborlineband.com</p>
        <p class="footer-date">Generated on ${today}</p>
      </div>
    </div>
  </div>
  <script>
    window.onload = function() { setTimeout(function() { window.print(); }, 200); };
  </script>
</body>
</html>`);
  printWindow.document.close();
};
