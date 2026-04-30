import Layout from "@/components/Layout";
import PageHero from "@/components/PageHero";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Guitar, Mic2, Users, Heart, CheckCircle } from "lucide-react";
import galleryImage2 from "@/assets/gallery-2.jpg";
import galleryImage3 from "@/assets/gallery-3.jpg";

const features = [
  { icon: Users, text: "2 Musicians" },
  { icon: Guitar, text: "Acoustic Sound" },
  { icon: Mic2, text: "Vocal Harmonies" },
  { icon: Heart, text: "Intimate Feel" },
];

const includes = [
  "Guitar (acoustic or electric)",
  "Piano or second guitar",
  "Lead and harmony vocals",
  "Compact sound system",
  "Diverse song catalog",
  "Custom song learning",
  "Minimal footprint setup",
  "Continuous performance",
];

const idealFor = [
  "Wedding ceremonies",
  "Cocktail hours",
  "Brewery & winery events",
  "Intimate celebrations",
  "Outdoor gatherings",
  "Restaurant performances",
];

const AcousticDuoPage = () => {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": "Harborline Acoustic Duo",
    "provider": {
      "@type": "MusicGroup",
      "name": "Harborline"
    },
    "areaServed": "Baltimore, Maryland",
    "description": "Intimate acoustic duo for ceremonies, cocktail hours, and small gatherings in Baltimore and Maryland."
  };

  return (
    <Layout
      title="Acoustic Duo Baltimore | Harborline Live Acoustic Music"
      description="Intimate acoustic performances for ceremonies, cocktail hours, and small gatherings. Beautiful harmonies and stripped-down arrangements."
      canonical="https://harborlineband.com/ensembles/acoustic-duo"
    >
      <script type="application/ld+json">
        {JSON.stringify(schema)}
      </script>

      <PageHero
        eyebrow="ACOUSTIC DUO"
        title="STRIPPED-DOWN SOUL"
        subtitle="Two musicians, pure sound, and the intimate connection that only acoustic music creates"
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
                PURE <span className="text-gradient-gold">ACOUSTIC MAGIC</span>
              </h2>
              <p className="text-muted-foreground text-lg">
                Sometimes less is more. Our acoustic duo strips songs to their emotional core, 
                delivering performances that feel personal and present—like the music is being 
                played just for you.
              </p>
              <p className="text-muted-foreground">
                Perfect for spaces where a larger band isn't practical, or for moments where 
                intimacy matters most. From ceremony processionals to cocktail hour vibes, 
                our duo creates the perfect soundtrack without overwhelming the moment.
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
                src={galleryImage2}
                alt="Acoustic duo performance"
                className="rounded-lg shadow-lg"
              />
              <img
                src={galleryImage3}
                alt="Intimate event setting"
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
                THE DUO
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
                    <Guitar className="w-5 h-5 text-primary flex-shrink-0" />
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

export default AcousticDuoPage;
