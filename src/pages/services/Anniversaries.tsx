import Layout from "@/components/Layout";
import PageHero from "@/components/PageHero";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Heart, Music, Clock, Sparkles, CheckCircle } from "lucide-react";
import galleryImage2 from "@/assets/gallery-2.jpg";
import galleryImage3 from "@/assets/gallery-3.jpg";

const features = [
  { icon: Heart, text: "Romantic Dedications" },
  { icon: Music, text: "Your Special Songs" },
  { icon: Clock, text: "Era-Spanning Setlists" },
  { icon: Sparkles, text: "Surprise Performances" },
];

const milestones = [
  {
    name: "Silver Anniversary (25 Years)",
    description: "A quarter century deserves a grand celebration",
    includes: ["Hits from your wedding year", "First dance recreation", "Personalized dedications", "Dance floor favorites"]
  },
  {
    name: "Golden Anniversary (50 Years)",
    description: "Honor five decades of love in style",
    includes: ["Classic standards", "Era-appropriate music", "Family celebration songs", "Elegant entertainment"]
  },
  {
    name: "Vow Renewal Celebration",
    description: "Mark a new chapter with live music",
    includes: ["Ceremony music", "Reception entertainment", "Special song requests", "Romantic atmosphere"]
  }
];

const AnniversariesPage = () => {
  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": "Harborline Anniversary Party Entertainment",
    "provider": {
      "@type": "MusicGroup",
      "name": "Harborline"
    },
    "areaServed": "Baltimore, Maryland",
    "description": "Live band entertainment for anniversary parties and milestone celebrations in Baltimore and Maryland."
  };

  return (
    <Layout
      title="Anniversary Party Band Baltimore | Harborline Live Entertainment"
      description="Celebrate your milestone anniversary with Harborline. Live band entertainment for silver, golden, and special anniversary celebrations in Baltimore."
      canonical="https://harborlineband.com/anniversaries"
    >
      <script type="application/ld+json">
        {JSON.stringify(serviceSchema)}
      </script>

      <PageHero
        eyebrow="ANNIVERSARIES"
        title="CELEBRATE YOUR LOVE"
        subtitle="Live entertainment for milestone anniversary celebrations"
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
                YOUR LOVE <span className="text-gradient-gold">STORY</span>
              </h2>
              <p className="text-muted-foreground text-lg">
                A milestone anniversary deserves more than cake and champagne—it deserves 
                the songs that soundtracked your life together. Harborline creates 
                unforgettable anniversary celebrations with music spanning your entire journey.
              </p>
              <p className="text-muted-foreground">
                From recreating your first dance to filling the floor with all your 
                favorites, we help you celebrate decades of love with the energy and 
                elegance the occasion demands.
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
                alt="Anniversary celebration"
                className="rounded-lg shadow-lg"
              />
              <img
                src={galleryImage3}
                alt="Romantic performance"
                className="rounded-lg shadow-lg mt-8"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Milestones */}
      <section className="py-20 md:py-24 bg-card">
        <div className="container px-6 max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <p className="text-primary font-display tracking-display text-sm mb-3">
              MILESTONES
            </p>
            <h2 className="font-display text-4xl md:text-5xl tracking-tight">
              ANNIVERSARY CELEBRATIONS
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {milestones.map((milestone, index) => (
              <motion.div
                key={milestone.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="p-6 bg-background border border-border rounded-lg"
              >
                <Heart className="w-8 h-8 text-primary mb-4" />
                <h3 className="font-display text-2xl mb-2">{milestone.name}</h3>
                <p className="text-muted-foreground text-sm mb-6">{milestone.description}</p>
                <ul className="space-y-2">
                  {milestone.includes.map((item) => (
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

export default AnniversariesPage;
