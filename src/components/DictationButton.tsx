import { useCallback, useEffect, useRef } from "react";
import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDictation } from "@/hooks/useDictation";

type FieldEl = HTMLTextAreaElement | HTMLInputElement;

interface DictationButtonProps {
  /** Ref to the controlled textarea/input the transcript inserts into. */
  targetRef: React.RefObject<FieldEl>;
  /** Current field value (so we can splice the transcript at the caret). */
  value: string;
  /** Called with the new value after a transcript chunk is inserted. */
  onValueChange: (next: string) => void;
  /** Hint shown in the button title / aria-label. */
  label?: string;
  className?: string;
  disabled?: boolean;
}

/** Join two text fragments with a single space unless one side already has whitespace/punctuation. */
function joinWithSpace(before: string, insert: string): string {
  if (!before) return insert;
  if (/\s$/.test(before)) return before + insert;
  if (/^[.,!?;:]/.test(insert)) return before + insert;
  return before + " " + insert;
}

/**
 * Mic toggle that dictates speech into a controlled text field via the Web
 * Speech API. Renders nothing when the browser has no SpeechRecognition (e.g.
 * Firefox) so callers can drop it next to any qualifying input unconditionally.
 *
 * Transcript chunks insert at the current caret position; the caret is moved to
 * the end of the inserted text so successive chunks chain naturally.
 */
export function DictationButton({
  targetRef,
  value,
  onValueChange,
  label = "Dictate",
  className,
  disabled,
}: DictationButtonProps) {
  // Remember where to drop the caret after a controlled re-render.
  const pendingCaretRef = useRef<number | null>(null);
  // Latest value, so the onFinalResult closure always splices fresh text.
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const insertText = useCallback(
    (text: string) => {
      const el = targetRef.current;
      const current = valueRef.current;
      // Caret-aware splice when we have a focused field with a selection;
      // otherwise append to the end.
      const hasCaret =
        el && typeof el.selectionStart === "number" && document.activeElement === el;
      const start = hasCaret ? (el.selectionStart ?? current.length) : current.length;
      const end = hasCaret ? (el.selectionEnd ?? start) : current.length;

      const head = current.slice(0, start);
      const tail = current.slice(end);
      const joinedHead = joinWithSpace(head, text);
      const next = joinedHead + tail;
      pendingCaretRef.current = joinedHead.length;
      valueRef.current = next;
      onValueChange(next);
    },
    [targetRef, onValueChange],
  );

  const { supported, listening, error, toggle } = useDictation({
    onFinalResult: insertText,
  });

  // Apply the pending caret position after the controlled value updates.
  useEffect(() => {
    const caret = pendingCaretRef.current;
    const el = targetRef.current;
    if (caret == null || !el) return;
    pendingCaretRef.current = null;
    requestAnimationFrame(() => {
      try {
        el.focus();
        el.setSelectionRange(caret, caret);
      } catch {
        /* input type may not support selection range — ignore */
      }
    });
  }, [value, targetRef]);

  if (!supported) return null;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      disabled={disabled}
      onClick={toggle}
      title={error ?? (listening ? "Stop dictation" : label)}
      aria-label={listening ? "Stop dictation" : label}
      aria-pressed={listening}
      className={cn(
        "h-8 w-8 text-muted-foreground hover:text-foreground",
        listening && "text-red-500 hover:text-red-500",
        className,
      )}
    >
      {listening ? (
        <span className="relative flex items-center justify-center">
          <Mic className="w-4 h-4" />
          <span className="absolute -right-1 -top-1 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
          </span>
        </span>
      ) : (
        <MicOff className="w-4 h-4" />
      )}
    </Button>
  );
}
