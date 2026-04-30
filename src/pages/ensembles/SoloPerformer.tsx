import Layout from "@/components/Layout";
import PageHero from "@/components/PageHero";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { User, Piano, Mic2, Guitar, CheckCircle } from "lucide-react";
import galleryImage1 from "@/assets/gallery-1.jpg";
import galleryImage2 from "@/assets/gallery-2.jpg";

const features = [
  { icon: User, text: "1 Musician" },
  { icon: Piano, text: "Piano or Guitar" },
  { icon: Mic2, text: "Vocalist Options" },
  { icon: Guitar, text: "Maximum Flexibility" },
];

const includes = [
  "Solo pianist, guitarist, or vocalist",
  "Full song catalog",
  "Custom song requests",
  "Compact professional sound",
  "Background or featured performance",
  "Continuous music coverage",
  "Minimal space requirement",
  "Quick setup",
];

const idealFor = [
  "Small cocktail parties",
  "Restaurant ambiance",
  "Hotel lobby music",
  "Proposal settings",
  "Intimate dinners",
  "Open houses & showings",
];

const SoloPerformerPage = () => {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": "Harborline Solo Performer",
    "provider": {
      "@type": "MusicGroup",
      "name": "Harborline"
    },
    "areaServed": "Baltimore, Maryland",
    "description": "Solo pianist, guitarist, or vocalist for intimate events and ambient entertainment in Baltimore and Maryland."
  };

  return (
    <Layout
      title="Solo Pianist & Guitarist Baltimore | Harborline Solo Performers"
      description="Solo pianist, guitarist, or vocalist for intimate events. Perfect ambient entertainment for cocktail hours, dinners, and small gatherings."
      canonical="https://harborlineband.com/ensembles/solo-performer"
    >
      <script type="application/ld+json">
        {JSON.stringify(schema)}
      </script>

      <PageHero
        eyebrow="SOLO PERFORMER"
        title="ONE MUSICIAN, INFINITE POSSIBILITIES"
        subtitle="Intimate performances that create the perfect atmosphere for any setting"
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
                THE POWER OF <span className="text-gradient-gold">SIMPLICITY</span>
              </h2>
              <p className="text-muted-foreground text-lg">
                Sometimes the perfect entertainment is one exceptional musician creating an 
                atmosphere that enhances without overwhelming. Our solo performers are virtuosos 
                who can carry an entire event with grace and style.
              </p>
              <p className="text-muted-foreground">
                Whether you need a pianist tinkling standards in a hotel lobby, a guitarist 
                setting the mood at a wine tasting, or a vocalist delivering background 
                elegance at a corporate reception—our soloists deliver professionalism 
                and artistry in equal measure.
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
                src={galleryImage1}
                alt="Solo performer"
                className="rounded-lg shadow-lg"
              />
              <img
                src={galleryImage2}
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
                THE PERFORMER
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

export default SoloPerformerPage;
