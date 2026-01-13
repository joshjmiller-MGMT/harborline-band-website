import LocationPage from "@/components/LocationPage";

const BaltimorePage = () => {
  return (
    <LocationPage
      city="Baltimore"
      region="Maryland"
      description="As Baltimore's premier event band, Harborline has been the soundtrack to countless celebrations throughout Charm City. From the Inner Harbor to Mount Vernon, we bring unmatched energy and professionalism to weddings, corporate galas, and private parties across Baltimore. Our deep roots in the Baltimore music scene and understanding of local venues make us the go-to choice for clients who demand excellence."
      venues={[
        "The Pendry Baltimore",
        "Sagamore Pendry",
        "George Peabody Library",
        "The Belvedere",
        "American Visionary Art Museum",
        "The B&O Railroad Museum",
        "Pier 5 Hotel",
        "Four Seasons Baltimore"
      ]}
      nearbyAreas={[
        { name: "Towson", slug: "towson" },
        { name: "Columbia", slug: "columbia" },
        { name: "Annapolis", slug: "annapolis" }
      ]}
    />
  );
};

export default BaltimorePage;
