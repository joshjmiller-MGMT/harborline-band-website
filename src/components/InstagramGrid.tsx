import { motion } from "framer-motion";
import { Instagram } from "lucide-react";

const instagramPosts = [
  { url: "https://www.instagram.com/reel/example1/", thumbnail: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&h=400&fit=crop", alt: "Live performance highlight" },
  { url: "https://www.instagram.com/reel/example2/", thumbnail: "https://images.unsplash.com/photo-1501612780327-45045538702b?w=400&h=400&fit=crop", alt: "Wedding reception moment" },
  { url: "https://www.instagram.com/reel/example3/", thumbnail: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&h=400&fit=crop", alt: "Band setup" },
  { url: "https://www.instagram.com/reel/example4/", thumbnail: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop", alt: "Stage lights" },
  { url: "https://www.instagram.com/reel/example5/", thumbnail: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=400&fit=crop", alt: "Crowd dancing" },
  { url: "https://www.instagram.com/reel/example6/", thumbnail: "https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=400&h=400&fit=crop", alt: "Event highlight" },
  { url: "https://www.instagram.com/reel/example7/", thumbnail: "https://images.unsplash.com/photo-1506157786151-b8491531f063?w=400&h=400&fit=crop", alt: "Behind the scenes" },
  { url: "https://www.instagram.com/reel/example8/", thumbnail: "https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?w=400&h=400&fit=crop", alt: "Gala performance" },
];

const InstagramGrid = () => {
  return (
    <section className="py-24 md:py-32">
      <div className="container px-6 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <p className="text-primary font-display tracking-display text-sm mb-3">
            FOLLOW ALONG
          </p>
          <h2 className="font-display text-5xl md:text-7xl tracking-tight mb-4">
            @HARBORLINE.BAND
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Catch the latest highlights, behind-the-scenes moments, and live performance clips.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3"
        >
          {instagramPosts.map((post, index) => (
            <motion.a
              key={index}
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              className="group relative aspect-square overflow-hidden rounded-sm bg-card border border-border"
            >
              <img
                src={post.thumbnail}
                alt={post.alt}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-background/0 group-hover:bg-background/60 transition-all duration-300 flex items-center justify-center">
                <Instagram className="text-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-300 w-8 h-8" />
              </div>
            </motion.a>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="text-center mt-8"
        >
          <a
            href="https://www.instagram.com/harborline.band/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors font-display tracking-wide-custom text-lg"
          >
            <Instagram className="w-5 h-5" />
            FOLLOW US ON INSTAGRAM
          </a>
        </motion.div>
      </div>
    </section>
  );
};

export default InstagramGrid;
