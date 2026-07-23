// Harborline App
import { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import ScrollToTopOnNavigate from "./components/ScrollToTopOnNavigate";
import PageLoadingSpinner from "./components/PageLoadingSpinner";
import { TeamNoindex } from "./components/TeamNoindex";
import ErrorBoundary from "./components/ErrorBoundary";

// Eager: canonical landing surfaces + 404 (small, first-paint critical)
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AboutPage from "./pages/About";
import FAQPage from "./pages/FAQ";
import SongListPage from "./pages/SongList";
import WhereWePerformPage from "./pages/WhereWePerform";

// Lazy: SEO landing pages (occasions / ensembles / locations / venues / quote / schedule)
const EPKPage = lazy(() => import("./pages/EPK"));
const WeddingsPage = lazy(() => import("./pages/services/Weddings"));
const CorporatePage = lazy(() => import("./pages/services/Corporate"));
const GalasPage = lazy(() => import("./pages/services/Galas"));
const PrivatePartiesPage = lazy(() => import("./pages/services/PrivateParties"));
const BirthdayPartiesPage = lazy(() => import("./pages/services/BirthdayParties"));
const HolidayPartiesPage = lazy(() => import("./pages/services/HolidayParties"));
const AnniversariesPage = lazy(() => import("./pages/services/Anniversaries"));
const BreweryEventsPage = lazy(() => import("./pages/services/BreweryEvents"));

const FullBandPage = lazy(() => import("./pages/ensembles/FullBand"));
const JazzCombosPage = lazy(() => import("./pages/ensembles/JazzCombos"));
const PianoTrioPage = lazy(() => import("./pages/ensembles/PianoTrio"));
const AcousticDuoPage = lazy(() => import("./pages/ensembles/AcousticDuo"));
const StringEnsemblePage = lazy(() => import("./pages/ensembles/StringEnsemble"));
const SoloPerformerPage = lazy(() => import("./pages/ensembles/SoloPerformer"));

const BaltimorePage = lazy(() => import("./pages/locations/Baltimore"));
const TowsonPage = lazy(() => import("./pages/locations/Towson"));
const ColumbiaPage = lazy(() => import("./pages/locations/Columbia"));
const AnnapolisPage = lazy(() => import("./pages/locations/Annapolis"));
const WashingtonDCPage = lazy(() => import("./pages/locations/WashingtonDC"));
const BethesdaPage = lazy(() => import("./pages/locations/Bethesda"));
const RockvillePage = lazy(() => import("./pages/locations/Rockville"));
const FrederickPage = lazy(() => import("./pages/locations/Frederick"));
const EasternShorePage = lazy(() => import("./pages/locations/EasternShore"));

const PendryBaltimorePage = lazy(() => import("./pages/venues/PendryBaltimore"));
const SagamorePendryPage = lazy(() => import("./pages/venues/SagamorePendry"));
const GeorgePeabodyLibraryPage = lazy(() => import("./pages/venues/GeorgePeabodyLibrary"));
const TheBelvederePage = lazy(() => import("./pages/venues/TheBelvedere"));
const AmericanVisionaryArtMuseumPage = lazy(() => import("./pages/venues/AmericanVisionaryArtMuseum"));
const BORailroadMuseumPage = lazy(() => import("./pages/venues/BORailroadMuseum"));
const FourSeasonsBaltimorePage = lazy(() => import("./pages/venues/FourSeasonsBaltimore"));
const EvergreenMuseumPage = lazy(() => import("./pages/venues/EvergreenMuseum"));
const LeggMasonTowerPage = lazy(() => import("./pages/venues/LeggMasonTower"));
const CylburnArboretumPage = lazy(() => import("./pages/venues/CylburnArboretum"));
const CloistersCastlePage = lazy(() => import("./pages/venues/CloistersCastle"));

const RequestQuotePage = lazy(() => import("./pages/RequestQuote"));
const SchedulePage = lazy(() => import("./pages/Schedule"));
const SmartLinkPage = lazy(() => import("./pages/SmartLink"));

// Team Portal: auth provider stays eager (context); pages are lazy
import { TeamAuthProvider } from "./hooks/useTeamAuth";
const TeamLogin = lazy(() => import("./pages/team/TeamLogin"));
const TeamSongs = lazy(() => import("./pages/team/TeamSongs"));
const TeamScheduler = lazy(() => import("./pages/team/TeamScheduler"));
const TeamResources = lazy(() => import("./pages/team/TeamResources"));
const TeamGigPack = lazy(() => import("./pages/team/TeamGigPack"));
const TeamCurriculum = lazy(() => import("./pages/team/TeamCurriculum"));
const TeamHolds = lazy(() => import("./pages/team/TeamHolds"));
const TeamRunOfShow = lazy(() => import("./pages/team/TeamRunOfShow"));
const TeamDashboard = lazy(() => import("./pages/team/TeamDashboard"));
const TeamPractice = lazy(() => import("./pages/team/TeamPractice"));
const TeamSocial = lazy(() => import("./pages/team/TeamSocial"));
const TeamSocialHandoff = lazy(() => import("./pages/team/TeamSocialHandoff"));
const TeamVenues = lazy(() => import("./pages/team/TeamVenues"));
const TeamBookingPipeline = lazy(() => import("./pages/team/TeamBookingPipeline"));
const TeamVisualAssets = lazy(() => import("./pages/team/TeamVisualAssets"));
const TeamBrandStudio = lazy(() => import("./pages/team/TeamBrandStudio"));
const TeamBandMembers = lazy(() => import("./pages/team/TeamBandMembers"));
const TeamBands = lazy(() => import("./pages/team/TeamBands"));
const TeamMedia = lazy(() => import("./pages/team/TeamMedia"));
const TeamSystems = lazy(() => import("./pages/team/TeamSystems"));
const TeamGrants = lazy(() => import("./pages/team/TeamGrants"));
const TeamLeads = lazy(() => import("./pages/team/TeamLeads"));
const TeamFeed = lazy(() => import("./pages/team/TeamFeed"));
const TeamContacts = lazy(() => import("./pages/team/TeamContacts"));
const TeamAdminUsers = lazy(() => import("./pages/team/TeamAdminUsers"));
const TeamMembers = lazy(() => import("./pages/team/TeamMembers"));
const TeamSetlistBuilder = lazy(() => import("./pages/team/TeamSetlistBuilder"));
const TeamReviewQueue = lazy(() => import("./pages/team/TeamReviewQueue"));
const TeamFinances = lazy(() => import("./pages/team/TeamFinances"));
const TeamReleasePipeline = lazy(() => import("./pages/team/TeamReleasePipeline"));
const TeamOutreach = lazy(() => import("./pages/team/TeamOutreach"));
const TeamSmartLinks = lazy(() => import("./pages/team/TeamSmartLinks"));
const TeamFans = lazy(() => import("./pages/team/TeamFans"));

const queryClient = new QueryClient();

// Short-link domain (Josh 2026-07-22, "gethip.to/[release]" — Artist Hub style).
// When the site is served on this host (Netlify domain alias), root-level slugs
// render the smart-link page directly: gethip.to/blue-house-vol-1. Pre-staged so
// the domain works the moment DNS lands.
const SHORT_LINK_HOST = /^(www\.)?gethip\.to$/i;
const isShortLinkHost =
  typeof window !== "undefined" && SHORT_LINK_HOST.test(window.location.hostname);

function ShortHome() {
  // Bare gethip.to → send to the main site.
  useEffect(() => { window.location.replace("https://harborlineband.com"); }, []);
  return null;
}

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTopOnNavigate />
          <TeamNoindex />
          <TeamAuthProvider>
            <ErrorBoundary label="the app">
            <Suspense fallback={<PageLoadingSpinner />}>
              <Routes>
                {/* gethip.to serves smart links at root-level slugs */}
                {isShortLinkHost && <Route path="/" element={<ShortHome />} />}
                {isShortLinkHost && <Route path="/:slug" element={<SmartLinkPage />} />}
                <Route path="/" element={<Index />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/faq" element={<FAQPage />} />
                <Route path="/songs" element={<SongListPage />} />
                <Route path="/where-we-perform" element={<WhereWePerformPage />} />
                <Route path="/request-a-quote" element={<RequestQuotePage />} />
                <Route path="/epk" element={<EPKPage />} />
                <Route path="/press" element={<EPKPage />} />

                {/* Occasion Routes */}
                <Route path="/weddings" element={<WeddingsPage />} />
                <Route path="/corporate" element={<CorporatePage />} />
                <Route path="/galas" element={<GalasPage />} />
                <Route path="/private-parties" element={<PrivatePartiesPage />} />
                <Route path="/birthday-parties" element={<BirthdayPartiesPage />} />
                <Route path="/holiday-parties" element={<HolidayPartiesPage />} />
                <Route path="/anniversaries" element={<AnniversariesPage />} />
                <Route path="/brewery-events" element={<BreweryEventsPage />} />

                {/* Ensemble Routes */}
                <Route path="/ensembles/full-band" element={<FullBandPage />} />
                <Route path="/ensembles/jazz-combos" element={<JazzCombosPage />} />
                <Route path="/ensembles/piano-trio" element={<PianoTrioPage />} />
                <Route path="/ensembles/acoustic-duo" element={<AcousticDuoPage />} />
                <Route path="/ensembles/string-ensemble" element={<StringEnsemblePage />} />
                <Route path="/ensembles/solo-performer" element={<SoloPerformerPage />} />

                {/* Location Routes */}
                <Route path="/locations/baltimore" element={<BaltimorePage />} />
                <Route path="/locations/towson" element={<TowsonPage />} />
                <Route path="/locations/columbia" element={<ColumbiaPage />} />
                <Route path="/locations/annapolis" element={<AnnapolisPage />} />
                <Route path="/locations/washington-dc" element={<WashingtonDCPage />} />
                <Route path="/locations/bethesda" element={<BethesdaPage />} />
                <Route path="/locations/rockville" element={<RockvillePage />} />
                <Route path="/locations/frederick" element={<FrederickPage />} />
                <Route path="/locations/eastern-shore" element={<EasternShorePage />} />

                {/* Venue Routes */}
                <Route path="/venues/pendry-baltimore" element={<PendryBaltimorePage />} />
                <Route path="/venues/sagamore-pendry" element={<SagamorePendryPage />} />
                <Route path="/venues/george-peabody-library" element={<GeorgePeabodyLibraryPage />} />
                <Route path="/venues/the-belvedere" element={<TheBelvederePage />} />
                <Route path="/venues/american-visionary-art-museum" element={<AmericanVisionaryArtMuseumPage />} />
                <Route path="/venues/b-and-o-railroad-museum" element={<BORailroadMuseumPage />} />
                <Route path="/venues/four-seasons-baltimore" element={<FourSeasonsBaltimorePage />} />
                <Route path="/venues/evergreen-museum" element={<EvergreenMuseumPage />} />
                <Route path="/venues/legg-mason-tower" element={<LeggMasonTowerPage />} />
                <Route path="/venues/cylburn-arboretum" element={<CylburnArboretumPage />} />
                <Route path="/venues/cloisters-castle" element={<CloistersCastlePage />} />

                {/* Hidden Routes */}
                <Route path="/schedule" element={<SchedulePage />} />

                {/* Public smart-link landing (our own Artist Hub) */}
                <Route path="/l/:slug" element={<SmartLinkPage />} />

                {/* Team Portal */}
                <Route path="/team/login" element={<TeamLogin />} />
                <Route path="/team/songs" element={<TeamSongs />} />
                <Route path="/team/scheduler" element={<TeamScheduler />} />
                <Route path="/team/resources" element={<TeamResources />} />
                <Route path="/team/gig-pack" element={<TeamGigPack />} />
                <Route path="/team/curriculum" element={<TeamCurriculum />} />
                <Route path="/team/holds" element={<TeamHolds />} />
                <Route path="/team/run-of-show" element={<TeamRunOfShow />} />
                <Route path="/team/dashboard" element={<TeamDashboard />} />
                <Route path="/team/practice" element={<TeamPractice />} />
                <Route path="/team/social" element={<TeamSocial />} />
                <Route path="/team/social-handoff/:week" element={<TeamSocialHandoff />} />
                {/* Booking page retired (2026-07-07) — Venue & Festival Tracker extracted to /team/venues. */}
                <Route path="/team/booking" element={<Navigate to="/team/venues" replace />} />
                <Route path="/team/venues" element={<TeamVenues />} />
                <Route path="/team/booking-pipeline" element={<TeamBookingPipeline />} />
                <Route path="/team/visual-assets" element={<TeamVisualAssets />} />
                <Route path="/team/brand-studio" element={<TeamBrandStudio />} />
                <Route path="/team/band-members" element={<TeamBandMembers />} />
                <Route path="/team/bands" element={<TeamBands />} />
                {/* SMART board merged into /team/review (2026-07-07) — redirect keeps old links alive. */}
                <Route path="/team/smart-tasks" element={<Navigate to="/team/review" replace />} />
                <Route path="/team/media" element={<TeamMedia />} />
                <Route path="/team/systems" element={<TeamSystems />} />
                <Route path="/team/grants" element={<TeamGrants />} />
                <Route path="/team/leads" element={<TeamLeads />} />
                <Route path="/team/feed" element={<TeamFeed />} />
                <Route path="/team/contacts" element={<TeamContacts />} />
                <Route path="/team/admin/users" element={<TeamAdminUsers />} />
                <Route path="/team/members" element={<TeamMembers />} />
                <Route path="/team/setlist-builder" element={<TeamSetlistBuilder />} />
                <Route path="/team/review" element={<TeamReviewQueue />} />
                <Route path="/team/finances" element={<TeamFinances />} />
                <Route path="/team/release-pipeline" element={<TeamReleasePipeline />} />
                <Route path="/team/smart-links" element={<TeamSmartLinks />} />
                <Route path="/team/fans" element={<TeamFans />} />
                <Route path="/team/outreach" element={<TeamOutreach />} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
            </ErrorBoundary>
          </TeamAuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
