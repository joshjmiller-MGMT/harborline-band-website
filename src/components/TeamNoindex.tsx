import { useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";

export const TeamNoindex = () => {
  const { pathname } = useLocation();
  if (!pathname.startsWith("/team")) return null;
  return (
    <Helmet>
      <meta name="robots" content="noindex, nofollow" />
    </Helmet>
  );
};
