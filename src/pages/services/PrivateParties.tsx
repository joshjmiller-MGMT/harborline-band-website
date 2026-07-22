import Layout from "@/components/Layout";
import PageHero from "@/components/PageHero";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Cake, Music, Users, Sparkles } from "lucide-react";

const occasions = [
  { icon: Cake, title: "Birthday Parties", description: "30/40/50/60th milestones — set built around the toast, the cake, the dance floor" },
  { icon: Users, title: "Anniversary Parties", description: "First-dance reprise, era-specific sets, family-friendly registers" },
  { icon: Sparkles, title: "Holiday Gatherings", description: "Cocktail background through full party hour; custom carol arrangements on request" },
  { icon: Music, title: "Private Dinners", description: "Acoustic duo or trio. Dinner-music volume, conversational" },
];

const PrivatePartiesPage = () => {
  const privatePartySchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": "Harborline Private Party Entertainment",
    "serviceType": "Private Party Entertainment",
    "provider": {
      "@type": "MusicGroup",
      "name": "Harborline"
    },
    "areaServed": {
      "@type": "City",
      "name": "Baltimore",
      "containedInPlace": { "@type": "State", "name": "Maryland" }
    },
    "description": "Live entertainment for private parties, milestone birthdays, anniversaries, holiday gatherings, and intimate celebrations in Baltimore and Maryland."
  };
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://harborlineband.com/" },
      { "@type": "ListItem", "position": 2, "name": "Occasions", "item": "https://harborlineband.com/" },
      { "@type": "ListItem", "position": 3, "name": "Private Parties", "item": "https://harborlineband.com/private-parties" }
    ]
  };

  return (
    <Layout
      title="Private Party Band Baltimore | Harborline Entertainment"
      description="Live music for private parties, milestone birthdays, anniversaries, and holiday gatherings across Baltimore + the DMV. 4-piece up to full band, depending on the room."
      canonical="https://harborlineband.com/private-parties"
    >
      <script type="application/ld+json">
        {JSON.stringify(privatePartySchema)}
      </script>
      <script type="application/ld+json">
        {JSON.stringify(breadcrumbSchema)}
      </script>

      <PageHero
        eyebrow="PRIVATE PARTIES"
        title="YOUR CELEBRATION"
        subtitle="Birthdays, anniversaries, holiday gatherings. 4-piece up to full band, depending on the room."
      />

      <section className="py-20 md:py-24">
        <div className="container px-6 max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="font-display text-4xl md:text-5xl tracking-tight mb-6">
              PARTIES WE <span className="text-gradient-brand">RUN</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              From intimate milestone birthdays to multi-room anniversary parties,
              we scale to the venue. Custom setlists, MD running the room, named
              POC from first inquiry.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {occasions.map((occasion, index) => (
              <motion.div
                key={occasion.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="p-6 bg-card border border-border rounded-lg text-center hover:border-primary/50 transition-colors"
              >
                <occasion.icon className="w-10 h-10 text-primary mx-auto mb-4" />
                <h3 className="font-display text-xl mb-2">{occasion.title}</h3>
                <p className="text-muted-foreground text-sm">{occasion.description}</p>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-card border border-border rounded-lg p-8 md:p-12 text-center"
          >
            <h3 className="font-display text-3xl mb-4">WORKED AROUND YOUR ROOM</h3>
            <p className="text-muted-foreground max-w-2xl mx-auto mb-8">
              We run a 30-minute call before the event to walk the setlist, the
              room, and the timing of toasts, cake, and dance-floor opening. The
              MD adjusts in real time when something hits or doesn't. You're not
              managing the band — we're managing the night.
            </p>
            <Button variant="hero" size="lg" asChild>
              <a href="/request-a-quote">Request a Quote</a>
            </Button>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
};

export default PrivatePartiesPage;
