import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import { Mail, Phone, MapPin } from "lucide-react";

const RequestQuotePage = () => {
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Request a Quote | Harborline Entertainment</title>
        <meta name="description" content="Get a custom quote for your event. Harborline provides live entertainment for weddings, corporate events, and private celebrations in Baltimore, Maryland and beyond." />
        <link rel="canonical" href="https://harborlinemusic.com/request-a-quote" />
      </Helmet>
      
      <Header />
      
      <main className="pt-24 pb-20">
        <div className="container px-6 max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
            {/* Left Side - Text Content */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="lg:sticky lg:top-32"
            >
              <p className="text-primary font-display tracking-display text-sm mb-4">
                LET'S WORK TOGETHER
              </p>
              <h1 className="font-display text-5xl md:text-6xl lg:text-7xl tracking-tight mb-6">
                REQUEST A QUOTE
              </h1>
              <p className="text-muted-foreground text-lg mb-8 max-w-lg">
                Ready to make your next event unforgettable? Fill out the form and our team 
                will get back to you within 24 hours with availability and pricing for your event.
              </p>

              {/* Contact Info */}
              <div className="space-y-4">
                <a
                  href="mailto:harborlineband@gmail.com"
                  className="flex items-center gap-3 text-muted-foreground hover:text-primary transition-colors group"
                >
                  <div className="w-10 h-10 rounded-full border border-border flex items-center justify-center group-hover:border-primary transition-colors">
                    <Mail className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  </div>
                  <span>harborlineband@gmail.com</span>
                </a>
                <a
                  href="tel:+14434052378"
                  className="flex items-center gap-3 text-muted-foreground hover:text-primary transition-colors group"
                >
                  <div className="w-10 h-10 rounded-full border border-border flex items-center justify-center group-hover:border-primary transition-colors">
                    <Phone className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  </div>
                  <span>(443) 405-2378</span>
                </a>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <div className="w-10 h-10 rounded-full border border-border flex items-center justify-center">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <span>Baltimore, MD</span>
                </div>
              </div>
            </motion.div>

            {/* Right Side - Form */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="overflow-visible"
            >
              <iframe 
                src="https://forms.monday.com/forms/embed/cd9db9bdd36a0a870cc16f6d7cf06fda?r=use1" 
                width="100%" 
                height="auto"
                style={{ border: 0, filter: 'invert(1) hue-rotate(180deg)', minHeight: '100vh' }}
                title="Request a Quote Form"
                scrolling="no"
              />
            </motion.div>
          </div>
        </div>
      </main>

      <Footer />
      <ScrollToTop />
    </div>
  );
};

export default RequestQuotePage;
