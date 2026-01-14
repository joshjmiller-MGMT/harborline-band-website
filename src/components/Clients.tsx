import { motion } from "framer-motion";

// Expanded client list with corporate clients for credibility
const venueClients = [
  "Four Seasons Baltimore",
  "The Sagamore Pendry",
  "George Peabody Library",
  "The Belvedere Hotel",
  "Cylburn Arboretum",
  "Evergreen Museum",
  "B&O Railroad Museum",
  "Cloisters Castle",
];

const corporateClients = [
  "T. Rowe Price",
  "Johns Hopkins",
  "Under Armour",
  "Marriott International",
  "Legg Mason",
  "McCormick & Company",
  "Baltimore Ravens",
  "University of Maryland",
];

const Clients = () => {
  const allClients = [...venueClients, ...corporateClients];
  
  return (
    <section className="py-16 bg-secondary/30 border-y border-border overflow-hidden">
      <div className="container px-6 max-w-7xl mx-auto">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-muted-foreground font-display tracking-display text-xs mb-8"
        >
          TRUSTED BY BALTIMORE'S FINEST VENUES & ORGANIZATIONS
        </motion.p>
        
        {/* Scrolling marquee */}
        <div className="relative">
          <div className="flex animate-marquee space-x-12 md:space-x-20">
            {[...allClients, ...allClients].map((client, index) => (
              <span
                key={index}
                className="font-display text-xl md:text-2xl text-foreground/40 hover:text-primary transition-colors duration-300 whitespace-nowrap"
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
