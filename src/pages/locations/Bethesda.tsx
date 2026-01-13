import LocationPage from "@/components/LocationPage";

const BethesdaPage = () => {
  return (
    <LocationPage
      city="Bethesda"
      region="Maryland"
      description="Serving Montgomery County's most sophisticated clientele, Harborline delivers exceptional live entertainment for Bethesda's upscale events. From country club weddings to corporate conferences at premier hotels, we understand the refined expectations of Bethesda audiences. Our professional approach and diverse repertoire have made us a trusted name for events throughout the Bethesda-Chevy Chase corridor."
      venues={[
        "Bethesda Country Club",
        "Bethesda North Marriott Hotel & Conference Center",
        "Congressional Country Club",
        "Strathmore",
        "Woodmont Country Club",
        "Columbia Country Club",
        "Bethesda Blues & Jazz",
        "The Hyatt Regency Bethesda"
      ]}
      nearbyAreas={[
        { name: "Washington DC", slug: "washington-dc" },
        { name: "Rockville", slug: "rockville" },
        { name: "Baltimore", slug: "baltimore" }
      ]}
    />
  );
};

export default BethesdaPage;
