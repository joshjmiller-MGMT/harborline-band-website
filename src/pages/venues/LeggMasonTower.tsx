import VenuePage from "@/components/VenuePage";
import { OptimizedImage } from "@/components/OptimizedImage";
const LeggMasonTowerPage = () => {
  return (
    <VenuePage
      venueName="Legg Mason Tower"
      city="Baltimore"
      venueType="Corporate Venue"
      capacity="Up to 400 guests"
      description="Legg Mason Tower in Harbor East has panoramic views of Baltimore's skyline and waterfront. A modern venue for corporate events, galas, and milestone celebrations. Harborline has played here multiple times — the contemporary space suits a 4-piece up through full-band configurations depending on the room and the run-of-show."
      features={[
        "Panoramic harbor views",
        "Modern event spaces",
        "State-of-the-art facilities",
        "Harbor East location",
        "Floor-to-ceiling windows",
        "Corporate-ready amenities",
        "Flexible configurations",
        "Valet parking available"
      ]}
      highlights={[
        "The views at night are absolutely spectacular",
        "Modern facilities make load-in seamless",
        "Reliable corporate-event venue with load-in handled",
        "The contemporary setting suits our versatile style"
      ]}
      nearbyVenues={[
        { name: "Four Seasons Baltimore", slug: "four-seasons-baltimore" },
        { name: "The Pendry Baltimore", slug: "pendry-baltimore" },
        { name: "Sagamore Pendry", slug: "sagamore-pendry" },
        { name: "American Visionary Art Museum", slug: "american-visionary-art-museum" }
      ]}
      images={[
        { src: "venues/legg-mason-1", alt: "Legg Mason Tower penthouse event space with panoramic city views at night" }
      ]}
    />
  );
};

export default LeggMasonTowerPage;
