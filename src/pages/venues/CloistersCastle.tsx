import VenuePage from "@/components/VenuePage";
import cloisters1 from "@/assets/venues/cloisters-1.jpg";
import cloisters2 from "@/assets/venues/cloisters-2.jpg";

const CloistersCastlePage = () => {
  return (
    <VenuePage
      venueName="Cloisters Castle"
      city="Baltimore"
      venueType="Castle Estate"
      capacity="Up to 250 guests"
      description="Cloisters Castle is a fairytale come to life in Baltimore County. This romantic castle estate, complete with towers, turrets, and stunning gardens, provides a magical backdrop for weddings and special celebrations. Harborline has had the pleasure of performing in the castle's grand hall and beautiful outdoor spaces, creating musical moments as enchanting as the setting itself."
      features={[
        "Authentic castle architecture",
        "Romantic tower rooms",
        "Beautiful formal gardens",
        "Grand reception hall",
        "Outdoor ceremony options",
        "Bridal suite in tower",
        "Scenic grounds",
        "Fairy-tale atmosphere"
      ]}
      highlights={[
        "The castle setting inspires romantic performances",
        "Grand hall has excellent natural acoustics",
        "Perfect for couples wanting a fairytale vibe",
        "Gardens offer stunning ceremony backdrops"
      ]}
      nearbyVenues={[
        { name: "Cylburn Arboretum", slug: "cylburn-arboretum" },
        { name: "Evergreen Museum", slug: "evergreen-museum" },
        { name: "The Belvedere", slug: "the-belvedere" },
        { name: "George Peabody Library", slug: "george-peabody-library" }
      ]}
      images={[
        { src: cloisters1, alt: "Cloisters Castle fairytale exterior with towers and garden wedding ceremony" },
        { src: cloisters2, alt: "Cloisters Castle grand hall interior with candlelit wedding reception" }
      ]}
    />
  );
};

export default CloistersCastlePage;
