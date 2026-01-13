import VenuePage from "@/components/VenuePage";
import avam1 from "@/assets/venues/avam-1.jpg";

const AmericanVisionaryArtMuseumPage = () => {
  return (
    <VenuePage
      venueName="American Visionary Art Museum"
      city="Baltimore"
      venueType="Art Museum"
      capacity="Up to 350 guests"
      description="AVAM is unlike any other venue in Baltimore—or anywhere else. This celebration of outsider art provides a wildly creative backdrop for couples who want their wedding or event to be truly unique. The museum's eclectic spaces, from the main gallery to the outdoor sculpture garden overlooking the harbor, inspire performances that are equally creative and memorable. Harborline loves bringing energy to this one-of-a-kind space."
      features={[
        "Unique visionary art setting",
        "Harbor-view sculpture garden",
        "Multiple gallery spaces",
        "Indoor/outdoor flexibility",
        "Whimsical Whirligig terrace",
        "Creative catering options",
        "Federal Hill location",
        "Stunning sunset views"
      ]}
      highlights={[
        "The art creates incredible conversation and energy",
        "Outdoor spaces perfect for cocktail hour performances",
        "Couples who book here appreciate creative music",
        "The harbor views at sunset are unmatched"
      ]}
      nearbyVenues={[
        { name: "Four Seasons Baltimore", slug: "four-seasons-baltimore" },
        { name: "The Pendry Baltimore", slug: "pendry-baltimore" },
        { name: "B&O Railroad Museum", slug: "b-and-o-railroad-museum" },
        { name: "George Peabody Library", slug: "george-peabody-library" }
      ]}
      images={[
        { src: avam1, alt: "American Visionary Art Museum colorful interior with whimsical art installations" }
      ]}
    />
  );
};

export default AmericanVisionaryArtMuseumPage;
