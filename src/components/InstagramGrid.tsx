import { motion } from "framer-motion";
import { Instagram } from "lucide-react";

// Replace these imports with your own square-cropped frame screenshots
import thumb1 from "@/assets/band/live-performance-1.png";
import thumb2 from "@/assets/band/live-performance-2.jpg";
import thumb3 from "@/assets/band/live-performance-3.jpg";
import thumb4 from "@/assets/band/group-laughing.jpg";
import thumb5 from "@/assets/band/live-dj-sax.webp";
import thumb6 from "@/assets/band/jazz-trio-1.webp";
import thumb7 from "@/assets/band/special-event-dancer.webp";
import thumb8 from "@/assets/band/setup-tent.png";

const instagramPosts = [
  { url: "https://www.instagram.com/harborline.band/reel/DQKEwAXjC8n/", thumbnail: thumb1 },
  { url: "https://www.instagram.com/baltimoresoundentertainment/reel/DN3nioKYj6D/", thumbnail: thumb2 },
  { url: "https://www.instagram.com/joshjmillerofficial/reel/DUqps0tEbJ6/", thumbnail: thumb3 },
  { url: "https://www.instagram.com/baltimoresoundentertainment/p/DUlckBnjTh3/", thumbnail: thumb4 },
  { url: "https://www.instagram.com/harborline.band/reel/DSaXaZ-jV4l/", thumbnail: thumb5 },
  { url: "https://www.instagram.com/baltimoresoundentertainment/reel/DLSiBjwM--m/", thumbnail: thumb6 },
  { url: "https://www.instagram.com/100daysoffiddle/reel/DIjnjrrgjOC/", thumbnail: thumb7 },
  { url: "https://www.instagram.com/the.economy.band/reel/DGmQKv5sMJB/", thumbnail: thumb8 },
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
                alt={`Instagram post ${index + 1}`}
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
