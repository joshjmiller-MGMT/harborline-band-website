import { useMemo, useState } from "react";
import { Mail, Plus, Trash2, Copy, ExternalLink, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

/**
 * Booking outreach email composer (built by Jon Miller; integrated + restyled to
 * the team-portal design system 2026-06-16). Lives on the Lead Pipeline page so
 * outreach happens next to the leads. Generates a subject + body from structured
 * inputs, with a live preview, Copy, and "Open in email app" (mailto).
 */

type MessageContext = "cold" | "warm" | "followUp";
type PitchType = "specificBill" | "bandOnly";
type DateMode = "specificDate" | "dateWindow" | "dateList" | "flexible";

type LineupMember = {
  id: string;
  role: string;
  name: string;
  url: string;
  extraText?: string;
};

type BookingEmailState = {
  venueName: string;
  contactName: string;
  senderName: string;
  bandName: string;
  bandDescription: string;
  homeBase: string;
  epkUrl: string;
  phone: string;
  messageContext: MessageContext;
  pitchType: PitchType;
  dateMode: DateMode;
  requestedDate: string;
  dateWindow: string;
  dateList: string;
  expectedDraw: string;
  lineup: LineupMember[];
  customNote: string;
};

/**
 * Band presets fill the sender/band fields. Only The Economy carries full
 * known-good contact details (from Jon's original tool); Harborline + JMJ fill
 * name/home-base/description + the real site, leaving EPK/phone for Josh to
 * confirm so nothing fabricated goes into an outbound email.
 */
type BandPreset = {
  label: string;
  senderName: string;
  bandName: string;
  bandDescription: string;
  homeBase: string;
  epkUrl: string;
  phone: string;
  lineup: LineupMember[];
};

const BAND_PRESETS: Record<string, BandPreset> = {
  harborline: {
    label: "Harborline",
    senderName: "Josh",
    bandName: "Harborline",
    bandDescription: "high-energy wedding & events band",
    homeBase: "Baltimore-based",
    epkUrl: "https://harborlineband.com",
    phone: "",
    lineup: [],
  },
  economy: {
    label: "The Economy",
    senderName: "Josh",
    bandName: "The Economy",
    bandDescription: "modern pop-fusion project",
    homeBase: "Baltimore-based",
    epkUrl: "https://theeconomyband.com/electronic-press-kit-epk",
    phone: "443-717-1759",
    lineup: [
      { id: "1", role: "Headliner", name: "VIRG", url: "https://virg.supertape.site/", extraText: "ViRG's Spotify" },
      { id: "2", role: "", name: "The Economy", url: "https://theeconomyband.com/electronic-press-kit-epk" },
      { id: "3", role: "", name: "Shamboogie", url: "https://www.instagram.com/shamboogiband/?hl=en" },
    ],
  },
  jmj: {
    label: "Josh Miller Jazz",
    senderName: "Josh",
    bandName: "Josh Miller Jazz",
    bandDescription: "jazz trio / quartet",
    homeBase: "Baltimore-based",
    epkUrl: "",
    phone: "",
    lineup: [],
  },
};

const DEFAULT_PRESET = "harborline";

function presetState(key: string): BookingEmailState {
  const p = BAND_PRESETS[key] ?? BAND_PRESETS[DEFAULT_PRESET];
  return {
    venueName: "",
    contactName: "",
    senderName: p.senderName,
    bandName: p.bandName,
    bandDescription: p.bandDescription,
    homeBase: p.homeBase,
    epkUrl: p.epkUrl,
    phone: p.phone,
    messageContext: "cold",
    pitchType: p.lineup.length ? "specificBill" : "bandOnly",
    dateMode: "flexible",
    requestedDate: "",
    dateWindow: "",
    dateList: "",
    expectedDraw: "",
    lineup: p.lineup.map((m) => ({ ...m })),
    customNote: "",
  };
}

function createId() {
  return Math.random().toString(36).slice(2);
}

function getDateListItems(state: BookingEmailState) {
  return state.dateList.split("\n").map((d) => d.trim()).filter(Boolean);
}

function formatDateListInline(state: BookingEmailState) {
  const dates = getDateListItems(state);
  if (dates.length === 0) return "";
  if (dates.length === 1) return dates[0];
  if (dates.length === 2) return `${dates[0]} or ${dates[1]}`;
  return `${dates.slice(0, -1).join(", ")}, or ${dates[dates.length - 1]}`;
}

function getIntro(state: BookingEmailState) {
  const bandIntro = `This is ${state.senderName} from ${state.bandName}, a ${state.homeBase} ${state.bandDescription}.`;
  switch (state.messageContext) {
    case "warm":
      return `Hope you're doing well! ${bandIntro}`;
    case "followUp":
      return `Just wanted to follow up — ${bandIntro}`;
    default:
      return bandIntro;
  }
}

function getSubject(state: BookingEmailState) {
  if (state.pitchType === "specificBill") {
    const headliner = state.lineup.find((m) => m.role.toLowerCase().includes("headliner"));
    const lineupPart = headliner?.name ? `${state.bandName} / ${headliner.name}` : state.bandName;
    let datePart = "";
    if (state.dateMode === "specificDate" && state.requestedDate) datePart = ` - ${state.requestedDate}`;
    if (state.dateMode === "dateList") {
      const inlineDates = formatDateListInline(state);
      datePart = inlineDates ? ` - ${inlineDates}` : " - date options";
    }
    return `Show pitch: ${lineupPart} at ${state.venueName}${datePart}`;
  }
  return `Booking inquiry: ${state.bandName} at ${state.venueName}`;
}

function formatLineupMember(member: LineupMember) {
  const rolePrefix = member.role ? `${member.role}: ` : "";
  const extra = member.extraText ? ` & ${member.extraText}` : "";
  return `${rolePrefix}${member.name} – ${member.url}${extra}`;
}

function getDateAsk(state: BookingEmailState) {
  if (state.dateMode === "specificDate") {
    return `If ${state.requestedDate} is open, we'd love to lock it in and chat details. If that night's already on hold, we're also open to other dates${state.dateWindow ? ` in the ${state.dateWindow} window` : ""} that you're looking to fill.`;
  }
  if (state.dateMode === "dateList") {
    const inlineDates = formatDateListInline(state);
    if (!inlineDates) return "We'd love to find a date that works and chat through details.";
    return "If any of those dates are open, we'd love to lock one in and chat details. If they're already on hold, we're also open to other nearby dates that you're looking to fill.";
  }
  if (state.dateMode === "dateWindow") {
    return `We're open to dates in the ${state.dateWindow} window and would love to see if there's a night you're looking to fill.`;
  }
  return `We're flexible on timing and would love to see if there are any upcoming dates where ${state.bandName} could be a good fit.`;
}

// NOTE: lines are intentionally left-aligned (no leading indentation) so the
// generated email body copies cleanly — the original tool's template literals
// carried the function indentation into every output line (the dedent bug).
function generateEmailBody(state: BookingEmailState) {
  const greeting = `Hi ${state.contactName || `${state.venueName || "there"} team`}!`;
  const intro = getIntro(state);
  const customNote = state.customNote.trim() ? `\n\n${state.customNote.trim()}` : "";

  if (state.pitchType === "specificBill") {
    const lineupText = state.lineup
      .filter((m) => m.name.trim())
      .map(formatLineupMember)
      .join("\n\n");

    let datePhrase = "";
    if (state.dateMode === "specificDate" && state.requestedDate) datePhrase = ` ${state.requestedDate}`;
    if (state.dateMode === "dateList") {
      const inlineDates = formatDateListInline(state);
      datePhrase = inlineDates ? ` on ${inlineDates}` : "";
    }

    const drawSentence = state.expectedDraw
      ? `On a strong night, we're confident we can bring at least ${state.expectedDraw} with proper promotion behind it.`
      : "";

    const parts = [
      greeting,
      `${intro} I'd like to put together a ${state.lineup.length}-band bill at ${state.venueName}${datePhrase} and wanted to see if that night might be available.`,
      "Proposed lineup:",
      lineupText,
      drawSentence,
      `${getDateAsk(state)}${customNote}`,
      `Thanks for considering this. We'd love to build a show over at ${state.venueName}, even if this specific date doesn't work.`,
      "Looking forward to chatting with you soon.",
      `Best,\n${state.senderName}\n${state.bandName}${state.phone ? `\n${state.phone}` : ""}`,
    ];
    return parts.filter((p) => p && p.trim()).join("\n\n");
  }

  const parts = [
    greeting,
    `${intro} I wanted to reach out and see if ${state.bandName} might be a good fit for an upcoming bill at ${state.venueName}.`,
    `${state.bandName} is a ${state.homeBase} ${state.bandDescription}.`,
    state.epkUrl ? `EPK: ${state.epkUrl}` : "",
    `${getDateAsk(state)}${customNote}`,
    `Thanks for considering this. We'd love to play ${state.venueName} and are happy to chat through any details.`,
    `Best,\n${state.senderName}\n${state.bandName}${state.phone ? `\n${state.phone}` : ""}`,
  ];
  return parts.filter((p) => p && p.trim()).join("\n\n");
}

function ComposerBody() {
  const [preset, setPreset] = useState<string>(DEFAULT_PRESET);
  const [form, setForm] = useState<BookingEmailState>(() => presetState(DEFAULT_PRESET));
  const [copied, setCopied] = useState(false);

  const subject = useMemo(() => getSubject(form), [form]);
  const body = useMemo(() => generateEmailBody(form), [form]);

  function applyPreset(key: string) {
    setPreset(key);
    const p = BAND_PRESETS[key];
    if (!p) return;
    setForm((cur) => ({
      ...cur,
      senderName: p.senderName,
      bandName: p.bandName,
      bandDescription: p.bandDescription,
      homeBase: p.homeBase,
      epkUrl: p.epkUrl,
      phone: p.phone,
      lineup: p.lineup.map((m) => ({ ...m })),
      pitchType: p.lineup.length ? cur.pitchType : "bandOnly",
    }));
  }

  function update<K extends keyof BookingEmailState>(key: K, value: BookingEmailState[K]) {
    setForm((cur) => ({ ...cur, [key]: value }));
  }

  function updateLineupMember(id: string, key: keyof LineupMember, value: string) {
    setForm((cur) => ({
      ...cur,
      lineup: cur.lineup.map((m) => (m.id === id ? { ...m, [key]: value } : m)),
    }));
  }

  function addLineupMember() {
    setForm((cur) => ({
      ...cur,
      lineup: [...cur.lineup, { id: createId(), role: "", name: "", url: "", extraText: "" }],
    }));
  }

  function removeLineupMember(id: string) {
    setForm((cur) => ({ ...cur, lineup: cur.lineup.filter((m) => m.id !== id) }));
  }

  async function copyEmail() {
    const fullEmail = `Subject: ${subject}\n\n${body}`;
    try {
      await navigator.clipboard.writeText(fullEmail);
      setCopied(true);
      toast.success("Email copied to clipboard");
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't access clipboard — select the preview and copy manually");
    }
  }

  const mailtoHref = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  const fieldLabel = "text-xs font-medium text-muted-foreground";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* Controls */}
      <div className="space-y-5">
        <div className="grid gap-1.5">
          <Label className={fieldLabel}>Band</Label>
          <Select value={preset} onValueChange={applyPreset}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(BAND_PRESETS).map(([key, p]) => (
                <SelectItem key={key} value={key}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label className={fieldLabel}>Venue name</Label>
            <Input value={form.venueName} onChange={(e) => update("venueName", e.target.value)} placeholder="The Metro" />
          </div>
          <div className="grid gap-1.5">
            <Label className={fieldLabel}>Greeting / contact name</Label>
            <Input value={form.contactName} onChange={(e) => update("contactName", e.target.value)} placeholder="booking team" />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label className={fieldLabel}>Context</Label>
            <Select value={form.messageContext} onValueChange={(v) => update("messageContext", v as MessageContext)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cold">Cold first message</SelectItem>
                <SelectItem value="warm">Warm reach-out</SelectItem>
                <SelectItem value="followUp">Follow-up</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label className={fieldLabel}>Pitch type</Label>
            <Select value={form.pitchType} onValueChange={(v) => update("pitchType", v as PitchType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bandOnly">Offering {form.bandName || "the band"}</SelectItem>
                <SelectItem value="specificBill">Pitching a specific bill</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label className={fieldLabel}>Date situation</Label>
            <Select value={form.dateMode} onValueChange={(v) => update("dateMode", v as DateMode)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="flexible">Flexible / no date yet</SelectItem>
                <SelectItem value="specificDate">Specific date</SelectItem>
                <SelectItem value="dateWindow">Date window</SelectItem>
                <SelectItem value="dateList">List of specific dates</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {form.dateMode === "specificDate" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label className={fieldLabel}>Requested date</Label>
              <Input value={form.requestedDate} onChange={(e) => update("requestedDate", e.target.value)} placeholder="Friday 2/21" />
            </div>
            <div className="grid gap-1.5">
              <Label className={fieldLabel}>Backup window</Label>
              <Input value={form.dateWindow} onChange={(e) => update("dateWindow", e.target.value)} placeholder="2/16–2/22" />
            </div>
          </div>
        )}

        {form.dateMode === "dateWindow" && (
          <div className="grid gap-1.5">
            <Label className={fieldLabel}>Available date window</Label>
            <Input value={form.dateWindow} onChange={(e) => update("dateWindow", e.target.value)} placeholder="2/16–2/22" />
          </div>
        )}

        {form.dateMode === "dateList" && (
          <div className="grid gap-1.5">
            <Label className={fieldLabel}>Dates (one per line)</Label>
            <Textarea value={form.dateList} onChange={(e) => update("dateList", e.target.value)} rows={4} placeholder={"Thursday 2/20\nFriday 2/21\nSaturday 2/22"} />
          </div>
        )}

        {form.pitchType === "specificBill" && (
          <div className="space-y-3 rounded-lg border border-border bg-card/40 p-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-foreground">Lineup</h4>
                <p className="text-xs text-muted-foreground">Each artist on the bill, formatted into the proposed lineup.</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addLineupMember}>
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Add band
              </Button>
            </div>
            <div className="space-y-2">
              {form.lineup.map((member) => (
                <div key={member.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_1.5fr_1fr_auto] items-center">
                  <Input value={member.role} onChange={(e) => updateLineupMember(member.id, "role", e.target.value)} placeholder="Headliner" />
                  <Input value={member.name} onChange={(e) => updateLineupMember(member.id, "name", e.target.value)} placeholder="Band name" />
                  <Input value={member.url} onChange={(e) => updateLineupMember(member.id, "url", e.target.value)} placeholder="https://..." />
                  <Input value={member.extraText || ""} onChange={(e) => updateLineupMember(member.id, "extraText", e.target.value)} placeholder="Spotify, IG…" />
                  <Button type="button" variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => removeLineupMember(member.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="grid gap-1.5">
              <Label className={fieldLabel}>Expected draw</Label>
              <Input value={form.expectedDraw} onChange={(e) => update("expectedDraw", e.target.value)} placeholder="100 paid combined" />
            </div>
          </div>
        )}

        <details className="rounded-lg border border-border bg-card/40 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-foreground">Band info (preset {BAND_PRESETS[preset]?.label ?? ""})</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label className={fieldLabel}>Sender name</Label>
              <Input value={form.senderName} onChange={(e) => update("senderName", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label className={fieldLabel}>Band name</Label>
              <Input value={form.bandName} onChange={(e) => update("bandName", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label className={fieldLabel}>Home base</Label>
              <Input value={form.homeBase} onChange={(e) => update("homeBase", e.target.value)} placeholder="Baltimore-based" />
            </div>
            <div className="grid gap-1.5">
              <Label className={fieldLabel}>Description</Label>
              <Input value={form.bandDescription} onChange={(e) => update("bandDescription", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label className={fieldLabel}>EPK URL</Label>
              <Input value={form.epkUrl} onChange={(e) => update("epkUrl", e.target.value)} placeholder="https://…" />
            </div>
            <div className="grid gap-1.5">
              <Label className={fieldLabel}>Phone</Label>
              <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="443-…" />
            </div>
          </div>
        </details>

        <div className="grid gap-1.5">
          <Label className={fieldLabel}>Optional custom note</Label>
          <Textarea value={form.customNote} onChange={(e) => update("customNote", e.target.value)} rows={3} placeholder="One extra sentence specific to this venue or relationship." />
        </div>
      </div>

      {/* Preview */}
      <div className="space-y-3 lg:sticky lg:top-0 self-start">
        <div className="grid gap-1.5">
          <Label className={fieldLabel}>Subject</Label>
          <Input value={subject} readOnly className="font-medium" />
        </div>
        <div className="grid gap-1.5">
          <Label className={fieldLabel}>Body</Label>
          <Textarea value={body} readOnly rows={22} className="font-mono text-xs leading-relaxed" />
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" onClick={copyEmail}>
            {copied ? <Check className="w-4 h-4 mr-1.5" /> : <Copy className="w-4 h-4 mr-1.5" />}
            {copied ? "Copied" : "Copy email"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <a href={mailtoHref}>
              <ExternalLink className="w-4 h-4 mr-1.5" /> Open in email app
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function BookingEmailComposer() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Mail className="w-3.5 h-3.5 mr-1.5" /> Compose Email
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-amber-500" /> Outreach Email Composer
          </DialogTitle>
          <DialogDescription>
            Build a booking outreach email from structured inputs. Live preview, copy, or open in your email app.
          </DialogDescription>
        </DialogHeader>
        <ComposerBody />
      </DialogContent>
    </Dialog>
  );
}
