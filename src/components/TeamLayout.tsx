import { Link, useLocation, Navigate } from "react-router-dom";
import { useTeamAuth } from "@/hooks/useTeamAuth";
import { Music, Calendar, FolderOpen, LogOut, FileText, Home, LayoutDashboard, Activity, Share2, Phone, ChevronDown, Briefcase, Images, Palette, Loader2, Kanban, Sparkles, Users, Megaphone, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import logo from "@/assets/logo-text.png";

type NavItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  description: string;
};

type NavGroup = {
  label: string;
  icon: LucideIcon;
  items: NavItem[];
};

const dashboardItem: NavItem = {
  name: "Dashboard",
  href: "/team/dashboard",
  icon: LayoutDashboard,
  description: "Overview and live activity",
};

const navGroups: NavGroup[] = [
  {
    label: "Pipeline & Ops",
    icon: Briefcase,
    items: [
      { name: "Lead Pipeline", href: "/team/booking-pipeline", icon: Kanban, description: "Scrum board — drag leads across buckets" },
      { name: "Booking", href: "/team/booking", icon: Phone, description: "Venue tracker & lead-source widget" },
      { name: "Scheduler", href: "/team/scheduler", icon: Calendar, description: "Rehearsal & event scheduling" },
      { name: "SMART Tasks", href: "/team/smart-tasks", icon: Sparkles, description: "Scrum board — Trello inbox → SMART → Active across ventures" },
      { name: "Doc Generator", href: "/team/run-of-show", icon: FileText, description: "Run of show & client docs" },
    ],
  },
  {
    label: "Brand & People",
    icon: Megaphone,
    items: [
      { name: "Brand Studio", href: "/team/brand-studio", icon: Palette, description: "People, decisions, releases, EPKs across ventures" },
      { name: "Social", href: "/team/social", icon: Share2, description: "Posting times, social manager & content queue" },
      { name: "Band Members", href: "/team/band-members", icon: Users, description: "Roster + reference images for visual-asset face recognition" },
      { name: "Assets", href: "/team/visual-assets", icon: Images, description: "Visual asset library — photos, art, captures" },
    ],
  },
  {
    label: "Music",
    icon: Music,
    items: [
      { name: "Practice", href: "/team/practice", icon: Activity, description: "Practice mode, mastery & sessions" },
      { name: "Songs", href: "/team/songs", icon: Music, description: "Songbook & charts" },
      { name: "Resources", href: "/team/resources", icon: FolderOpen, description: "Reference files & links" },
    ],
  },
];

export default function TeamLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, logout } = useTeamAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/team/login" replace />;
  }

  const dashboardActive = location.pathname === dashboardItem.href;
  const DashboardIcon = dashboardItem.icon;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top Nav */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <Link to="/team/dashboard" className="block">
              <img src={logo} alt="Harborline" className="h-5 w-auto opacity-80" />
            </Link>
            <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors" title="Back to website">
              <Home className="w-4 h-4" />
            </Link>
          </div>

          <nav className="flex items-center gap-1">
            {/* Dashboard — direct link (daily landing) */}
            <Link
              to={dashboardItem.href}
              title={dashboardItem.description}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-display tracking-wide-custom transition-colors ${
                dashboardActive
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <DashboardIcon className="w-4 h-4" />
              <span className="hidden sm:inline">{dashboardItem.name}</span>
            </Link>

            {/* Category dropdowns */}
            {navGroups.map((group) => {
              const GroupIcon = group.icon;
              const groupActive = group.items.some((m) => location.pathname === m.href);
              return (
                <DropdownMenu key={group.label}>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-display tracking-wide-custom transition-colors ${
                        groupActive
                          ? "bg-primary/15 text-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      }`}
                    >
                      <GroupIcon className="w-4 h-4" />
                      <span className="hidden sm:inline">{group.label}</span>
                      <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64">
                    {group.items.map((item) => {
                      const isActive = location.pathname === item.href;
                      const ItemIcon = item.icon;
                      return (
                        <DropdownMenuItem key={item.href} asChild>
                          <Link
                            to={item.href}
                            className={`flex items-start gap-3 cursor-pointer ${
                              isActive ? "bg-primary/10 text-primary" : ""
                            }`}
                          >
                            <ItemIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">{item.name}</span>
                              <span className="text-xs text-muted-foreground">{item.description}</span>
                            </div>
                          </Link>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            })}

            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="ml-2 text-muted-foreground hover:text-destructive"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </nav>
        </div>
      </header>

      {/* Content */}
      <main>{children}</main>
    </div>
  );
}
