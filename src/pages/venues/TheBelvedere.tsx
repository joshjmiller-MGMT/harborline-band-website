import VenuePage from "@/components/VenuePage";
import { OptimizedImage } from "@/components/OptimizedImage";
const TheBelvederePage = () => {
  return (
    <VenuePage
      venueName="The Belvedere"
      city="Baltimore"
      venueType="Historic Hotel & Venue"
      capacity="Up to 400 guests"
      description="The Belvedere is a Beaux-Arts landmark in Mount Vernon — open since 1903. Multiple event spaces, from the 13th Floor with panoramic city views to the John Eager Howard Room. We've played here many times and know how the room scales — 4-piece for the John Eager, full band for the 13th Floor or grand ballroom."
      features={[
        "Historic Beaux-Arts architecture",
        "Multiple event spaces",
        "Panoramic 13th Floor views",
        "Grand ballroom",
        "Smaller intimate rooms",
        "On-site catering",
        "Central Mount Vernon location",
        "Rooftop terrace"
      ]}
      highlights={[
        "The 13th Floor views work for evening receptions with a dance-floor register",
        "Versatile spaces accommodate any band configuration",
        "Rich history adds gravitas to every celebration",
        "Excellent sound and power infrastructure"
      ]}
      nearbyVenues={[
        { name: "George Peabody Library", slug: "george-peabody-library" },
        { name: "The Pendry Baltimore", slug: "pendry-baltimore" },
        { name: "Evergreen Museum", slug: "evergreen-museum" },
        { name: "Sagamore Pendry", slug: "sagamore-pendry" }
      ]}
      images={[
        { src: "venues/belvedere-1", alt: "The Belvedere grand ballroom with chandeliers and wedding reception" },
        { src: "venues/belvedere-2", alt: "The Belvedere rooftop terrace with panoramic city views at night" }
      ]}
    />
  );
};

export default TheBelvederePage;
