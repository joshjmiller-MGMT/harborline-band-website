import LocationPage from "@/components/LocationPage";

const RockvillePage = () => {
  return (
    <LocationPage
      city="Rockville"
      region="Maryland"
      description="Rockville and central Montgomery County are an hour's drive from Baltimore. We work the corporate-conference and country-club circuits here for weddings, galas, and corporate events. The venues below are on the regular rotation. Configurations from 4-piece up to 14-piece, scaled to the room."
      venues={[
        "Rockville Hilton",
        "Glenview Mansion",
        "Manor Country Club",
        "Bolger Center",
        "F. Scott Fitzgerald Theatre",
        "Normandie Farm",
        "Woodmore Country Club",
        "The Universities at Shady Grove"
      ]}
      nearbyAreas={[
        { name: "Bethesda", slug: "bethesda" },
        { name: "Frederick", slug: "frederick" },
        { name: "Washington DC", slug: "washington-dc" }
      ]}
    />
  );
};

export default RockvillePage;
