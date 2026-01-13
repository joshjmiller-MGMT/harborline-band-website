import { motion } from "framer-motion";

const About = () => {
  return (
    <section id="about" className="py-24 md:py-32 relative overflow-hidden">
      {/* Subtle background accent */}
      <div className="absolute top-1/2 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 -translate-x-1/2" />
      
      <div className="container px-6 max-w-5xl mx-auto relative">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <p className="text-primary font-display tracking-display text-sm mb-3">
            WHO WE ARE
          </p>
          <h2 className="font-display text-5xl md:text-7xl tracking-tight mb-8">
            ABOUT HARBORLINE
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-3xl mx-auto text-center"
        >
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-8">
            Based in Baltimore, Harborline is a dynamic ensemble of seasoned musicians 
            dedicated to delivering world-class live entertainment. With decades of 
            combined experience performing at prestigious venues and high-profile events, 
            we bring professionalism, versatility, and infectious energy to every stage.
          </p>
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
            From classic hits to contemporary favorites, our repertoire spans genres 
            to keep dance floors packed and guests entertained from the first note to 
            the last encore.
          </p>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="grid grid-cols-3 gap-8 mt-16 pt-16 border-t border-border"
        >
          {[
            { number: "500+", label: "Events" },
            { number: "15+", label: "Years" },
            { number: "100%", label: "Energy" },
          ].map((stat, index) => (
            <div key={stat.label} className="text-center">
              <p className="font-display text-4xl md:text-6xl text-gradient-gold">
                {stat.number}
              </p>
              <p className="text-muted-foreground font-display tracking-display text-sm mt-2">
                {stat.label}
              </p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default About;
