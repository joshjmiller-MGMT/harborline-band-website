import Layout from "@/components/Layout";
import PageHero from "@/components/PageHero";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Sparkles, Music, Building2, Gift, TreePine, CheckCircle } from "lucide-react";
import galleryImage1 from "@/assets/gallery-1.jpg";
import galleryImage5 from "@/assets/gallery-5.jpg";

const features = [
  { icon: TreePine, text: "Holiday Classics" },
  { icon: Gift, text: "Festive Entertainment" },
  { icon: Building2, text: "Corporate Parties" },
  { icon: Sparkles, text: "Year-End Celebrations" },
];

const packages = [
  {
    name: "Office Holiday Party",
    description: "Perfect for company celebrations and team gatherings",
    includes: ["Holiday classics & pop hits", "Flexible band size", "Professional sound", "Interactive performances"]
  },
  {
    name: "Holiday Gala",
    description: "Elegant entertainment for upscale celebrations",
    includes: ["Sophisticated repertoire", "Cocktail hour music", "Full reception band", "Emcee services"]
  },
  {
    name: "New Year's Eve",
    description: "Ring in the new year with unforgettable energy",
    includes: ["Countdown celebration", "High-energy dance sets", "Extended performance", "Midnight moment"]
  }
];

const HolidayPartiesPage = () => {
  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": "Harborline Holiday Party Entertainment",
    "provider": {
      "@type": "MusicGroup",
      "name": "Harborline"
    },
    "areaServed": "Baltimore, Maryland",
    "description": "Live band entertainment for holiday parties, corporate celebrations, and New Year's Eve events in Baltimore and Maryland."
  };

  return (
    <Layout
      title="Holiday Party Band Baltimore | Harborline Live Entertainment"
      description="Book Harborline for your holiday party. Live band entertainment for corporate holiday parties, festive galas, and New Year's Eve celebrations in Baltimore."
      canonical="https://harborlineband.com/holiday-parties"
    >
      <script type="application/ld+json">
        {JSON.stringify(serviceSchema)}
      </script>

      <PageHero
        eyebrow="HOLIDAY PARTIES"
        title="FESTIVE ENTERTAINMENT"
        subtitle="Live music that makes your holiday celebration truly memorable"
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
                CELEBRATE THE <span className="text-gradient-gold">SEASON</span>
              </h2>
              <p className="text-muted-foreground text-lg">
                The holidays deserve more than a playlist. Harborline brings live energy, 
                holiday classics, and danceable hits to corporate parties, galas, and 
                year-end celebrations throughout Baltimore and Maryland.
              </p>
              <p className="text-muted-foreground">
                Whether you're planning an intimate office gathering or a grand New Year's Eve 
                bash, we deliver festive entertainment that gets everyone in the spirit.
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
                alt="Holiday party performance"
                className="rounded-lg shadow-lg"
              />
              <img
                src={galleryImage5}
                alt="Festive celebration"
                className="rounded-lg shadow-lg mt-8"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Packages */}
      <section className="py-20 md:py-24 bg-card">
        <div className="container px-6 max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <p className="text-primary font-display tracking-display text-sm mb-3">
              OPTIONS
            </p>
            <h2 className="font-display text-4xl md:text-5xl tracking-tight">
              HOLIDAY PACKAGES
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {packages.map((pkg, index) => (
              <motion.div
                key={pkg.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="p-6 bg-background border border-border rounded-lg"
              >
                <Sparkles className="w-8 h-8 text-primary mb-4" />
                <h3 className="font-display text-2xl mb-2">{pkg.name}</h3>
                <p className="text-muted-foreground text-sm mb-6">{pkg.description}</p>
                <ul className="space-y-2">
                  {pkg.includes.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mt-12"
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

export default HolidayPartiesPage;
