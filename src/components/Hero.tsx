import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import heroBand from "@/assets/band-hero.jpg";
import logo from "@/assets/logo-circle.png";
const Hero = () => {
  return <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0">
        <img src={heroBand} alt="Harborline performing live" className="w-full h-full object-cover" />
        {/* Dark overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/70 to-background" />
        <div className="absolute inset-0 bg-background/40" />
      </div>

      {/* Content */}
      <div className="relative z-10 text-center px-6 max-w-5xl mx-auto">
        <motion.div initial={{
        opacity: 0,
        scale: 0.9
      }} animate={{
        opacity: 1,
        scale: 1
      }} transition={{
        duration: 0.8,
        delay: 0.2
      }} className="mb-6">
          <img src={logo} alt="Harborline Logo" className="w-48 md:w-64 lg:w-80 mx-auto drop-shadow-2xl" />
        </motion.div>

        <motion.p initial={{
        opacity: 0,
        y: 20
      }} animate={{
        opacity: 1,
        y: 0
      }} transition={{
        duration: 0.6,
        delay: 0.4
      }} className="text-primary font-display tracking-display text-lg md:text-xl mb-4">
          BALTIMORE'S PREMIER EVENT BAND
        </motion.p>

        <motion.p initial={{
        opacity: 0,
        y: 20
      }} animate={{
        opacity: 1,
        y: 0
      }} transition={{
        duration: 0.6,
        delay: 0.6
      }} className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto mb-10 font-light">The best of the old and the best of the new—one nonstop, feel-good set for events, weddings, and celebrations across the DMV.</motion.p>

        <motion.div initial={{
        opacity: 0,
        y: 20
      }} animate={{
        opacity: 1,
        y: 0
      }} transition={{
        duration: 0.6,
        delay: 0.8
      }} className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button variant="hero" size="xl" asChild>
            <a href="/request-a-quote">Request a Quote</a>
          </Button>
          <Button variant="heroOutline" size="xl" asChild>
            <a href="/where-we-perform#upcoming-shows">See Us Live</a>
          </Button>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div initial={{
      opacity: 0
    }} animate={{
      opacity: 1
    }} transition={{
      delay: 1.2,
      duration: 0.6
    }} className="absolute bottom-10 left-1/2 -translate-x-1/2">
        <motion.div animate={{
        y: [0, 10, 0]
      }} transition={{
        duration: 2,
        repeat: Infinity
      }} className="w-6 h-10 border-2 border-foreground/30 rounded-full flex justify-center">
          <motion.div animate={{
          y: [0, 12, 0],
          opacity: [1, 0.5, 1]
        }} transition={{
          duration: 2,
          repeat: Infinity
        }} className="w-1 h-3 bg-primary rounded-full mt-2" />
        </motion.div>
      </motion.div>
    </section>;
};
export default Hero;