import { Helmet } from "react-helmet-async";
import Layout from "@/components/Layout";
import PageHero from "@/components/PageHero";
import { motion } from "framer-motion";
import { MapPin, Building2, Star, Users, Calendar, Award, Clock, Ticket } from "lucide-react";
import { Link } from "react-router-dom";

// Featured venues with images
import pendryImg from "@/assets/venues/pendry-1.jpg";
import peabodyImg from "@/assets/venues/peabody-1.jpg";
import belvedereImg from "@/assets/venues/belvedere-1.jpg";
import fourSeasonsImg from "@/assets/venues/four-seasons-1.jpg";
import avamImg from "@/assets/venues/avam-1.jpg";
import cloisterImg from "@/assets/venues/cloisters-1.jpg";
import cylburnImg from "@/assets/venues/cylburn-1.jpg";
import evergreenImg from "@/assets/venues/evergreen-1.jpg";

const featuredVenues = [
  {
    name: "The Pendry Baltimore",
    href: "/venues/pendry-baltimore",
    image: pendryImg,
    type: "Luxury Hotel",
    location: "Fells Point",
  },
  {
    name: "George Peabody Library",
    href: "/venues/george-peabody-library",
    image: peabodyImg,
    type: "Historic Library",
    location: "Mount Vernon",
  },
  {
    name: "The Belvedere",
    href: "/venues/the-belvedere",
    image: belvedereImg,
    type: "Historic Landmark",
    location: "Mount Vernon",
  },
  {
    name: "Four Seasons Baltimore",
    href: "/venues/four-seasons-baltimore",
    image: fourSeasonsImg,
    type: "Luxury Hotel",
    location: "Harbor East",
  },
  {
    name: "American Visionary Art Museum",
    href: "/venues/american-visionary-art-museum",
    image: avamImg,
    type: "Art Museum",
    location: "Federal Hill",
  },
  {
    name: "Cloisters Castle",
    href: "/venues/cloisters-castle",
    image: cloisterImg,
    type: "Historic Castle",
    location: "Lutherville",
  },
  {
    name: "Cylburn Arboretum",
    href: "/venues/cylburn-arboretum",
    image: cylburnImg,
    type: "Garden Estate",
    location: "North Baltimore",
  },
  {
    name: "Evergreen Museum",
    href: "/venues/evergreen-museum",
    image: evergreenImg,
    type: "Historic Mansion",
    location: "North Baltimore",
  },
];

const serviceAreas = [
  {
    region: "Baltimore Metro",
    areas: ["Baltimore City", "Towson", "Columbia", "Ellicott City", "Catonsville", "Pikesville"],
    description: "Our home base and where we perform most frequently",
  },
  {
    region: "DC Metro",
    areas: ["Washington DC", "Bethesda", "Rockville", "Silver Spring", "Chevy Chase", "Georgetown"],
    description: "Premier venues throughout the nation's capital",
  },
  {
    region: "Annapolis & Eastern Shore",
    areas: ["Annapolis", "Easton", "St. Michaels", "Kent Island", "Oxford", "Cambridge"],
    description: "Waterfront estates and historic manor homes",
  },
  {
    region: "Frederick & Beyond",
    areas: ["Frederick", "Hagerstown", "Westminster", "Gettysburg", "Lancaster"],
    description: "Scenic countryside venues and wineries",
  },
];

const stats = [
  { number: "500+", label: "Performances", icon: Calendar },
  { number: "150+", label: "Venues", icon: Building2 },
  { number: "10+", label: "Years Experience", icon: Award },
  { number: "50mi", label: "Service Radius", icon: MapPin },
];

// Upcoming public performances - you can update these dates
const upcomingShows = [
  {
    date: "2026-02-14",
    title: "Valentine's Jazz Night (Solo Piano)",
    venue: "Atwater's",
    location: "Belvedere Square",
    time: "7:00 PM - 10:00 PM",
    type: "Public Event",
    ticketLink: null, // Add ticket link when available
  },
  {
    date: "2026-03-08",
    title: "Spring Swing Soirée",
    venue: "George Peabody Library",
    location: "Mount Vernon",
    time: "6:30 PM - 9:30 PM",
    type: "Public Event",
    ticketLink: null,
  },
  {
    date: "2026-03-21",
    title: "Harbor Nights",
    venue: "Four Seasons Baltimore",
    location: "Harbor East",
    time: "8:00 PM - 11:00 PM",
    type: "Public Event",
    ticketLink: null,
  },
  {
    date: "2026-04-12",
    title: "Jazz Brunch",
    venue: "The Belvedere",
    location: "Mount Vernon",
    time: "11:00 AM - 2:00 PM",
    type: "Public Event",
    ticketLink: null,
  },
];

const WhereWePerformPage = () => {
  return (
    <Layout>
      <Helmet>
        <title>Where We Perform | Baltimore & DC Area | Harborline</title>
        <meta
          name="description"
          content="Harborline performs at premier venues across Baltimore, Washington DC, Annapolis, and the Mid-Atlantic region. View our featured venues and service areas."
        />
        <meta name="keywords" content="Baltimore wedding band, DC event band, Annapolis live music, Maryland wedding entertainment, luxury venue band" />
        <link rel="canonical" href="https://harborline.lovable.app/where-we-perform" />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "MusicGroup",
            name: "Harborline",
            areaServed: [
              { "@type": "City", name: "Baltimore", addressRegion: "MD" },
              { "@type": "City", name: "Washington", addressRegion: "DC" },
              { "@type": "City", name: "Annapolis", addressRegion: "MD" },
            ],
            performerIn: featuredVenues.map(venue => ({
              "@type": "EventVenue",
              name: venue.name,
            })),
          })}
        </script>
      </Helmet>

      <PageHero
        title="Where We Perform"
        subtitle="From historic ballrooms to waterfront estates, we bring unforgettable entertainment to the Mid-Atlantic's most prestigious venues"
      />

      {/* Upcoming Shows Calendar */}
      <section id="upcoming-shows" className="py-20 scroll-mt-24">
        <div className="container px-6 mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <div className="flex items-center justify-center gap-2 mb-4">
              <Ticket className="w-5 h-5 text-primary" />
              <span className="font-display text-sm tracking-widest text-primary uppercase">See Us Live</span>
            </div>
            <h2 className="font-display text-3xl md:text-4xl text-foreground mb-4">
              Upcoming Public Performances
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Catch us at one of our upcoming shows. Private events are not listed—contact us to book your own.
            </p>
          </motion.div>

          <div className="max-w-3xl mx-auto space-y-4">
            {upcomingShows.map((show, index) => {
              const showDate = new Date(show.date);
              const monthShort = showDate.toLocaleDateString('en-US', { month: 'short' });
              const dayNum = showDate.getDate();
              const dayName = showDate.toLocaleDateString('en-US', { weekday: 'long' });
              
              return (
                <motion.div
                  key={`${show.date}-${show.title}`}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="flex gap-4 md:gap-6 bg-card border border-border rounded-xl p-4 md:p-6 hover:border-primary/50 transition-colors"
                >
                  {/* Date Block */}
                  <div className="flex-shrink-0 w-16 md:w-20 text-center">
                    <div className="bg-primary/10 rounded-lg p-2 md:p-3">
                      <div className="font-display text-xs text-primary uppercase">{monthShort}</div>
                      <div className="font-display text-2xl md:text-3xl text-foreground">{dayNum}</div>
                    </div>
                  </div>
                  
                  {/* Event Details */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display text-lg md:text-xl text-foreground mb-1 truncate">
                      {show.title}
                    </h3>
                    <p className="text-muted-foreground text-sm mb-2">
                      {show.venue} • {show.location}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        {show.time}
                      </span>
                      <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-medium">
                        {show.type}
                      </span>
                    </div>
                  </div>
                  
                  {/* Action */}
                  <div className="flex-shrink-0 self-center">
                    {show.ticketLink ? (
                      <a
                        href={show.ticketLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-4 py-2 bg-primary text-primary-foreground text-sm font-display rounded-md hover:bg-primary/90 transition-colors"
                      >
                        <Ticket className="w-4 h-4" />
                        Tickets
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">Details TBA</span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center text-muted-foreground mt-8 text-sm"
          >
            Want us at your event? <Link to="/#contact" className="text-primary hover:underline">Get in touch</Link> to discuss your private booking.
          </motion.p>
        </div>
      </section>

      {/* Experience Highlights */}
      <section className="py-20">
        <div className="container px-6 mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <div className="flex items-center justify-center gap-2 mb-4">
              <Star className="w-5 h-5 text-primary" />
              <span className="font-display text-sm tracking-widest text-primary uppercase">Our Experience</span>
            </div>
            <h2 className="font-display text-3xl md:text-4xl text-foreground mb-4">
              Why Venue Experience Matters
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center"
            >
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-display text-lg text-foreground mb-2">Venue Partnerships</h3>
              <p className="text-muted-foreground text-sm">
                We're on the preferred vendor list at many premier venues, meaning streamlined coordination 
                and trusted relationships with venue staff.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-center"
            >
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-display text-lg text-foreground mb-2">Local Expertise</h3>
              <p className="text-muted-foreground text-sm">
                As Baltimore natives, we understand the unique character of each neighborhood and venue, 
                from Inner Harbor elegance to countryside charm.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-center"
            >
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Award className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-display text-lg text-foreground mb-2">Acoustic Knowledge</h3>
              <p className="text-muted-foreground text-sm">
                Every space sounds different. Our experience means we know exactly how to tune our 
                sound for each venue's unique acoustics.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Featured Venues */}
      <section className="py-20">
        <div className="container px-6 mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <div className="flex items-center justify-center gap-2 mb-4">
              <Building2 className="w-5 h-5 text-primary" />
              <span className="font-display text-sm tracking-widest text-primary uppercase">Featured Venues</span>
            </div>
            <h2 className="font-display text-3xl md:text-4xl text-foreground mb-4">
              Venues We Know & Love
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              We've performed at these exceptional venues multiple times and understand their unique acoustics, 
              layouts, and requirements to deliver flawless entertainment.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredVenues.map((venue, index) => (
              <motion.div
                key={venue.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
              >
                <Link
                  to={venue.href}
                  className="group block bg-card border border-border rounded-xl overflow-hidden hover:border-primary/50 transition-all duration-300"
                >
                  <div className="aspect-[4/3] overflow-hidden">
                    <img
                      src={venue.image}
                      alt={venue.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="font-display text-foreground group-hover:text-primary transition-colors">
                      {venue.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                      <span>{venue.type}</span>
                      <span>•</span>
                      <span>{venue.location}</span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center text-muted-foreground mt-8"
          >
            Plus dozens more venues across the region. <Link to="/#contact" className="text-primary hover:underline">Contact us</Link> to discuss your venue.
          </motion.p>
        </div>
      </section>

      {/* Service Areas */}
      <section className="py-20 bg-muted/30">
        <div className="container px-6 mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <div className="flex items-center justify-center gap-2 mb-4">
              <MapPin className="w-5 h-5 text-primary" />
              <span className="font-display text-sm tracking-widest text-primary uppercase">Service Areas</span>
            </div>
            <h2 className="font-display text-3xl md:text-4xl text-foreground mb-4">
              Regions We Serve
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Based in Baltimore, we regularly perform throughout Maryland, Washington DC, Virginia, 
              Delaware, and Pennsylvania.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6">
            {serviceAreas.map((region, index) => (
              <motion.div
                key={region.region}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-card border border-border rounded-xl p-6"
              >
                <h3 className="font-display text-xl text-foreground mb-2">{region.region}</h3>
                <p className="text-sm text-muted-foreground mb-4">{region.description}</p>
                <div className="flex flex-wrap gap-2">
                  {region.areas.map((area) => (
                    <span
                      key={area}
                      className="px-3 py-1 text-sm bg-muted rounded-full text-foreground"
                    >
                      {area}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-muted/30">
        <div className="container px-6 mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="text-center"
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <stat.icon className="w-6 h-6 text-primary" />
                </div>
                <div className="font-display text-3xl md:text-4xl text-foreground mb-1">{stat.number}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-primary/5">
        <div className="container px-6 mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="font-display text-3xl md:text-4xl text-foreground mb-4">
              Have a Venue in Mind?
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto mb-8">
              Whether it's a venue we know well or somewhere new, we'll deliver an unforgettable 
              performance tailored to your space.
            </p>
            <Link
              to="/#contact"
              className="inline-flex items-center justify-center px-8 py-3 bg-primary text-primary-foreground font-display tracking-wide uppercase hover:bg-primary/90 transition-colors rounded-md"
            >
              Get in Touch
            </Link>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
};

export default WhereWePerformPage;
