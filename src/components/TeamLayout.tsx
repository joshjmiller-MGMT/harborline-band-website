import { Link, useLocation, Navigate } from "react-router-dom";
import { useTeamAuth } from "@/hooks/useTeamAuth";
import { Music, Calendar, FolderOpen, LogOut, FileText, Home, LayoutDashboard, Activity, Share2, Phone, ChevronDown, Briefcase, Images, Palette } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import logo from "@/assets/logo-text.png";

const managementNav = [
  { name: "Dashboard", href: "/team/dashboard", icon: LayoutDashboard, description: "Overview and live activity" },
  { name: "Social", href: "/team/social", icon: Share2, description: "Posting times & social manager" },
  { name: "Booking", href: "/team/booking", icon: Phone, description: "Lead pipeline & venue tracker" },
  { name: "Scheduler", href: "/team/scheduler", icon: Calendar, description: "Rehearsal & event scheduling" },
  { name: "Doc Generator", href: "/team/run-of-show", icon: FileText, description: "Run of show & client docs" },
  { name: "Brand Studio", href: "/team/brand-studio", icon: Palette, description: "People, decisions, releases, EPKs across ventures" },
];

const teamNav = [
  { name: "Practice", href: "/team/practice", icon: Activity },
  { name: "Songs", href: "/team/songs", icon: Music },
  { name: "Assets", href: "/team/visual-assets", icon: Images },
  { name: "Resources", href: "/team/resources", icon: FolderOpen },
];

export default function TeamLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, logout } = useTeamAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/team/login" replace />;
  }

  const managementActive = managementNav.some((m) => location.pathname === m.href);

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
            {/* Management mega menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-display tracking-wide-custom transition-colors ${
                    managementActive
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  <Briefcase className="w-4 h-4" />
                  <span className="hidden sm:inline">Management</span>
                  <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                {managementNav.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <DropdownMenuItem key={item.href} asChild>
                      <Link
                        to={item.href}
                        className={`flex items-start gap-3 cursor-pointer ${
                          isActive ? "bg-primary/10 text-primary" : ""
                        }`}
                      >
                        <item.icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
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

            {teamNav.map((item) => {
              const isActive = location.pathname === item.href;
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
                  <item.icon className="w-4 h-4" />
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

      {/* Content */}
      <main>{children}</main>
    </div>
  );
}
