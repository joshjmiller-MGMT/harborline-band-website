import TeamLayout from "@/components/TeamLayout";
import RunOfShowGeneratorV2 from "@/components/RunOfShowGeneratorV2";

export default function TeamRunOfShowV2() {
  return (
    <TeamLayout>
      <div className="mb-4 p-3 rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/20 text-sm">
        <strong>v2 preview.</strong> Canonical-pipeline doc generator (Drive search → ingest-event → canonical_events → render-canonical-event). The daily-driver Doc Generator stays at <code className="text-xs">/team/run-of-show</code>; this is the side route for trying the v2 architecture.
      </div>
      <RunOfShowGeneratorV2 />
    </TeamLayout>
  );
}
