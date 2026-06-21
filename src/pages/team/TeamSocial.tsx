import TeamLayout from "@/components/TeamLayout";
import SocialManagerWidget from "@/components/dashboard/SocialManagerWidget";
import PostingTimesWidget from "@/components/dashboard/PostingTimesWidget";
import SocialContentQueueManager from "@/components/social/SocialContentQueueManager";
import ContentIngestLogWidget from "@/components/social/ContentIngestLogWidget";
import ContentSmartGoalsWidget from "@/components/social/ContentSmartGoalsWidget";
import { Share2 } from "lucide-react";

export default function TeamSocial() {
  return (
    <TeamLayout>
      <div className="container mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="font-display text-3xl tracking-wide-custom text-foreground flex items-center gap-3">
            <Share2 className="w-7 h-7 text-primary" /> Social
          </h1>
          <p className="text-muted-foreground mt-2">
            Workflow tracker, posting times, and social media manager.
          </p>
        </div>

        <div className="space-y-6">
          <SocialContentQueueManager />
          <SocialManagerWidget />
          <PostingTimesWidget />
          <ContentSmartGoalsWidget />
          <ContentIngestLogWidget />
        </div>
      </div>
    </TeamLayout>
  );
}
