import { useState } from "react";
import TeamLayout from "@/components/TeamLayout";
import BookingAgentWidget from "@/components/dashboard/BookingAgentWidget";
import VenueFestivalTrackerWidget from "@/components/dashboard/VenueFestivalTrackerWidget";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Phone, Building2, Users } from "lucide-react";

export default function TeamBooking() {
  const [tab, setTab] = useState("lead-pipeline");

  return (
    <TeamLayout>
      <div className="container mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="font-display text-3xl tracking-wide-custom text-foreground flex items-center gap-3">
            <Phone className="w-7 h-7 text-amber-500" /> Booking
          </h1>
          <p className="text-muted-foreground mt-2">
            Lead pipeline and venue tracking, connected to the JJMM contact spreadsheet.
          </p>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid w-full max-w-xl grid-cols-2">
            <TabsTrigger value="lead-pipeline" className="gap-2">
              <Users className="w-4 h-4" /> Lead Pipeline
            </TabsTrigger>
            <TabsTrigger value="venue-festival" className="gap-2">
              <Building2 className="w-4 h-4" /> Venue & Festival Tracker
            </TabsTrigger>
          </TabsList>

          <TabsContent value="lead-pipeline" className="mt-6">
            <BookingAgentWidget />
          </TabsContent>

          <TabsContent value="venue-festival" className="mt-6">
            <VenueFestivalTrackerWidget />
          </TabsContent>
        </Tabs>
      </div>
    </TeamLayout>
  );
}
