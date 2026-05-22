import { Loader2 } from "lucide-react";
import logoText from "@/assets/logo-text.png";

const PageLoadingSpinner = () => (
  <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background gap-6">
    <img src={logoText} alt="Harborline" className="h-8 w-auto opacity-80" />
    <Loader2 className="h-6 w-6 text-primary animate-spin" aria-hidden="true" />
    <span className="sr-only">Loading…</span>
  </div>
);

export default PageLoadingSpinner;
