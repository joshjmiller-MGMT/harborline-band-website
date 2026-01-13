import LocationPage from "@/components/LocationPage";

const FrederickPage = () => {
  return (
    <LocationPage
      city="Frederick"
      region="Maryland"
      description="From historic downtown Frederick to the rolling farmland of Frederick County, Harborline delivers unforgettable live entertainment for celebrations throughout Western Maryland. We've performed at some of Frederick's most charming venues—from restored barns to elegant estates—bringing our signature energy and musical versatility to every event. Let us be the soundtrack to your Frederick celebration."
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
