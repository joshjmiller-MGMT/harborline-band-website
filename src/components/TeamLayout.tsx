import { Link, useLocation, Navigate } from "react-router-dom";
import { useTeamAuth } from "@/hooks/useTeamAuth";
import { Music, Image, Calendar, FolderOpen, LogOut, FileText, Home, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo-text.png";

const teamNav = [
  { name: "Dashboard", href: "/team/dashboard", icon: LayoutDashboard },
  { name: "Songs", href: "/team/songs", icon: Music },
  { name: "Gallery", href: "/team/gallery", icon: Image },
  { name: "Scheduler", href: "/team/scheduler", icon: Calendar },
  { name: "Resources", href: "/team/resources", icon: FolderOpen },
  { name: "Doc Generator", href: "/team/run-of-show", icon: FileText },
];

export default function TeamLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, logout } = useTeamAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/team/login" replace />;
  }

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
