import LocationPage from "@/components/LocationPage";

const BaltimorePage = () => {
  return (
    <LocationPage
      city="Baltimore"
      region="Maryland"
      description="Baltimore is home. Most of the band lives within 30 minutes of the Inner Harbor, and we've worked the rooms below across weddings, corporate events, galas, and private parties. Named POC from first inquiry, backup-per-role on the roster, configurations from 4-piece up to 14-piece depending on the room."
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
