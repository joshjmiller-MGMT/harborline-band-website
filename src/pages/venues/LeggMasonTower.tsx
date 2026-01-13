import VenuePage from "@/components/VenuePage";
import leggMason1 from "@/assets/venues/legg-mason-1.jpg";

const LeggMasonTowerPage = () => {
  return (
    <VenuePage
      venueName="Legg Mason Tower"
      city="Baltimore"
      venueType="Corporate Venue"
      capacity="Up to 400 guests"
      description="Legg Mason Tower in Harbor East offers some of the most stunning panoramic views of Baltimore's skyline and waterfront. This modern, sophisticated venue is a favorite for corporate events, galas, and milestone celebrations. Harborline has energized many events in this sleek space, bringing our signature sound to complement the contemporary elegance and breathtaking vistas."
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
        "Perfect for sophisticated corporate events",
        "The contemporary setting suits our versatile style"
      ]}
      nearbyVenues={[
        { name: "Four Seasons Baltimore", slug: "four-seasons-baltimore" },
        { name: "The Pendry Baltimore", slug: "pendry-baltimore" },
        { name: "Sagamore Pendry", slug: "sagamore-pendry" },
        { name: "American Visionary Art Museum", slug: "american-visionary-art-museum" }
      ]}
      images={[
        { src: leggMason1, alt: "Legg Mason Tower penthouse event space with panoramic city views at night" }
      ]}
    />
  );
};

export default LeggMasonTowerPage;
