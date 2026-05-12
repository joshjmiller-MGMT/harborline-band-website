// Harborline App
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import ScrollToTopOnNavigate from "./components/ScrollToTopOnNavigate";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AboutPage from "./pages/About";
import FAQPage from "./pages/FAQ";
import SongListPage from "./pages/SongList";
import WhereWePerformPage from "./pages/WhereWePerform";
import GalleryPage from "./pages/Gallery";

// Occasion Pages
import WeddingsPage from "./pages/services/Weddings";
import CorporatePage from "./pages/services/Corporate";
import GalasPage from "./pages/services/Galas";
import PrivatePartiesPage from "./pages/services/PrivateParties";
import BirthdayPartiesPage from "./pages/services/BirthdayParties";
import HolidayPartiesPage from "./pages/services/HolidayParties";
import AnniversariesPage from "./pages/services/Anniversaries";
import BreweryEventsPage from "./pages/services/BreweryEvents";

// Ensemble Pages
import FullBandPage from "./pages/ensembles/FullBand";
import JazzQuartetPage from "./pages/ensembles/JazzQuartet";
import PianoTrioPage from "./pages/ensembles/PianoTrio";
import AcousticDuoPage from "./pages/ensembles/AcousticDuo";
import StringEnsemblePage from "./pages/ensembles/StringEnsemble";
import SoloPerformerPage from "./pages/ensembles/SoloPerformer";

// Location Pages
import BaltimorePage from "./pages/locations/Baltimore";
import TowsonPage from "./pages/locations/Towson";
import ColumbiaPage from "./pages/locations/Columbia";
import AnnapolisPage from "./pages/locations/Annapolis";
import WashingtonDCPage from "./pages/locations/WashingtonDC";
import BethesdaPage from "./pages/locations/Bethesda";
import RockvillePage from "./pages/locations/Rockville";
import FrederickPage from "./pages/locations/Frederick";
import EasternShorePage from "./pages/locations/EasternShore";

// Venue Pages
import PendryBaltimorePage from "./pages/venues/PendryBaltimore";
import SagamorePendryPage from "./pages/venues/SagamorePendry";
import GeorgePeabodyLibraryPage from "./pages/venues/GeorgePeabodyLibrary";
import TheBelvederePage from "./pages/venues/TheBelvedere";
import AmericanVisionaryArtMuseumPage from "./pages/venues/AmericanVisionaryArtMuseum";
import BORailroadMuseumPage from "./pages/venues/BORailroadMuseum";
import FourSeasonsBaltimorePage from "./pages/venues/FourSeasonsBaltimore";
import EvergreenMuseumPage from "./pages/venues/EvergreenMuseum";
import LeggMasonTowerPage from "./pages/venues/LeggMasonTower";
import CylburnArboretumPage from "./pages/venues/CylburnArboretum";
import CloistersCastlePage from "./pages/venues/CloistersCastle";
import RequestQuotePage from "./pages/RequestQuote";
import SchedulePage from "./pages/Schedule";

// Team Portal
import { TeamAuthProvider } from "./hooks/useTeamAuth";
import TeamLogin from "./pages/team/TeamLogin";
import TeamSongs from "./pages/team/TeamSongs";
import TeamScheduler from "./pages/team/TeamScheduler";
import TeamResources from "./pages/team/TeamResources";
import TeamRunOfShow from "./pages/team/TeamRunOfShow";
import TeamDashboard from "./pages/team/TeamDashboard";
import TeamPractice from "./pages/team/TeamPractice";
import TeamSocial from "./pages/team/TeamSocial";
import TeamBooking from "./pages/team/TeamBooking";
import TeamVisualAssets from "./pages/team/TeamVisualAssets";
import TeamBrandStudio from "./pages/team/TeamBrandStudio";

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTopOnNavigate />
          <TeamAuthProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/faq" element={<FAQPage />} />
              <Route path="/songs" element={<SongListPage />} />
              <Route path="/where-we-perform" element={<WhereWePerformPage />} />
              <Route path="/request-a-quote" element={<RequestQuotePage />} />
              <Route path="/gallery" element={<GalleryPage />} />
              
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
              <Route path="/ensembles/jazz-quartet" element={<JazzQuartetPage />} />
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
              
              {/* Team Portal */}
              <Route path="/team/login" element={<TeamLogin />} />
              <Route path="/team/songs" element={<TeamSongs />} />
              <Route path="/team/scheduler" element={<TeamScheduler />} />
              <Route path="/team/resources" element={<TeamResources />} />
              <Route path="/team/run-of-show" element={<TeamRunOfShow />} />
              <Route path="/team/dashboard" element={<TeamDashboard />} />
              <Route path="/team/practice" element={<TeamPractice />} />
              <Route path="/team/social" element={<TeamSocial />} />
              <Route path="/team/booking" element={<TeamBooking />} />
              <Route path="/team/visual-assets" element={<TeamVisualAssets />} />
              <Route path="/team/brand-studio" element={<TeamBrandStudio />} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </TeamAuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
