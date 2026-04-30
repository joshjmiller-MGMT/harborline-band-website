import Layout from "@/components/Layout";
import PageHero from "@/components/PageHero";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Building2, Presentation, Award, Users, CheckCircle } from "lucide-react";

const benefits = [
  "Professional emcee and event coordination",
  "Brand-appropriate song selections",
  "Seamless integration with event timeline",
  "Corporate-friendly repertoire",
  "Experienced with 1000+ corporate events",
  "Full production capabilities"
];

const eventTypes = [
  { icon: Award, title: "Award Galas", description: "Elegant entertainment for your recognition events" },
  { icon: Presentation, title: "Conferences", description: "Energizing performances for corporate gatherings" },
  { icon: Building2, title: "Company Parties", description: "Holiday parties, summer picnics, and milestones" },
  { icon: Users, title: "Team Building", description: "Interactive entertainment that brings teams together" },
];

const CorporatePage = () => {
  return (
    <Layout
      title="Corporate Event Band Baltimore | Harborline Entertainment"
      description="Elevate your corporate event with Harborline. Professional live entertainment for galas, conferences, company parties, and team events in Baltimore."
      canonical="https://harborlineband.com/corporate"
    >
      <PageHero
        eyebrow="CORPORATE EVENTS"
        title="ELEVATE YOUR EVENT"
        subtitle="Professional entertainment that impresses clients and energizes teams"
      />

      <section className="py-20 md:py-24">
        <div className="container px-6 max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="font-display text-4xl md:text-5xl tracking-tight mb-6">
                CORPORATE <span className="text-gradient-gold">EXCELLENCE</span>
              </h2>
              <p className="text-muted-foreground text-lg mb-6">
                Whether it's a company party or a night your team will never forget, 
                Harborline sets the tone with modern soul and R&B energy—building the vibe, 
                reading the room, and keeping the energy high from first note to last.
              </p>
              
              <ul className="grid sm:grid-cols-2 gap-3">
                {benefits.map((benefit) => (
                  <li key={benefit} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>

              <Button variant="hero" size="lg" className="mt-8" asChild>
                <a href="/request-a-quote">Request a Quote</a>
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="grid grid-cols-2 gap-4"
            >
              {eventTypes.map((type, index) => (
                <div
                  key={type.title}
                  className="p-5 bg-card border border-border rounded-lg"
                >
                  <type.icon className="w-8 h-8 text-primary mb-3" />
                  <h3 className="font-display text-lg mb-1">{type.title}</h3>
                  <p className="text-muted-foreground text-sm">{type.description}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Clients Section */}
      <section className="py-16 bg-card">
        <div className="container px-6 max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <p className="text-primary font-display tracking-display text-sm mb-3">
              TRUSTED BY
            </p>
            <h3 className="font-display text-3xl mb-8">
              LEADING ORGANIZATIONS
            </h3>
            <p className="text-muted-foreground">
              Harborline has had the privilege of performing for corporations, nonprofits, 
              and institutions throughout the Baltimore-Washington region.
            </p>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
};

export default CorporatePage;
