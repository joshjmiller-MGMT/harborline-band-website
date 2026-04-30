import Layout from "@/components/Layout";
import PageHero from "@/components/PageHero";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Music2, Heart, Users, Sparkles, CheckCircle } from "lucide-react";
import galleryImage4 from "@/assets/gallery-4.jpg";
import galleryImage5 from "@/assets/gallery-5.jpg";

const features = [
  { icon: Users, text: "2-4 Musicians" },
  { icon: Music2, text: "Classical & Modern" },
  { icon: Heart, text: "Ceremony Perfect" },
  { icon: Sparkles, text: "Elegant Ambiance" },
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
    "description": "Elegant string quartet and ensemble for wedding ceremonies, formal events, and sophisticated celebrations in Baltimore."
  };

  return (
    <Layout
      title="String Quartet Baltimore | Harborline String Ensemble"
      description="Elegant string quartet for wedding ceremonies and formal events. Classical repertoire and modern pop arrangements performed with sophistication."
      canonical="https://harborlineband.com/ensembles/string-ensemble"
    >
      <script type="application/ld+json">
        {JSON.stringify(schema)}
      </script>

      <PageHero
        eyebrow="STRING ENSEMBLE"
        title="CLASSICAL BEAUTY"
        subtitle="The timeless elegance of strings, from Bach to Beyoncé"
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
                STRINGS THAT <span className="text-gradient-gold">MOVE HEARTS</span>
              </h2>
              <p className="text-muted-foreground text-lg">
                Nothing sets a ceremony mood quite like a string ensemble. Whether you dream 
                of walking down the aisle to Pachelbel's Canon or a strings arrangement of 
                your favorite modern song, our ensemble delivers elegance personified.
              </p>
              <p className="text-muted-foreground">
                Our classically trained musicians bring conservatory credentials and years of 
                experience to every performance. But they're not stuffy—they love reimagining 
                pop hits and rock classics through the lens of chamber music.
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
                src={galleryImage4}
                alt="String ensemble performance"
                className="rounded-lg shadow-lg"
              />
              <img
                src={galleryImage5}
                alt="Elegant ceremony setting"
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
