import LocationPage from "@/components/LocationPage";

const ColumbiaPage = () => {
  return (
    <LocationPage
      city="Columbia"
      region="Maryland"
      description="Columbia's planned community and beautiful venues make it a premier destination for celebrations. Harborline brings world-class entertainment to Columbia weddings, corporate gatherings, and milestone celebrations. Our experience performing at Columbia's diverse range of venues—from lakeside settings to elegant ballrooms—ensures a perfect musical experience for your event."
      venues={[
        "Turf Valley Resort",
        "Columbia Lakefront",
        "Robinson Nature Center",
        "The Mansion at Maple Lawn",
        "Historic Oakland Manor",
        "The Other Barn"
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
