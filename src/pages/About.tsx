import Layout from "@/components/Layout";
import PageHero from "@/components/PageHero";
import { motion } from "framer-motion";
import groupWaterfront1 from "@/assets/band/group-waterfront-1.webp";
import groupWaterfront3 from "@/assets/band/group-waterfront-3.webp";
import { Music, Users, Calendar, Award, Heart, Sparkles } from "lucide-react";

const stats = [
  { icon: Calendar, value: "1000+", label: "Events Performed" },
  { icon: Users, value: "10+", label: "Years Experience" },
  { icon: Award, value: "100%", label: "Client Satisfaction" },
  { icon: Heart, value: "50+", label: "Wedding Venues" },
];

const AboutPage = () => {
  return (
    <Layout
      title="About Harborline | Baltimore's Premier Event Band"
      description="Harborline is the DMV's premiere event band bringing modern soul and R&B energy to every celebration. The best of the old and the best of the new."
      canonical="https://harborlineband.com/about"
    >
      <PageHero
        eyebrow="OUR STORY"
        title="ABOUT HARBORLINE"
        subtitle="Modern soul. Timeless energy."
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
              <img
                src={groupWaterfront1}
                alt="Harborline band group photo by the water"
                className="rounded-lg shadow-2xl"
              />
              <img
                src={groupWaterfront3}
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
                SETTING THE TONE
              </h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  Whether it's a first dance, a company party, or a night you'll never forget, 
                  Harborline sets the tone and keeps the groove alive. The band is Baltimore's go-to 
                  choice for weddings, corporate events, galas, and private parties.
                </p>
                <p>
                  Harborline's seasoned musicians bring decades of combined experience across every style—
                  from classic Motown and soul to today's hottest hits. The band delivers the best of 
                  the old and the best of the new in one nonstop, feel-good set that reads the 
                  room and keeps people dancing.
                </p>
                <p>
                  What sets Harborline apart isn't just the talent—it's the commitment to creating 
                  an unforgettable vibe, working closely with every client to craft the perfect 
                  experience and ensure every moment hits exactly right.
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
              THE HARBORLINE DIFFERENCE
            </p>
            <h2 className="font-display text-4xl md:text-5xl tracking-tight">
              WHY CLIENTS CHOOSE US
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Music,
                title: "Versatile Repertoire",
                description: "From Sinatra to Bruno Mars, we cover every genre to keep all your guests entertained."
              },
              {
                icon: Users,
                title: "Flexible Configurations",
                description: "From a 4-piece combo to a full 12-piece ensemble with horns—we scale to your venue and vision."
              },
              {
                icon: Sparkles,
                title: "White-Glove Service",
                description: "Professional from first inquiry to final song. We handle every detail so you can focus on celebrating."
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
