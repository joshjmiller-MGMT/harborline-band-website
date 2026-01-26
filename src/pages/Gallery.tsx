import { motion } from "framer-motion";
import Layout from "@/components/Layout";
import { Helmet } from "react-helmet-async";

// Gallery images
import gallery1 from "@/assets/gallery-1.jpg";
import gallery2 from "@/assets/gallery-2.jpg";
import gallery3 from "@/assets/gallery-3.jpg";
import gallery4 from "@/assets/gallery-4.jpg";
import gallery5 from "@/assets/gallery-5.jpg";
import heroBand from "@/assets/band-hero.jpg";
import heroImage from "@/assets/hero-band.jpg";

// Venue images
import avam1 from "@/assets/venues/avam-1.jpg";
import belvedere1 from "@/assets/venues/belvedere-1.jpg";
import belvedere2 from "@/assets/venues/belvedere-2.jpg";
import boRailroad1 from "@/assets/venues/bo-railroad-1.jpg";
import boRailroad2 from "@/assets/venues/bo-railroad-2.jpg";
import cloisters1 from "@/assets/venues/cloisters-1.jpg";
import cloisters2 from "@/assets/venues/cloisters-2.jpg";
import cylburn1 from "@/assets/venues/cylburn-1.jpg";
import cylburn2 from "@/assets/venues/cylburn-2.jpg";
import evergreen1 from "@/assets/venues/evergreen-1.jpg";
import evergreen2 from "@/assets/venues/evergreen-2.jpg";
import fourSeasons1 from "@/assets/venues/four-seasons-1.jpg";
import fourSeasons2 from "@/assets/venues/four-seasons-2.jpg";
import leggMason1 from "@/assets/venues/legg-mason-1.jpg";
import peabody1 from "@/assets/venues/peabody-1.jpg";
import peabody2 from "@/assets/venues/peabody-2.jpg";
import pendry1 from "@/assets/venues/pendry-1.jpg";
import pendry2 from "@/assets/venues/pendry-2.jpg";

// Logos
import logoCircle from "@/assets/logo-circle.png";
import logoText from "@/assets/logo-text.png";
import logoBlack from "@/assets/logo-black.png";
import logoNew from "@/assets/logo-new.png";
import logoIcon from "@/assets/logo-icon.png";
import logoOriginal from "@/assets/logo.png";

const galleryImages = [
  { src: gallery1, alt: "Harborline performing at a corporate event", category: "Band" },
  { src: gallery2, alt: "Band members at an outdoor celebration", category: "Band" },
  { src: gallery3, alt: "Setup for an elegant waterfront event", category: "Band" },
  { src: gallery4, alt: "The band posing by the Chesapeake Bay", category: "Band" },
  { src: gallery5, alt: "Keyboardist performing live", category: "Band" },
  { src: heroBand, alt: "Harborline hero band image", category: "Band" },
  { src: heroImage, alt: "Hero band performance", category: "Band" },
];

const venueImages = [
  { src: avam1, alt: "American Visionary Art Museum", category: "Venue" },
  { src: belvedere1, alt: "The Belvedere", category: "Venue" },
  { src: belvedere2, alt: "The Belvedere interior", category: "Venue" },
  { src: boRailroad1, alt: "B&O Railroad Museum", category: "Venue" },
  { src: boRailroad2, alt: "B&O Railroad Museum interior", category: "Venue" },
  { src: cloisters1, alt: "Cloisters Castle", category: "Venue" },
  { src: cloisters2, alt: "Cloisters Castle grounds", category: "Venue" },
  { src: cylburn1, alt: "Cylburn Arboretum", category: "Venue" },
  { src: cylburn2, alt: "Cylburn Arboretum gardens", category: "Venue" },
  { src: evergreen1, alt: "Evergreen Museum", category: "Venue" },
  { src: evergreen2, alt: "Evergreen Museum interior", category: "Venue" },
  { src: fourSeasons1, alt: "Four Seasons Baltimore", category: "Venue" },
  { src: fourSeasons2, alt: "Four Seasons Baltimore ballroom", category: "Venue" },
  { src: leggMason1, alt: "Legg Mason Tower", category: "Venue" },
  { src: peabody1, alt: "George Peabody Library", category: "Venue" },
  { src: peabody2, alt: "George Peabody Library interior", category: "Venue" },
  { src: pendry1, alt: "Pendry Baltimore", category: "Venue" },
  { src: pendry2, alt: "Pendry Baltimore event space", category: "Venue" },
];

const logos = [
  { src: logoCircle, alt: "Harborline Circle Logo" },
  { src: logoText, alt: "Harborline Text Logo" },
  { src: logoBlack, alt: "Harborline Black Logo" },
  { src: logoNew, alt: "Harborline New Logo" },
  { src: logoIcon, alt: "Harborline Icon Logo" },
  { src: logoOriginal, alt: "Harborline Original Logo" },
];

const externalLinks = [
  { name: "Vimeo Showcase", url: "https://vimeo.com/showcase/11690570", type: "Video" },
  { name: "Instagram", url: "https://www.instagram.com/harborline.band/", type: "Social" },
  { name: "Facebook", url: "https://www.facebook.com/Harborline.band/", type: "Social" },
];

const GalleryPage = () => {
  return (
    <Layout>
      <Helmet>
        <title>Media Gallery | Harborline</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="pt-32 pb-24">
        <div className="container px-6 max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <p className="text-primary font-display tracking-display text-sm mb-3">
              MEDIA ASSETS
            </p>
            <h1 className="font-display text-5xl md:text-7xl tracking-tight mb-4">
              GALLERY
            </h1>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              All uploaded images, videos, and links in one place.
            </p>
          </motion.div>

          {/* Videos Section */}
          <motion.section
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mb-20"
          >
            <h2 className="font-display text-3xl mb-8 border-b border-border pb-4">
              VIDEO GALLERY
            </h2>
            <div className="relative rounded-lg overflow-hidden border border-border bg-card shadow-2xl">
              <div style={{ padding: '56.25% 0 0 0', position: 'relative' }}>
                <iframe
                  src="https://vimeo.com/showcase/11690570/embed"
                  allow="autoplay; fullscreen; picture-in-picture; gyroscope; accelerometer; clipboard-write; encrypted-media; web-share"
                  frameBorder="0"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                  }}
                  title="Harborline Video Gallery"
                />
              </div>
            </div>
          </motion.section>

          {/* Band Images Section */}
          <motion.section
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-20"
          >
            <h2 className="font-display text-3xl mb-8 border-b border-border pb-4">
              BAND PHOTOS
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {galleryImages.map((image, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  className="relative group overflow-hidden rounded-lg aspect-square"
                >
                  <img
                    src={image.src}
                    alt={image.alt}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-end p-4">
                    <p className="text-sm text-foreground">{image.alt}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>

          {/* Venue Images Section */}
          <motion.section
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mb-20"
          >
            <h2 className="font-display text-3xl mb-8 border-b border-border pb-4">
              VENUE PHOTOS
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {venueImages.map((image, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, delay: index * 0.03 }}
                  className="relative group overflow-hidden rounded-lg aspect-square"
                >
                  <img
                    src={image.src}
                    alt={image.alt}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-end p-4">
                    <p className="text-sm text-foreground">{image.alt}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>

          {/* Logos Section */}
          <motion.section
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mb-20"
          >
            <h2 className="font-display text-3xl mb-8 border-b border-border pb-4">
              LOGOS & BRANDING
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
              {logos.map((logo, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  className="relative group overflow-hidden rounded-lg bg-card border border-border p-6 flex items-center justify-center aspect-square"
                >
                  <img
                    src={logo.src}
                    alt={logo.alt}
                    className="max-w-full max-h-full object-contain"
                  />
                </motion.div>
              ))}
            </div>
          </motion.section>

          {/* External Links Section */}
          <motion.section
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <h2 className="font-display text-3xl mb-8 border-b border-border pb-4">
              EXTERNAL LINKS
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {externalLinks.map((link, index) => (
                <a
                  key={index}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-6 bg-card border border-border rounded-lg hover:border-primary transition-colors"
                >
                  <div>
                    <p className="font-display text-lg">{link.name}</p>
                    <p className="text-sm text-muted-foreground">{link.type}</p>
                  </div>
                  <span className="text-primary">→</span>
                </a>
              ))}
            </div>
          </motion.section>
        </div>
      </div>
    </Layout>
  );
};

export default GalleryPage;
