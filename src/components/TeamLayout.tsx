import { Link, useLocation, Navigate } from "react-router-dom";
import { useTeamAuth } from "@/hooks/useTeamAuth";
import ReportFixWidget from "@/components/team/ReportFixWidget";
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
  Megaphone,
  Users,
  ListMusic,
  Inbox,
  Handshake,
  Wallet,
  Rocket,
  Send,
  LayoutGrid,
  Landmark,
  Rss,
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

// Nav = 4 WORKFLOW HUBS (Book / Create / Music / Run) + 4 command surfaces
// (Dashboard, SMART, Review, Systems). IA consolidation 2026-07-07: pages are
// grouped by workflow adjacency, and every page in a hub renders a persistent
// HubTabs bar — one click between adjacent tools, no menu-diving. ADD-ergonomic:
// fewer top-level choices, consistent stages toward actionability.
const bookHub: MegaMenu = {
  label: "Book",
  icon: Phone,
  items: [
    { name: "Leads", href: "/team/leads", icon: Inbox, description: "Booking inquiries across all sources — status-tracked" },
    { name: "Pipeline", href: "/team/booking-pipeline", icon: Kanban, description: "Scrum board — drag leads across buckets" },
    { name: "Venues", href: "/team/venues", icon: Phone, description: "Venue & Festival Tracker — rooms and stages by act fit" },
    { name: "Outreach", href: "/team/outreach", icon: Send, description: "Proactive targets — venues, festivals, radio, playlists, press, collabs" },
    { name: "Contacts", href: "/team/contacts", icon: Users, description: "Central contact hub — mirror of the JJMM sheet; follow-up flags" },
    { name: "Bands", href: "/team/bands", icon: Handshake, description: "Relationship board — bands for show swaps & support slots" },
    { name: "Grants", href: "/team/grants", icon: Landmark, description: "Grant & funding opportunities — deadlines, fit, status" },
  ],
};

const createHub: MegaMenu = {
  label: "Create",
  icon: Share2,
  items: [
    { name: "Social", href: "/team/social", icon: Share2, description: "Posting times, content queue, handoff" },
    { name: "Feed", href: "/team/feed", icon: Rss, description: "Watch / listen / learn — everything to consume" },
    { name: "Media Library", href: "/team/media", icon: FolderOpen, description: "Catalogue of all photo/video/audio — filter, triage, route" },
    { name: "Visual Assets", href: "/team/visual-assets", icon: Images, description: "Photos, logos, design files" },
    { name: "Brand Studio", href: "/team/brand-studio", icon: Palette, description: "People, decisions, releases, EPKs" },
    { name: "Releases", href: "/team/release-pipeline", icon: Rocket, description: "JMJ EP waterfall — singles + per-release checklist" },
  ],
};

const musicHub: MegaMenu = {
  label: "Music",
  icon: Music,
  items: [
    { name: "Songs", href: "/team/songs", icon: Music, description: "Master song catalog with tags + keys" },
    { name: "Setlists", href: "/team/setlist-builder", icon: ListMusic, description: "Build & save setlists for any ensemble" },
    { name: "Practice", href: "/team/practice", icon: Activity, description: "Practice tracker + instrument hours" },
    { name: "Charts", href: "/team/resources", icon: FolderOpen, description: "Sheet music library — fake books, charts, parts, setlists" },
    { name: "Gig Pack", href: "/team/gig-pack", icon: FolderOpen, description: "Setlist in — every chart variation out, sources for whats missing" },
    { name: "Conservatory", href: "/team/curriculum", icon: Music, description: "MSM-style MM curriculum — self-study to greatness" },
  ],
};

const runHub: MegaMenu = {
  label: "Run",
  icon: Calendar,
  items: [
    { name: "Scheduler", href: "/team/scheduler", icon: Calendar, description: "Rehearsal & event scheduling" },
    { name: "Doc Generator", href: "/team/run-of-show", icon: FileText, description: "Run of show & client docs" },
    { name: "Finances", href: "/team/finances", icon: Wallet, description: "Every purchase classified by venture + business-vs-personal" },
    { name: "Members", href: "/team/members", icon: Users, description: "Band roster + team logins" },
  ],
};

const megaMenus: MegaMenu[] = [bookHub, createHub, musicHub, runHub];

// Command surfaces (direct links): the daily loop — Dashboard → Review (which
// now contains the SMART board at top; review + smartify = ONE surface).
const directLinks: { name: string; href: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { name: "Dashboard", href: "/team/dashboard", icon: LayoutDashboard },
  { name: "Review · SMART", href: "/team/review", icon: Sparkles },
  { name: "Systems", href: "/team/systems", icon: LayoutGrid },
];

// HubTabs — the ergonomic core: when the current page belongs to a hub, render
// its sibling tools as a persistent tab bar so switching is ONE click.
function HubTabs({ pathname }: { pathname: string }) {
  const hub = megaMenus.find((m) => m.items.some((i) => i.href === pathname));
  if (!hub) return null;
  return (
    <div className="border-b border-border bg-card/30">
      <div className="container mx-auto px-6 flex items-center gap-1 overflow-x-auto">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground pr-2 shrink-0">{hub.label}</span>
        {hub.items.map((i) => {
          const active = pathname === i.href;
          return (
            <Link
              key={i.href}
              to={i.href}
              className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
                active
                  ? "border-primary text-primary font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {i.name}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

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
            {/* Dashboard direct link — first slot */}
            {(() => {
              const dash = directLinks[0];
              const isActive = location.pathname === dash.href;
              const DashIcon = dash.icon;
              return (
                <Link
                  key={dash.href}
                  to={dash.href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-display tracking-wide-custom transition-colors ${
                    isActive
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  <DashIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">{dash.name}</span>
                </Link>
              );
            })()}

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

            {/* Review direct link — tail slot */}
            {directLinks.slice(1).map((item) => {
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

      <HubTabs pathname={location.pathname} />

      <main>{children}</main>

      {/* Site-fix chatbot — reports file as jobs on Webb's board (AI Team). */}
      <ReportFixWidget />
    </div>
  );
}
