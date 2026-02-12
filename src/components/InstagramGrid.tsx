import { motion } from "framer-motion";
import { Instagram } from "lucide-react";

const instagramPosts = [
  { url: "https://www.instagram.com/harborline.band/reel/DQKEwAXjC8n/", embedId: "DQKEwAXjC8n", alt: "Harborline performance" },
  { url: "https://www.instagram.com/baltimoresoundentertainment/reel/DN3nioKYj6D/", embedId: "DN3nioKYj6D", alt: "Baltimore Sound Entertainment" },
  { url: "https://www.instagram.com/joshjmillerofficial/reel/DUqps0tEbJ6/", embedId: "DUqps0tEbJ6", alt: "Josh Miller performance" },
  { url: "https://www.instagram.com/baltimoresoundentertainment/p/DUlckBnjTh3/", embedId: "DUlckBnjTh3", alt: "Baltimore Sound post" },
  { url: "https://www.instagram.com/harborline.band/reel/DSaXaZ-jV4l/", embedId: "DSaXaZ-jV4l", alt: "Harborline reel" },
  { url: "https://www.instagram.com/baltimoresoundentertainment/reel/DLSiBjwM--m/", embedId: "DLSiBjwM--m", alt: "Baltimore Sound reel" },
  { url: "https://www.instagram.com/100daysoffiddle/reel/DIjnjrrgjOC/", embedId: "DIjnjrrgjOC", alt: "100 Days of Fiddle" },
  { url: "https://www.instagram.com/the.economy.band/reel/DGmQKv5sMJB/", embedId: "DGmQKv5sMJB", alt: "The Economy Band" },
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
                src={`https://instagram.com/p/${post.embedId}/media/?size=m`}
                alt={post.alt}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                loading="lazy"
                onError={(e) => {
                  const target = e.currentTarget;
                  target.style.display = 'none';
                  target.parentElement!.classList.add('bg-secondary');
                }}
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
