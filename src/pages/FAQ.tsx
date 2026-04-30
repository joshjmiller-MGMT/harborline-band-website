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
    question: "How far in advance should I book Harborline?",
    answer: "We recommend booking as early as possible, especially for peak wedding season (May-October). Popular dates can book 12-18 months in advance. However, we occasionally have last-minute availability, so don't hesitate to reach out even for events coming up soon."
  },
  {
    question: "What size band configurations do you offer?",
    answer: "We offer flexible configurations from a 4-piece combo (perfect for cocktail hours and intimate gatherings) up to a full 12-piece ensemble with a horn section. Our most popular option is our 7-piece band, which provides a full sound for most venues."
  },
  {
    question: "Can we request specific songs?",
    answer: "Absolutely! We love learning new songs for our clients. Most requests can be accommodated with adequate notice. We'll also work with you to create a custom setlist that fits your event's vibe and keeps your guests on the dance floor."
  },
  {
    question: "Do you provide your own sound and lighting?",
    answer: "Yes! We come fully equipped with professional-grade sound systems and lighting appropriate for your venue size. For larger events, we can also coordinate with your venue's in-house AV team or bring in additional production."
  },
  {
    question: "What genres of music do you play?",
    answer: "We cover an extensive range: Motown, classic rock, R&B, funk, jazz standards, Top 40 hits, country, and more. Our diverse repertoire ensures there's something for every generation at your event."
  },
  {
    question: "Do you perform during ceremonies and cocktail hours?",
    answer: "Yes! Many of our wedding clients book us for the full event. We can provide elegant acoustic or jazz arrangements for your ceremony and cocktail hour, then bring the energy for your reception."
  },
  {
    question: "What is your pricing structure?",
    answer: "Pricing varies based on band size, event duration, date, and location. We provide customized quotes for each event. Contact us with your event details for a personalized proposal."
  },
  {
    question: "Do you travel outside the Baltimore area?",
    answer: "Yes! While we're based in Baltimore, we regularly perform throughout Maryland, Washington D.C., Northern Virginia, Delaware, and Pennsylvania. Travel fees may apply for events beyond the immediate Baltimore area."
  },
  {
    question: "Can we see you perform before booking?",
    answer: "We occasionally have public performances or showcase events. We also have extensive video footage of live performances that we're happy to share. Contact us to learn about upcoming showcases or to request performance videos."
  },
  {
    question: "What happens if a band member gets sick?",
    answer: "We maintain a roster of exceptional musicians who can step in if needed. In our 10+ years, we've never missed an event. Your celebration is our priority, and we have contingency plans for any situation."
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

  return (
    <Layout
      title="FAQ | Harborline Baltimore Event Band"
      description="Frequently asked questions about booking Harborline for your wedding, corporate event, or private party in Baltimore, Maryland."
      canonical="https://harborlineband.com/faq"
    >
      <script type="application/ld+json">
        {JSON.stringify(faqSchema)}
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
