import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Music2, Headphones, Mic } from "lucide-react";
import groupWaterfront1 from "@/assets/band/group-waterfront-1.webp";

const highlights = [
  { icon: Music2, text: "100+ Song Repertoire" },
  { icon: Headphones, text: "Professional Sound" },
  { icon: Mic, text: "Dynamic Vocalists" },
];

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
                src={groupWaterfront1}
                alt="Harborline band group photo by the water"
                className="w-full aspect-[4/3] object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-background/20 to-transparent" />
              
              {/* Overlay highlights */}
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <div className="flex flex-wrap gap-2">
                  {highlights.map((item, index) => (
                    <motion.div
                      key={item.text}
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.4 + index * 0.1 }}
                      className="flex items-center gap-2 px-3 py-1.5 bg-background/80 backdrop-blur-sm border border-border rounded-full text-xs"
                    >
                      <item.icon className="w-3.5 h-3.5 text-primary" />
                      <span>{item.text}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
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
                One nonstop, feel-good set for events, weddings, and celebrations across 
                the DMV—the DMV's newest premiere band connecting some of the best musicians 
                and bandleaders in the region to create something special.
              </p>
              <p className="text-lg leading-relaxed">
                From timeless classics to today's chart-toppers, Harborline builds the vibe, 
                reads the room, and keeps dance floors moving all night long with the best 
                of the old and the best of the new.
              </p>
            </div>

            <Link 
              to="/songs" 
              className="inline-flex items-center gap-2 mt-6 text-primary font-display tracking-wide hover:gap-3 transition-all group"
            >
              <span>View Our Song List</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-6 mt-10 pt-10 border-t border-border">
              {[
                { number: "1000+", label: "Events" },
                { number: "10+", label: "Years" },
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
