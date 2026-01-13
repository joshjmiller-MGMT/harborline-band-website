import LocationPage from "@/components/LocationPage";

const AnnapolisPage = () => {
  return (
    <LocationPage
      city="Annapolis"
      region="Maryland"
      description="Maryland's capital city offers stunning waterfront venues and historic charm—the perfect backdrop for unforgettable events. Harborline brings sophisticated entertainment to Annapolis weddings, corporate gatherings, and private celebrations. From downtown historic venues to bayside celebrations, we create the perfect soundtrack for your Annapolis event."
      venues={[
        "The Hotel & Conference Center",
        "Annapolis Waterfront Hotel",
        "Historic Inns of Annapolis",
        "Chesapeake Bay Beach Club",
        "St. Anne's Church",
        "William Paca House",
        "Naval Academy Club"
      ]}
      nearbyAreas={[
        { name: "Baltimore", slug: "baltimore" },
        { name: "Columbia", slug: "columbia" },
        { name: "Towson", slug: "towson" }
      ]}
    />
  );
};

export default AnnapolisPage;
