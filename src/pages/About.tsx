import Layout from "@/components/Layout";
import PageHero from "@/components/PageHero";
import { motion } from "framer-motion";
import { OptimizedImage } from "@/components/OptimizedImage";
import { Music, Users, Calendar, Award, Heart, Sparkles } from "lucide-react";

const stats = [
  { icon: Calendar, value: "1000+", label: "Events Performed" },
  { icon: Users, value: "10+", label: "Years Operating" },
  { icon: Award, value: "100%", label: "Backup-per-Role Coverage" },
  { icon: Heart, value: "50+", label: "Wedding Venues Worked" },
];

const AboutPage = () => {
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://harborlineband.com/" },
      { "@type": "ListItem", "position": 2, "name": "About", "item": "https://harborlineband.com/about" }
    ]
  };

  return (
    <Layout
      title="About Harborline | Musician-Led Event Band in the DMV"
      description="Harborline is a musician-led event band based in Baltimore, working weddings, galas, corporate events, and private parties across the DMV. Built and run by working musicians."
      canonical="https://harborlineband.com/about"
    >
      <script type="application/ld+json">
        {JSON.stringify(breadcrumbSchema)}
      </script>
      <PageHero
        eyebrow="OUR STORY"
        title="ABOUT HARBORLINE"
        subtitle="Musician-led. Baltimore-based."
        showCTA={false}
      />

      {/* Story Section */}
      <section className="py-20 md:py-24">
        <div className="container px-6 max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="space-y-4"
            >
              <OptimizedImage
                src="band/group-waterfront-1"
                alt="Harborline band group photo by the water"
                className="rounded-lg shadow-2xl"
              />
              <OptimizedImage
                src="band/group-waterfront-3"
                alt="Harborline band having fun by the bay"
                className="rounded-lg shadow-xl"
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="font-display text-4xl md:text-5xl tracking-tight mb-6">
                HOW WE WORK
              </h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  Harborline plays weddings, corporate events, galas, and private
                  parties across Baltimore and the DMV. Same band, different rooms —
                  a quiet jazz quartet for cocktail hour scales up to a full 12-piece
                  for the dance floor.
                </p>
                <p>
                  The guys playing these gigs are working musicians, not subcontracted
                  side gigs. We read the room — Motown when the dance floor's warming
                  up, today's hits when it's peaked, jazz standards for the cocktail
                  hour — and pivot mid-set when the MD calls it.
                </p>
                <p>
                  What's different about us is the operational backbone — named POC
                  from first inquiry, backup-per-role on the roster, line-itemed
                  pricing, and check-ins at 1 week / 72 hours / 24 hours out. The
                  musicianship is the floor; the reliability is the differentiator.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-card">
        <div className="container px-6 max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="text-center"
              >
                <stat.icon className="w-8 h-8 text-primary mx-auto mb-3" />
                <div className="font-display text-4xl text-gradient-gold mb-1">
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* What We Offer */}
      <section className="py-20 md:py-24">
        <div className="container px-6 max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <p className="text-primary font-display tracking-display text-sm mb-3">
              WHAT'S ON THE RECORD
            </p>
            <h2 className="font-display text-4xl md:text-5xl tracking-tight">
              HOW WE DELIVER
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Music,
                title: "Range, Not Genre",
                description: "Sinatra through Bruno Mars. The MD reads the room and pivots the set live — no fixed canned setlist."
              },
              {
                icon: Users,
                title: "Flexible Configurations",
                description: "4-piece combo through 12-piece with horns. We scale to your venue, headcount, and budget."
              },
              {
                icon: Sparkles,
                title: "Operational Backbone",
                description: "Named POC from first inquiry. Backup-per-role on the roster. Check-ins at 1 week / 72 hours / 24 hours out."
              }
            ].map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="p-6 bg-secondary/30 border border-border rounded-lg text-center"
              >
                <item.icon className="w-10 h-10 text-primary mx-auto mb-4" />
                <h3 className="font-display text-xl mb-3">{item.title}</h3>
                <p className="text-muted-foreground text-sm">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default AboutPage;
