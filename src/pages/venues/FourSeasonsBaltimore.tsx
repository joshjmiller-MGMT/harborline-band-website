import VenuePage from "@/components/VenuePage";
import { OptimizedImage } from "@/components/OptimizedImage";
const FourSeasonsBaltimorePage = () => {
  return (
    <VenuePage
      venueName="Four Seasons Baltimore"
      city="Baltimore"
      venueType="Luxury Hotel"
      capacity="Up to 350 guests"
      description="Four Seasons Baltimore sets the standard for luxury events in the Mid-Atlantic. Perched on the waterfront in Harbor East, this five-star property offers impeccable service and stunning spaces that range from intimate gatherings to grand ballroom celebrations. Harborline has been the band of choice for countless Four Seasons weddings and corporate events, and we've built strong relationships with their exceptional events team."
      features={[
        "Five-star service",
        "Harbor East waterfront",
        "Grand ballroom",
        "Outdoor terrace options",
        "Onsite catering",
        "Luxury accommodations",
        "Spa & amenities",
        "Dedicated event planners"
      ]}
      highlights={[
        "The events team is among the best we've worked with",
        "Sound and lighting infrastructure handles a full-band setup without rentals",
        "The waterfront terrace suits cocktail hour and ceremony, ballroom for the reception",
        "Indoor-outdoor flow walked in the 30-min pre-event call"
      ]}
      nearbyVenues={[
        { name: "The Pendry Baltimore", slug: "pendry-baltimore" },
        { name: "Sagamore Pendry", slug: "sagamore-pendry" },
        { name: "American Visionary Art Museum", slug: "american-visionary-art-museum" },
        { name: "Legg Mason Tower", slug: "legg-mason-tower" }
      ]}
      images={[
        { src: "venues/four-seasons-1", alt: "Four Seasons Baltimore ballroom with crystal chandeliers and harbor views" },
        { src: "venues/four-seasons-2", alt: "Four Seasons Baltimore waterfront terrace ceremony at sunset" }
      ]}
    />
  );
};

export default FourSeasonsBaltimorePage;
