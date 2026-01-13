import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    quote: "Harborline made our wedding reception absolutely magical. The dance floor was packed all night long!",
    author: "Sarah & Michael",
    event: "Wedding Reception",
    rating: 5,
  },
  {
    quote: "Professional, talented, and incredibly fun. They read the room perfectly and kept our guests entertained for hours.",
    author: "Jennifer T.",
    event: "Corporate Gala",
    rating: 5,
  },
  {
    quote: "Yes, we want the full 8 minutes of American Pie! They played everything we asked for and more.",
    author: "Sky D.",
    event: "Private Event",
    rating: 5,
  },
  {
    quote: "The energy they brought to our company holiday party was incredible. Already booked them for next year!",
    author: "Marcus W.",
    event: "Corporate Holiday Party",
    rating: 5,
  },
  {
    quote: "From cocktail hour jazz to late-night dance hits, they handled every moment perfectly.",
    author: "Amanda & David",
    event: "Wedding Reception",
    rating: 5,
  },
  {
    quote: "Our fundraiser exceeded expectations thanks to Harborline's incredible performance. A true class act.",
    author: "Baltimore Arts Council",
    event: "Charity Gala",
    rating: 5,
  },
];

const Testimonials = () => {
  return (
    <section className="py-24 md:py-32 relative overflow-hidden">
      {/* Background accent */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2" />
      
      <div className="container px-6 max-w-6xl mx-auto relative">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-primary font-display tracking-display text-sm mb-3">
            WHAT CLIENTS SAY
          </p>
          <h2 className="font-display text-5xl md:text-7xl tracking-tight">
            TESTIMONIALS
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: (index % 3) * 0.15 }}
              className="relative p-8 bg-card border border-border rounded-lg hover:border-primary/30 transition-all duration-500 group"
            >
              <Quote className="w-10 h-10 text-primary/20 absolute top-6 right-6 group-hover:text-primary/40 transition-colors duration-500" />
              
              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {Array.from({ length: testimonial.rating }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-primary text-primary" />
                ))}
              </div>
              
              <p className="text-foreground/90 leading-relaxed mb-6 italic">
                "{testimonial.quote}"
              </p>
              
              <div>
                <p className="font-display text-lg tracking-wide">
                  {testimonial.author}
                </p>
                <p className="text-muted-foreground text-sm">
                  {testimonial.event}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
