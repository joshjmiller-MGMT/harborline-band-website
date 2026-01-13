import LocationPage from "@/components/LocationPage";

const EasternShorePage = () => {
  return (
    <LocationPage
      city="Eastern Shore"
      region="Maryland"
      description="Harborline brings world-class live entertainment to Maryland's beautiful Eastern Shore. From waterfront weddings in St. Michaels to elegant celebrations in Easton, we've become the premier choice for events across the Chesapeake Bay region. Our experience performing at Eastern Shore venues means we understand the unique charm and relaxed sophistication that makes this area so special."
      venues={[
        "The Chesapeake Bay Beach Club",
        "The Oaks Waterfront Inn",
        "The Inn at Perry Cabin",
        "Wye River Conference Center",
        "Tidewater Inn",
        "Celebrations at the Bay",
        "Kent Manor Inn",
        "Historic Inns of Annapolis"
      ]}
      nearbyAreas={[
        { name: "Annapolis", slug: "annapolis" },
        { name: "Baltimore", slug: "baltimore" },
        { name: "Washington DC", slug: "washington-dc" }
      ]}
    />
  );
};

export default EasternShorePage;
