import Layout from "@/components/Layout";
import PageHero from "@/components/PageHero";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { OptimizedImage } from "@/components/OptimizedImage";
import { Piano, Music, Users, Heart, CheckCircle } from "lucide-react";
const features = [
  { icon: Users, text: "3 Musicians" },
  { icon: Piano, text: "Piano-Led Sound" },
  { icon: Music, text: "Ballads to Standards" },
  { icon: Heart, text: "Conversation Volume" },
];

const includes = [
  "Piano-led (acoustic or electric)",
  "Two more — bass, drums, vocals, or sax",
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
    "description": "Harborline's piano trio — three musicians, piano-led (acoustic or electric) with two more to fit the event: bass, drums, vocals, or sax. Conversation-level volume floor for ceremonies, cocktail hours, dinner sets, lobbies, and proposal events in Baltimore + DC + the DMV."
  };

  return (
    <Layout
      title="Piano Trio Baltimore | Harborline Live Piano Music"
      description="Harborline's piano trio — three musicians for weddings, cocktail hours, restaurant ambiance, and intimate gatherings. Piano-led volume floor means full sound that doesn't drown the conversation."
      canonical="https://harborlineband.com/ensembles/piano-trio"
    >
      <script type="application/ld+json">
        {JSON.stringify(schema)}
      </script>

      <PageHero
        eyebrow="PIANO TRIO"
        title="PIANO + TWO"
        subtitle="Full sound at conversation volume — piano-led, instrumentation to the room"
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
                PIANO-LED <span className="text-gradient-gold">THREE-PIECE</span>
              </h2>
              <p className="text-muted-foreground text-lg">
                The trio is the right call when the room needs a full sound that doesn't drown
                the conversation. Three musicians — piano-led, with two more to fit the event.
                Bass and drums for a jazz feel, bass and vocals for a singer-songwriter mood,
                sax and bass for cocktail-hour energy. Volume floor that lets a ceremony, a
                reception, or a dinner set breathe.
              </p>
              <p className="text-muted-foreground">
                Ballads for the dinner hour. Standards when the room loosens up. Pop
                arrangements for a younger crowd. We've staffed this trio at hotel lobbies,
                wedding ceremonies (processional and reception), proposal moments where the
                music needed to land just right, and corporate dinners where two-piece felt
                thin but five-piece would crowd the room.
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
                alt="Piano trio performing with drums and upright bass"
                className="rounded-lg shadow-lg"
              />
              <OptimizedImage
                src="band/jazz-trio-2"
                alt="Piano trio performing under tent with drums and upright bass"
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
