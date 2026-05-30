import VenuePage from "@/components/VenuePage";
import { OptimizedImage } from "@/components/OptimizedImage";
const PendryBaltimorePage = () => {
  return (
    <VenuePage
      venueName="The Pendry Baltimore"
      city="Baltimore"
      venueType="Luxury Hotel"
      capacity="Up to 300 guests"
      description="The Pendry Baltimore represents the pinnacle of luxury hospitality in Charm City. Located in the historic Recreation Pier building at Fells Point, this stunning venue offers breathtaking waterfront views and impeccable service. Harborline has had the privilege of performing at numerous weddings and galas here, and we've developed an intimate understanding of how to maximize the acoustics and ambiance of their beautiful ballroom and outdoor spaces."
      features={[
        "Historic waterfront location",
        "Multiple ballroom spaces",
        "Harbor views",
        "Indoor & outdoor options",
        "Onsite catering",
        "Dedicated event coordinators",
        "Luxury accommodations",
        "Rooftop terrace available"
      ]}
      highlights={[
        "The ballroom's high ceilings handle a 14-piece configuration",
        "Waterfront pier for first-dance and ceremony options",
        "Ceremony-to-reception transitions walked in the pre-event call",
        "Cocktail-hour spaces sized for a 4-piece register"
      ]}
      nearbyVenues={[
        { name: "Sagamore Pendry", slug: "sagamore-pendry" },
        { name: "George Peabody Library", slug: "george-peabody-library" },
        { name: "The Belvedere", slug: "the-belvedere" },
        { name: "American Visionary Art Museum", slug: "american-visionary-art-museum" }
      ]}
      images={[
        { src: "venues/pendry-1", alt: "The Pendry Baltimore ballroom with arched ceilings and harbor views" },
        { src: "venues/pendry-2", alt: "The Pendry Baltimore waterfront pier wedding ceremony at sunset" }
      ]}
    />
  );
};

export default PendryBaltimorePage;
