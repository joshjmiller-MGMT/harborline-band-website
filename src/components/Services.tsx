import { motion } from "framer-motion";
import { Music, Building2, Heart, Mic2, Users, Sparkles } from "lucide-react";

const services = [
  {
    icon: Building2,
    title: "Corporate Events",
    description:
      "High-energy performances for conferences, galas, award ceremonies, and company celebrations that leave lasting impressions.",
  },
  {
    icon: Heart,
    title: "Weddings",
    description:
      "From ceremony to reception, we create the perfect soundtrack for your special day with elegance and energy.",
  },
  {
    icon: Mic2,
    title: "Private Parties",
    description:
      "Birthdays, anniversaries, and exclusive gatherings brought to life with tailored setlists and professional production.",
  },
  {
    icon: Music,
    title: "Live Productions",
    description:
      "Full-scale entertainment solutions with professional sound, lighting, and stage presence for any venue.",
  },
];

const features = [
  { icon: Users, text: "Flexible Band Sizes" },
  { icon: Sparkles, text: "Custom Setlists" },
  { icon: Music, text: "All Genres" },
];

const Services = () => {
  return (
    <section id="services" className="py-24 md:py-32 bg-card">
      <div className="container px-6 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-primary font-display tracking-display text-sm mb-3">
            WHAT WE DO
          </p>
          <h2 className="font-display text-5xl md:text-7xl tracking-tight mb-6">
            OUR SERVICES
          </h2>
          
          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-3 mt-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.text}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }}
                className="flex items-center gap-2 px-4 py-2 bg-secondary/50 border border-border rounded-full text-sm text-muted-foreground"
              >
                <feature.icon className="w-4 h-4 text-primary" />
                <span>{feature.text}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
          {services.map((service, index) => (
            <motion.div
              key={service.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="group relative p-8 md:p-10 bg-secondary/50 border border-border rounded-lg hover:border-primary/50 transition-all duration-500 overflow-hidden"
            >
              {/* Hover glow effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="relative">
                <service.icon className="w-10 h-10 text-primary mb-6 group-hover:scale-110 transition-transform duration-300" />
                <h3 className="font-display text-2xl md:text-3xl tracking-wide mb-4">
                  {service.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {service.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Services;
