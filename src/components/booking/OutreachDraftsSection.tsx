import { useState } from "react";
import { Copy, Check, ExternalLink, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";

type DraftType = "warm" | "cold";

interface OutreachDraft {
  id: string;
  agency: string;
  email: string;
  type: DraftType;
  subject: string;
  body: string;
}

// Source of truth: wiki/harborline/agency-outreach-kit.md § "Email Outreach — ready-to-paste drafts".
// Kept as static templates here so Josh can copy/send from the site. Photo placeholders
// ([band-hero] / [group-waterfront-2]) stay inline — embed images manually after pasting.
const WARM_BODY = `Hey [first name],

We already know each other, so I'll keep this quick. Here's Harborline's current EPK, all in one place. Everything on it is real and the band is looking sharp.

[band-hero photo]  [group-waterfront-2 photo]

Watch the band: https://vimeo.com/showcase/11690570
Site: https://harborlineband.com

Harborline is a Baltimore event band led by working musicians. We scale from a solo act up to a full band with horns, covering weddings, corporate events, and galas across the DMV. Let me know what you need from us.

Josh / Harborline / harborlineband@gmail.com / (443) 405-2378`;

const COLD_CLOSING = `[band-hero] [group-waterfront-2]
Watch the band: https://vimeo.com/showcase/11690570 · Site: https://harborlineband.com
We scale from a solo act up to a full band with horns, covering weddings, corporate events, and galas across the DMV. Named point of contact, a backup for every role, and we show up. Happy to send pricing and our rider.
Josh / Harborline / harborlineband@gmail.com / (443) 405-2378`;

const COLD_SUBJECT = "Harborline, a DMV event band for your roster";

function cold(id: string, agency: string, email: string, opening: string): OutreachDraft {
  return { id, agency, email, type: "cold", subject: COLD_SUBJECT, body: `${opening}\n${COLD_CLOSING}` };
}

const DRAFTS: OutreachDraft[] = [
  {
    id: "567",
    agency: "567 Productions",
    email: "Booking@567Productions.com",
    type: "warm",
    subject: "Harborline EPK and a quick hello",
    body: WARM_BODY,
  },
  {
    id: "extraordinary",
    agency: "Extraordinary Entertainment",
    email: "sales@bookextraordinary.com",
    type: "warm",
    subject: "Harborline EPK and a quick hello",
    body: WARM_BODY,
  },
  cold(
    "watershed",
    "Watershed Entertainment",
    "Andrew@watershedentertainment.com",
    "Hi Andrew,\nI'm Josh Miller, bandleader of Harborline, a Baltimore event band led by working musicians. As another outfit run by working musicians, I figured you'd size us up the way we'd want, on the playing. We'd love to be on your roster.",
  ),
  cold(
    "washington-talent",
    "Washington Talent",
    "hello@washingtontalent.com",
    "Hi [first name],\nI'm Josh Miller, bandleader of Harborline, a Baltimore event band led by working musicians. We'd love to be considered for your roster. One question: I wasn't sure whether you take affiliated or outside acts, so let me know how that works on your end.",
  ),
  cold(
    "dan-goldman",
    "Dan Goldman Events",
    "party@dangoldmanevents.com",
    "Hi [first name],\nI'm Josh Miller, bandleader of Harborline, a Baltimore event band led by working musicians. You produce a lot of full service events across DC, MD, and VA, and we pair well with that, anything from a jazz trio at cocktail hour to a full band with horns for the party. We'd love to be on your roster.",
  ),
  cold(
    "dan-mcguire",
    "Dan McGuire / District Event Co.",
    "info@danmcguiregroup.com",
    "Hi [first name],\nI'm Josh Miller, bandleader of Harborline, a Baltimore event band led by working musicians. You've built District Event Co. around a strong stable of house bands, so I'm reaching out in case we can fill a style or configuration gap your current acts don't cover. We'd love to be on your roster.",
  ),
  cold(
    "green-light",
    "Green Light Booking",
    "entertainment@greenlightbooking.com",
    "Hi [first name],\nI'm Josh Miller, bandleader of Harborline, a Baltimore event band led by working musicians. Keeping this short, we'd love to be on your roster.",
  ),
  cold(
    "abe",
    "ABE Agency",
    "Jon@ABEAgency.com",
    "Hi Jon,\nI'm Josh Miller, bandleader of Harborline, a Baltimore event band led by working musicians. Saw you're always adding variety and party bands across the Northeast and Mid Atlantic, so reaching out, we'd love to be on your roster.",
  ),
];

export default function OutreachDraftsSection() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyDraft = async (d: OutreachDraft) => {
    try {
      await navigator.clipboard.writeText(`Subject: ${d.subject}\n\n${d.body}`);
      setCopiedId(d.id);
      toast.success(`Copied the ${d.agency} draft`);
      setTimeout(() => setCopiedId((c) => (c === d.id ? null : c)), 2000);
    } catch {
      toast.error("Couldn't copy — select and copy manually");
    }
  };

  return (
    <Card className="mt-8 bg-card/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-display tracking-wide-custom">
          <FileText className="w-5 h-5 text-amber-500" /> Outreach Drafts
          <Badge variant="secondary" className="ml-1 font-normal">{DRAFTS.length}</Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Ready-to-paste agency outreach emails. Copy, then send from{" "}
          <span className="font-medium">harborlineband@gmail.com</span> — embed the band photos
          where the placeholders are.
        </p>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {DRAFTS.map((d) => (
            <AccordionItem key={d.id} value={d.id}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex flex-1 items-center gap-3 text-left">
                  <span className="font-medium">{d.agency}</span>
                  <Badge
                    variant={d.type === "warm" ? "default" : "outline"}
                    className="text-[10px] uppercase tracking-wide"
                  >
                    {d.type}
                  </Badge>
                  <span className="text-xs text-muted-foreground hidden sm:inline">{d.email}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">To:</span> {d.email}
                    <span className="mx-2">·</span>
                    <span className="font-medium text-foreground">Subject:</span> {d.subject}
                  </p>
                  <pre className="whitespace-pre-wrap rounded-md border border-border bg-background/60 p-3 text-sm font-sans leading-relaxed">
                    {d.body}
                  </pre>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => copyDraft(d)}>
                      {copiedId === d.id ? (
                        <><Check className="w-3.5 h-3.5 mr-1.5" /> Copied</>
                      ) : (
                        <><Copy className="w-3.5 h-3.5 mr-1.5" /> Copy email</>
                      )}
                    </Button>
                    <Button asChild size="sm" variant="ghost">
                      <a
                        href={`mailto:${d.email}?subject=${encodeURIComponent(d.subject)}&body=${encodeURIComponent(d.body)}`}
                      >
                        <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Open in email
                      </a>
                    </Button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
