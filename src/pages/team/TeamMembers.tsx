import { useState } from "react";
import TeamLayout from "@/components/TeamLayout";
import { Helmet } from "react-helmet-async";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Users, Shield } from "lucide-react";
import TeamBandMembers from "./TeamBandMembers";
import TeamAdminUsers from "./TeamAdminUsers";

// Merged "Members" surface (p70): combines the Band Members roster and the
// Team Members (login admin) pages under one nav entry via tabs. Each tab renders
// the existing page in `embedded` mode (no nested TeamLayout). Co-located, not
// fused — the login-admin tab keeps its own logic/gating intact.
export default function TeamMembers() {
  const [tab, setTab] = useState("roster");

  return (
    <TeamLayout>
      <Helmet>
        <title>Members · Team</title>
      </Helmet>
      <div className="container mx-auto px-6 pt-8">
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="roster" className="gap-2">
              <Users className="w-4 h-4" /> Band Roster
            </TabsTrigger>
            <TabsTrigger value="logins" className="gap-2">
              <Shield className="w-4 h-4" /> Team Logins
            </TabsTrigger>
          </TabsList>

          <TabsContent value="roster" className="mt-0">
            <TeamBandMembers embedded />
          </TabsContent>

          <TabsContent value="logins" className="mt-0">
            <TeamAdminUsers embedded />
          </TabsContent>
        </Tabs>
      </div>
    </TeamLayout>
  );
}
