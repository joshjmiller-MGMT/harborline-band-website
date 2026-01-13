import { Instagram, Facebook } from "lucide-react";
import logo from "@/assets/logo.png";

const VimeoIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M23.977 6.416c-.105 2.338-1.739 5.543-4.894 9.609-3.268 4.247-6.026 6.37-8.29 6.37-1.409 0-2.578-1.294-3.553-3.881L5.322 11.4C4.603 8.816 3.834 7.522 3.01 7.522c-.179 0-.806.378-1.881 1.132L0 7.197c1.185-1.044 2.351-2.084 3.501-3.128C5.08 2.701 6.266 1.984 7.055 1.91c1.867-.18 3.016 1.1 3.447 3.838.465 2.953.789 4.789.971 5.507.539 2.45 1.131 3.674 1.776 3.674.502 0 1.256-.796 2.265-2.385 1.004-1.589 1.54-2.797 1.612-3.628.144-1.371-.395-2.061-1.614-2.061-.574 0-1.167.121-1.777.391 1.186-3.868 3.434-5.757 6.762-5.637 2.473.06 3.628 1.664 3.493 4.797l-.013.01z"/>
  </svg>
);

const socialLinks = [
  { icon: Instagram, href: "https://www.instagram.com/harborline.band/", label: "Instagram" },
  { icon: Facebook, href: "https://www.facebook.com/Harborline.band/", label: "Facebook" },
  { icon: VimeoIcon, href: "https://vimeo.com/showcase/11690570", label: "Vimeo" },
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
