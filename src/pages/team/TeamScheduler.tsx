import TeamLayout from "@/components/TeamLayout";
import SchedulePage from "@/pages/Schedule";
import StaffingWidget from "@/components/dashboard/StaffingWidget";

export default function TeamScheduler() {
  return (
    <TeamLayout>
      <div className="container mx-auto px-6 py-12 space-y-8">
        <StaffingWidget />
      </div>
      <SchedulePage />
    </TeamLayout>
  );
}
