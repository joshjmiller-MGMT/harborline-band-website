import Layout from "@/components/Layout";
import PageHero from "@/components/PageHero";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { OptimizedImage } from "@/components/OptimizedImage";
import { Music, Wine, Users, Sparkles, CheckCircle } from "lucide-react";
const features = [
  { icon: Users, text: "4 Musicians" },
  { icon: Music, text: "Standards + Bossa" },
  { icon: Wine, text: "Brushes Optional" },
  { icon: Sparkles, text: "Reads the Room" },
];

const includes = [
  "Piano or guitar",
  "Upright or electric bass",
  "Drums with brushes option",
  "Saxophone or trumpet",
  "Vocal capabilities",
  "Curated jazz standards library",
  "Custom song requests",
  "Background or featured performance",
];

const idealFor = [
  "Cocktail hours",
  "Dinner music",
  "Upscale corporate events",
  "Art gallery openings",
  "Wine tastings",
  "Intimate wedding receptions",
];

const JazzQuartetPage = () => {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": "Harborline Jazz Quartet",
    "provider": {
      "@type": "MusicGroup",
      "name": "Harborline"
    },
    "areaServed": "Baltimore, Maryland",
    "description": "Harborline's 4-piece jazz quartet — piano or guitar, upright or electric bass, drums with brushes, sax or trumpet, optional vocals. Standards, bossa nova, swing classics, and jazz takes on modern hits. Cocktail hours, dinner sets, corporate events, gallery openings, wine tastings, and reception sets in Baltimore + DC + the DMV."
  };

  return (
    <Layout
      title="Jazz Quartet Baltimore | Harborline Live Jazz Music"
      description="Harborline's jazz quartet — 4 musicians playing standards, bossa nova, and swing classics for cocktail hours, dinner sets, corporate events, gallery openings. We adjust volume and tempo to the room — brushes for dinner, swing-out when the floor opens up."
      canonical="https://harborlineband.com/ensembles/jazz-quartet"
    >
      <script type="application/ld+json">
        {JSON.stringify(schema)}
      </script>

      <PageHero
        eyebrow="JAZZ QUARTET"
        title="FOUR PIECES, ONE GROOVE"
        subtitle="Piano or guitar, upright or electric bass, drums, sax or trumpet — and we read the room from the first set"
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
                FOUR PIECES, <span className="text-gradient-gold">ONE GROOVE</span>
              </h2>
              <p className="text-muted-foreground text-lg">
                The quartet is piano or guitar, upright or electric bass, drums with brushes
                for the dinner sets, and sax or trumpet on top. Optional vocals if the moment
                calls for it. We staff the gig for what the room actually needs — three sets
                at a cocktail hour reads differently than a single-set wedding cocktail window.
              </p>
              <p className="text-muted-foreground">
                Standards from the Great American Songbook are the bread and butter — Cole
                Porter, Gershwin, Mancini, Bacharach. Bossa nova when the energy needs to
                settle. Swing classics when the floor wants to open. Jazz takes on modern
                hits when the crowd is more contemporary than canonical. The MD watches the
                room and pivots set-by-set.
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
                alt="Jazz trio performing under tent with piano, drums and upright bass"
                className="rounded-lg shadow-lg"
              />
              <OptimizedImage
                src="band/jazz-trio-2"
                alt="Jazz trio intimate performance"
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

export default JazzQuartetPage;
