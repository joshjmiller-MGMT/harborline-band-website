import TeamLayout from "@/components/TeamLayout";
import ClaudeLogWidget from "@/components/dashboard/ClaudeLogWidget";
import UnifiedCalendarWidget from "@/components/dashboard/UnifiedCalendarWidget";
import SocialManagerWidget from "@/components/dashboard/SocialManagerWidget";
import PostingTimesWidget from "@/components/dashboard/PostingTimesWidget";
import NeedsActionWidget from "@/components/dashboard/NeedsActionWidget";
import BookingAgentWidget from "@/components/dashboard/BookingAgentWidget";
import AvailabilityCheckerWidget from "@/components/dashboard/AvailabilityCheckerWidget";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, Share2 } from "lucide-react";

export default function TeamDashboard() {
  return (
    <TeamLayout>
      <div className="container mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="font-display text-3xl tracking-wide-custom text-foreground flex items-center gap-3">
            <LayoutDashboard className="w-7 h-7 text-primary" /> Dashboard
          </h1>
          <p className="text-muted-foreground mt-2">Overview and tools for the Harborline team.</p>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="overview" className="gap-2">
              <LayoutDashboard className="w-4 h-4" /> Overview
            </TabsTrigger>
            <TabsTrigger value="social" className="gap-2">
              <Share2 className="w-4 h-4" /> Social
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <NeedsActionWidget />
              <AvailabilityCheckerWidget />
              <UnifiedCalendarWidget />
              <BookingAgentWidget />
              <ClaudeLogWidget />
            </div>
          </TabsContent>

          <TabsContent value="social">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PostingTimesWidget />
              <SocialManagerWidget />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </TeamLayout>
  );
}
