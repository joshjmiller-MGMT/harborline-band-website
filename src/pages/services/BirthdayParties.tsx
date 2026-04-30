import Layout from "@/components/Layout";
import PageHero from "@/components/PageHero";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Cake, Music, Users, Sparkles, Mic2, CheckCircle } from "lucide-react";
import galleryImage3 from "@/assets/gallery-3.jpg";
import galleryImage4 from "@/assets/gallery-4.jpg";

const features = [
  { icon: Cake, text: "Milestone Celebrations" },
  { icon: Music, text: "Custom Song Dedications" },
  { icon: Users, text: "Any Party Size" },
  { icon: Sparkles, text: "Interactive Performances" },
];

const occasions = [
  {
    name: "Milestone Birthdays",
    description: "30th, 40th, 50th and beyond—celebrate in style",
    includes: ["Custom setlist", "Birthday song performance", "Crowd interaction", "Photo-ready moments"]
  },
  {
    name: "Sweet 16 & Coming of Age",
    description: "High-energy performances for younger celebrations",
    includes: ["Current hits & classics", "Age-appropriate entertainment", "Dance floor energy", "Special dedications"]
  },
  {
    name: "Surprise Parties",
    description: "We'll help make the reveal unforgettable",
    includes: ["Coordinated surprise entrance", "Guest of honor spotlight", "Personalized songs", "Memorable moments"]
  }
];

const BirthdayPartiesPage = () => {
  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": "Harborline Birthday Party Entertainment",
    "provider": {
      "@type": "MusicGroup",
      "name": "Harborline"
    },
    "areaServed": "Baltimore, Maryland",
    "description": "Live band entertainment for birthday parties and milestone celebrations in Baltimore and Maryland."
  };

  return (
    <Layout
      title="Birthday Party Band Baltimore | Harborline Live Entertainment"
      description="Make your birthday celebration unforgettable with Harborline. Live band entertainment for milestone birthdays, sweet 16s, and surprise parties in Baltimore."
      canonical="https://harborlineband.com/birthday-parties"
    >
      <script type="application/ld+json">
        {JSON.stringify(serviceSchema)}
      </script>

      <PageHero
        eyebrow="BIRTHDAY PARTIES"
        title="CELEBRATE IN STYLE"
        subtitle="Live entertainment that makes every birthday unforgettable"
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
                MAKE IT A <span className="text-gradient-gold">PARTY</span>
              </h2>
              <p className="text-muted-foreground text-lg">
                A birthday party with live music isn't just a party—it's an event. 
                Harborline transforms milestone celebrations into unforgettable experiences 
                with high-energy performances tailored to your guest of honor.
              </p>
              <p className="text-muted-foreground">
                From intimate gatherings to blowout bashes, we bring the energy, 
                the hits, and the professional polish that elevates any birthday celebration.
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
                src={galleryImage3}
                alt="Birthday party celebration"
                className="rounded-lg shadow-lg"
              />
              <img
                src={galleryImage4}
                alt="Party entertainment"
                className="rounded-lg shadow-lg mt-8"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Occasions */}
      <section className="py-20 md:py-24 bg-card">
        <div className="container px-6 max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <p className="text-primary font-display tracking-display text-sm mb-3">
              OCCASIONS
            </p>
            <h2 className="font-display text-4xl md:text-5xl tracking-tight">
              BIRTHDAY CELEBRATIONS
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {occasions.map((occasion, index) => (
              <motion.div
                key={occasion.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="p-6 bg-background border border-border rounded-lg"
              >
                <Cake className="w-8 h-8 text-primary mb-4" />
                <h3 className="font-display text-2xl mb-2">{occasion.name}</h3>
                <p className="text-muted-foreground text-sm mb-6">{occasion.description}</p>
                <ul className="space-y-2">
                  {occasion.includes.map((item) => (
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

export default BirthdayPartiesPage;
