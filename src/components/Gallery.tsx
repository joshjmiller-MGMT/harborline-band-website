import { motion } from "framer-motion";
import groupWaterfront1 from "@/assets/band/group-waterfront-1.webp";
import jazzTrio1 from "@/assets/band/jazz-trio-1.webp";
import livePerformance1 from "@/assets/band/live-performance-1.png";
import groupPortrait from "@/assets/band/group-portrait.jpg";
import specialEventDancer from "@/assets/band/special-event-dancer.webp";

const images = [
  { src: groupWaterfront1, alt: "Harborline band group photo by the water" },
  { src: livePerformance1, alt: "Live performance - drums and saxophone" },
  { src: jazzTrio1, alt: "Jazz trio performing under tent" },
  { src: groupPortrait, alt: "Harborline band official group portrait" },
  { src: specialEventDancer, alt: "Special event with ribbon dancer and live band" },
];

const Gallery = () => {
  return (
    <section id="gallery" className="py-24 md:py-32 bg-card">
      <div className="container px-6 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-primary font-display tracking-display text-sm mb-3">
            LIVE IN ACTION
          </p>
          <h2 className="font-display text-5xl md:text-7xl tracking-tight">
            GALLERY
          </h2>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
          {/* Large featured image */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="col-span-2 row-span-2 relative group overflow-hidden rounded-lg"
          >
            <img
              src={images[0].src}
              alt={images[0].alt}
              className="w-full h-full object-cover aspect-square md:aspect-auto transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          </motion.div>

          {/* Smaller images */}
          {images.slice(1).map((image, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: (index + 1) * 0.1 }}
              className="relative group overflow-hidden rounded-lg aspect-square"
            >
              <img
                src={image.src}
                alt={image.alt}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Gallery;
