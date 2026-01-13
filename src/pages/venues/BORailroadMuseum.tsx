import VenuePage from "@/components/VenuePage";
import boRailroad1 from "@/assets/venues/bo-railroad-1.jpg";
import boRailroad2 from "@/assets/venues/bo-railroad-2.jpg";

const BORailroadMuseumPage = () => {
  return (
    <VenuePage
      venueName="B&O Railroad Museum"
      city="Baltimore"
      venueType="Historic Museum"
      capacity="Up to 500 guests"
      description="The B&O Railroad Museum is where American railroading began, and it's one of Baltimore's most impressive event venues. The historic Roundhouse, with its stunning 123-foot dome and collection of historic locomotives, creates an unforgettable setting for large-scale events. Harborline has rocked this incredible space many times, and we know how to fill that magnificent dome with music that moves guests to dance."
      features={[
        "Historic 1884 Roundhouse",
        "123-foot domed ceiling",
        "Historic train collection",
        "Large capacity space",
        "Indoor venue year-round",
        "Unique photo opportunities",
        "Convenient parking",
        "Full catering facilities"
      ]}
      highlights={[
        "The dome creates incredible, immersive acoustics",
        "Dancing among historic trains is unforgettable",
        "Perfect for large weddings and corporate galas",
        "The scale allows for full production setups"
      ]}
      nearbyVenues={[
        { name: "American Visionary Art Museum", slug: "american-visionary-art-museum" },
        { name: "The Belvedere", slug: "the-belvedere" },
        { name: "Four Seasons Baltimore", slug: "four-seasons-baltimore" },
        { name: "The Pendry Baltimore", slug: "pendry-baltimore" }
      ]}
      images={[
        { src: boRailroad1, alt: "B&O Railroad Museum historic hall with vintage locomotives and wedding reception" },
        { src: boRailroad2, alt: "B&O Railroad Museum roundhouse with domed ceiling and elegant event setup" }
      ]}
    />
  );
};

export default BORailroadMuseumPage;
