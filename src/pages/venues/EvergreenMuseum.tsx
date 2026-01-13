import VenuePage from "@/components/VenuePage";
import evergreen1 from "@/assets/venues/evergreen-1.jpg";
import evergreen2 from "@/assets/venues/evergreen-2.jpg";

const EvergreenMuseumPage = () => {
  return (
    <VenuePage
      venueName="Evergreen Museum & Library"
      city="Baltimore"
      venueType="Historic Estate"
      capacity="Up to 200 guests"
      description="Evergreen Museum & Library, a Johns Hopkins University property, is a hidden gem in North Baltimore. This stunning 48-room Gilded Age mansion and its beautiful grounds offer an intimate, elegant setting for weddings and special events. Harborline has performed in both the grand interior spaces and the gorgeous garden settings, creating the perfect soundtrack for refined celebrations."
      features={[
        "Gilded Age mansion",
        "Beautiful formal gardens",
        "Intimate indoor spaces",
        "Rare book library",
        "Tiffany glass collection",
        "Private estate setting",
        "Garden ceremony options",
        "Historic architecture"
      ]}
      highlights={[
        "The gardens are perfect for outdoor ceremonies",
        "Intimate scale creates connection with guests",
        "The historic setting inspires elegant repertoire",
        "Stunning architecture in every photograph"
      ]}
      nearbyVenues={[
        { name: "George Peabody Library", slug: "george-peabody-library" },
        { name: "The Belvedere", slug: "the-belvedere" },
        { name: "Cylburn Arboretum", slug: "cylburn-arboretum" },
        { name: "The Pendry Baltimore", slug: "pendry-baltimore" }
      ]}
      images={[
        { src: evergreen1, alt: "Evergreen Museum Victorian mansion with formal gardens and wedding ceremony" },
        { src: evergreen2, alt: "Evergreen Museum carriage house interior with exposed brick and candlelit reception" }
      ]}
    />
  );
};

export default EvergreenMuseumPage;
