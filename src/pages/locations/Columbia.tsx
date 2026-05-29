import LocationPage from "@/components/LocationPage";

const ColumbiaPage = () => {
  return (
    <LocationPage
      city="Columbia"
      region="Maryland"
      description="Columbia sits between our Baltimore base and the DC suburbs — we cover it for weddings, milestone events, and corporate gatherings. The venues below are familiar ground, from the Lakefront to Turf Valley. We scale from a 4-piece acoustic register to the full band depending on the space and the run-of-show."
      venues={[
        "Turf Valley Resort",
        "Columbia Lakefront",
        "Robinson Nature Center",
        "The Mansion at Maple Lawn",
        "Historic Oakland Manor",
        "The Other Barn",
        "The Mansion at Laurel"
      ]}
      nearbyAreas={[
        { name: "Baltimore", slug: "baltimore" },
        { name: "Towson", slug: "towson" },
        { name: "Annapolis", slug: "annapolis" }
      ]}
    />
  );
};

export default ColumbiaPage;
