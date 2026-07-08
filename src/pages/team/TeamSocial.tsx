import TeamLayout from "@/components/TeamLayout";
import SocialManagerWidget from "@/components/dashboard/SocialManagerWidget";
import PostingTimesWidget from "@/components/dashboard/PostingTimesWidget";
import SocialContentQueueManager from "@/components/social/SocialContentQueueManager";
import ContentIngestLogWidget from "@/components/social/ContentIngestLogWidget";
import ContentSmartGoalsWidget from "@/components/social/ContentSmartGoalsWidget";
import { Share2 } from "lucide-react";

// Social page IA (Josh as social-media-manager, 2026-07-07):
// 1. Social Media MANAGER is the main hub → TOP. Its Ideas→Drafting→Scheduled→
//    Posted pipeline is the working surface; ingested/feed ideas belong in its
//    Ideas column.
// 2. Content queue (Des handoff) + posting times = supporting tools, below.
// 3. Content SMART goals stay, but they're big goals — break down ONE AT A TIME
//    through smartification (via /team/review), not all at once.
// 4. Content ingest log = raw intake at the bottom; actionable items flow
//    through review/smartification, not worked from here.
export default function TeamSocial() {
  return (
    <TeamLayout>
      <div className="container mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="font-display text-3xl tracking-wide-custom text-foreground flex items-center gap-3">
            <Share2 className="w-7 h-7 text-primary" /> Social
          </h1>
          <p className="text-muted-foreground mt-2">
            The manager is the hub — ideas land in its Ideas column, everything else supports it.
          </p>
        </div>

        <div className="space-y-6">
          {/* 1 — THE HUB */}
          <SocialManagerWidget />

          {/* 2 — supporting tools */}
          <SocialContentQueueManager />
          <PostingTimesWidget />

          {/* 3 — big goals (break down one at a time via review/smartify) */}
          <ContentSmartGoalsWidget />

          {/* 4 — raw intake; actionable items flow to review/smartification */}
          <ContentIngestLogWidget />
        </div>
      </div>
    </TeamLayout>
  );
}
