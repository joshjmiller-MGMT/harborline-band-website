import VenuePage from "@/components/VenuePage";

const CylburnArboretumPage = () => {
  return (
    <VenuePage
      venueName="Cylburn Arboretum"
      city="Baltimore"
      venueType="Garden Estate"
      capacity="Up to 200 guests"
      description="Cylburn Arboretum is Baltimore's premier garden wedding destination. Set on 207 acres of stunning gardens and natural landscapes, this city-owned estate features a beautiful Victorian mansion and multiple outdoor ceremony sites. Harborline has performed many celebrations here, from garden ceremonies to tent receptions, always adapting our sound to complement the natural beauty."
      features={[
        "207-acre garden estate",
        "Victorian mansion",
        "Multiple garden settings",
        "Tent reception options",
        "Natural woodland paths",
        "Formal gardens",
        "Greenhouse spaces",
        "Scenic photo locations"
      ]}
      highlights={[
        "Natural acoustics in the outdoor spaces are lovely",
        "Perfect setting for garden party vibes",
        "Guests love exploring the grounds during breaks",
        "Sunset ceremonies are absolutely magical"
      ]}
      nearbyVenues={[
        { name: "Evergreen Museum", slug: "evergreen-museum" },
        { name: "The Belvedere", slug: "the-belvedere" },
        { name: "George Peabody Library", slug: "george-peabody-library" },
        { name: "Cloisters Castle", slug: "cloisters-castle" }
      ]}
    />
  );
};

export default CylburnArboretumPage;
