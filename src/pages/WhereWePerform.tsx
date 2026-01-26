import { Helmet } from "react-helmet-async";
import { useState } from "react";
import Layout from "@/components/Layout";
import PageHero from "@/components/PageHero";
import { motion } from "framer-motion";
import { MapPin, Building2, Star, Users, Calendar, Award, Clock, Ticket, List, CalendarDays } from "lucide-react";
import { Link } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  { number: "1000+", label: "Performances", icon: Calendar },
  { number: "150+", label: "Venues", icon: Building2 },
  { number: "10+", label: "Years Experience", icon: Award },
  { number: "50mi", label: "Service Radius", icon: MapPin },
];

// Upcoming performances - you can update these dates
const upcomingShows = [
  {
    date: "2025-01-31",
    title: "Final Fridays with Josh Miller Trio",
    venue: "Backwater Books",
    location: "Old Ellicott City",
    time: "8:00 PM - 10:00 PM",
    type: "Every Final Friday of the Month",
    ticketLink: null,
  },
  {
    date: "2025-02-14",
    title: "Valentine's Jazz Night (Solo Piano)",
    venue: "Atwater's",
    location: "Belvedere Square",
    time: "6:00 PM - 9:00 PM",
    type: "Public Event",
    ticketLink: null,
  },
  {
    date: "2025-02-19",
    title: "Private Event",
    venue: "Destination Corporate Activation",
    location: "Bahamas",
    time: "Feb 19-21",
    type: "Private Event",
    ticketLink: null,
  },
  {
    date: "2025-03-28",
    title: "Wedding",
    venue: "",
    location: "",
    time: "",
    type: "Private Event",
    ticketLink: null,
  },
  {
    date: "2025-04-11",
    title: "Wedding",
    venue: "",
    location: "",
    time: "",
    type: "Private Event",
    ticketLink: null,
  },
  {
    date: "2025-04-18",
    title: "Wedding",
    venue: "",
    location: "",
    time: "",
    type: "Private Event",
    ticketLink: null,
  },
  {
    date: "2025-04-25",
    title: "Wedding",
    venue: "",
    location: "",
    time: "",
    type: "Private Event",
    ticketLink: null,
  },
  {
    date: "2025-05-02",
    title: "Hold",
    venue: "",
    location: "",
    time: "",
    type: "Private Event",
    ticketLink: null,
  },
  {
    date: "2025-05-08",
    title: "Hold",
    venue: "",
    location: "",
    time: "",
    type: "Private Event",
    ticketLink: null,
  },
  {
    date: "2025-05-16",
    title: "Wedding Hold",
    venue: "",
    location: "",
    time: "",
    type: "Private Event",
    ticketLink: null,
  },
  {
    date: "2025-05-30",
    title: "Blackout Day",
    venue: "",
    location: "",
    time: "",
    type: "Unavailable",
    ticketLink: null,
  },
  {
    date: "2025-06-06",
    title: "Wedding",
    venue: "",
    location: "",
    time: "",
    type: "Private Event",
    ticketLink: null,
  },
  {
    date: "2025-06-20",
    title: "Wedding",
    venue: "",
    location: "",
    time: "",
    type: "Private Event",
    ticketLink: null,
  },
  {
    date: "2025-07-18",
    title: "Wedding",
    venue: "",
    location: "",
    time: "",
    type: "Private Event",
    ticketLink: null,
  },
  {
    date: "2025-07-25",
    title: "Wedding",
    venue: "",
    location: "",
    time: "",
    type: "Private Event",
    ticketLink: null,
  },
  {
    date: "2025-08-15",
    title: "Wedding",
    venue: "",
    location: "",
    time: "",
    type: "Private Event",
    ticketLink: null,
  },
  {
    date: "2025-09-26",
    title: "Wedding",
    venue: "",
    location: "",
    time: "",
    type: "Private Event",
    ticketLink: null,
  },
  {
    date: "2025-10-03",
    title: "Jazz Trio",
    venue: "",
    location: "Annapolis",
    time: "",
    type: "Private Event",
    ticketLink: null,
  },
  {
    date: "2025-10-04",
    title: "Wedding",
    venue: "",
    location: "",
    time: "",
    type: "Private Event",
    ticketLink: null,
  },
  {
    date: "2025-10-10",
    title: "Wedding",
    venue: "",
    location: "",
    time: "",
    type: "Private Event",
    ticketLink: null,
  },
  {
    date: "2025-10-24",
    title: "Hold",
    venue: "",
    location: "",
    time: "",
    type: "Private Event",
    ticketLink: null,
  },
];

// Calendar View Component
const CalendarView = ({ shows }: { shows: typeof upcomingShows }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date(2025, 0, 1)); // Start at Jan 2025
  
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
  
  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  
  const showsByDate = shows.reduce((acc, show) => {
    acc[show.date] = show;
    return acc;
  }, {} as Record<string, typeof shows[0]>);
  
  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  
  const days = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(<div key={`empty-${i}`} className="h-10 md:h-12" />);
  }
  
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const show = showsByDate[dateStr];
    
    days.push(
      <div
        key={day}
        className={`h-10 md:h-12 flex items-center justify-center rounded-lg text-sm relative group ${
          show 
            ? 'bg-primary text-primary-foreground font-medium cursor-pointer' 
            : 'text-muted-foreground hover:bg-muted/50'
        }`}
      >
        {day}
        {show && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-popover border border-border rounded-lg shadow-lg text-xs text-foreground opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
            <div className="font-medium">{show.title}</div>
            {show.venue && <div className="text-muted-foreground">{show.venue}</div>}
          </div>
        )}
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="p-2 hover:bg-muted rounded-lg transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h3 className="font-display text-lg text-foreground">{monthName}</h3>
        <button onClick={nextMonth} className="p-2 hover:bg-muted rounded-lg transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-xs text-muted-foreground font-medium py-2">{day}</div>
        ))}
        {days}
      </div>
    </div>
  );
};

const WhereWePerformPage = () => {
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  
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

          <div className="max-w-3xl mx-auto bg-card/50 border border-border rounded-2xl p-4 md:p-6">
            {/* View Toggle */}
            <div className="flex justify-end mb-4">
              <div className="flex bg-background border border-border rounded-lg p-1">
                <button
                  onClick={() => setViewMode('list')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'list' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <List className="w-4 h-4" />
                  List
                </button>
                <button
                  onClick={() => setViewMode('calendar')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'calendar' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <CalendarDays className="w-4 h-4" />
                  Calendar
                </button>
              </div>
            </div>

            {viewMode === 'list' ? (
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {upcomingShows.map((show, index) => {
                    const [year, month, day] = show.date.split('-').map(Number);
                    const showDate = new Date(year, month - 1, day);
                    const monthShort = showDate.toLocaleDateString('en-US', { month: 'short' });
                    const dayNum = showDate.getDate();
                    
                    const hasVenueInfo = show.venue || show.location;
                    
                    return (
                      <motion.div
                        key={`${show.date}-${show.title}`}
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: index * 0.05 }}
                        className="flex gap-3 md:gap-4 bg-background border border-border rounded-lg p-3 md:p-4 hover:border-primary/50 transition-colors"
                      >
                        {/* Date Block */}
                        <div className="flex-shrink-0 w-12 md:w-14 text-center">
                          <div className="bg-primary/10 rounded-lg p-1.5 md:p-2">
                            <div className="font-display text-[10px] text-primary uppercase">{monthShort}</div>
                            <div className="font-display text-xl md:text-2xl text-foreground">{dayNum}</div>
                          </div>
                        </div>
                        
                        {/* Event Details */}
                        <div className="flex-1 min-w-0 flex items-center">
                          <div>
                            <h3 className="font-display text-base md:text-lg text-foreground truncate">
                              {show.title}
                            </h3>
                            {hasVenueInfo && (
                              <p className="text-muted-foreground text-xs">
                                {[show.venue, show.location].filter(Boolean).join(' • ')}
                              </p>
                            )}
                            {show.time && (
                              <span className="flex items-center gap-1 text-muted-foreground text-xs mt-1">
                                <Clock className="w-3 h-3" />
                                {show.time}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {/* Type Badge */}
                        <div className="flex-shrink-0 self-center">
                          <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-medium">
                            {show.type}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </ScrollArea>
            ) : (
              <CalendarView shows={upcomingShows} />
            )}
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center text-muted-foreground mt-8 text-sm"
          >
            Want us at your event? <Link to="/request-a-quote" className="text-primary hover:underline">Get in touch</Link> to discuss your private booking.
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
            Plus dozens more venues across the region. <Link to="/request-a-quote" className="text-primary hover:underline">Contact us</Link> to discuss your venue.
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
              to="/request-a-quote"
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
