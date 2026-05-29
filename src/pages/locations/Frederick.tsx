import LocationPage from "@/components/LocationPage";

const FrederickPage = () => {
  return (
    <LocationPage
      city="Frederick"
      region="Maryland"
      description="Frederick is about an hour from Baltimore. We work the western Maryland circuit for barn weddings, country-club events, and historic-downtown receptions — the venues below are familiar territory. Configurations scale from acoustic trio for ceremonies up to the full band for the reception."
      venues={[
        "Ceresville Mansion",
        "Springfield Manor",
        "Morningside Inn",
        "The Weinberg Center for the Arts",
        "Walkers Overlook",
        "Stone Manor Country Club",
        "Musket Ridge Golf Club",
        "The Frederick Fairgrounds"
      ]}
      nearbyAreas={[
        { name: "Rockville", slug: "rockville" },
        { name: "Baltimore", slug: "baltimore" },
        { name: "Columbia", slug: "columbia" }
      ]}
    />
  );
};

export default FrederickPage;
