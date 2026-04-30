import Layout from "@/components/Layout";
import PageHero from "@/components/PageHero";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Beer, Music, Users, Calendar, CheckCircle } from "lucide-react";
import galleryImage4 from "@/assets/gallery-4.jpg";
import galleryImage5 from "@/assets/gallery-5.jpg";

const features = [
  { icon: Beer, text: "Brewery Atmosphere" },
  { icon: Music, text: "Acoustic to Full Band" },
  { icon: Users, text: "Crowd Engagement" },
  { icon: Calendar, text: "Regular Residencies" },
];

const eventTypes = [
  {
    name: "Taproom Entertainment",
    description: "Regular live music for your brewery's taproom",
    includes: ["Weekly/monthly residencies", "Duo or trio format", "Background to high-energy", "Flexible set lengths"]
  },
  {
    name: "Brewery Events",
    description: "Special occasions and release parties",
    includes: ["Beer release celebrations", "Anniversary parties", "Oktoberfest events", "Seasonal festivals"]
  },
  {
    name: "Private Rentals",
    description: "Full-service entertainment for brewery buyouts",
    includes: ["Wedding receptions", "Corporate parties", "Private celebrations", "Full band production"]
  }
];

const BreweryEventsPage = () => {
  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": "Harborline Brewery Entertainment",
    "provider": {
      "@type": "MusicGroup",
      "name": "Harborline"
    },
    "areaServed": "Baltimore, Maryland",
    "description": "Live band entertainment for breweries, taprooms, and brewery events in Baltimore and Maryland."
  };

  return (
    <Layout
      title="Brewery Live Music Baltimore | Harborline Entertainment"
      description="Book Harborline for your brewery or taproom. Live music for taproom entertainment, beer releases, and private brewery events in Baltimore."
      canonical="https://harborlineband.com/brewery-events"
    >
      <script type="application/ld+json">
        {JSON.stringify(serviceSchema)}
      </script>

      <PageHero
        eyebrow="BREWERY EVENTS"
        title="CHEERS TO LIVE MUSIC"
        subtitle="Entertainment that pairs perfectly with great craft beer"
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
                CRAFT BEER & <span className="text-gradient-gold">LIVE MUSIC</span>
              </h2>
              <p className="text-muted-foreground text-lg">
                Baltimore's craft brewery scene deserves live entertainment that matches 
                its quality and character. Harborline brings the perfect vibe to taprooms, 
                beer gardens, and brewery events throughout Maryland.
              </p>
              <p className="text-muted-foreground">
                Whether you need a laid-back duo for weekend taproom sessions or a 
                full band for your anniversary blowout, we scale our sound to fit 
                your space and occasion.
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
                alt="Brewery performance"
                className="rounded-lg shadow-lg"
              />
              <img
                src={galleryImage5}
                alt="Taproom entertainment"
                className="rounded-lg shadow-lg mt-8"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Event Types */}
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
              BREWERY ENTERTAINMENT
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {eventTypes.map((eventType, index) => (
              <motion.div
                key={eventType.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="p-6 bg-background border border-border rounded-lg"
              >
                <Beer className="w-8 h-8 text-primary mb-4" />
                <h3 className="font-display text-2xl mb-2">{eventType.name}</h3>
                <p className="text-muted-foreground text-sm mb-6">{eventType.description}</p>
                <ul className="space-y-2">
                  {eventType.includes.map((item) => (
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

export default BreweryEventsPage;
