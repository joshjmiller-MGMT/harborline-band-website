import { Link } from "react-router-dom";
import { Instagram, Facebook } from "lucide-react";
import logo from "@/assets/logo-text.png";

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

const serviceLinks = [
  { name: "Weddings", href: "/weddings" },
  { name: "Corporate Events", href: "/corporate" },
  { name: "Galas & Fundraisers", href: "/galas" },
  { name: "Private Parties", href: "/private-parties" },
  { name: "Birthday Parties", href: "/birthday-parties" },
  { name: "Holiday Parties", href: "/holiday-parties" },
  { name: "Anniversaries", href: "/anniversaries" },
  { name: "Brewery Events", href: "/brewery-events" },
];

const locationLinks = [
  { name: "Baltimore", href: "/locations/baltimore" },
  { name: "Washington DC", href: "/locations/washington-dc" },
  { name: "Annapolis", href: "/locations/annapolis" },
  { name: "Bethesda", href: "/locations/bethesda" },
  { name: "Columbia", href: "/locations/columbia" },
  { name: "Towson", href: "/locations/towson" },
  { name: "Frederick", href: "/locations/frederick" },
  { name: "Rockville", href: "/locations/rockville" },
  { name: "Eastern Shore", href: "/locations/eastern-shore" },
];

const venueLinks = [
  { name: "The Pendry Baltimore", href: "/venues/pendry-baltimore" },
  { name: "Sagamore Pendry", href: "/venues/sagamore-pendry" },
  { name: "George Peabody Library", href: "/venues/george-peabody-library" },
  { name: "The Belvedere", href: "/venues/the-belvedere" },
  { name: "Four Seasons Baltimore", href: "/venues/four-seasons-baltimore" },
  { name: "American Visionary Art Museum", href: "/venues/american-visionary-art-museum" },
  { name: "B&O Railroad Museum", href: "/venues/b-and-o-railroad-museum" },
  { name: "Evergreen Museum", href: "/venues/evergreen-museum" },
  { name: "Cylburn Arboretum", href: "/venues/cylburn-arboretum" },
  { name: "Cloisters Castle", href: "/venues/cloisters-castle" },
  { name: "Legg Mason Tower", href: "/venues/legg-mason-tower" },
];

const Footer = () => {
  return (
    <footer className="py-16 border-t border-border bg-card/50">
      <div className="container px-6 max-w-7xl mx-auto">
        {/* Main Footer Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-12">
          {/* Brand Column */}
          <div className="col-span-2 md:col-span-1">
            <img src={logo} alt="Harborline" className="h-12 w-auto mb-4 object-contain" />
            <p className="text-muted-foreground text-sm mb-4">
              The DMV's newest premiere band—building the vibe, reading the room, and keeping dance floors moving all night.
            </p>
            <div className="flex gap-3">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition-all duration-300"
                >
                  <social.icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Services Column */}
          <div>
            <h4 className="font-display tracking-wide text-sm mb-4">SERVICES</h4>
            <ul className="space-y-2">
              {serviceLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Locations Column */}
          <div>
            <h4 className="font-display tracking-wide text-sm mb-4">LOCATIONS</h4>
            <ul className="space-y-2">
              {locationLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Venues Column */}
          <div>
            <h4 className="font-display tracking-wide text-sm mb-4">VENUES</h4>
            <ul className="space-y-2">
              {venueLinks.slice(0, 8).map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Quick Links Column */}
          <div>
            <h4 className="font-display tracking-wide text-sm mb-4">QUICK LINKS</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/songs" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Song List
                </Link>
              </li>
              <li>
                <Link to="/about" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link to="/faq" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  FAQ
                </Link>
              </li>
              <li>
                <a href="/#gallery" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Gallery
                </a>
              </li>
              <li>
                <a href="/#videos" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Videos
                </a>
              </li>
              <li>
                <a href="/request-a-quote" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Request a Quote
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-border">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-muted-foreground text-sm">
              © {new Date().getFullYear()} Harborline. Baltimore's Premier Event Band.
            </p>
            <p className="text-muted-foreground/60 text-xs">
              Live Entertainment for Maryland, DC, Virginia & Beyond
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
