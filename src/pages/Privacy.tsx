import Layout from "@/components/Layout";
import PageHero from "@/components/PageHero";
import { motion } from "framer-motion";

// Privacy policy (2026-08-01). Written to match what the systems ACTUALLY do:
//   - fan_signups: phone/email captured on the gethip.to landers -> contacts
//   - smart_link_events: Netlify edge geolocation (country/region/city), UA,
//     referrer, UTMs. No IP address is persisted (see netlify/edge-functions/
//     smartlink-track.ts — geo is derived at the edge, the IP is never written).
//   - Meta Pixel fires only on landers that carry a pixel_id on the smart_links
//     row. Required disclosure under Meta's Business Tools Terms.
//   - Booking forms are a monday.com embed, so monday is a processor.
//
// WHAT DRIVES THE CONTENT (verified at primary sources 2026-08-01):
//   - CalOPPA, Cal. Bus. & Prof. Code §22575(b) — the law that actually forces
//     a posted policy here. NO size threshold: any commercial site collecting
//     PII from a CA resident is covered. Its six required elements map to
//     sections below: (1) categories collected + third parties = "What we
//     collect"/"Who we share it with"; (2) review/change process + (3) change
//     notification + (4) effective date + (5) DO NOT TRACK response +
//     (6) third-party cross-site collection = "Do Not Track" section.
//     Elements (5) and (6) are the commonly-missed ones. Do not delete them.
//   - Meta Business Tools Terms §3.b.i — notice on each pixel page explaining
//     (a) third parties collect via pixels for measurement/ad targeting,
//     (b) how to opt out, (c) where the opt-out mechanism lives. That is the
//     three-part shape of the "Advertising and the Meta Pixel" section.
//   - CAN-SPAM (FTC) — postal address + working opt-out honored within 10
//     business days + no transfer of opted-out addresses.
//   - TCPA 47 CFR §64.1200(a)(10) — SEVEN per-se stop words, and a sender may
//     NOT designate an exclusive means of revocation. Hence the word list and
//     the "any reasonable way" language. Do not narrow it back to just STOP.
//   - CTIA Messaging Principles §5.2.1 — privacy policy must be referenced from
//     the signup call-to-action. That is why SmartLink.tsx links here.
//   - CCPA/CPRA, GDPR, and Maryland's MODPA were each checked and do NOT apply
//     at this size ($26.6M / 100k consumers; no EU targeting; 35k MD consumers).
//     Deliberately NOT claiming those statutory rights — voluntarily promising
//     them makes them enforceable. Revisit if any threshold is crossed.
// Keep this page in sync when any of the above changes.

const LAST_UPDATED = "August 1, 2026";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mb-10">
    <h2 className="font-display tracking-wide text-xl md:text-2xl mb-4 text-foreground">{title}</h2>
    <div className="space-y-4 text-muted-foreground leading-relaxed">{children}</div>
  </section>
);

const PrivacyPage = () => {
  return (
    <Layout
      title="Privacy Policy | Harborline"
      description="How Harborline and Joshua J Miller collect, use, and protect your information. What we store, who we share it with, and how to opt out or ask us to delete it."
      canonical="https://harborlineband.com/privacy"
    >
      <PageHero
        eyebrow="LEGAL"
        title="Privacy Policy"
        subtitle="What we collect, why we collect it, and how to get out."
        showCTA={false}
      />

      <section className="py-20">
        <div className="container px-6 max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <p className="text-sm text-muted-foreground/70 mb-10">
              Last updated: {LAST_UPDATED}
            </p>

            <Section title="Who this covers">
              <p>
                This policy covers <strong className="text-foreground">harborlineband.com</strong> and{" "}
                <strong className="text-foreground">gethip.to</strong>. Both are run by Harborline, a
                Baltimore based live music and event band business, and by Joshua J Miller, the
                musician behind it. When this policy says "we" it means both.
              </p>
              <p>
                We are a small business. There is no data team here. Josh reads the inbox. That is
                worth knowing when you decide what to send us.
              </p>
            </Section>

            <Section title="What we collect">
              <p className="text-foreground font-medium">When you ask for a quote or contact us</p>
              <p>
                Our booking and contact forms are hosted by monday.com and embedded on our pages. When
                you fill one out you give us your name, email, phone number, and details about your
                event such as the date, venue, guest count, and budget. You choose what to put in
                those fields. We get whatever you type.
              </p>
              <p>
                You can also just email or call us. Then we have your email address or phone number
                and whatever you told us.
              </p>

              <p className="text-foreground font-medium pt-2">When you sign up for music updates</p>
              <p>
                On our music release pages at gethip.to you can enter a phone number or an email
                address to hear about new music and shows. We store that contact, the release page
                you signed up from, the date, and the fact that you agreed to be contacted. If you
                arrived from an ad or a link with tracking tags we store those tags too, so we know
                which post worked.
              </p>

              <p className="text-foreground font-medium pt-2">When you just visit</p>
              <p>
                On our music release pages we log each view and each click out to a streaming service.
                That record holds the page, what you clicked, your browser's user agent string, the
                site you came from, the campaign tags on the link, and an approximate location.
              </p>
              <p>
                The location is country, state or region, and city. It comes from our host, Netlify,
                which works it out at the edge of its network.{" "}
                <strong className="text-foreground">We do not store your IP address.</strong> It is
                used to derive the rough location and then it is gone. City level is as precise as
                this ever gets.
              </p>
              <p>
                We do not run Google Analytics. We do not run a cookie banner because we do not set
                our own tracking cookies. Third parties embedded on our pages may set their own, and
                those are listed below.
              </p>
            </Section>

            <Section title="Advertising and the Meta Pixel">
              <p>
                Some of our music release pages run the Meta Pixel. It is Facebook and Instagram
                tracking code. Right now it is on one page, the Blue House Vol. 1 release page, and it
                is there because we point Instagram and Facebook ads at that page and need to know
                whether the ads work.
              </p>
              <p>
                When the pixel is on a page it tells Meta that a browser loaded the page, played a
                preview, signed up, or clicked out to a streaming service. Meta can connect that to
                your Facebook or Instagram account if you have one, and can use it to show you ads.
                Meta sets its own cookies to do this. That is Meta's technology and Meta's data, not
                ours, and Meta's own terms govern what it does with it.
              </p>
              <p>
                We do not send Meta your name, email address, or phone number. We do not use Meta's
                advanced matching. The pixel only ever sees that an anonymous browser did something on
                a page.
              </p>
              <p>
                You can control this. Meta's{" "}
                <a
                  href="https://accountscenter.facebook.com/ad_preferences"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary/80 transition-colors"
                >
                  ad preferences
                </a>{" "}
                and{" "}
                <a
                  href="https://www.facebook.com/help/2207256696182627"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary/80 transition-colors"
                >
                  off Facebook activity
                </a>{" "}
                settings let you disconnect this activity from your account. Your browser's tracking
                protection or an ad blocker will also stop the pixel from loading.
              </p>
            </Section>

            <Section title="Do Not Track, and tracking by others">
              <p>
                Some browsers send a "Do Not Track" signal.{" "}
                <strong className="text-foreground">
                  We do not respond to Do Not Track signals.
                </strong>{" "}
                There is still no agreed standard for what a site should do when it gets one, so
                rather than imply we handle it, we are telling you plainly that we do not. The
                controls that do work are listed above and below.
              </p>
              <p>
                <strong className="text-foreground">
                  Other companies can collect information about you across different websites through
                  our pages.
                </strong>{" "}
                Specifically: Meta, through the pixel on the release pages that run it, can see that
                your browser visited and can combine that with your activity on other sites that also
                run Meta pixels. Vimeo and Google can do the same through the video players and fonts
                they serve. We do not control what they collect once their code is loaded, and their
                own privacy policies govern it.
              </p>
              <p>
                We ourselves do not track you across other companies' websites. Our own analytics stop
                at our own pages.
              </p>
            </Section>

            <Section title="Why we use it">
              <p>We use what we collect to do these things and nothing else:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Answer your inquiry, quote your event, and play it.</li>
                <li>Stay in touch about a booking that is already on the calendar.</li>
                <li>Send you music and show news if you asked for it.</li>
                <li>See which releases and which links actually get listened to.</li>
                <li>Know whether an ad we paid for did anything.</li>
                <li>Keep our own records straight and meet tax and business obligations.</li>
              </ul>
              <p>
                <strong className="text-foreground">We do not sell your information.</strong> We do not
                rent it, trade it, or hand it to a data broker. We have never done it and it is not
                part of the plan.
              </p>
            </Section>

            <Section title="Who we share it with">
              <p>
                We use outside services to actually run the business. They handle your data on our
                instructions so that we can deliver something you asked for. They are not allowed to
                use it for their own purposes, except Meta, which is described above and does use it
                for its own advertising.
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong className="text-foreground">Supabase</strong> stores our database. Contacts,
                  signups, and page analytics live there.
                </li>
                <li>
                  <strong className="text-foreground">Netlify</strong> hosts and serves the sites and
                  derives the approximate location described above.
                </li>
                <li>
                  <strong className="text-foreground">monday.com</strong> hosts our booking and
                  contact forms and receives what you type into them.
                </li>
                <li>
                  <strong className="text-foreground">Resend</strong> sends our email on our behalf.
                </li>
                <li>
                  <strong className="text-foreground">Twilio</strong> will send our text messages. We
                  have not started sending texts yet. When we do, it will go through Twilio.
                </li>
                <li>
                  <strong className="text-foreground">Meta</strong> receives pixel activity from the
                  release pages that run it.
                </li>
                <li>
                  <strong className="text-foreground">Google</strong> serves the fonts on our pages and
                  provides the sign in used by our internal staff area. Loading a font tells Google
                  your IP address, which is how any web font works.
                </li>
                <li>
                  <strong className="text-foreground">Vimeo</strong> hosts our performance videos. If a
                  video player is on a page, Vimeo can set its own cookies.
                </li>
              </ul>
              <p>
                We will also hand over information if a law, a subpoena, or a court order requires it,
                or if we ever sell or merge the business, in which case whoever takes it over is bound
                by this policy until they publish a new one.
              </p>
            </Section>

            <Section title="Email and text messages">
              <p>
                <strong className="text-foreground">Email.</strong> Every marketing email we send has
                an unsubscribe link at the bottom. Click it and you are out. We honor it promptly and
                in any case within ten business days, which is what federal law requires. Our real
                mailing address is in the footer of those emails. We will not sell or transfer your
                address to someone else for their own mailing list.
              </p>
              <p>
                <strong className="text-foreground">Text messages.</strong> We only text you if you
                gave us your number and agreed to it, and we only text about our own music, shows, and
                your booking. Message and data rates may apply from your carrier. Message frequency
                varies and is low.
              </p>
              <p>
                To stop, reply with any of these words:{" "}
                <strong className="text-foreground">
                  STOP, QUIT, END, REVOKE, OPT OUT, CANCEL, or UNSUBSCRIBE
                </strong>
                . Capitalization and punctuation do not matter. Reply{" "}
                <strong className="text-foreground">HELP</strong> for help.
              </p>
              <p>
                Those words are not the only way out.{" "}
                <strong className="text-foreground">
                  Any reasonable request to stop counts, however you word it and whichever way you
                  send it
                </strong>{" "}
                — text, email, or a phone call all work, and plain English like "please stop texting
                me" is enough. We honor it within ten business days and usually the same day.
              </p>
              <p>
                Replying STOP to texts does not unsubscribe you from email, and unsubscribing from
                email does not stop texts. They are separate lists. If you want out of both, say so
                and we will handle it.
              </p>
              <p>
                Emails about an event you actually booked with us are not marketing. Those keep coming
                until the event is done, because that is us doing the job.
              </p>
            </Section>

            <Section title="How long we keep it">
              <p>
                Booking inquiries and client records stay while we might still work together and for
                seven years after an event we played, because that is what tax and business records
                need.
              </p>
              <p>
                Music signup contacts stay until you opt out. When you opt out we keep the bare
                minimum needed to remember not to contact you again, which is a good faith reading of
                what the opt out rules require. Ask us to erase you entirely and we will.
              </p>
              <p>
                Page view and click analytics stay for two years, then get cleared. Those records are
                not tied to your name.
              </p>
            </Section>

            <Section title="Your choices">
              <p>You can ask us to do any of these and we will:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Tell you what we have on you.</li>
                <li>Correct anything that is wrong.</li>
                <li>Delete you.</li>
                <li>Stop emailing or texting you.</li>
                <li>Send you a copy of what you gave us.</li>
              </ul>
              <p>
                Email{" "}
                <a
                  href="mailto:harborlineband@gmail.com?subject=Privacy%20request"
                  className="text-primary hover:text-primary/80 transition-colors"
                >
                  harborlineband@gmail.com
                </a>{" "}
                with the subject "Privacy request" and tell us what you want. We will reply within 30
                days. We may ask you to confirm you are who you say you are before we delete or hand
                over anything, which protects you more than it protects us.
              </p>
              <p>
                We will not treat you differently for asking. No worse pricing, no worse service.
              </p>
              <p>
                Some state privacy laws give residents formal versions of these rights. Harborline is
                small enough that most of those laws do not currently apply to us by their own size
                thresholds. We are not going to make you look that up. Ask and we will do it anyway.
              </p>
            </Section>

            <Section title="Children">
              <p>
                Our sites are for adults booking events and adults listening to music. We do not
                knowingly collect anything from anyone under 13. If you think your child gave us
                something, email us and it is gone.
              </p>
            </Section>

            <Section title="Security">
              <p>
                Contact data sits behind row level security in our database, which means the public
                site can write a signup in but cannot read anything back out. Our internal staff area
                is password protected and limited to named people. Everything moves over HTTPS.
              </p>
              <p>
                No system is perfect and we are not going to claim ours is. If you find a hole,
                telling us is genuinely appreciated.
              </p>
            </Section>

            <Section title="Where we are">
              <p>
                We are in Baltimore, Maryland, in the United States, and our service providers store
                data in the United States. If you are somewhere else and you contact us, your
                information comes here.
              </p>
            </Section>

            <Section title="Changes">
              <p>
                If we change this we update the date at the top. If the change is a big one, meaning we
                start collecting something new or sharing with someone new, we will say so on the site
                rather than quietly editing this page.
              </p>
            </Section>

            <Section title="Contact">
              <p>
                Harborline
                <br />
                Baltimore, Maryland
                <br />
                <a
                  href="mailto:harborlineband@gmail.com"
                  className="text-primary hover:text-primary/80 transition-colors"
                >
                  harborlineband@gmail.com
                </a>
                <br />
                <a
                  href="tel:+14437856769"
                  className="text-primary hover:text-primary/80 transition-colors"
                >
                  (443) 785-6769
                </a>
              </p>
              <p>
                A full mailing address is included in every marketing email we send, as the law
                requires. If you need it before that, ask.
              </p>
            </Section>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
};

export default PrivacyPage;
