import { motion } from "framer-motion";
import gallery1 from "@/assets/gallery-1.jpg";

const About = () => {
  return (
    <section id="about" className="py-24 md:py-32 relative overflow-hidden">
      {/* Subtle background accent */}
      <div className="absolute top-1/2 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 -translate-x-1/2" />
      
      <div className="container px-6 max-w-6xl mx-auto relative">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Image */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative"
          >
            <div className="relative rounded-lg overflow-hidden">
              <img
                src={gallery1}
                alt="Harborline band"
                className="w-full aspect-[4/3] object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/40 to-transparent" />
            </div>
            {/* Decorative element */}
            <div className="absolute -bottom-4 -right-4 w-32 h-32 border-2 border-primary/30 rounded-lg -z-10" />
          </motion.div>

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <p className="text-primary font-display tracking-display text-sm mb-3">
              WHO WE ARE
            </p>
            <h2 className="font-display text-5xl md:text-6xl tracking-tight mb-8">
              ABOUT HARBORLINE
            </h2>
            
            <div className="space-y-6 text-muted-foreground">
              <p className="text-lg leading-relaxed">
                Based in Baltimore, Harborline is a dynamic ensemble of seasoned musicians 
                dedicated to delivering world-class live entertainment. With decades of 
                combined experience performing at prestigious venues and high-profile events, 
                we bring professionalism, versatility, and infectious energy to every stage.
              </p>
              <p className="text-lg leading-relaxed">
                From classic hits to contemporary favorites, our repertoire spans genres 
                to keep dance floors packed and guests entertained from the first note to 
                the last encore.
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-6 mt-10 pt-10 border-t border-border">
              {[
                { number: "500+", label: "Events" },
                { number: "15+", label: "Years" },
                { number: "100%", label: "Energy" },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="font-display text-3xl md:text-4xl text-gradient-gold">
                    {stat.number}
                  </p>
                  <p className="text-muted-foreground font-display tracking-display text-xs mt-1">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default About;
