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
import WeddingsPage from "./pages/services/Weddings";
import CorporatePage from "./pages/services/Corporate";
import GalasPage from "./pages/services/Galas";
import PrivatePartiesPage from "./pages/services/PrivateParties";
import BaltimorePage from "./pages/locations/Baltimore";
import TowsonPage from "./pages/locations/Towson";
import ColumbiaPage from "./pages/locations/Columbia";
import AnnapolisPage from "./pages/locations/Annapolis";

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
            <Route path="/weddings" element={<WeddingsPage />} />
            <Route path="/corporate" element={<CorporatePage />} />
            <Route path="/galas" element={<GalasPage />} />
            <Route path="/private-parties" element={<PrivatePartiesPage />} />
            <Route path="/locations/baltimore" element={<BaltimorePage />} />
            <Route path="/locations/towson" element={<TowsonPage />} />
            <Route path="/locations/columbia" element={<ColumbiaPage />} />
            <Route path="/locations/annapolis" element={<AnnapolisPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
