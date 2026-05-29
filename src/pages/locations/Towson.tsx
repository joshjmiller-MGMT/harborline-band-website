import LocationPage from "@/components/LocationPage";

const TowsonPage = () => {
  return (
    <LocationPage
      city="Towson"
      region="Maryland"
      description="Towson is in our backyard — most of the band lives within 15 minutes of the venues below. Towson University events, country-club weddings, and Baltimore County private parties make up the regular rotation. Named POC from first inquiry, backup-per-role on the roster, 30-minute pre-event call to walk the run-of-show."
      venues={[
        "Towson University",
        "Hillendale Country Club",
        "The Grand Lodge",
        "Historic Hampton",
        "Baltimore Country Club",
        "Valley Mansion"
      ]}
      nearbyAreas={[
        { name: "Baltimore", slug: "baltimore" },
        { name: "Columbia", slug: "columbia" },
        { name: "Annapolis", slug: "annapolis" }
      ]}
    />
  );
};

export default TowsonPage;
