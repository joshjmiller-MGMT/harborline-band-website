import Layout from "@/components/Layout";
import PageHero from "@/components/PageHero";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Sparkles, Wine, Award, Clock, CheckCircle } from "lucide-react";

const features = [
  { icon: Wine, text: "Black-Tie Appropriate" },
  { icon: Award, text: "Elegant Repertoire" },
  { icon: Clock, text: "Seamless Timing" },
  { icon: Sparkles, text: "Full Production" },
];

const GalasPage = () => {
  const galaSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": "Harborline Gala & Fundraiser Entertainment",
    "serviceType": "Gala and Fundraiser Entertainment",
    "provider": {
      "@type": "MusicGroup",
      "name": "Harborline"
    },
    "areaServed": {
      "@type": "City",
      "name": "Baltimore",
      "containedInPlace": { "@type": "State", "name": "Maryland" }
    },
    "description": "Live entertainment for galas, fundraisers, awards ceremonies, and black-tie events in Baltimore and Maryland."
  };
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://harborlineband.com/" },
      { "@type": "ListItem", "position": 2, "name": "Occasions", "item": "https://harborlineband.com/" },
      { "@type": "ListItem", "position": 3, "name": "Galas & Fundraisers", "item": "https://harborlineband.com/galas" }
    ]
  };

  return (
    <Layout
      title="Gala Entertainment Baltimore | Harborline Live Band"
      description="Live music for galas, fundraisers, and black-tie events across Baltimore + the DMV. Cocktail hour through dinner through dance floor — one band, three registers."
      canonical="https://harborlineband.com/galas"
    >
      <script type="application/ld+json">
        {JSON.stringify(galaSchema)}
      </script>
      <script type="application/ld+json">
        {JSON.stringify(breadcrumbSchema)}
      </script>

      <PageHero
        eyebrow="GALAS & FUNDRAISERS"
        title="BLACK-TIE ENTERTAINMENT"
        subtitle="Cocktail hour through dinner through dance floor — one band, three registers."
      />

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
                GALAS WE'VE <span className="text-gradient-gold">RUN</span>
              </h2>
              <p className="text-muted-foreground text-lg">
                Galas have three registers — cocktail-hour ambient, dinner-music
                low, post-dinner dance floor. We work all three from the same
                stage in one night. No band swap, no volume scramble between
                courses.
              </p>
              <p className="text-muted-foreground">
                Charity fundraisers, awards ceremonies, nonprofit galas — we
                coordinate with your event planner on the run-of-show in
                advance and stay tight to it. Auction support, program
                transitions, dance-floor energy all built around your timeline.
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

              <Button variant="hero" size="lg" className="mt-4" asChild>
                <a href="/request-a-quote">Request a Quote</a>
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="bg-card border border-border rounded-lg p-8"
            >
              <h3 className="font-display text-2xl mb-6">GALA SERVICES</h3>
              <ul className="space-y-4">
                {[
                  "Cocktail reception entertainment",
                  "Dinner music and background sets",
                  "Dancing and high-energy performances",
                  "Auction and program support",
                  "Custom song arrangements",
                  "Coordination with event planners"
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default GalasPage;
