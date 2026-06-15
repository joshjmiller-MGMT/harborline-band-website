import { useCallback, useEffect, useRef, useState } from "react";

// ─── Minimal Web Speech API typings ─────────────────────────────────────
// The DOM lib doesn't ship SpeechRecognition types, so declare the slice we use.
interface SpeechRecognitionAlternative {
  transcript: string;
}
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
}
interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface UseDictationOptions {
  /** Fired with each finalized chunk of transcript (already trimmed). */
  onFinalResult: (text: string) => void;
  /** Optional: fired with the live interim (not-yet-final) transcript. */
  onInterim?: (text: string) => void;
  lang?: string;
}

export interface UseDictation {
  supported: boolean;
  listening: boolean;
  error: string | null;
  start: () => void;
  stop: () => void;
  toggle: () => void;
}

/**
 * Zero-dependency Web Speech API wrapper for push-to-dictate text entry.
 *
 * Handles the two gotchas that make hand-rolling annoying:
 *  - Chrome silently stops `continuous` recognition after ~60s (fires `onend`);
 *    we auto-restart while the user still has the mic toggled on.
 *  - Interim vs final results: only final chunks are committed via
 *    `onFinalResult`; interim text streams through `onInterim` for a live hint.
 *
 * Firefox (and any browser without SpeechRecognition) reports `supported:false`
 * so the caller can hide the control.
 */
export function useDictation({
  onFinalResult,
  onInterim,
  lang = "en-US",
}: UseDictationOptions): UseDictation {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  // Tracks whether the user *wants* to be listening, so onend can auto-restart.
  const wantListeningRef = useRef(false);

  // Keep latest callbacks in refs so we don't rebuild the recognition instance.
  const onFinalRef = useRef(onFinalResult);
  const onInterimRef = useRef(onInterim);
  useEffect(() => {
    onFinalRef.current = onFinalResult;
    onInterimRef.current = onInterim;
  }, [onFinalResult, onInterim]);

  const supported = getRecognitionCtor() !== null;

  useEffect(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;

    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) {
          const trimmed = text.trim();
          if (trimmed) onFinalRef.current(trimmed);
        } else {
          interim += text;
        }
      }
      onInterimRef.current?.(interim.trim());
    };

    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      // "no-speech" / "aborted" are benign; surface the rest.
      if (e.error === "no-speech" || e.error === "aborted") return;
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        wantListeningRef.current = false;
        setError("Microphone permission denied.");
        setListening(false);
        return;
      }
      setError(`Dictation error: ${e.error}`);
    };

    rec.onend = () => {
      // Chrome auto-stops ~60s; restart if the user still wants to listen.
      if (wantListeningRef.current) {
        try {
          rec.start();
        } catch {
          // start() throws if called too soon after end; ignore — next onend retries.
        }
      } else {
        setListening(false);
      }
    };

    recognitionRef.current = rec;
    return () => {
      wantListeningRef.current = false;
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try {
        rec.abort();
      } catch {
        /* noop */
      }
      recognitionRef.current = null;
    };
  }, [lang]);

  const start = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec || wantListeningRef.current) return;
    setError(null);
    wantListeningRef.current = true;
    try {
      rec.start();
      setListening(true);
    } catch {
      // Already started — keep going.
      setListening(true);
    }
  }, []);

  const stop = useCallback(() => {
    const rec = recognitionRef.current;
    wantListeningRef.current = false;
    setListening(false);
    if (rec) {
      try {
        rec.stop();
      } catch {
        /* noop */
      }
    }
  }, []);

  const toggle = useCallback(() => {
    if (wantListeningRef.current) stop();
    else start();
  }, [start, stop]);

  return { supported, listening, error, start, stop, toggle };
}
