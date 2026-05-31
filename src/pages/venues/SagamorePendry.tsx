import VenuePage from "@/components/VenuePage";
import { OptimizedImage } from "@/components/OptimizedImage";
const SagamorePendryPage = () => {
  return (
    <VenuePage
      venueName="Sagamore Pendry"
      city="Baltimore"
      venueType="Waterfront Hotel"
      capacity="Up to 250 guests"
      description="Sagamore Pendry Baltimore sits on the Fells Point waterfront — a restored pier building with a ballroom on one side and the harbor pier on the other. Our band has played here many times, working the indoor-outdoor flow from cocktail hour through dance floor."
      features={[
        "Historic pier location",
        "Waterfront ceremony options",
        "Indoor ballroom",
        "Boutique waterfront hotel",
        "Onsite catering",
        "Pier 5 access",
        "Sunset harbor views",
        "Garden + cocktail spaces"
      ]}
      highlights={[
        "The pier handles outdoor sets well — backup-per-role on the roster covers weather pivots",
        "Acoustics in the main ballroom work for a 4-piece up through full band",
        "Staff is hands-on with live bands — load-in dock is straightforward",
        "Indoor-outdoor transitions handled by the MD live"
      ]}
      nearbyVenues={[
        { name: "The Pendry Baltimore", slug: "pendry-baltimore" },
        { name: "George Peabody Library", slug: "george-peabody-library" },
        { name: "Four Seasons Baltimore", slug: "four-seasons-baltimore" },
        { name: "The Belvedere", slug: "the-belvedere" }
      ]}
      images={[
        { src: "venues/pendry-1", alt: "Sagamore Pendry ballroom with French Revival architecture" },
        { src: "venues/pendry-2", alt: "Sagamore Pendry waterfront pier ceremony at golden hour" }
      ]}
    />
  );
};

export default SagamorePendryPage;
