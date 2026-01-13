import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Music, Building2, Heart, Mic2, Users, Sparkles, ArrowRight } from "lucide-react";

const services = [
  {
    icon: Building2,
    title: "Corporate Events",
    description:
      "High-energy performances for conferences, galas, award ceremonies, and company celebrations.",
    link: "/corporate",
  },
  {
    icon: Heart,
    title: "Weddings",
    description:
      "From ceremony to reception, we create the perfect soundtrack for your special day.",
    link: "/weddings",
  },
  {
    icon: Mic2,
    title: "Private Parties",
    description:
      "Birthdays, anniversaries, and exclusive gatherings brought to life with tailored setlists.",
    link: "/private-parties",
  },
  {
    icon: Music,
    title: "Galas & Fundraisers",
    description:
      "Sophisticated entertainment for charity events, galas, and prestigious gatherings.",
    link: "/galas",
  },
];

const features = [
  { icon: Users, text: "Flexible Band Sizes" },
  { icon: Sparkles, text: "Custom Setlists" },
  { icon: Music, text: "All Genres" },
];

const Services = () => {
  return (
    <section id="services" className="py-20 md:py-24 bg-card">
      <div className="container px-6 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <p className="text-primary font-display tracking-display text-sm mb-3">
            WHAT WE DO
          </p>
          <h2 className="font-display text-4xl md:text-5xl tracking-tight mb-4">
            OUR SERVICES
          </h2>
          
          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-2 mt-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.text}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }}
                className="flex items-center gap-2 px-3 py-1.5 bg-secondary/50 border border-border rounded-full text-xs text-muted-foreground"
              >
                <feature.icon className="w-3.5 h-3.5 text-primary" />
                <span>{feature.text}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {services.map((service, index) => (
            <Link to={service.link} key={service.title}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="group relative h-full p-5 bg-secondary/30 border border-border rounded-lg hover:border-primary/50 hover:bg-secondary/50 transition-all duration-300"
              >
                <service.icon className="w-8 h-8 text-primary mb-4 group-hover:scale-110 transition-transform duration-300" />
                <h3 className="font-display text-lg tracking-wide mb-2">
                  {service.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                  {service.description}
                </p>
                <div className="flex items-center gap-1 text-primary text-sm font-display tracking-wide opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <span>Learn More</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </motion.div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Services;
