import Layout from "@/components/Layout";
import PageHero from "@/components/PageHero";
import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "How quickly does Harborline respond to inquiries?",
    answer: "One named point-of-contact responds within 24 hours, every time. Quote in hand or a follow-up call scheduled — no auto-replies, no \"we'll get back to you when we can.\""
  },
  {
    question: "What happens if a band member can't make it?",
    answer: "Every role has a confirmed backup on the roster. If a player has to swap inside 72 hours of the event, a backup deploys with the same charts. We've never missed an event in 10+ years."
  },
  {
    question: "How is pricing structured?",
    answer: "Every quote is line-itemed: musicians × hours, bandleader fee, agency markup if a third party is involved, and a 12% business margin. No hidden costs. No surprise add-ons after the event."
  },
  {
    question: "How does Harborline stay in touch before the event?",
    answer: "Three calendared check-ins — 1 week, 72 hours, and 24 hours before — plus a same-day debrief after. Nothing slips, nothing surprises anyone day-of."
  },
  {
    question: "Can the band read the room and adjust mid-set?",
    answer: "Yes. The MD on stage has live-pivot capability — the setlist is built as modules, not a linear sequence. If the floor empties, we shift the energy without breaking flow."
  },
  {
    question: "What kind of music does Harborline play?",
    answer: "Nine style sub-brands: Jazz · Yacht Rock · 80s · 90s/2000s Pop & Electronic · Soul/R&B · Variety · Modern · Funk/Disco · Latin. Each one is its own configuration — you pick the style that fits your event, we book the right players for it."
  },
  {
    question: "What size band configurations do you offer?",
    answer: "Three tiers within each style: Intimate (trio to 5-piece, cocktail-hour and ceremony scale), Standard (7–10-piece, reception and mid-size venue), and Premium (12+ piece, festival and large-gala scale). Add-on sets for cocktail, reception, or ceremony coverage attach to any tier."
  },
  {
    question: "How far in advance should I book Harborline?",
    answer: "Wedding season (May–October) books 12–18 months out for popular dates. Off-season weddings and corporate events often have shorter lead times — 3 to 6 months is plenty for most weekends. Last-minute openings happen; ask."
  },
  {
    question: "Can we request specific songs?",
    answer: "Yes. Most requests are accommodated with adequate notice. We'll also build the setlist with you so it fits your event's shape — special-moment songs (first dance, parent dances, ceremony processional) are locked early, then the dance-floor set is curated around what your guests will actually move to."
  },
  {
    question: "Do you perform ceremonies and cocktail hours?",
    answer: "Yes — many wedding clients book the full event. Smaller acoustic or jazz configurations cover ceremony and cocktail hour; the full band brings the energy for the reception."
  },
  {
    question: "Do you provide sound and lighting?",
    answer: "We come fully equipped with professional sound systems and lighting appropriate for the venue. For larger events we coordinate with the venue's in-house production or bring in additional staging through our BSE-side infrastructure."
  },
  {
    question: "Do you travel outside the Baltimore area?",
    answer: "Yes. We're based in Baltimore and play regularly across Maryland, DC, Northern Virginia, Delaware, and Pennsylvania. Travel fees may apply for events beyond the immediate DMV; we line-item them in the quote."
  },
  {
    question: "Can we see you perform before booking?",
    answer: "Performance videos are available on request — full-band, ensemble, and cocktail configurations. Occasional public shows happen too; ask and we'll point you at the next one in your area."
  }
];

const FAQPage = () => {
  // JSON-LD structured data for FAQ
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://harborlineband.com/" },
      { "@type": "ListItem", "position": 2, "name": "FAQ", "item": "https://harborlineband.com/faq" }
    ]
  };

  return (
    <Layout
      title="FAQ | Harborline Baltimore Event Band"
      description="Frequently asked questions about booking Harborline for your wedding, corporate event, or private party in Baltimore, Maryland."
      canonical="https://harborlineband.com/faq"
    >
      <script type="application/ld+json">
        {JSON.stringify(faqSchema)}
      </script>
      <script type="application/ld+json">
        {JSON.stringify(breadcrumbSchema)}
      </script>

      <PageHero
        eyebrow="QUESTIONS"
        title="FREQUENTLY ASKED"
        subtitle="Everything you need to know about booking Harborline"
      />

      <section className="py-20 md:py-24">
        <div className="container px-6 max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Accordion type="single" collapsible className="space-y-4">
              {faqs.map((faq, index) => (
                <AccordionItem
                  key={index}
                  value={`item-${index}`}
                  className="bg-card border border-border rounded-lg px-6"
                >
                  <AccordionTrigger className="text-left font-display text-lg tracking-wide hover:text-primary">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mt-16 text-center"
          >
            <p className="text-muted-foreground mb-6">
              Still have questions? We'd love to hear from you.
            </p>
            <a
              href="/request-a-quote"
              className="inline-flex items-center gap-2 text-primary hover:text-primary/80 font-display tracking-wide transition-colors"
            >
              Contact Us →
            </a>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
};

export default FAQPage;
