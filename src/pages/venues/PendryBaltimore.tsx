import VenuePage from "@/components/VenuePage";
import pendry1 from "@/assets/venues/pendry-1.jpg";
import pendry2 from "@/assets/venues/pendry-2.jpg";

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
        "Elegant ballroom spaces",
        "Stunning harbor views",
        "Indoor & outdoor options",
        "World-class catering",
        "Dedicated event coordinators",
        "Luxury accommodations",
        "Rooftop terrace available"
      ]}
      highlights={[
        "The ballroom's high ceilings create incredible sound",
        "Waterfront backdrop for unforgettable first dances",
        "Seamless transitions between ceremony and reception",
        "Intimate spaces perfect for cocktail hour sets"
      ]}
      nearbyVenues={[
        { name: "Sagamore Pendry", slug: "sagamore-pendry" },
        { name: "George Peabody Library", slug: "george-peabody-library" },
        { name: "The Belvedere", slug: "the-belvedere" },
        { name: "American Visionary Art Museum", slug: "american-visionary-art-museum" }
      ]}
      images={[
        { src: pendry1, alt: "The Pendry Baltimore elegant ballroom with arched ceilings and harbor views" },
        { src: pendry2, alt: "The Pendry Baltimore waterfront pier wedding ceremony at sunset" }
      ]}
    />
  );
};

export default PendryBaltimorePage;
