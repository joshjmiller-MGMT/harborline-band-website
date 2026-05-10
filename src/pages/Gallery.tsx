import { motion } from "framer-motion";
import Layout from "@/components/Layout";
import { Helmet } from "react-helmet-async";
import { OptimizedImage } from "@/components/OptimizedImage";
import type { AssetSlug } from "@/lib/asset-manifest";

// Logos — kept as bundled imports (small + on critical render path)
import logoCircle from "@/assets/logo-circle.png";
import logoText from "@/assets/logo-text.png";
import logoBlack from "@/assets/logo-black.png";
import logoNew from "@/assets/logo-new.png";
import logoIcon from "@/assets/logo-icon.png";
import logoOriginal from "@/assets/logo.png";

const galleryImages: { src: AssetSlug; alt: string; category: string }[] = [
  // New waterfront group shots
  { src: "band/group-waterfront-1", alt: "Full band group photo by the water - everyone smiling", category: "Band" },
  { src: "band/group-waterfront-2", alt: "Candid band moment with vocalist featured", category: "Band" },
  { src: "band/group-waterfront-3", alt: "Fun band photo with peace sign", category: "Band" },
  { src: "band/group-waterfront-4", alt: "Band sharing a candid moment by the bay", category: "Band" },
  // New performance shots
  { src: "band/jazz-trio-1", alt: "Jazz trio performing under white tent - piano, drums, upright bass", category: "Band" },
  { src: "band/jazz-trio-2", alt: "Jazz trio in action - intimate performance", category: "Band" },
  { src: "band/live-dj-sax", alt: "DJ and saxophone player performing together", category: "Band" },
  { src: "band/special-event-dancer", alt: "Special event with ribbon dancer and live band", category: "Band" },
  // Original photos
  { src: "band/group-laughing", alt: "Harborline band group photo - candid laughing moment", category: "Band" },
  { src: "band/group-portrait", alt: "Harborline band official group portrait", category: "Band" },
  { src: "band/live-performance-1", alt: "Live performance - drums and saxophone", category: "Band" },
  { src: "band/setup-tent", alt: "Professional DJ and sound setup in white tent", category: "Band" },
  { src: "band/setup-waterfront", alt: "Waterfront keyboard setup with bay view", category: "Band" },
  { src: "gallery-1", alt: "Harborline performing at a corporate event", category: "Band" },
  { src: "gallery-2", alt: "Band members at an outdoor celebration", category: "Band" },
  { src: "gallery-3", alt: "Setup for an elegant waterfront event", category: "Band" },
  { src: "gallery-4", alt: "The band posing by the Chesapeake Bay", category: "Band" },
  { src: "gallery-5", alt: "Keyboardist performing live", category: "Band" },
  { src: "band-hero", alt: "Harborline hero band image", category: "Band" },
  { src: "hero-band", alt: "Hero band performance", category: "Band" },
];

const memberImages: { src: AssetSlug; alt: string; player: number }[] = [
  // Player 1 - Glasses, beard
  { src: "band/portrait-player1-a", alt: "Band member portrait - serious", player: 1 },
  { src: "band/portrait-player1-b", alt: "Band member portrait - smiling", player: 1 },
  // Player 2 - Female vocalist
  { src: "band/portrait-player2-a", alt: "Band member portrait - vocalist", player: 2 },
  // Player 3 - Long hair
  { src: "band/portrait-player3-a", alt: "Band member portrait - guitarist", player: 3 },
  // Player 4 - Curly hair, mustache
  { src: "band/portrait-player4-a", alt: "Band member portrait - smiling", player: 4 },
  { src: "band/portrait-player4-b", alt: "Band member portrait - serious", player: 4 },
  // Player 5 - Durag
  { src: "band/portrait-player5-a", alt: "Band member portrait - smiling", player: 5 },
  { src: "band/portrait-player5-b", alt: "Band member portrait - serious", player: 5 },
  // Existing portraits
  { src: "band/member-1", alt: "Band member portrait", player: 6 },
  { src: "band/member-2", alt: "Band member portrait", player: 7 },
  { src: "band/member-3", alt: "Band member portrait", player: 8 },
  { src: "band/member-4", alt: "Band member portrait", player: 9 },
  { src: "band/member-5", alt: "Band member portrait", player: 10 },
  { src: "band/member-6", alt: "Band member portrait", player: 11 },
];

const venueImages: { src: AssetSlug; alt: string; category: string }[] = [
  { src: "venues/avam-1", alt: "American Visionary Art Museum", category: "Venue" },
  { src: "venues/belvedere-1", alt: "The Belvedere", category: "Venue" },
  { src: "venues/belvedere-2", alt: "The Belvedere interior", category: "Venue" },
  { src: "venues/bo-railroad-1", alt: "B&O Railroad Museum", category: "Venue" },
  { src: "venues/bo-railroad-2", alt: "B&O Railroad Museum interior", category: "Venue" },
  { src: "venues/cloisters-1", alt: "Cloisters Castle", category: "Venue" },
  { src: "venues/cloisters-2", alt: "Cloisters Castle grounds", category: "Venue" },
  { src: "venues/cylburn-1", alt: "Cylburn Arboretum", category: "Venue" },
  { src: "venues/cylburn-2", alt: "Cylburn Arboretum gardens", category: "Venue" },
  { src: "venues/evergreen-1", alt: "Evergreen Museum", category: "Venue" },
  { src: "venues/evergreen-2", alt: "Evergreen Museum interior", category: "Venue" },
  { src: "venues/four-seasons-1", alt: "Four Seasons Baltimore", category: "Venue" },
  { src: "venues/four-seasons-2", alt: "Four Seasons Baltimore ballroom", category: "Venue" },
  { src: "venues/legg-mason-1", alt: "Legg Mason Tower", category: "Venue" },
  { src: "venues/peabody-1", alt: "George Peabody Library", category: "Venue" },
  { src: "venues/peabody-2", alt: "George Peabody Library interior", category: "Venue" },
  { src: "venues/pendry-1", alt: "Pendry Baltimore", category: "Venue" },
  { src: "venues/pendry-2", alt: "Pendry Baltimore event space", category: "Venue" },
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

const GalleryPage = ({ embedded = false }: { embedded?: boolean }) => {
  const content = (
    <>
      <Helmet>
        <title>Media Gallery | Harborline</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className={embedded ? "py-12" : "pt-32 pb-24"}>
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
                  <OptimizedImage
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

          {/* Member Portraits Section */}
          <motion.section
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="mb-20"
          >
            <h2 className="font-display text-3xl mb-8 border-b border-border pb-4">
              MEMBER PORTRAITS
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {memberImages.map((image, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  className="relative group overflow-hidden rounded-lg aspect-[3/4]"
                >
                  <OptimizedImage
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
                  <OptimizedImage
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
    </>
  );

  if (embedded) return content;
  return <Layout>{content}</Layout>;
};

export default GalleryPage;
