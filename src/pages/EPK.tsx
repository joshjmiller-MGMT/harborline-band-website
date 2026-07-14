import Layout from "@/components/Layout";
import PageHero from "@/components/PageHero";
import { motion } from "framer-motion";
import { OptimizedImage } from "@/components/OptimizedImage";
import { Link } from "react-router-dom";
import {
  Music,
  Users,
  ShieldCheck,
  Building2,
  MapPin,
  Play,
  Instagram,
  Phone,
  Mail,
  Globe,
} from "lucide-react";

// Content is the Josh-confirmed one-sheet (wiki/harborline/harborline-one-sheet.md).
// Real venue/org lists only — deliberately NOT the inflated "1000+/10+ yrs" public stats.

const why = [
  {
    icon: Music,
    title: "Range, not genre",
    body: "Sinatra through Bruno Mars — Motown, soul, funk, pop, today's hits. The music director reads the room and pivots the set live. No canned setlist.",
  },
  {
    icon: Users,
    title: "Scalable in one call",
    body: "Solo to 12-piece with horns — sized to the venue, headcount, and budget.",
  },
  {
    icon: ShieldCheck,
    title: "Operational backbone",
    body: "A named point of contact from first inquiry. A confirmed backup for every role on the roster. Line-itemed pricing. Check-ins at 1 week, 72 hours, and 24 hours out.",
  },
  {
    icon: Users,
    title: "Working musicians",
    body: "The players on the date are the players on the website. Built for reliability under pressure, including short-notice backup and overflow.",
  },
];

const configs = [
  { setup: "Solo performer", size: "1", best: "Cocktail hours, dinners" },
  { setup: "Acoustic duo", size: "2", best: "Ceremonies, intimate gatherings" },
  { setup: "Piano trio", size: "3", best: "Dinner-to-cocktail, dance volume" },
  { setup: "Jazz combos", size: "3–7", best: "Swing to bossa, ballads to contemporary" },
  { setup: "String ensemble", size: "2–4", best: "Ceremonies — Bach to modern pop" },
  { setup: "Full band", size: "8–12", best: "High-energy dance band with horns + vocals" },
];

const venues = [
  "Four Seasons Baltimore",
  "The Sagamore Pendry",
  "George Peabody Library",
  "The Belvedere",
  "Cylburn Arboretum",
  "Evergreen Museum",
  "B&O Railroad Museum",
  "Cloisters Castle",
];

const orgs = [
  "T. Rowe Price",
  "Johns Hopkins",
  "Under Armour",
  "Marriott International",
  "Legg Mason",
  "McCormick & Company",
  "Baltimore Ravens",
  "University of Maryland",
];

const VIMEO_SHOWCASE = "https://vimeo.com/showcase/11690570";

const EPKPage = () => {
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://harborlineband.com/" },
      { "@type": "ListItem", position: 2, name: "Press Kit", item: "https://harborlineband.com/epk" },
    ],
  };

  return (
    <Layout
      title="Press Kit (EPK) | Harborline — Musician-Led Event Band"
      description="The Harborline electronic press kit: who we are, our configurations from solo to 12-piece, venues and organizations we've worked, video, and booking contact for weddings, galas, and corporate events across the DMV."
      canonical="https://harborlineband.com/epk"
    >
      <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>

      <PageHero
        eyebrow="PRESS KIT"
        title="HARBORLINE EPK"
        subtitle="Baltimore's musician-led event band"
        showCTA={false}
      />

      {/* Intro + primary actions */}
      <section className="py-16 md:py-20">
        <div className="container px-6 max-w-5xl mx-auto text-center">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto"
          >
            Live music for weddings, galas, and corporate events across the DMV — built and led by
            working musicians.
          </motion.p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/request-a-quote"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition"
            >
              Request a Quote
            </Link>
            <a
              href={VIMEO_SHOWCASE}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-border px-5 py-2.5 text-sm font-medium hover:bg-muted/40 transition"
            >
              <Play className="w-4 h-4" /> Watch the band
            </a>
          </div>
        </div>
      </section>

      {/* Why Harborline */}
      <section className="py-16 bg-card">
        <div className="container px-6 max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-primary font-display tracking-display text-sm mb-3">WHY HARBORLINE</p>
            <h2 className="font-display text-4xl md:text-5xl tracking-tight">WHAT SETS US APART</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            {why.map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="p-6 bg-secondary/30 border border-border rounded-lg"
              >
                <item.icon className="w-9 h-9 text-primary mb-4" />
                <h3 className="font-display text-xl mb-2">{item.title}</h3>
                <p className="text-muted-foreground text-sm">{item.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Configurations */}
      <section className="py-16 md:py-20">
        <div className="container px-6 max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-primary font-display tracking-display text-sm mb-3">CONFIGURATIONS</p>
            <h2 className="font-display text-4xl md:text-5xl tracking-tight">SIZED TO THE ROOM</h2>
          </div>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-left">
              <thead className="bg-secondary/40 text-sm">
                <tr>
                  <th className="px-4 py-3 font-display tracking-wide">Setup</th>
                  <th className="px-4 py-3 font-display tracking-wide">Size</th>
                  <th className="px-4 py-3 font-display tracking-wide">Best for</th>
                </tr>
              </thead>
              <tbody>
                {configs.map((c, i) => (
                  <tr key={c.setup} className={i % 2 ? "bg-card/40" : ""}>
                    <td className="px-4 py-3 font-medium">{c.setup}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.size}</td>
                    <td className="px-4 py-3 text-muted-foreground text-sm">{c.best}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Credentials */}
      <section className="py-16 bg-card">
        <div className="container px-6 max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <OptimizedImage
                src="band/group-waterfront-1"
                alt="Harborline band by the water"
                className="rounded-lg shadow-2xl"
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <p className="text-primary font-display tracking-display text-sm mb-3">CREDENTIALS</p>
              <p className="text-muted-foreground mb-6">
                Musician-led and Baltimore-based, led by <strong className="text-foreground">Josh Miller</strong>{" "}
                (bandleader, music director, keyboards) — UMBC Jazz Studies, with a core rhythm section across
                every Harborline date.
              </p>

              <div className="mb-6">
                <div className="flex items-center gap-2 text-sm font-display tracking-wide text-foreground mb-3">
                  <MapPin className="w-4 h-4 text-primary" /> DMV venues &amp; rooms
                </div>
                <div className="flex flex-wrap gap-2">
                  {venues.map((v) => (
                    <span key={v} className="rounded-full border border-border bg-secondary/30 px-3 py-1 text-xs text-muted-foreground">
                      {v}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 text-sm font-display tracking-wide text-foreground mb-3">
                  <Building2 className="w-4 h-4 text-primary" /> Performed for
                </div>
                <div className="flex flex-wrap gap-2">
                  {orgs.map((o) => (
                    <span key={o} className="rounded-full border border-border bg-secondary/30 px-3 py-1 text-xs text-muted-foreground">
                      {o}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* See & hear */}
      <section className="py-16 md:py-20">
        <div className="container px-6 max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-primary font-display tracking-display text-sm mb-3">SEE &amp; HEAR</p>
            <h2 className="font-display text-4xl md:text-5xl tracking-tight">THE BAND, LIVE</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <a href={VIMEO_SHOWCASE} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-lg border border-border p-4 hover:bg-muted/40 transition">
              <Play className="w-5 h-5 text-primary shrink-0" />
              <span className="text-sm">Video showcase</span>
            </a>
            <Link to="/where-we-perform" className="flex items-center gap-3 rounded-lg border border-border p-4 hover:bg-muted/40 transition">
              <MapPin className="w-5 h-5 text-primary shrink-0" />
              <span className="text-sm">Where we perform</span>
            </Link>
            <Link to="/ensembles/full-band" className="flex items-center gap-3 rounded-lg border border-border p-4 hover:bg-muted/40 transition">
              <Music className="w-5 h-5 text-primary shrink-0" />
              <span className="text-sm">Configurations &amp; ensembles</span>
            </Link>
            <a href="https://instagram.com/harborline.band" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-lg border border-border p-4 hover:bg-muted/40 transition">
              <Instagram className="w-5 h-5 text-primary shrink-0" />
              <span className="text-sm">@harborline.band</span>
            </a>
          </div>
        </div>
      </section>

      {/* Booking */}
      <section className="py-16 bg-card">
        <div className="container px-6 max-w-3xl mx-auto text-center">
          <p className="text-primary font-display tracking-display text-sm mb-3">BOOKING</p>
          <h2 className="font-display text-3xl md:text-4xl tracking-tight mb-2">Josh Miller</h2>
          <p className="text-muted-foreground mb-6">Bandleader &amp; Music Director</p>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm">
            <a href="mailto:harborlineband@gmail.com" className="inline-flex items-center gap-2 hover:text-primary transition">
              <Mail className="w-4 h-4 text-primary" /> harborlineband@gmail.com
            </a>
            <a href="tel:+14437856769" className="inline-flex items-center gap-2 hover:text-primary transition">
              <Phone className="w-4 h-4 text-primary" /> (443) 785-6769
            </a>
            <a href="https://harborlineband.com" className="inline-flex items-center gap-2 hover:text-primary transition">
              <Globe className="w-4 h-4 text-primary" /> harborlineband.com
            </a>
          </div>

          <p className="mt-6 text-xs text-muted-foreground">
            Pricing tiers, tech/hospitality rider, and references available on request. Happy to work to your
            commission structure.
          </p>

          <div className="mt-8">
            <Link
              to="/request-a-quote"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:opacity-90 transition"
            >
              Request a Quote
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default EPKPage;
