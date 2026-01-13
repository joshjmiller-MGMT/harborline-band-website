import VenuePage from "@/components/VenuePage";
import belvedere1 from "@/assets/venues/belvedere-1.jpg";
import belvedere2 from "@/assets/venues/belvedere-2.jpg";

const TheBelvederePage = () => {
  return (
    <VenuePage
      venueName="The Belvedere"
      city="Baltimore"
      venueType="Historic Hotel & Venue"
      capacity="Up to 400 guests"
      description="The Belvedere has been Baltimore's premier social destination since 1903. This Beaux-Arts landmark in Mount Vernon offers multiple stunning event spaces, from the legendary 13th Floor with panoramic city views to the elegant John Eager Howard Room. Our band has been part of countless celebrations in this iconic venue, and we know exactly how to make the grand spaces feel both epic and intimate."
      features={[
        "Historic Beaux-Arts architecture",
        "Multiple event spaces",
        "Panoramic 13th Floor views",
        "Grand ballroom",
        "Elegant smaller rooms",
        "On-site catering",
        "Central Mount Vernon location",
        "Rooftop terrace"
      ]}
      highlights={[
        "The 13th Floor views create magical evening receptions",
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
        { src: belvedere1, alt: "The Belvedere grand ballroom with chandeliers and wedding reception" },
        { src: belvedere2, alt: "The Belvedere rooftop terrace with panoramic city views at night" }
      ]}
    />
  );
};

export default TheBelvederePage;
