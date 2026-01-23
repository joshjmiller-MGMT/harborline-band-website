import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Menu, X, ChevronDown, Music, MapPin, Users, Mic2, Piano, Guitar, Music2, User, Heart, Briefcase, PartyPopper, Gift } from "lucide-react";
import logo from "@/assets/logo-text.png";

// Ensemble configurations - how the band can be sized
const ensembleLinks = [
  { name: "The Full Band", href: "/ensembles/full-band", icon: Users, description: "8-12 piece high-energy" },
  { name: "Jazz Quartet", href: "/ensembles/jazz-quartet", icon: Mic2, description: "Sophisticated swing" },
  { name: "Piano Trio", href: "/ensembles/piano-trio", icon: Piano, description: "Elegant & intimate" },
  { name: "Acoustic Duo", href: "/ensembles/acoustic-duo", icon: Guitar, description: "Stripped-down soul" },
  { name: "String Ensemble", href: "/ensembles/string-ensemble", icon: Music2, description: "Classical beauty" },
  { name: "Solo Performer", href: "/ensembles/solo-performer", icon: User, description: "Piano, guitar, or voice" },
];

// Occasions - what events we cover
const occasionLinks = [
  { name: "Weddings", href: "/weddings", icon: Heart, description: "Ceremony to reception" },
  { name: "Corporate Events", href: "/corporate", icon: Briefcase, description: "Galas & conferences" },
  { name: "Private Parties", href: "/private-parties", icon: PartyPopper, description: "Celebrations of all kinds" },
  { name: "Special Occasions", href: "/galas", icon: Gift, description: "Fundraisers & milestones" },
];

const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [mobileExpandedMenu, setMobileExpandedMenu] = useState<string | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleMenuEnter = (menu: string) => {
    setActiveMenu(menu);
  };

  const handleMenuLeave = () => {
    setActiveMenu(null);
  };

  const toggleMobileMenu = (menu: string) => {
    setMobileExpandedMenu(mobileExpandedMenu === menu ? null : menu);
  };

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? "bg-background/95 backdrop-blur-md border-b border-border" : "bg-background/80 backdrop-blur-sm"
      }`}
    >
      <div className="container px-6 mx-auto">
        <nav className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link to="/" className="block">
            <img src={logo} alt="Harborline" className="h-6 w-auto" />
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-1">
            {/* Ensembles Dropdown */}
            <div 
              className="relative"
              onMouseEnter={() => handleMenuEnter('ensembles')}
              onMouseLeave={handleMenuLeave}
            >
              <button className="flex items-center gap-1 px-4 py-2 font-display tracking-wide-custom text-sm text-muted-foreground hover:text-primary transition-colors">
                Ensembles
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${activeMenu === 'ensembles' ? 'rotate-180' : ''}`} />
              </button>
              
              <AnimatePresence>
                {activeMenu === 'ensembles' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.2 }}
                    className="absolute top-full left-0 pt-2 z-50"
                  >
                    <div className="bg-card border border-border rounded-xl shadow-2xl p-6 min-w-[520px]">
                      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
                        <Music className="w-5 h-5 text-primary" />
                        <span className="font-display text-sm text-foreground">Band Configurations</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {ensembleLinks.map((link) => (
                          <Link
                            key={link.href}
                            to={link.href}
                            className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                          >
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                              <link.icon className="w-5 h-5" />
                            </div>
                            <div>
                              <span className="font-display text-sm text-foreground block">{link.name}</span>
                              <span className="text-xs text-muted-foreground">{link.description}</span>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Occasions Dropdown */}
            <div 
              className="relative"
              onMouseEnter={() => handleMenuEnter('occasions')}
              onMouseLeave={handleMenuLeave}
            >
              <button className="flex items-center gap-1 px-4 py-2 font-display tracking-wide-custom text-sm text-muted-foreground hover:text-primary transition-colors">
                Occasions
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${activeMenu === 'occasions' ? 'rotate-180' : ''}`} />
              </button>
              
              <AnimatePresence>
                {activeMenu === 'occasions' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.2 }}
                    className="absolute top-full left-0 pt-2 z-50"
                  >
                    <div className="bg-card border border-border rounded-xl shadow-2xl p-6 min-w-[320px]">
                      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
                        <PartyPopper className="w-5 h-5 text-primary" />
                        <span className="font-display text-sm text-foreground">Event Types</span>
                      </div>
                      <div className="space-y-1">
                        {occasionLinks.map((link) => (
                          <Link
                            key={link.href}
                            to={link.href}
                            className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                          >
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                              <link.icon className="w-5 h-5" />
                            </div>
                            <div>
                              <span className="font-display text-sm text-foreground block">{link.name}</span>
                              <span className="text-xs text-muted-foreground">{link.description}</span>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Where We Perform - Single Link */}
            <Link
              to="/where-we-perform"
              className="flex items-center gap-1 px-4 py-2 font-display tracking-wide-custom text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <MapPin className="w-4 h-4" />
              Where We Perform
            </Link>

            {/* Direct Links */}
            <Link
              to="/songs"
              className="flex items-center gap-1 px-4 py-2 font-display tracking-wide-custom text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <Music className="w-4 h-4" />
              Songs
            </Link>
            <Link
              to="/about"
              className="px-4 py-2 font-display tracking-wide-custom text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              About
            </Link>
            <Link
              to="/faq"
              className="px-4 py-2 font-display tracking-wide-custom text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              FAQ
            </Link>

            <Button variant="hero" size="sm" className="ml-4" asChild>
              <a href="/request-a-quote">Request a Quote</a>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 text-foreground"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </nav>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="lg:hidden pb-6 overflow-hidden"
            >
              <div className="flex flex-col gap-2 bg-card rounded-xl p-4 border border-border">
                {/* Mobile Ensembles */}
                <div>
                  <button
                    onClick={() => toggleMobileMenu('ensembles')}
                    className="flex items-center justify-between w-full py-3 font-display tracking-wide-custom text-lg text-foreground"
                  >
                    Ensembles
                    <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${mobileExpandedMenu === 'ensembles' ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {mobileExpandedMenu === 'ensembles' && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="pl-4 overflow-hidden"
                      >
                        {ensembleLinks.map((link) => (
                          <Link
                            key={link.href}
                            to={link.href}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="flex items-center gap-3 py-2 text-muted-foreground hover:text-primary transition-colors"
                          >
                            <link.icon className="w-4 h-4" />
                            {link.name}
                          </Link>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Mobile Occasions */}
                <div>
                  <button
                    onClick={() => toggleMobileMenu('occasions')}
                    className="flex items-center justify-between w-full py-3 font-display tracking-wide-custom text-lg text-foreground"
                  >
                    Occasions
                    <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${mobileExpandedMenu === 'occasions' ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {mobileExpandedMenu === 'occasions' && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="pl-4 overflow-hidden"
                      >
                        {occasionLinks.map((link) => (
                          <Link
                            key={link.href}
                            to={link.href}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="flex items-center gap-3 py-2 text-muted-foreground hover:text-primary transition-colors"
                          >
                            <link.icon className="w-4 h-4" />
                            {link.name}
                          </Link>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Where We Perform - Single Link */}
                <Link
                  to="/where-we-perform"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-2 py-3 font-display tracking-wide-custom text-lg text-foreground hover:text-primary transition-colors"
                >
                  <MapPin className="w-5 h-5" />
                  Where We Perform
                </Link>

                {/* Direct Links */}
                <Link
                  to="/songs"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="py-3 font-display tracking-wide-custom text-lg text-foreground hover:text-primary transition-colors"
                >
                  Songs
                </Link>
                <Link
                  to="/about"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="py-3 font-display tracking-wide-custom text-lg text-foreground hover:text-primary transition-colors"
                >
                  About
                </Link>
                <Link
                  to="/faq"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="py-3 font-display tracking-wide-custom text-lg text-foreground hover:text-primary transition-colors"
                >
                  FAQ
                </Link>

                <Button variant="hero" size="lg" className="mt-4" asChild>
                  <a href="/request-a-quote" onClick={() => setIsMobileMenuOpen(false)}>
                    Request a Quote
                  </a>
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.header>
  );
};

export default Header;
