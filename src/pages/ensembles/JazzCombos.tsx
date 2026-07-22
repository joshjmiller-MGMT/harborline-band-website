import Layout from "@/components/Layout";
import PageHero from "@/components/PageHero";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { OptimizedImage } from "@/components/OptimizedImage";
import { Music, Wine, Users, Sparkles, CheckCircle } from "lucide-react";
const features = [
  { icon: Users, text: "3 to 7 Pieces" },
  { icon: Music, text: "Swing + Bossa" },
  { icon: Wine, text: "Ballads + Contemporary" },
  { icon: Sparkles, text: "Reads the Room" },
];

const includes = [
  "3 to 7 musicians, your size",
  "Piano or guitar (or both)",
  "Upright or electric bass",
  "Drums and percussion",
  "Saxophone or trumpet (or both)",
  "Optional vocals",
  "Curated standards library",
  "Background or featured set",
];

const idealFor = [
  "Cocktail hours",
  "Dinner music",
  "Upscale corporate events",
  "Art gallery openings",
  "Wine tastings",
  "Intimate wedding receptions",
];

const JazzCombosPage = () => {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": "Harborline Jazz Combos",
    "provider": {
      "@type": "MusicGroup",
      "name": "Harborline"
    },
    "areaServed": "Baltimore, Maryland",
    "description": "Harborline's jazz combos — three to seven musicians, instrumentation to fit your event. Swing, bossa, ballads, and contemporary for cocktail hours, dinner sets, corporate events, gallery openings, and reception sets in Baltimore + DC + the DMV."
  };

  return (
    <Layout
      title="Jazz Combos Baltimore | Harborline Live Jazz Music"
      description="Harborline's jazz combos — three to seven musicians for cocktail hours, dinner sets, corporate events, and reception sets in Baltimore + DC + the DMV. Swing, bossa, ballads, contemporary. Pick your size; we staff the lineup to match the room."
      canonical="https://harborlineband.com/ensembles/jazz-combos"
    >
      <script type="application/ld+json">
        {JSON.stringify(schema)}
      </script>

      <PageHero
        eyebrow="JAZZ COMBOS"
        title="JAZZ THAT READS THE ROOM"
        subtitle="Three to seven musicians, staffed to the gig — swing to bossa, ballads to contemporary"
      />

      {/* Intro Section */}
      <section className="py-20 md:py-24">
        <div className="container px-6 max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="space-y-6"
            >
              <h2 className="font-display text-4xl md:text-5xl tracking-tight">
                STAFFED TO THE <span className="text-gradient-brand">GIG</span>
              </h2>
              <p className="text-muted-foreground text-lg">
                Three to seven musicians, staffed to the gig — swing to bossa, ballads to
                contemporary. A trio for a quiet dinner, a quintet with horns for a cocktail
                hour, a septet when the floor wants to open up. Pick the size; we staff the
                lineup to match.
              </p>
              <p className="text-muted-foreground">
                Swing, bossa, ballads, contemporary. The set list shifts to the room — bossa
                for dinner, swing when the floor opens, ballads where the moment calls. The
                MD adjusts set by set.
              </p>
              <div className="flex flex-wrap gap-4 pt-4">
                {features.map((feature) => (
                  <div
                    key={feature.text}
                    className="flex items-center gap-2 px-4 py-2 bg-secondary/50 rounded-full text-sm"
                  >
                    <feature.icon className="w-4 h-4 text-primary" />
                    <span>{feature.text}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="grid grid-cols-2 gap-4"
            >
              <OptimizedImage
                src="band/jazz-trio-1"
                alt="Jazz combo performing under tent with piano, drums and upright bass"
                className="rounded-lg shadow-lg"
              />
              <OptimizedImage
                src="band/jazz-trio-2"
                alt="Jazz combo performing at an intimate event"
                className="rounded-lg shadow-lg mt-8"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* What's Included */}
      <section className="py-20 md:py-24 bg-card">
        <div className="container px-6 max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <p className="text-primary font-display tracking-display text-sm mb-3">
                THE ENSEMBLE
              </p>
              <h2 className="font-display text-4xl tracking-tight mb-8">
                WHAT'S INCLUDED
              </h2>
              <ul className="space-y-3">
                {includes.map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              <p className="text-primary font-display tracking-display text-sm mb-3">
                PERFECT FOR
              </p>
              <h2 className="font-display text-4xl tracking-tight mb-8">
                IDEAL SETTINGS
              </h2>
              <ul className="space-y-3">
                {idealFor.map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <Wine className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mt-16"
          >
            <Button variant="hero" size="lg" asChild>
              <a href="/request-a-quote">Request a Quote</a>
            </Button>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
};

export default JazzCombosPage;
