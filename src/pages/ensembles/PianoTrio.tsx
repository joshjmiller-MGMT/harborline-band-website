import Layout from "@/components/Layout";
import PageHero from "@/components/PageHero";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Piano, Music, Users, Heart, CheckCircle } from "lucide-react";
import jazzTrio1 from "@/assets/band/jazz-trio-1.webp";
import jazzTrio2 from "@/assets/band/jazz-trio-2.webp";

const features = [
  { icon: Users, text: "3 Musicians" },
  { icon: Piano, text: "Piano-Led Sound" },
  { icon: Music, text: "Versatile Repertoire" },
  { icon: Heart, text: "Romantic Ambiance" },
];

const includes = [
  "Piano (acoustic or electric)",
  "Upright or electric bass",
  "Drums or percussion",
  "Optional vocalist",
  "Extensive song library",
  "Custom arrangements",
  "Background or spotlight performance",
  "Flexible setup options",
];

const idealFor = [
  "Wedding ceremonies",
  "Cocktail receptions",
  "Restaurant ambiance",
  "Hotel lobbies",
  "Intimate dinner parties",
  "Proposal events",
];

const PianoTrioPage = () => {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": "Harborline Piano Trio",
    "provider": {
      "@type": "MusicGroup",
      "name": "Harborline"
    },
    "areaServed": "Baltimore, Maryland",
    "description": "Elegant piano trio for weddings, cocktail hours, and intimate events in Baltimore and Maryland."
  };

  return (
    <Layout
      title="Piano Trio Baltimore | Harborline Live Piano Music"
      description="Create an atmosphere of elegance with Harborline's piano trio. Perfect for weddings, cocktail hours, and sophisticated gatherings."
      canonical="https://harborlineband.com/ensembles/piano-trio"
    >
      <script type="application/ld+json">
        {JSON.stringify(schema)}
      </script>

      <PageHero
        eyebrow="PIANO TRIO"
        title="ELEGANT INTIMACY"
        subtitle="The perfect balance of sophistication and warmth for refined celebrations"
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
                CLASSIC <span className="text-gradient-gold">PIANO ELEGANCE</span>
              </h2>
              <p className="text-muted-foreground text-lg">
                The piano trio is the quintessential choice for events where ambiance matters. 
                Three musicians creating a full, rich sound that fills a room without overpowering 
                conversation.
              </p>
              <p className="text-muted-foreground">
                From romantic ballads during dinner to upbeat standards that get toes tapping, 
                our piano trio adapts seamlessly to the mood of your event—sophisticated enough 
                for a black-tie affair, warm enough for an intimate gathering.
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
                alt="Piano trio performing with drums and upright bass"
                className="rounded-lg shadow-lg"
              />
              <img
                src={jazzTrio2}
                alt="Elegant trio performance under tent"
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
                    <Piano className="w-5 h-5 text-primary flex-shrink-0" />
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

export default PianoTrioPage;
