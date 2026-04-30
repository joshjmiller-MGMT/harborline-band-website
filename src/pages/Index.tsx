import { Helmet } from "react-helmet-async";
import Header from "@/components/Header";
import Hero from "@/components/Hero";

import CredibilitySection from "@/components/CredibilitySection";
import Services from "@/components/Services";
import Gallery from "@/components/Gallery";
import InstagramGrid from "@/components/InstagramGrid";
import VideoGallery from "@/components/VideoGallery";
import About from "@/components/About";
import Testimonials from "@/components/Testimonials";

import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";

// Comprehensive Schema.org structured data for SEO
const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "MusicGroup",
  "name": "Harborline",
  "url": "https://harborlineband.com",
  "logo": "https://harborlineband.com/logo.png",
  "image": "https://harborlineband.com/logo.png",
  "description": "Baltimore's premier event and corporate music group. Live entertainment for weddings, galas, corporate events, and private celebrations across Maryland.",
  "foundingDate": "2009",
  "areaServed": [
    { "@type": "City", "name": "Baltimore", "containedInPlace": { "@type": "State", "name": "Maryland" } },
    { "@type": "City", "name": "Washington", "containedInPlace": { "@type": "AdministrativeArea", "name": "District of Columbia" } },
    { "@type": "City", "name": "Annapolis", "containedInPlace": { "@type": "State", "name": "Maryland" } }
  ],
  "genre": ["Wedding Music", "Corporate Entertainment", "Jazz", "Dance", "Pop", "R&B"],
  "sameAs": [
    "https://www.instagram.com/harborline.band/",
    "https://www.facebook.com/Harborline.band/",
    "https://vimeo.com/showcase/11690570"
  ],
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Baltimore",
    "addressRegion": "MD",
    "addressCountry": "US"
  },
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "+1-443-405-2378",
    "contactType": "booking",
    "email": "harborlineband@gmail.com"
  },
  "priceRange": "$$$$",
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "5",
    "ratingCount": "150",
    "bestRating": "5",
    "worstRating": "1"
  },
  "knowsAbout": ["Wedding Music", "Corporate Entertainment", "Live Events"]
};

const localBusinessSchema = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Harborline Entertainment",
  "@id": "https://harborlineband.com",
  "url": "https://harborlineband.com",
  "telephone": "+1-443-405-2378",
  "email": "harborlineband@gmail.com",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Baltimore",
    "addressRegion": "MD",
    "postalCode": "21201",
    "addressCountry": "US"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 39.2904,
    "longitude": -76.6122
  },
  "openingHoursSpecification": {
    "@type": "OpeningHoursSpecification",
    "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    "opens": "09:00",
    "closes": "18:00"
  },
  "priceRange": "$$$$",
  "paymentAccepted": "Credit Card, Check",
  "currenciesAccepted": "USD"
};

const serviceSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  "serviceType": "Live Event Entertainment",
  "provider": {
    "@type": "MusicGroup",
    "name": "Harborline"
  },
  "areaServed": {
    "@type": "GeoCircle",
    "geoMidpoint": {
      "@type": "GeoCoordinates",
      "latitude": 39.2904,
      "longitude": -76.6122
    },
    "geoRadius": "100 mi"
  },
  "hasOfferCatalog": {
    "@type": "OfferCatalog",
    "name": "Entertainment Packages",
    "itemListElement": [
      {
        "@type": "Offer",
        "itemOffered": {
          "@type": "Service",
          "name": "Full Dance Band",
          "description": "8-12 piece high-energy dance band for weddings and galas"
        }
      },
      {
        "@type": "Offer",
        "itemOffered": {
          "@type": "Service",
          "name": "Jazz Quartet",
          "description": "Sophisticated jazz for cocktail hours and intimate events"
        }
      },
      {
        "@type": "Offer",
        "itemOffered": {
          "@type": "Service",
          "name": "Acoustic Duo",
          "description": "Perfect for ceremonies and smaller gatherings"
        }
      }
    ]
  }
};

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Harborline | Baltimore's Premier Event & Corporate Band</title>
        <meta name="description" content="Top-rated live entertainment for weddings, galas, corporate events, and private celebrations in Baltimore, Maryland, Washington DC, and the Mid-Atlantic region." />
        <meta name="keywords" content="Baltimore wedding band, corporate event band, live music Baltimore, wedding entertainment Maryland, jazz band Baltimore, gala entertainment, party band DC" />
        <link rel="canonical" href="https://harborlineband.com" />
        
        {/* Open Graph */}
        <meta property="og:title" content="Harborline | Baltimore's Premier Event Band" />
        <meta property="og:description" content="Top-rated live entertainment for weddings, galas, and corporate events in Baltimore and the Mid-Atlantic." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://harborlineband.com" />
        <meta property="og:image" content="https://harborlineband.com/og-image.jpg" />
        <meta property="og:locale" content="en_US" />
        <meta property="og:site_name" content="Harborline" />
        
        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Harborline | Baltimore Event Band" />
        <meta name="twitter:description" content="Top-rated live entertainment for weddings, galas, and corporate events." />
        <meta name="twitter:image" content="https://harborlineband.com/og-image.jpg" />
        
        {/* Additional SEO Meta */}
        <meta name="robots" content="index, follow" />
        <meta name="author" content="Harborline" />
        <meta name="geo.region" content="US-MD" />
        <meta name="geo.placename" content="Baltimore" />
        
        {/* Structured Data */}
        <script type="application/ld+json">
          {JSON.stringify(organizationSchema)}
        </script>
        <script type="application/ld+json">
          {JSON.stringify(localBusinessSchema)}
        </script>
        <script type="application/ld+json">
          {JSON.stringify(serviceSchema)}
        </script>
      </Helmet>
      
      <Header />
      <main>
        <Hero />
        <About />
        <InstagramGrid />
        <VideoGallery />
        <Services />
        <Gallery />
        <Testimonials />
        <CredibilitySection />
      </main>
      <Footer />
      <ScrollToTop />
    </div>
  );
};

export default Index;
