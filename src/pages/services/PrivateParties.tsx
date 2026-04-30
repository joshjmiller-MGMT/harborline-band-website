import Layout from "@/components/Layout";
import PageHero from "@/components/PageHero";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Cake, Music, Users, Sparkles } from "lucide-react";

const occasions = [
  { icon: Cake, title: "Birthday Parties", description: "Milestone celebrations deserve live music magic" },
  { icon: Users, title: "Anniversary Parties", description: "Honor your years together with timeless songs" },
  { icon: Sparkles, title: "Holiday Gatherings", description: "Seasonal celebrations with festive entertainment" },
  { icon: Music, title: "Private Dinners", description: "Intimate acoustic sets for special evenings" },
];

const PrivatePartiesPage = () => {
  return (
    <Layout
      title="Private Party Band Baltimore | Harborline Entertainment"
      description="Live entertainment for private parties, birthdays, anniversaries, and special celebrations in Baltimore. Harborline creates unforgettable experiences."
      canonical="https://harborlineband.com/private-parties"
    >
      <PageHero
        eyebrow="PRIVATE PARTIES"
        title="YOUR CELEBRATION"
        subtitle="Personalized entertainment that makes your occasion unforgettable"
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
              EVERY OCCASION <span className="text-gradient-gold">DESERVES LIVE MUSIC</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              From intimate milestone birthdays to grand anniversary celebrations, 
              Harborline brings the perfect energy and entertainment to your private events.
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
            <h3 className="font-display text-3xl mb-4">FULLY CUSTOMIZED EXPERIENCES</h3>
            <p className="text-muted-foreground max-w-2xl mx-auto mb-8">
              Your private party should reflect your unique style. We work with you to create 
              a custom setlist, coordinate with your venue, and ensure every detail is perfect. 
              From song requests to timing, we make it seamless.
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
