import TeamLayout from "@/components/TeamLayout";
import AvailabilityCheckerWidget from "@/components/dashboard/AvailabilityCheckerWidget";
import IntegrationHealthWidget from "@/components/dashboard/IntegrationHealthWidget";
import NeedsActionWidget from "@/components/dashboard/NeedsActionWidget";
import SmartTaskWidget from "@/components/dashboard/SmartTaskWidget";
import UnifiedCalendarWidget from "@/components/dashboard/UnifiedCalendarWidget";
import { LayoutDashboard } from "lucide-react";

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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Calendar gets the full width — it's the daily-driver surface. */}
          <div className="lg:col-span-2">
            <UnifiedCalendarWidget />
          </div>

          <NeedsActionWidget />
          <SmartTaskWidget />

          <div className="lg:col-span-2">
            <AvailabilityCheckerWidget />
          </div>

          {/* Integration health goes last — it's read-only diagnostics, not a daily-driver. */}
          <div className="lg:col-span-2">
            <IntegrationHealthWidget />
          </div>
        </div>
      </div>
    </TeamLayout>
  );
}
