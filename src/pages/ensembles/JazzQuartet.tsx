import Layout from "@/components/Layout";
import PageHero from "@/components/PageHero";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Music, Wine, Users, Sparkles, CheckCircle } from "lucide-react";
import jazzTrio1 from "@/assets/band/jazz-trio-1.webp";
import jazzTrio2 from "@/assets/band/jazz-trio-2.webp";

const features = [
  { icon: Users, text: "4 Musicians" },
  { icon: Wine, text: "Sophisticated Sound" },
  { icon: Music, text: "Standards & Swing" },
  { icon: Sparkles, text: "Intimate Elegance" },
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
    "description": "Sophisticated jazz quartet for cocktail hours, corporate events, and elegant celebrations in Baltimore."
  };

  return (
    <Layout
      title="Jazz Quartet Baltimore | Harborline Live Jazz Music"
      description="Add sophistication to your event with Harborline's jazz quartet. Perfect for cocktail hours, corporate events, and upscale celebrations."
      canonical="https://harborlineband.com/ensembles/jazz-quartet"
    >
      <script type="application/ld+json">
        {JSON.stringify(schema)}
      </script>

      <PageHero
        eyebrow="JAZZ QUARTET"
        title="TIMELESS SOPHISTICATION"
        subtitle="Four musicians creating the perfect atmosphere of elegance and swing"
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
                THE ART OF <span className="text-gradient-gold">LIVE JAZZ</span>
              </h2>
              <p className="text-muted-foreground text-lg">
                There's a reason jazz has been the soundtrack to elegant gatherings for a century. 
                Our quartet brings the warmth, spontaneity, and sophistication that only live jazz 
                can provide.
              </p>
              <p className="text-muted-foreground">
                From Great American Songbook standards to bossa nova, from swing classics to 
                modern jazz interpretations of contemporary hits—our musicians create an atmosphere 
                of refined celebration that elevates any event.
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
              <img
                src={jazzTrio1}
                alt="Jazz trio performing under tent with piano, drums and upright bass"
                className="rounded-lg shadow-lg"
              />
              <img
                src={jazzTrio2}
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
