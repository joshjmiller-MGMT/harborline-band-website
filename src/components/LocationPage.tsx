import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import PageHero from "@/components/PageHero";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { MapPin, Music, Heart, Building2, CheckCircle } from "lucide-react";

interface LocationPageProps {
  city: string;
  region: string;
  description: string;
  venues: string[];
  nearbyAreas: { name: string; slug: string }[];
}

const LocationPage = ({ city, region, description, venues, nearbyAreas }: LocationPageProps) => {
  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "Harborline",
    "@id": `https://harborlineband.com/locations/${city.toLowerCase().replace(/\s/g, '-')}`,
    "description": `Live event band and entertainment services in ${city}, ${region}`,
    "areaServed": {
      "@type": "City",
      "name": city,
      "containedInPlace": {
        "@type": "State",
        "name": region
      }
    },
    "priceRange": "$$$$"
  };

  return (
    <Layout
      title={`${city} Event Band | Harborline Live Entertainment`}
      description={`Book Harborline for weddings, corporate events, and private parties in ${city}, ${region}. Professional live entertainment that creates unforgettable celebrations.`}
      canonical={`https://harborlineband.com/locations/${city.toLowerCase().replace(/\s/g, '-')}`}
    >
      <script type="application/ld+json">
        {JSON.stringify(localBusinessSchema)}
      </script>

      <PageHero
        eyebrow={region.toUpperCase()}
        title={`${city.toUpperCase()} EVENT BAND`}
        subtitle={`Live entertainment for weddings, corporate events, and celebrations in ${city}`}
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
                <h2 className="font-display text-3xl md:text-4xl tracking-tight mb-4">
                  LIVE ENTERTAINMENT IN <span className="text-gradient-gold">{city.toUpperCase()}</span>
                </h2>
                <p className="text-muted-foreground text-lg">{description}</p>
              </div>

              {/* Services in this location */}
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  { icon: Heart, title: "Weddings", link: "/weddings" },
                  { icon: Building2, title: "Corporate Events", link: "/corporate" },
                  { icon: Music, title: "Galas & Fundraisers", link: "/galas" },
                  { icon: MapPin, title: "Private Parties", link: "/private-parties" },
                ].map((service) => (
                  <Link
                    key={service.title}
                    to={service.link}
                    className="flex items-center gap-4 p-4 bg-card border border-border rounded-lg hover:border-primary/50 transition-colors"
                  >
                    <service.icon className="w-8 h-8 text-primary" />
                    <div>
                      <h3 className="font-display text-lg">{service.title}</h3>
                      <span className="text-sm text-muted-foreground">in {city}</span>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Local Venues */}
              {venues.length > 0 && (
                <div>
                  <h3 className="font-display text-2xl mb-4">POPULAR {city.toUpperCase()} VENUES</h3>
                  <p className="text-muted-foreground mb-4">
                    We've performed at many of {city}'s finest venues, including:
                  </p>
                  <ul className="grid sm:grid-cols-2 gap-2">
                    {venues.map((venue) => (
                      <li key={venue} className="flex items-center gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-primary" />
                        <span>{venue}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

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
              {/* Quick Facts */}
              <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="font-display text-xl mb-4">WHY HARBORLINE</h3>
                <ul className="space-y-3">
                  {[
                    "1000+ events performed",
                    "10+ years experience",
                    "All genres covered",
                    "Flexible band sizes",
                    "Professional sound & lighting"
                  ].map((fact) => (
                    <li key={fact} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-primary" />
                      <span>{fact}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Nearby Areas */}
              {nearbyAreas.length > 0 && (
                <div className="bg-card border border-border rounded-lg p-6">
                  <h3 className="font-display text-xl mb-4">NEARBY AREAS</h3>
                  <ul className="space-y-2">
                    {nearbyAreas.map((area) => (
                      <li key={area.slug}>
                        <Link
                          to={`/locations/${area.slug}`}
                          className="text-muted-foreground hover:text-primary transition-colors text-sm"
                        >
                          {area.name} Event Band →
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

export default LocationPage;
