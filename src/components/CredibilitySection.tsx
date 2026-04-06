import { motion } from "framer-motion";
import { Award, Shield, Clock, Star } from "lucide-react";

const trustBadges = [
  {
    icon: Award,
    label: "1000+ Events",
    description: "Performed",
  },
  {
    icon: Shield,
    label: "200+ Songs",
    description: "In Our Repertoire",
  },
  {
    icon: Clock,
    label: "10+ Years",
    description: "Experience",
  },
  {
    icon: Star,
    label: "5-Star Rated",
    description: "On All Platforms",
  },
];

const pressLogos = [
  { name: "The Knot", featured: true },
  { name: "WeddingWire", featured: true },
  { name: "Baltimore Magazine", featured: true },
  { name: "Baltimore Sun", featured: false },
  { name: "Maryland Event", featured: false },
  { name: "Washingtonian", featured: false },
];


const CredibilitySection = () => {
  return (
    <section className="py-20 md:py-28 relative overflow-hidden border-t border-border">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-secondary/20 to-transparent" />
      
      <div className="container px-6 max-w-7xl mx-auto relative">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-primary font-display tracking-display text-sm mb-3">
            TRUSTED & RECOGNIZED
          </p>
          <h2 className="font-display text-4xl md:text-6xl tracking-tight mb-4">
            WHY CLIENTS CHOOSE US
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Top-rated entertainment trusted by Fortune 500 companies, luxury venues, and discerning clients throughout the Mid-Atlantic.
          </p>
        </motion.div>

        {/* Trust Badges Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
          {trustBadges.map((badge, index) => (
            <motion.div
              key={badge.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="text-center p-6 bg-card border border-border rounded-lg hover:border-primary/50 transition-all duration-300 group"
            >
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <badge.icon className="w-7 h-7 text-primary" />
              </div>
              <p className="font-display text-2xl tracking-wide text-foreground">
                {badge.label}
              </p>
              <p className="text-muted-foreground text-sm mt-1">
                {badge.description}
              </p>
            </motion.div>
          ))}
        </div>

        {/* As Featured In / Press Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <p className="text-muted-foreground font-display tracking-display text-xs mb-8">
            AS FEATURED IN
          </p>
          
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12">
            {pressLogos.map((logo, index) => (
              <motion.div
                key={logo.name}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className={`font-display text-xl md:text-2xl transition-colors duration-300 ${
                  logo.featured 
                    ? "text-foreground/60 hover:text-primary" 
                    : "text-foreground/40 hover:text-primary"
                }`}
              >
                {logo.name}
              </motion.div>
            ))}
          </div>
        </motion.div>

      </div>
    </section>
  );
};

export default CredibilitySection;
