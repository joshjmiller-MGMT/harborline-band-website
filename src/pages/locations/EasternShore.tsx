import LocationPage from "@/components/LocationPage";

const EasternShorePage = () => {
  return (
    <LocationPage
      city="Eastern Shore"
      region="Maryland"
      description="Eastern Shore work means a Bay Bridge run, so we plan load-in around the bridge schedule and bring our own gear end-to-end. The venues below have hosted us for waterfront weddings, Easton galas, and St. Michaels receptions. Named POC from first inquiry; we coordinate with the event planner on the full run-of-show in advance."
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
