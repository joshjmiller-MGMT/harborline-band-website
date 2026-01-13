import LocationPage from "@/components/LocationPage";

const RockvillePage = () => {
  return (
    <LocationPage
      city="Rockville"
      region="Maryland"
      description="Harborline proudly serves Rockville and central Montgomery County with premium live entertainment. Whether you're hosting a corporate event at a Rockville conference center or celebrating a wedding at one of the area's beautiful venues, we bring energy, professionalism, and musical excellence to every performance. Our experience performing throughout the DC suburbs has made us experts at reading diverse crowds."
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
