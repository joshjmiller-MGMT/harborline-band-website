import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import PageHero from "@/components/PageHero";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { MapPin, Music, Heart, Users, CheckCircle, Star, Building2, Camera } from "lucide-react";
import { useState } from "react";

interface VenuePageProps {
  venueName: string;
  city: string;
  venueType: string;
  description: string;
  features: string[];
  capacity?: string;
  highlights: string[];
  nearbyVenues: { name: string; slug: string }[];
  images?: { src: string; alt: string }[];
}

const VenuePage = ({ 
  venueName, 
  city, 
  venueType,
  description, 
  features,
  capacity,
  highlights,
  nearbyVenues,
  images = []
}: VenuePageProps) => {
  const [selectedImage, setSelectedImage] = useState<number | null>(null);
  const slug = venueName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  
  const venueSchema = {
    "@context": "https://schema.org",
    "@type": "Event",
    "name": `Harborline Live Entertainment at ${venueName}`,
    "description": `Book Harborline to perform at ${venueName} in ${city}. Professional live band for weddings, corporate events, and celebrations.`,
    "location": {
      "@type": "Place",
      "name": venueName,
      "address": {
        "@type": "PostalAddress",
        "addressLocality": city,
        "addressRegion": "Maryland"
      }
    },
    "performer": {
      "@type": "MusicGroup",
      "name": "Harborline"
    }
  };

  return (
    <Layout
      title={`${venueName} Wedding Band | Harborline at ${venueName}`}
      description={`Book Harborline to perform at ${venueName} in ${city}. Expert live band with experience at this stunning ${venueType.toLowerCase()}. Weddings, galas, and corporate events.`}
      canonical={`https://harborlineband.com/venues/${slug}`}
    >
      <script type="application/ld+json">
        {JSON.stringify(venueSchema)}
      </script>

      <PageHero
        eyebrow={city.toUpperCase()}
        title={venueName.toUpperCase()}
        subtitle={`Live entertainment for weddings and events at ${venueName}`}
      />

      <section className="py-20 md:py-24">
        <div className="container px-6 max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-3 gap-12">
            {/* Main Content */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="lg:col-span-2 space-y-8"
            >
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="px-3 py-1 bg-primary/10 text-primary text-sm rounded-full">
                    {venueType}
                  </span>
                  {capacity && (
                    <span className="px-3 py-1 bg-muted text-muted-foreground text-sm rounded-full flex items-center gap-1">
                      <Users className="w-3 h-3" /> {capacity}
                    </span>
                  )}
                </div>
                <h2 className="font-display text-3xl md:text-4xl tracking-tight mb-4">
                  HARBORLINE AT <span className="text-gradient-gold">{venueName.toUpperCase()}</span>
                </h2>
                <p className="text-muted-foreground text-lg mb-6">{description}</p>
                
                {/* Image Gallery */}
                {images.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="font-display text-xl flex items-center gap-2">
                      <Camera className="w-5 h-5 text-primary" />
                      VENUE GALLERY
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      {images.map((image, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, scale: 0.95 }}
                          whileInView={{ opacity: 1, scale: 1 }}
                          viewport={{ once: true }}
                          transition={{ delay: index * 0.1 }}
                          className="relative aspect-[4/3] overflow-hidden rounded-lg cursor-pointer group"
                          onClick={() => setSelectedImage(index)}
                        >
                          <img
                            src={image.src}
                            alt={image.alt}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Lightbox */}
              {selectedImage !== null && images.length > 0 && (
                <div 
                  className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
                  onClick={() => setSelectedImage(null)}
                >
                  <motion.img
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    src={images[selectedImage].src}
                    alt={images[selectedImage].alt}
                    className="max-w-full max-h-[90vh] object-contain rounded-lg"
                  />
                  <button
                    className="absolute top-4 right-4 text-white/80 hover:text-white text-4xl"
                    onClick={() => setSelectedImage(null)}
                  >
                    ×
                  </button>
                </div>
              )}

              {/* Why We Love This Venue */}
              <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="font-display text-xl mb-4 flex items-center gap-2">
                  <Star className="w-5 h-5 text-primary" />
                  WHY WE LOVE {venueName.toUpperCase()}
                </h3>
                <ul className="grid sm:grid-cols-2 gap-3">
                  {highlights.map((highlight) => (
                    <li key={highlight} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <span>{highlight}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Venue Features */}
              <div>
                <h3 className="font-display text-2xl mb-4">VENUE FEATURES</h3>
                <ul className="grid sm:grid-cols-2 gap-2">
                  {features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-primary" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Services at this venue */}
              <div>
                <h3 className="font-display text-2xl mb-4">EVENTS AT {venueName.toUpperCase()}</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    { icon: Heart, title: "Weddings", link: "/weddings", desc: "Ceremonies & receptions" },
                    { icon: Building2, title: "Corporate Events", link: "/corporate", desc: "Galas & conferences" },
                    { icon: Music, title: "Private Parties", link: "/private-parties", desc: "Celebrations & milestones" },
                    { icon: Users, title: "Fundraisers", link: "/galas", desc: "Charity events & galas" },
                  ].map((service) => (
                    <Link
                      key={service.title}
                      to={service.link}
                      className="flex items-center gap-4 p-4 bg-card border border-border rounded-lg hover:border-primary/50 transition-colors"
                    >
                      <service.icon className="w-8 h-8 text-primary" />
                      <div>
                        <h4 className="font-display text-lg">{service.title}</h4>
                        <span className="text-sm text-muted-foreground">{service.desc}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              <Button variant="hero" size="lg" asChild>
                <a href="/request-a-quote">Request a Quote</a>
              </Button>
            </motion.div>

            {/* Sidebar */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="space-y-6"
            >
              {/* Quick Info */}
              <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="font-display text-xl mb-4">HARBORLINE ADVANTAGE</h3>
                <ul className="space-y-3">
                  {[
                    "Venue-specific experience",
                    "Professional sound setup",
                    "Flexible band configurations",
                    "Seamless coordination",
                    "Custom song requests"
                  ].map((fact) => (
                    <li key={fact} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-primary" />
                      <span>{fact}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Location Link */}
              <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="font-display text-xl mb-4 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary" />
                  LOCATION
                </h3>
                <Link
                  to="/locations/baltimore"
                  className="text-muted-foreground hover:text-primary transition-colors text-sm"
                >
                  More Baltimore venues →
                </Link>
              </div>

              {/* Other Venues */}
              {nearbyVenues.length > 0 && (
                <div className="bg-card border border-border rounded-lg p-6">
                  <h3 className="font-display text-xl mb-4">OTHER VENUES</h3>
                  <ul className="space-y-2">
                    {nearbyVenues.map((venue) => (
                      <li key={venue.slug}>
                        <Link
                          to={`/venues/${venue.slug}`}
                          className="text-muted-foreground hover:text-primary transition-colors text-sm"
                        >
                          {venue.name} →
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default VenuePage;
