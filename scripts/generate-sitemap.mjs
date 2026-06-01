#!/usr/bin/env node
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = resolve(__dirname, "..", "public");
const OUT_FILE = resolve(PUBLIC_DIR, "sitemap.xml");
const ORIGIN = "https://harborlineband.com";

const routes = [
  { path: "/", priority: "1.0" },

  { path: "/about", priority: "0.8" },
  { path: "/faq", priority: "0.8" },
  { path: "/songs", priority: "0.8" },
  { path: "/where-we-perform", priority: "0.8" },
  { path: "/request-a-quote", priority: "0.8" },

  { path: "/weddings", priority: "0.7" },
  { path: "/corporate", priority: "0.7" },
  { path: "/galas", priority: "0.7" },
  { path: "/private-parties", priority: "0.7" },
  { path: "/birthday-parties", priority: "0.7" },
  { path: "/holiday-parties", priority: "0.7" },
  { path: "/anniversaries", priority: "0.7" },
  { path: "/brewery-events", priority: "0.7" },

  { path: "/ensembles/full-band", priority: "0.7" },
  { path: "/ensembles/jazz-combos", priority: "0.7" },
  { path: "/ensembles/piano-trio", priority: "0.7" },
  { path: "/ensembles/acoustic-duo", priority: "0.7" },
  { path: "/ensembles/string-ensemble", priority: "0.7" },
  { path: "/ensembles/solo-performer", priority: "0.7" },

  { path: "/locations/baltimore", priority: "0.6" },
  { path: "/locations/towson", priority: "0.6" },
  { path: "/locations/columbia", priority: "0.6" },
  { path: "/locations/annapolis", priority: "0.6" },
  { path: "/locations/washington-dc", priority: "0.6" },
  { path: "/locations/bethesda", priority: "0.6" },
  { path: "/locations/rockville", priority: "0.6" },
  { path: "/locations/frederick", priority: "0.6" },
  { path: "/locations/eastern-shore", priority: "0.6" },

  { path: "/venues/pendry-baltimore", priority: "0.6" },
  { path: "/venues/sagamore-pendry", priority: "0.6" },
  { path: "/venues/george-peabody-library", priority: "0.6" },
  { path: "/venues/the-belvedere", priority: "0.6" },
  { path: "/venues/american-visionary-art-museum", priority: "0.6" },
  { path: "/venues/b-and-o-railroad-museum", priority: "0.6" },
  { path: "/venues/four-seasons-baltimore", priority: "0.6" },
  { path: "/venues/evergreen-museum", priority: "0.6" },
  { path: "/venues/legg-mason-tower", priority: "0.6" },
  { path: "/venues/cylburn-arboretum", priority: "0.6" },
  { path: "/venues/cloisters-castle", priority: "0.6" },
];

const today = new Date().toISOString().slice(0, 10);

const urlEntries = routes
  .map(
    ({ path, priority }) =>
      `  <url>\n    <loc>${ORIGIN}${path}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>${priority}</priority>\n  </url>`,
  )
  .join("\n");

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlEntries}\n</urlset>\n`;

mkdirSync(PUBLIC_DIR, { recursive: true });
writeFileSync(OUT_FILE, xml, "utf8");

console.log(`sitemap.xml written → ${OUT_FILE} (${routes.length} URLs)`);
