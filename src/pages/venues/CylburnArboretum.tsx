import VenuePage from "@/components/VenuePage";
import cylburn1 from "@/assets/venues/cylburn-1.jpg";
import cylburn2 from "@/assets/venues/cylburn-2.jpg";

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
      images={[
        { src: cylburn1, alt: "Cylburn Arboretum garden wedding ceremony with greenhouse and flowering gardens" },
        { src: cylburn2, alt: "Cylburn Arboretum Victorian mansion with fountain and tented reception" }
      ]}
    />
  );
};

export default CylburnArboretumPage;
