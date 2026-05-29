import LocationPage from "@/components/LocationPage";

const BethesdaPage = () => {
  return (
    <LocationPage
      city="Bethesda"
      region="Maryland"
      description="We work Bethesda and the surrounding Montgomery County country-club circuit on a regular basis. The venues below are familiar territory across weddings, corporate conferences, and milestone celebrations. Configurations scale from a 4-piece dinner-music register up to the full 14-piece dance band, depending on the room."
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
