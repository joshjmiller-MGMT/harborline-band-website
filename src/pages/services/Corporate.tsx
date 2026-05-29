import Layout from "@/components/Layout";
import PageHero from "@/components/PageHero";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Building2, Presentation, Award, Users, CheckCircle } from "lucide-react";

const benefits = [
  "Emcee + transitions on request",
  "Setlist filtered for your brand context",
  "Tight to your run-of-show — we coordinate with your planner",
  "Register flexes: conference-appropriate or party-appropriate",
  "1000+ corporate events on the books",
  "Sound + lighting on request"
];

const eventTypes = [
  { icon: Award, title: "Award Galas", description: "Quiet dinner backing through celebration-volume dance floor — one stage, one band" },
  { icon: Presentation, title: "Conferences", description: "Welcome receptions, between-session sets, evening parties" },
  { icon: Building2, title: "Company Parties", description: "Holiday parties, summer picnics, milestones" },
  { icon: Users, title: "Team Building", description: "Song-request bidding, MD-led group sessions, custom formats" },
];

const CorporatePage = () => {
  const corporateSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": "Harborline Corporate Event Entertainment",
    "serviceType": "Corporate Event Entertainment",
    "provider": {
      "@type": "MusicGroup",
      "name": "Harborline"
    },
    "areaServed": "Baltimore, Maryland",
    "description": "Live entertainment for corporate events, galas, conferences, company parties, and team-building events in Baltimore and Maryland."
  };

  return (
    <Layout
      title="Corporate Event Band Baltimore | Harborline Entertainment"
      description="Live entertainment for corporate galas, conferences, company parties, and team events in Baltimore + the DMV. 1000+ corporate events run."
      canonical="https://harborlineband.com/corporate"
    >
      <script type="application/ld+json">
        {JSON.stringify(corporateSchema)}
      </script>

      <PageHero
        eyebrow="CORPORATE EVENTS"
        title="ENTERTAINMENT THAT WORKS THE ROOM"
        subtitle="We've run 1000+ corporate events — conferences, galas, holiday parties. Different rooms, same operational backbone."
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
                CORPORATE <span className="text-gradient-gold">EVENTS</span>
              </h2>
              <p className="text-muted-foreground text-lg mb-6">
                Whether it's a conference welcome reception or the company holiday
                party, Harborline reads the room — energy in, energy out — and
                pivots the set live. Up to 14 musicians depending on the venue
                and the budget.
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
              WHO WE'VE PLAYED FOR
            </p>
            <h3 className="font-display text-3xl mb-8">
              CORPORATIONS, NONPROFITS, INSTITUTIONS
            </h3>
            <p className="text-muted-foreground">
              We've worked corporate events across Baltimore, DC, and the broader
              DMV — corporations, nonprofits, healthcare systems, universities.
              Specific references on request.
            </p>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
};

export default CorporatePage;
