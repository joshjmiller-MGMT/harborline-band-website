import TeamLayout from "@/components/TeamLayout";
import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";

export default function TeamSongs() {
  return (
    <TeamLayout>
      <div className="container mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl tracking-wide-custom text-foreground">Songs</h1>
            <p className="text-muted-foreground mt-2">View the full song list and repertoire.</p>
          </div>
          <Link
            to="/songs"
            target="_blank"
            className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
          >
            Open Full Page <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
        <iframe
          src="/songs"
          className="w-full rounded-xl border border-border bg-card"
          style={{ height: "calc(100vh - 180px)" }}
          title="Song List"
        />
      </div>
    </TeamLayout>
  );
}
