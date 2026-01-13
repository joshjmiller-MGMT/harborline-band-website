import { Instagram, Facebook, Youtube, Music } from "lucide-react";
import logo from "@/assets/logo.png";

const socialLinks = [
  { icon: Instagram, href: "#", label: "Instagram" },
  { icon: Facebook, href: "#", label: "Facebook" },
  { icon: Youtube, href: "#", label: "YouTube" },
];

const Footer = () => {
  return (
    <footer className="py-12 border-t border-border bg-card/50">
      <div className="container px-6 mx-auto">
        <div className="flex flex-col items-center gap-8">
          {/* Logo */}
          <img src={logo} alt="Harborline" className="h-16 w-auto opacity-80" />
          
          {/* Social Links */}
          <div className="flex gap-6">
            {socialLinks.map((social) => (
              <a
                key={social.label}
                href={social.href}
                aria-label={social.label}
                className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition-all duration-300"
              >
                <social.icon className="w-5 h-5" />
              </a>
            ))}
          </div>
          
          {/* Nav Links */}
          <nav className="flex flex-wrap justify-center gap-6 text-sm">
            <a href="#services" className="text-muted-foreground hover:text-primary transition-colors">
              Services
            </a>
            <a href="#gallery" className="text-muted-foreground hover:text-primary transition-colors">
              Gallery
            </a>
            <a href="#about" className="text-muted-foreground hover:text-primary transition-colors">
              About
            </a>
            <a href="#contact" className="text-muted-foreground hover:text-primary transition-colors">
              Contact
            </a>
          </nav>
          
          {/* Copyright */}
          <div className="text-center">
            <p className="text-muted-foreground text-sm">
              © {new Date().getFullYear()} Harborline. Baltimore's Premier Event Band.
            </p>
            <p className="text-muted-foreground/60 text-xs mt-2">
              Serving Maryland, DC, Virginia & Beyond
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
