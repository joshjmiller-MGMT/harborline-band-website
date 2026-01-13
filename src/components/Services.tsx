import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Users, Mic2, Piano, Guitar, Music2, User, Sparkles, ArrowRight } from "lucide-react";

const ensembles = [
  {
    icon: Users,
    title: "The Full Band",
    description: "8-12 piece high-energy performance with horns, vocalists, and a packed dance floor.",
    link: "/ensembles/full-band",
  },
  {
    icon: Mic2,
    title: "Jazz Quartet",
    description: "Sophisticated swing and standards for cocktails, dinners, and elegant affairs.",
    link: "/ensembles/jazz-quartet",
  },
  {
    icon: Piano,
    title: "Piano Trio",
    description: "Intimate elegance with piano, bass, and drums—perfect for any setting.",
    link: "/ensembles/piano-trio",
  },
  {
    icon: Guitar,
    title: "Acoustic Duo",
    description: "Stripped-down soul for ceremonies, cocktail hours, and intimate gatherings.",
    link: "/ensembles/acoustic-duo",
  },
  {
    icon: Music2,
    title: "String Ensemble",
    description: "Classical beauty for ceremonies—from Bach to modern pop arrangements.",
    link: "/ensembles/string-ensemble",
  },
  {
    icon: User,
    title: "Solo Performer",
    description: "Piano, guitar, or vocals—one musician creating the perfect ambiance.",
    link: "/ensembles/solo-performer",
  },
];

const features = [
  { icon: Users, text: "Scalable 1-12 Piece" },
  { icon: Sparkles, text: "Custom Setlists" },
  { icon: Mic2, text: "All Genres" },
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
            BAND CONFIGURATIONS
          </p>
          <h2 className="font-display text-4xl md:text-5xl tracking-tight mb-4">
            OUR ENSEMBLES
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

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {ensembles.map((ensemble, index) => (
            <Link to={ensemble.link} key={ensemble.title}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="group relative h-full p-5 bg-secondary/30 border border-border rounded-lg hover:border-primary/50 hover:bg-secondary/50 transition-all duration-300"
              >
                <ensemble.icon className="w-8 h-8 text-primary mb-4 group-hover:scale-110 transition-transform duration-300" />
                <h3 className="font-display text-lg tracking-wide mb-2">
                  {ensemble.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                  {ensemble.description}
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
