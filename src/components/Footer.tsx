const Footer = () => {
  return (
    <footer className="py-8 border-t border-border">
      <div className="container px-6 mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
          <p className="font-display text-lg tracking-wide">HARBORLINE</p>
          <p className="text-muted-foreground text-sm">
            © {new Date().getFullYear()} Harborline. Baltimore's Premier Event Band.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
