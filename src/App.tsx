import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AboutPage from "./pages/About";
import FAQPage from "./pages/FAQ";
import SongListPage from "./pages/SongList";

// Service Pages
import WeddingsPage from "./pages/services/Weddings";
import CorporatePage from "./pages/services/Corporate";
import GalasPage from "./pages/services/Galas";
import PrivatePartiesPage from "./pages/services/PrivateParties";
import BirthdayPartiesPage from "./pages/services/BirthdayParties";
import HolidayPartiesPage from "./pages/services/HolidayParties";
import AnniversariesPage from "./pages/services/Anniversaries";
import BreweryEventsPage from "./pages/services/BreweryEvents";

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

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/faq" element={<FAQPage />} />
            <Route path="/songs" element={<SongListPage />} />
            
            {/* Service Routes */}
            <Route path="/weddings" element={<WeddingsPage />} />
            <Route path="/corporate" element={<CorporatePage />} />
            <Route path="/galas" element={<GalasPage />} />
            <Route path="/private-parties" element={<PrivatePartiesPage />} />
            <Route path="/birthday-parties" element={<BirthdayPartiesPage />} />
            <Route path="/holiday-parties" element={<HolidayPartiesPage />} />
            <Route path="/anniversaries" element={<AnniversariesPage />} />
            <Route path="/brewery-events" element={<BreweryEventsPage />} />
            
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
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
