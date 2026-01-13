import LocationPage from "@/components/LocationPage";

const TowsonPage = () => {
  return (
    <LocationPage
      city="Towson"
      region="Maryland"
      description="Towson's vibrant community deserves exceptional entertainment. Harborline serves the greater Towson area with professional live music for weddings at local country clubs, corporate events at business centers, and private celebrations throughout Baltimore County. Our versatile performances are perfect for Towson's diverse event scene."
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
