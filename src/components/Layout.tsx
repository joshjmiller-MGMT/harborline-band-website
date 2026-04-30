import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Helmet } from "react-helmet-async";

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  canonical?: string;
  keywords?: string;
  ogImage?: string;
}

// Base organization schema for all pages
const baseOrgSchema = {
  "@context": "https://schema.org",
  "@type": "MusicGroup",
  "name": "Harborline",
  "url": "https://harborlineband.com",
  "logo": "https://harborlineband.com/logo.png",
  "sameAs": [
    "https://www.instagram.com/harborline.band/",
    "https://www.facebook.com/Harborline.band/",
    "https://vimeo.com/showcase/11690570"
  ]
};

const Layout = ({ 
  children, 
  title = "Harborline | Baltimore's Premier Event & Corporate Band",
  description = "Top-rated live entertainment for weddings, galas, corporate events, and private celebrations in Baltimore, Maryland, and the Mid-Atlantic region.",
  canonical,
  keywords = "Baltimore wedding band, corporate event band, live music Baltimore, wedding entertainment Maryland",
  ogImage = "https://harborlineband.com/og-image.jpg"
}: LayoutProps) => {
  return (
    <>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="keywords" content={keywords} />
        {canonical && <link rel="canonical" href={canonical} />}
        <meta name="robots" content="index, follow" />
        
        {/* Open Graph */}
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
        <meta property="og:image" content={ogImage} />
        <meta property="og:locale" content="en_US" />
        <meta property="og:site_name" content="Harborline" />
        {canonical && <meta property="og:url" content={canonical} />}
        
        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={ogImage} />
        
        {/* Organization Schema */}
        <script type="application/ld+json">
          {JSON.stringify(baseOrgSchema)}
        </script>
      </Helmet>
      <div className="min-h-screen bg-background">
        <Header />
        <main>{children}</main>
        <Footer />
      </div>
    </>
  );
};

export default Layout;
