import { motion } from "framer-motion";

const clients = [
  "Four Seasons",
  "The Sagamore Pendry",
  "Baltimore Country Club", 
  "Peabody Library",
  "The Engineers Club",
  "Belvedere Hotel",
  "Cylburn Arboretum",
  "Pier 5 Hotel",
];

const Clients = () => {
  return (
    <section className="py-16 bg-secondary/30 border-y border-border overflow-hidden">
      <div className="container px-6 max-w-7xl mx-auto">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-muted-foreground font-display tracking-display text-xs mb-8"
        >
          TRUSTED BY BALTIMORE'S FINEST VENUES
        </motion.p>
        
        {/* Scrolling marquee */}
        <div className="relative">
          <div className="flex animate-marquee space-x-12 md:space-x-20">
            {[...clients, ...clients].map((client, index) => (
              <span
                key={index}
                className="font-display text-2xl md:text-3xl text-foreground/40 hover:text-primary transition-colors duration-300 whitespace-nowrap"
              >
                {client}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Clients;
