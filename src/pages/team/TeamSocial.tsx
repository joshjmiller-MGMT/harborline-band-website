import TeamLayout from "@/components/TeamLayout";
import SocialManagerWidget from "@/components/dashboard/SocialManagerWidget";
import PostingTimesWidget from "@/components/dashboard/PostingTimesWidget";
import SocialContentQueueManager from "@/components/social/SocialContentQueueManager";
import ContentIngestLogWidget from "@/components/social/ContentIngestLogWidget";
import ContentSmartGoalsWidget from "@/components/social/ContentSmartGoalsWidget";
import { Share2 } from "lucide-react";

// Social page IA — RE-SCOPED 2026-08-02 to match where the work actually happens
// (7/19 surface audit: social_sources = 0 rows, social_posts = 1 row ever, while
// content_ingest_log carries 845 rows and social_content_queue carries the Des
// handoff). The declared hub had inverted the real information architecture.
// 1. Content queue (Des handoff) = the working surface → TOP.
// 2. Content ingest log = the live intake with real volume; actionable items
//    flow through review/smartification, not worked from here.
// 3. Posting times + SMART goals = supporting tools.
// 4. Social Media MANAGER (Ideas→Drafting→Scheduled→Posted) is kept intact but
//    demoted until it earns adoption — nothing removed (no-wholesale-replacement).
export default function TeamSocial() {
  return (
    <TeamLayout>
      <div className="container mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="font-display text-3xl tracking-wide-custom text-foreground flex items-center gap-3">
            <Share2 className="w-7 h-7 text-primary" /> Social
          </h1>
          <p className="text-muted-foreground mt-2">
            Queue for Des first, live intake second — the tools follow the work.
          </p>
        </div>

        <div className="space-y-6">
          {/* 1 — the working surface: what goes to Des */}
          <SocialContentQueueManager />

          {/* 2 — live intake; actionable items flow to review/smartification */}
          <ContentIngestLogWidget />

          {/* 3 — supporting tools */}
          <PostingTimesWidget />
          <ContentSmartGoalsWidget />

          {/* 4 — pipeline board, kept but demoted until it earns adoption */}
          <SocialManagerWidget />
        </div>
      </div>
    </TeamLayout>
  );
}
