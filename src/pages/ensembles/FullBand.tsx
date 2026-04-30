import Layout from "@/components/Layout";
import PageHero from "@/components/PageHero";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Users, Music, Mic2, Zap, Volume2, CheckCircle } from "lucide-react";
import liveDjSax from "@/assets/band/live-dj-sax.webp";
import specialEventDancer from "@/assets/band/special-event-dancer.webp";

const features = [
  { icon: Users, text: "8-12 Musicians" },
  { icon: Volume2, text: "Full Horn Section" },
  { icon: Mic2, text: "Lead Vocalists" },
  { icon: Zap, text: "High-Energy Performance" },
];

const includes = [
  "Lead vocals (male & female)",
  "Full rhythm section (drums, bass, keys, guitar)",
  "3-4 piece horn section",
  "Background vocals",
  "Professional sound system",
  "Stage lighting package",
  "Wireless microphones",
  "Emcee services",
];

const idealFor = [
  "Wedding receptions",
  "Corporate galas",
  "Large private parties",
  "Fundraising events",
  "Holiday celebrations",
];

const FullBandPage = () => {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": "Harborline Full Dance Band",
    "provider": {
      "@type": "MusicGroup",
      "name": "Harborline"
    },
    "areaServed": "Baltimore, Maryland",
    "description": "8-12 piece high-energy dance band for weddings, galas, and special events in Baltimore and the Mid-Atlantic."
  };

  return (
    <Layout
      title="Full Dance Band Baltimore | Harborline 8-12 Piece Band"
      description="Experience the ultimate in live entertainment with Harborline's full dance band. 8-12 musicians delivering high-energy performances for weddings and events."
      canonical="https://harborlineband.com/ensembles/full-band"
    >
      <script type="application/ld+json">
        {JSON.stringify(schema)}
      </script>

      <PageHero
        eyebrow="THE FULL BAND"
        title="MAXIMUM IMPACT"
        subtitle="8-12 musicians delivering an unforgettable wall of sound that packs every dance floor"
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
                THE COMPLETE <span className="text-gradient-gold">LIVE EXPERIENCE</span>
              </h2>
              <p className="text-muted-foreground text-lg">
                When you want an event that people will talk about for years, you bring the full band. 
                Our 8-12 piece ensemble delivers the kind of energy and showmanship that transforms 
                any venue into an unforgettable celebration.
              </p>
              <p className="text-muted-foreground">
                With a complete horn section, dual lead vocalists, and a tight rhythm section, 
                we cover everything from Motown classics to modern chart-toppers with the 
                authenticity and power that only a full live band can deliver.
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
                src={liveDjSax}
                alt="Full band with DJ and saxophone"
                className="rounded-lg shadow-lg"
              />
              <img
                src={specialEventDancer}
                alt="Special event with ribbon dancer and live band"
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
                THE LINEUP
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
                IDEAL EVENTS
              </h2>
              <ul className="space-y-3">
                {idealFor.map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <Music className="w-5 h-5 text-primary flex-shrink-0" />
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

export default FullBandPage;
