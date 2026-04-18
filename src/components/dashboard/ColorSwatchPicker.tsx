import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, RotateCcw } from "lucide-react";

// Curated palette covering common calendar source colors plus warm/cool
// alternates so users have meaningful variety without an open-ended picker.
export const COLOR_PALETTE: string[] = [
  "#ddd6fe", "#a78bfa", "#8b5cf6", "#6d28d9",
  "#a5b4fc", "#6366f1", "#4338ca", "#1e3a8a",
  "#93c5fd", "#3b82f6", "#0ea5e9", "#0369a1",
  "#67e8f9", "#06b6d4", "#0d9488", "#134e4a",
  "#86efac", "#10b981", "#22c55e", "#15803d",
  "#bef264", "#84cc16", "#65a30d", "#3f6212",
  "#fde68a", "#eab308", "#f59e0b", "#b45309",
  "#fdba74", "#f97316", "#ea580c", "#9a3412",
  "#fca5a5", "#ef4444", "#dc2626", "#7f1d1d",
  "#fbcfe8", "#ec4899", "#db2777", "#9d174d",
  "#f0abfc", "#d946ef", "#a21caf", "#581c87",
  "#cbd5e1", "#64748b", "#475569", "#1e293b",
];

type Props = {
  color: string;
  hasOverride?: boolean;
  onChange: (color: string) => void;
  onReset?: () => void;
  shape?: "block" | "circle";
  size?: number;
  children?: React.ReactNode;
  title?: string;
  dimmed?: boolean;
};

export default function ColorSwatchPicker({
  color,
  hasOverride,
  onChange,
  onReset,
  shape = "block",
  size = 20,
  children,
  title,
  dimmed,
}: Props) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          title={title || "Change color"}
          aria-label={title || "Change color"}
          className={`shrink-0 inline-flex items-center justify-center text-[10px] font-bold text-white transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring ${
            shape === "circle" ? "rounded-full" : "rounded"
          }`}
          style={{
            backgroundColor: color,
            width: size,
            height: size,
            opacity: dimmed ? 0.4 : 1,
          }}
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-2"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grid grid-cols-8 gap-1.5">
          {COLOR_PALETTE.map((c) => {
            const selected = c.toLowerCase() === color.toLowerCase();
            return (
              <button
                key={c}
                type="button"
                onClick={() => onChange(c)}
                className="w-6 h-6 rounded flex items-center justify-center hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-ring"
                style={{ backgroundColor: c }}
                title={c}
                aria-label={`Set color ${c}`}
              >
                {selected && <Check className="w-3.5 h-3.5 text-white drop-shadow" />}
              </button>
            );
          })}
        </div>
        {hasOverride && onReset && (
          <button
            type="button"
            onClick={onReset}
            className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1 rounded hover:bg-muted/50"
          >
            <RotateCcw className="w-3 h-3" /> Reset to default
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
