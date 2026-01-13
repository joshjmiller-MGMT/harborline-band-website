import VenuePage from "@/components/VenuePage";
import pendry1 from "@/assets/venues/pendry-1.jpg";
import pendry2 from "@/assets/venues/pendry-2.jpg";

const SagamorePendryPage = () => {
  return (
    <VenuePage
      venueName="Sagamore Pendry"
      city="Baltimore"
      venueType="Waterfront Hotel"
      capacity="Up to 250 guests"
      description="Sagamore Pendry Baltimore, nestled in the heart of Fells Point, offers a perfect blend of historic charm and modern luxury. This beautifully restored pier building provides an extraordinary setting for weddings and special events. Our band has performed countless celebrations here, mastering the flow between the elegant indoor spaces and the stunning waterfront pier."
      features={[
        "Historic pier location",
        "Waterfront ceremony options",
        "Elegant indoor ballroom",
        "Boutique luxury hotel",
        "Exceptional cuisine",
        "Pier 5 access",
        "Sunset harbor views",
        "Intimate garden spaces"
      ]}
      highlights={[
        "The pier provides a magical setting for outdoor performances",
        "Excellent acoustics in the main event space",
        "Staff is incredibly accommodating for live bands",
        "Perfect for elegant, sophisticated celebrations"
      ]}
      nearbyVenues={[
        { name: "The Pendry Baltimore", slug: "pendry-baltimore" },
        { name: "George Peabody Library", slug: "george-peabody-library" },
        { name: "Four Seasons Baltimore", slug: "four-seasons-baltimore" },
        { name: "The Belvedere", slug: "the-belvedere" }
      ]}
      images={[
        { src: pendry1, alt: "Sagamore Pendry elegant ballroom with French Revival architecture" },
        { src: pendry2, alt: "Sagamore Pendry waterfront pier ceremony at golden hour" }
      ]}
    />
  );
};

export default SagamorePendryPage;
