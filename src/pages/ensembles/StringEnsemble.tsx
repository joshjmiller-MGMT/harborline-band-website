import Layout from "@/components/Layout";
import PageHero from "@/components/PageHero";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { OptimizedImage } from "@/components/OptimizedImage";
import { Music2, Heart, Users, Sparkles, CheckCircle } from "lucide-react";
const features = [
  { icon: Users, text: "2-4 Musicians" },
  { icon: Music2, text: "Classical + Pop Arrangements" },
  { icon: Heart, text: "Ceremony-Focused" },
  { icon: Sparkles, text: "Acoustic, No PA" },
];

const includes = [
  "Violin(s)",
  "Viola",
  "Cello",
  "Classical repertoire",
  "Modern pop arrangements",
  "Custom song arrangements",
  "Professional attire",
  "Self-sufficient setup",
];

const idealFor = [
  "Wedding ceremonies",
  "Church services",
  "Memorial celebrations",
  "Formal dinners",
  "Corporate receptions",
  "Black-tie galas",
];

const StringEnsemblePage = () => {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": "Harborline String Ensemble",
    "provider": {
      "@type": "MusicGroup",
      "name": "Harborline"
    },
    "areaServed": "Baltimore, Maryland",
    "description": "Harborline's string ensemble — 2 to 4 musicians (violin(s), viola, cello). Classical repertoire plus custom pop arrangements. Acoustic — no PA needed for ceremony or cocktail volume. Conservatory-trained players for ceremonies, formal dinners, corporate receptions, and galas in Baltimore + DC + the DMV."
  };

  return (
    <Layout
      title="String Quartet Baltimore | Harborline String Ensemble"
      description="Harborline's string ensemble — 2 to 4 conservatory-trained players (violin / viola / cello) for wedding ceremonies, prelude sets, and formal events. Classical repertoire plus custom arrangements of pop and rock hits. Acoustic — no amp needed."
      canonical="https://harborlineband.com/ensembles/string-ensemble"
    >
      <script type="application/ld+json">
        {JSON.stringify(schema)}
      </script>

      <PageHero
        eyebrow="STRING ENSEMBLE"
        title="STRINGS — BACH TO BEYONCÉ"
        subtitle="Two to four conservatory-trained players. Classical repertoire or custom pop arrangements — your call"
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
                ACOUSTIC, <span className="text-gradient-brand">CONSERVATORY-TRAINED</span>
              </h2>
              <p className="text-muted-foreground text-lg">
                The string ensemble is what we staff when a ceremony or formal moment needs
                music that the room hears without amplification. Two to four players —
                typically violin and cello, often a viola, sometimes two violins for
                processional weight. Acoustic. No PA setup, no monitor wedges, no power
                outlet required.
              </p>
              <p className="text-muted-foreground">
                Classical repertoire is the floor — Bach, Pachelbel's Canon, Vivaldi, Handel
                for a processional or prelude. Custom arrangements of pop and rock songs are
                the upgrade — Coldplay, Adele, Vampire Weekend, your first-dance song in
                chamber arrangement. The players are conservatory-trained. The arrangements
                are by working musicians.
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
                src="gallery-4"
                alt="String ensemble performance"
                className="rounded-lg shadow-lg"
              />
              <OptimizedImage
                src="gallery-5"
                alt="String ensemble performing at a ceremony"
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
                    <Music2 className="w-5 h-5 text-primary flex-shrink-0" />
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

export default StringEnsemblePage;
