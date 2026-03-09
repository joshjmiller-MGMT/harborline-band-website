import TeamLayout from "@/components/TeamLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Music2, ListMusic, FolderOpen } from "lucide-react";

const resourceCategories = [
  { title: "Charts", description: "Lead sheets and chord charts", icon: FileText, count: 0 },
  { title: "Parts", description: "Individual instrument parts", icon: Music2, count: 0 },
  { title: "Set Lists", description: "Saved set list templates", icon: ListMusic, count: 0 },
  { title: "Documents", description: "Contracts, riders, and misc", icon: FolderOpen, count: 0 },
];

export default function TeamResources() {
  return (
    <TeamLayout>
      <div className="container mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="font-display text-3xl tracking-wide-custom text-foreground">Resources</h1>
          <p className="text-muted-foreground mt-2">Charts, parts, and band documents.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {resourceCategories.map((cat) => (
            <Card key={cat.title} className="border-border bg-card hover:border-primary/30 transition-colors cursor-pointer">
              <CardHeader className="pb-2">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-3">
                  <cat.icon className="w-5 h-5" />
                </div>
                <CardTitle className="font-display text-lg tracking-wide-custom">{cat.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{cat.description}</p>
                <p className="text-xs text-muted-foreground mt-2">{cat.count} items</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-12 text-center text-muted-foreground text-sm">
          Resource uploads coming soon.
        </div>
      </div>
    </TeamLayout>
  );
}
