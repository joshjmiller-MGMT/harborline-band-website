import Layout from "@/components/Layout";
import PageHero from "@/components/PageHero";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Heart, Music, Users, Sparkles, Clock, CheckCircle } from "lucide-react";
import groupWaterfront2 from "@/assets/band/group-waterfront-2.webp";
import jazzTrio1 from "@/assets/band/jazz-trio-1.webp";

const features = [
  { icon: Music, text: "Custom First Dance Arrangements" },
  { icon: Users, text: "Flexible Band Sizes" },
  { icon: Clock, text: "Ceremony to Reception Coverage" },
  { icon: Sparkles, text: "Professional Emcee Services" },
];

const packages = [
  {
    name: "Ceremony & Cocktails",
    description: "Acoustic duo or trio for your ceremony and cocktail hour",
    includes: ["Live ceremony music", "Cocktail hour entertainment", "Custom song requests"]
  },
  {
    name: "Reception Experience",
    description: "Full band performance for your reception celebration",
    includes: ["4-hour reception coverage", "Custom setlist", "Professional sound & lighting", "Emcee services"]
  },
  {
    name: "Complete Wedding",
    description: "Full-day coverage from ceremony through last dance",
    includes: ["Ceremony musicians", "Cocktail hour", "Reception band", "All transitions covered", "Unlimited song requests"]
  }
];

const WeddingsPage = () => {
  const weddingSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": "Harborline Wedding Entertainment",
    "provider": {
      "@type": "MusicGroup",
      "name": "Harborline"
    },
    "areaServed": "Baltimore, Maryland",
    "description": "Live wedding band services for ceremonies, cocktail hours, and receptions in Baltimore and Maryland."
  };

  return (
    <Layout
      title="Wedding Band Baltimore | Harborline Live Music"
      description="Make your Baltimore wedding unforgettable with Harborline. Live ceremony music, cocktail hour entertainment, and high-energy reception performances."
      canonical="https://harborlineband.com/weddings"
    >
      <script type="application/ld+json">
        {JSON.stringify(weddingSchema)}
      </script>

      <PageHero
        eyebrow="WEDDINGS"
        title="YOUR PERFECT SOUNDTRACK"
        subtitle="From the first note to the last dance, Harborline creates unforgettable wedding celebrations"
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
                BALTIMORE'S PREMIER <span className="text-gradient-gold">WEDDING BAND</span>
              </h2>
              <p className="text-muted-foreground text-lg">
                Your wedding day deserves live music that moves hearts and fills the dance floor. 
                Harborline delivers the best of the old and the best of the new—timeless classics 
                and today's hits woven into one nonstop, feel-good celebration.
              </p>
              <p className="text-muted-foreground">
                From the first dance to the last song, Harborline sets the tone and keeps the groove alive—working 
                closely with each couple to craft the perfect soundtrack for every moment.
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
                src={groupWaterfront2}
                alt="Band candid moment with vocalist"
                className="rounded-lg shadow-lg"
              />
              <img
                src={jazzTrio1}
                alt="Jazz trio for wedding ceremony"
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
              WEDDING PACKAGES
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
                <Heart className="w-8 h-8 text-primary mb-4" />
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

export default WeddingsPage;
