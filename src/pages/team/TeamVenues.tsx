import TeamLayout from "@/components/TeamLayout";
import VenueFestivalTrackerWidget from "@/components/dashboard/VenueFestivalTrackerWidget";
import { Building2 } from "lucide-react";

// Venue & Festival Tracker — extracted to its own page (Josh, 2026-07-07: the
// Booking page was useless around it). /team/booking now redirects here.
// NOTE: BookingAgentWidget (the sheet-backed agent list that shared the old
// page) is unmounted but NOT deleted — pending Josh's call on whether it holds
// value vs. Leads/Pipeline (review card up).
export default function TeamVenues() {
  return (
    <TeamLayout>
      <div className="container mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="font-display text-3xl tracking-wide-custom text-foreground flex items-center gap-3">
            <Building2 className="w-7 h-7 text-primary" /> Venues & Festivals
          </h1>
          <p className="text-muted-foreground mt-2">
            The venue + festival tracker — rooms and stages by act fit.
          </p>
        </div>
        <VenueFestivalTrackerWidget />
      </div>
    </TeamLayout>
  );
}
