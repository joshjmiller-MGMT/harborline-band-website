import LocationPage from "@/components/LocationPage";

const WashingtonDCPage = () => {
  return (
    <LocationPage
      city="Washington DC"
      region="District of Columbia"
      description="Harborline is a Baltimore band that works DC regularly. We drive down for embassy events, Georgetown weddings, corporate galas, and political fundraisers — the venues below are familiar across all four. Named POC from first inquiry, configurations from 4-piece up to 14-piece depending on the room and the run-of-show."
      venues={[
        "The Hay-Adams",
        "The Willard InterContinental",
        "National Museum of Women in the Arts",
        "The Ritz-Carlton Georgetown",
        "Carnegie Library at Mt. Vernon Square",
        "The Mayflower Hotel",
        "Anderson House",
        "The Line DC",
        "City Tavern"
      ]}
      nearbyAreas={[
        { name: "Bethesda", slug: "bethesda" },
        { name: "Baltimore", slug: "baltimore" },
        { name: "Annapolis", slug: "annapolis" }
      ]}
    />
  );
};

export default WashingtonDCPage;
