import { useState } from "react";
import TeamLayout from "@/components/TeamLayout";
import { Helmet } from "react-helmet-async";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Users, Shield, Bot } from "lucide-react";
import TeamBandMembers from "./TeamBandMembers";
import TeamAdminUsers from "./TeamAdminUsers";
import AgentTeammates from "@/components/team/AgentTeammates";

// Merged "Members" surface (p70): Band Members roster + Team Members (login
// admin) under one nav entry via tabs. 2026-07-12: added the AI Team tab —
// Josh's field-expert agent teammates (chat + per-agent job log), default tab
// per his "manage a team, bounce field to field" directive.
export default function TeamMembers() {
  const [tab, setTab] = useState("ai-team");

  return (
    <TeamLayout>
      <Helmet>
        <title>Members · Team</title>
      </Helmet>
      <div className="container mx-auto px-6 pt-8">
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="ai-team" className="gap-2">
              <Bot className="w-4 h-4" /> AI Team
            </TabsTrigger>
            <TabsTrigger value="roster" className="gap-2">
              <Users className="w-4 h-4" /> Band Roster
            </TabsTrigger>
            <TabsTrigger value="logins" className="gap-2">
              <Shield className="w-4 h-4" /> Team Logins
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ai-team" className="mt-0">
            <AgentTeammates />
          </TabsContent>

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
