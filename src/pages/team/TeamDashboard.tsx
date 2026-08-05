import { useState } from "react";
import TeamLayout from "@/components/TeamLayout";
import FocusModeWidget from "@/components/dashboard/FocusModeWidget";
import AvailabilityCheckerWidget from "@/components/dashboard/AvailabilityCheckerWidget";
import PendingApprovalAlert from "@/components/dashboard/PendingApprovalAlert";
import FollowupsAlert from "@/components/dashboard/FollowupsAlert";
import DayPlanWidget from "@/components/dashboard/DayPlanWidget";
import TodayCommandWidget from "@/components/dashboard/TodayCommandWidget";
import IntegrationHealthWidget from "@/components/dashboard/IntegrationHealthWidget";
import UnifiedCalendarWidget from "@/components/dashboard/UnifiedCalendarWidget";
import { LayoutDashboard } from "lucide-react";
import ErrorBoundary from "@/components/ErrorBoundary";

export default function TeamDashboard() {
  // Focus mode (approved 2026-07-21, review card ab338385 "Build all 5"):
  // element 1 is "exactly ONE next action, everything else hidden". Nothing is
  // removed — the toggle defaults off and every widget below is one click away.
  const [focus, setFocus] = useState(false);

  return (
    <TeamLayout>
      <div className="container mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="font-display text-3xl tracking-wide-custom text-foreground flex items-center gap-3">
            <LayoutDashboard className="w-7 h-7 text-primary" /> Dashboard
          </h1>
          <p className="text-muted-foreground mt-2">Overview and tools for the Harborline team.</p>
        </div>

        <div className="mb-6">
          <ErrorBoundary compact label="Focus mode">
            <FocusModeWidget onFocusChange={setFocus} />
          </ErrorBoundary>
        </div>

        <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 ${focus ? "hidden" : ""}`}>
          {/* Pending-approval alert — surfaces the SMART backlog waiting on Josh. */}
          <div className="lg:col-span-2">
            <ErrorBoundary compact label="Pending approval">
              <PendingApprovalAlert />
            </ErrorBoundary>
          </div>

          {/* Follow-ups alert — recurring follow-ups, moved here off the SMART board (2026-07-07). */}
          <div className="lg:col-span-2">
            <ErrorBoundary compact label="Follow-ups">
              <FollowupsAlert />
            </ErrorBoundary>
          </div>

          {/* Day plan — time-blocked day template from the Daily's bucket (P4, 2026-07-07). */}
          <div className="lg:col-span-2">
            <ErrorBoundary compact label="Day plan">
              <TodayCommandWidget />
              <DayPlanWidget />
            </ErrorBoundary>
          </div>

          {/* Calendar — daily-driver surface, full width. */}
          <div className="lg:col-span-2">
            <ErrorBoundary compact label="Calendar">
              <UnifiedCalendarWidget />
            </ErrorBoundary>
          </div>

          {/* AvailabilityChecker — full width. (SmartTaskWidget moved to the SMART Tasks
              page 2026-06-21; the 2026-05-24 card had paired them here — flagged in the PR.) */}
          <div className="lg:col-span-2">
            <ErrorBoundary compact label="Availability">
              <AvailabilityCheckerWidget />
            </ErrorBoundary>
          </div>

          {/* Integration health goes last — read-only diagnostics, not a daily-driver.
              (Restored 2026-07-20 with the social-ingest signal; the 07-19 prune had
              unmounted it.) */}
          <div className="lg:col-span-2">
            <ErrorBoundary compact label="Integration health">
              <IntegrationHealthWidget />
            </ErrorBoundary>
          </div>
        </div>
      </div>
    </TeamLayout>
  );
}
