import { useEffect } from "react";
import { motion } from "framer-motion";
import { Instagram } from "lucide-react";

const instagramPosts = [
  { url: "https://www.instagram.com/harborline.band/reel/DQKEwAXjC8n/" },
  { url: "https://www.instagram.com/baltimoresoundentertainment/reel/DN3nioKYj6D/" },
  { url: "https://www.instagram.com/joshjmillerofficial/reel/DUqps0tEbJ6/" },
  { url: "https://www.instagram.com/baltimoresoundentertainment/p/DUlckBnjTh3/" },
  { url: "https://www.instagram.com/harborline.band/reel/DSaXaZ-jV4l/" },
  { url: "https://www.instagram.com/baltimoresoundentertainment/reel/DLSiBjwM--m/" },
  { url: "https://www.instagram.com/100daysoffiddle/reel/DIjnjrrgjOC/" },
  { url: "https://www.instagram.com/the.economy.band/reel/DGmQKv5sMJB/" },
];

const InstagramGrid = () => {
  useEffect(() => {
    // Load Instagram embed script
    const script = document.createElement("script");
    script.src = "https://www.instagram.com/embed.js";
    script.async = true;
    document.body.appendChild(script);

    script.onload = () => {
      if ((window as any).instgrm) {
        (window as any).instgrm.Embeds.process();
      }
    };

    return () => {
      document.body.removeChild(script);
    };
  }, []);

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
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              className="aspect-square overflow-hidden rounded-sm border border-border bg-card"
            >
              <iframe
                src={`${post.url}embed/`}
                className="w-full h-full border-0"
                scrolling="no"
                allowTransparency
                loading="lazy"
                title={`Instagram post ${index + 1}`}
              />
            </motion.div>
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
