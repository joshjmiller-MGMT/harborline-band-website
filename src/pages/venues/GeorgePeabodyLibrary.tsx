import VenuePage from "@/components/VenuePage";
import peabody1 from "@/assets/venues/peabody-1.jpg";
import peabody2 from "@/assets/venues/peabody-2.jpg";

const GeorgePeabodyLibraryPage = () => {
  return (
    <VenuePage
      venueName="George Peabody Library"
      city="Baltimore"
      venueType="Historic Library"
      capacity="Up to 300 guests"
      description="The George Peabody Library is one of the most spectacular event venues in the world. With its soaring 61-foot atrium, ornate cast-iron balconies, and over 300,000 volumes lining the walls, this architectural masterpiece creates an unforgettable backdrop for weddings and galas. Harborline has been honored to perform in this acoustic marvel, where every note resonates beautifully through the historic space."
      features={[
        "61-foot atrium ceiling",
        "Historic 19th-century architecture",
        "Dramatic cast-iron balconies",
        "Natural marble floors",
        "Stunning photography opportunities",
        "UNESCO recognition",
        "Central Mount Vernon location",
        "Adjacent to Peabody Institute"
      ]}
      highlights={[
        "The natural acoustics are absolutely phenomenal",
        "One of the most photographed venues in America",
        "The dramatic setting elevates every performance",
        "Guests are always in awe of the surroundings"
      ]}
      nearbyVenues={[
        { name: "The Belvedere", slug: "the-belvedere" },
        { name: "The Pendry Baltimore", slug: "pendry-baltimore" },
        { name: "Evergreen Museum", slug: "evergreen-museum" },
        { name: "American Visionary Art Museum", slug: "american-visionary-art-museum" }
      ]}
      images={[
        { src: peabody1, alt: "George Peabody Library grand atrium with ornate balconies and wedding reception" },
        { src: peabody2, alt: "George Peabody Library wedding ceremony with marble floors and book-lined walls" }
      ]}
    />
  );
};

export default GeorgePeabodyLibraryPage;
