import { Link, useLocation, Navigate } from "react-router-dom";
import { useTeamAuth } from "@/hooks/useTeamAuth";
import {
  Music,
  Calendar,
  FolderOpen,
  LogOut,
  FileText,
  Home,
  LayoutDashboard,
  Activity,
  Share2,
  Phone,
  ChevronDown,
  Images,
  Palette,
  Loader2,
  Kanban,
  Sparkles,
  Zap,
  Workflow,
  Megaphone,
  Shield,
  Users,
} from "lucide-react";

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
  icon: React.ComponentType<{ className?: string }>;
  description: string;
};

type MegaMenu = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
};

const dailyMenu: MegaMenu = {
  label: "Daily",
  icon: Zap,
  items: [
    { name: "Dashboard", href: "/team/dashboard", icon: LayoutDashboard, description: "Overview and live activity" },
    { name: "Doc Generator", href: "/team/run-of-show", icon: FileText, description: "Run of show & client docs" },
    { name: "Booking", href: "/team/booking", icon: Phone, description: "Lead pipeline & venue tracker" },
  ],
};

const pipelinesMenu: MegaMenu = {
  label: "Pipelines",
  icon: Workflow,
  items: [
    { name: "Lead Pipeline", href: "/team/booking-pipeline", icon: Kanban, description: "Scrum board — drag leads across buckets" },
    { name: "SMART Tasks", href: "/team/smart-tasks", icon: Sparkles, description: "Trello inbox → SMART → Active across ventures" },
    { name: "Scheduler", href: "/team/scheduler", icon: Calendar, description: "Rehearsal & event scheduling" },
  ],
};

const contentMenu: MegaMenu = {
  label: "Content",
  icon: Megaphone,
  items: [
    { name: "Social", href: "/team/social", icon: Share2, description: "Posting times & social manager" },
    { name: "Brand Studio", href: "/team/brand-studio", icon: Palette, description: "People, decisions, releases, EPKs" },
    { name: "Visual Assets", href: "/team/visual-assets", icon: Images, description: "Photos, logos, design files" },
    { name: "Band Members", href: "/team/band-members", icon: Users, description: "Roster + reference images for visual-asset face recognition" },
  ],
};

const adminMenu: MegaMenu = {
  label: "Admin",
  icon: Shield,
  items: [
    { name: "Team Members", href: "/team/admin/users", icon: Users, description: "Invite + manage team logins" },
  ],
};

const megaMenus: MegaMenu[] = [dailyMenu, pipelinesMenu, contentMenu, adminMenu];

const libraryNav: { name: string; href: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { name: "Practice", href: "/team/practice", icon: Activity },
  { name: "Songs", href: "/team/songs", icon: Music },
  { name: "Resources", href: "/team/resources", icon: FolderOpen },
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

  return (
    <div className="min-h-screen bg-background text-foreground">
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
            {megaMenus.map((menu) => {
              const isActive = menu.items.some((m) => location.pathname === m.href);
              const TriggerIcon = menu.icon;
              return (
                <DropdownMenu key={menu.label}>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-display tracking-wide-custom transition-colors ${
                        isActive
                          ? "bg-primary/15 text-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      }`}
                    >
                      <TriggerIcon className="w-4 h-4" />
                      <span className="hidden sm:inline">{menu.label}</span>
                      <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64">
                    {menu.items.map((item) => {
                      const ItemIcon = item.icon;
                      const itemActive = location.pathname === item.href;
                      return (
                        <DropdownMenuItem key={item.href} asChild>
                          <Link
                            to={item.href}
                            className={`flex items-start gap-3 cursor-pointer ${
                              itemActive ? "bg-primary/10 text-primary" : ""
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

            {libraryNav.map((item) => {
              const isActive = location.pathname === item.href;
              const ItemIcon = item.icon;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-display tracking-wide-custom transition-colors ${
                    isActive
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  <ItemIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">{item.name}</span>
                </Link>
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

      <main>{children}</main>
    </div>
  );
}
