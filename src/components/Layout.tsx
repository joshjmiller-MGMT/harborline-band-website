import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Helmet } from "react-helmet-async";

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  canonical?: string;
}

const Layout = ({ 
  children, 
  title = "Harborline | Baltimore's Premier Event & Corporate Band",
  description = "Harborline is Baltimore's premier event and corporate music group. Live entertainment for weddings, galas, corporate events, and private celebrations across Maryland.",
  canonical
}: LayoutProps) => {
  return (
    <>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        {canonical && <link rel="canonical" href={canonical} />}
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
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
