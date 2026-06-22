import { useSearchParams } from "react-router-dom";
import TeamLayout from "@/components/TeamLayout";
import { Helmet } from "react-helmet-async";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Users } from "lucide-react";
import { BandMembersPanel } from "./TeamBandMembers";
import { TeamAccessPanel } from "./TeamAdminUsers";

const VALID_TABS = ["roster", "access"] as const;
type MemberTab = (typeof VALID_TABS)[number];

// Merged "Members" surface: Roster (band roster + face-rec references) and
// Access (portal logins/invites) as two tabs — co-located under one nav entry
// while keeping the data-layer (roster) visually separate from the auth-layer
// (logins) per the P330 caution. Old /team/band-members + /team/admin/users
// routes redirect here with the matching ?tab=.
export default function TeamMembers() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab: MemberTab = (VALID_TABS as readonly string[]).includes(tabParam ?? "")
    ? (tabParam as MemberTab)
    : "roster";

  return (
    <TeamLayout>
      <Helmet>
        <title>Members · Team</title>
      </Helmet>
      <div className="container mx-auto px-6 py-8 max-w-5xl">
        <div className="flex items-center gap-3 mb-6">
          <Users className="w-6 h-6 text-primary" />
          <h1 className="font-display text-2xl tracking-wide-custom">Members</h1>
        </div>
        <Tabs
          value={tab}
          onValueChange={(v) => setSearchParams({ tab: v }, { replace: true })}
        >
          <TabsList className="mb-6">
            <TabsTrigger value="roster">Roster</TabsTrigger>
            <TabsTrigger value="access">Access</TabsTrigger>
          </TabsList>
          <TabsContent value="roster">
            <BandMembersPanel />
          </TabsContent>
          <TabsContent value="access">
            <TeamAccessPanel />
          </TabsContent>
        </Tabs>
      </div>
    </TeamLayout>
  );
}
