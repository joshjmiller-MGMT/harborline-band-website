import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import Layout from "@/components/Layout";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.warn("404:", location.pathname);
  }, [location.pathname]);

  return (
    <Layout
      title="Page Not Found | Harborline"
      description="The page you're looking for doesn't exist."
    >
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <h1 className="mb-4 text-4xl font-bold">404</h1>
          <p className="mb-4 text-xl text-muted-foreground">Page not found</p>
          <a href="/" className="text-primary underline hover:text-primary/90">
            Return to Home
          </a>
        </div>
      </div>
    </Layout>
  );
};

export default NotFound;
