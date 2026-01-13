import { motion } from "framer-motion";

const VideoGallery = () => {
  return (
    <section id="videos" className="py-24 md:py-32">
      <div className="container px-6 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <p className="text-primary font-display tracking-display text-sm mb-3">
            SEE US PERFORM
          </p>
          <h2 className="font-display text-5xl md:text-7xl tracking-tight mb-4">
            VIDEO GALLERY
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Watch Harborline bring the energy and entertainment to events across Maryland.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="relative rounded-lg overflow-hidden border border-border bg-card shadow-2xl"
        >
          <div style={{ padding: '56.25% 0 0 0', position: 'relative' }}>
            <iframe
              src="https://vimeo.com/showcase/11690570/embed"
              allow="autoplay; fullscreen; picture-in-picture; gyroscope; accelerometer; clipboard-write; encrypted-media; web-share"
              frameBorder="0"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
              }}
              title="Harborline Video Gallery"
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default VideoGallery;
