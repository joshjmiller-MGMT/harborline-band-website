import LocationPage from "@/components/LocationPage";

const WashingtonDCPage = () => {
  return (
    <LocationPage
      city="Washington DC"
      region="District of Columbia"
      description="Harborline brings Baltimore's finest live entertainment to the nation's capital. From prestigious embassy events to intimate Georgetown celebrations, we've earned a reputation as the go-to band for Washington DC's most discerning clients. Our versatile repertoire and polished professionalism make us the perfect choice for corporate galas, political fundraisers, and elegant weddings throughout the District."
      venues={[
        "The Hay-Adams",
        "The Willard InterContinental",
        "National Museum of Women in the Arts",
        "The Ritz-Carlton Georgetown",
        "Carnegie Library at Mt. Vernon Square",
        "The Mayflower Hotel",
        "Anderson House",
        "The Line DC"
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
