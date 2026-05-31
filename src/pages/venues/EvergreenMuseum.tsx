import VenuePage from "@/components/VenuePage";
import { OptimizedImage } from "@/components/OptimizedImage";
const EvergreenMuseumPage = () => {
  return (
    <VenuePage
      venueName="Evergreen Museum & Library"
      city="Baltimore"
      venueType="Historic Estate"
      capacity="Up to 200 guests"
      description="Evergreen Museum & Library is a Johns Hopkins University property in North Baltimore — a 48-room Gilded Age mansion with formal gardens. Harborline has played here for ceremonies in the garden and receptions in the grand interior; we scale from a 4-piece register for cocktail hour up to the full band for the reception."
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
        "The historic setting fits a quieter cocktail register; full band lands on the reception side",
        "Stunning architecture in every photograph"
      ]}
      nearbyVenues={[
        { name: "George Peabody Library", slug: "george-peabody-library" },
        { name: "The Belvedere", slug: "the-belvedere" },
        { name: "Cylburn Arboretum", slug: "cylburn-arboretum" },
        { name: "The Pendry Baltimore", slug: "pendry-baltimore" }
      ]}
      images={[
        { src: "venues/evergreen-1", alt: "Evergreen Museum Victorian mansion with formal gardens and wedding ceremony" },
        { src: "venues/evergreen-2", alt: "Evergreen Museum carriage house interior with exposed brick and candlelit reception" }
      ]}
    />
  );
};

export default EvergreenMuseumPage;
