import LocationPage from "@/components/LocationPage";

const AnnapolisPage = () => {
  return (
    <LocationPage
      city="Annapolis"
      region="Maryland"
      description="Annapolis is a 45-minute drive from Baltimore. We work waterfront weddings, historic-downtown receptions, and Naval Academy events here regularly — the venues below have hosted us across all three. Named POC from first inquiry, run-of-show walked in a 30-minute pre-event call."
      venues={[
        "The Hotel & Conference Center",
        "Annapolis Waterfront Hotel",
        "Historic Inns of Annapolis",
        "Chesapeake Bay Beach Club",
        "St. Anne's Church",
        "William Paca House",
        "Naval Academy Club"
      ]}
      nearbyAreas={[
        { name: "Baltimore", slug: "baltimore" },
        { name: "Columbia", slug: "columbia" },
        { name: "Towson", slug: "towson" }
      ]}
    />
  );
};

export default AnnapolisPage;
