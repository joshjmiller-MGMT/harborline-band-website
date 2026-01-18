import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Mail, Phone, MapPin } from "lucide-react";

const Contact = () => {
  return (
    <section id="contact" className="py-24 md:py-32 bg-card">
      <div className="container px-6 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <p className="text-primary font-display tracking-display text-sm mb-3">
            LET'S WORK TOGETHER
          </p>
          <h2 className="font-display text-5xl md:text-7xl tracking-tight mb-6">
            BOOK HARBORLINE
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Ready to make your next event unforgettable? Reach out to discuss 
            availability and customize your entertainment experience.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex flex-col items-center gap-8"
        >
          {/* Monday.com Form Embed */}
          <div className="w-full max-w-2xl rounded-lg overflow-hidden shadow-2xl">
            <iframe 
              src="https://forms.monday.com/forms/embed/cd9db9bdd36a0a870cc16f6d7cf06fda?r=use1" 
              width="100%" 
              height="500" 
              style={{ border: 0 }}
              title="Contact Form"
            />
          </div>

          {/* Contact Info */}
          <div className="flex flex-col md:flex-row gap-8 md:gap-16 text-center mt-4">
            <a
              href="mailto:harborlineband@gmail.com"
              className="flex items-center gap-3 text-muted-foreground hover:text-primary transition-colors group"
            >
              <Mail className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span>harborlineband@gmail.com</span>
            </a>
            <a
              href="tel:+14434052378"
              className="flex items-center gap-3 text-muted-foreground hover:text-primary transition-colors group"
            >
              <Phone className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span>(443) 405-2378</span>
            </a>
            <div className="flex items-center gap-3 text-muted-foreground">
              <MapPin className="w-5 h-5" />
              <span>Baltimore, MD</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Contact;
