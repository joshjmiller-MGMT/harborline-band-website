import { useEffect } from "react";
import { Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useDictation } from "@/hooks/useDictation";

/**
 * Mic toggle for dictating into a text field. Wire `onText` to append the
 * recognized speech into the target field's state (see `appendDictation`).
 *
 * Renders nothing on browsers without the Web Speech API (e.g. Firefox), so
 * callers don't need their own support check — just drop it next to a field.
 */
export function MicButton({
  onText,
  label = false,
  className,
  title = "Dictate",
}: {
  onText: (chunk: string) => void;
  /** Show a "Dictate"/"Listening…" text label next to the icon. */
  label?: boolean;
  className?: string;
  title?: string;
}) {
  const { supported, listening, error, toggle } = useDictation({ onFinal: onText });

  useEffect(() => {
    if (error) {
      toast({ title: "Dictation", description: error, variant: "destructive" });
    }
  }, [error]);

  if (!supported) return null;

  return (
    <Button
      type="button"
      variant={listening ? "secondary" : "ghost"}
      size={label ? "sm" : "icon"}
      onClick={toggle}
      aria-pressed={listening}
      title={listening ? "Stop dictation" : title}
      className={cn(listening && "text-red-500", className)}
    >
      <Mic className={cn("w-4 h-4", listening && "animate-pulse")} />
      {label && (
        <span className="ml-1.5 text-xs">{listening ? "Listening…" : "Dictate"}</span>
      )}
    </Button>
  );
}
