import TeamLayout from "@/components/TeamLayout";
import RunOfShowGeneratorV2 from "@/components/RunOfShowGeneratorV2";

export default function TeamRunOfShowV2() {
  return (
    <TeamLayout>
      <div className="mb-4 p-3 rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/20 text-sm">
        <strong>v2 candidate.</strong> Canonical-pipeline doc generator with inline editor, required-fields check, Drive upload, preview, print, and a client-facing renderer (C-client). The daily driver stays at <code className="text-xs">/team/run-of-show</code> until cutover.
      </div>
      <RunOfShowGeneratorV2 />
    </TeamLayout>
  );
}
