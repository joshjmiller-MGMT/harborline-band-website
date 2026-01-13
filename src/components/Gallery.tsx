import { motion } from "framer-motion";
import gallery1 from "@/assets/gallery-1.jpg";
import gallery2 from "@/assets/gallery-2.jpg";
import gallery3 from "@/assets/gallery-3.jpg";
import gallery4 from "@/assets/gallery-4.jpg";
import gallery5 from "@/assets/gallery-5.jpg";

const images = [
  { src: gallery1, alt: "Harborline performing at a corporate event" },
  { src: gallery2, alt: "Band members at an outdoor celebration" },
  { src: gallery3, alt: "Setup for an elegant waterfront event" },
  { src: gallery4, alt: "The band posing by the Chesapeake Bay" },
  { src: gallery5, alt: "Keyboardist performing live" },
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
