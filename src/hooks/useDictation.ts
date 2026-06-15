import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Zero-dependency speech-to-text on top of the browser-native Web Speech API
 * (`SpeechRecognition` / `webkitSpeechRecognition`). No npm dep, fully owned.
 *
 * Handles the two real-world gotchas:
 *  - **Unsupported browsers** (Firefox disables it by default) — `supported`
 *    is false; callers hide the affordance.
 *  - **Chrome's ~60s silent stop** — long dictation sessions fire `onend`
 *    without the user stopping; we auto-restart while the toggle is still on.
 *
 * Only *final* transcript segments are emitted via `onFinal` (interim results
 * are noisy + duplicate). `onInterim` is optional for a live preview.
 */

// Minimal Web Speech typings — not in the default DOM lib.
type SRAlternative = { transcript: string };
interface SRResult {
  isFinal: boolean;
  length: number;
  [index: number]: SRAlternative;
}
interface SRResultList {
  length: number;
  [index: number]: SRResult;
}
interface SREvent {
  resultIndex: number;
  results: SRResultList;
}
interface SRErrorEvent {
  error: string;
}
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SREvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: SRErrorEvent) => void) | null;
}
type SRCtor = new () => SpeechRecognitionLike;

function getSRCtor(): SRCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SRCtor;
    webkitSpeechRecognition?: SRCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** True when the current browser exposes the Web Speech API. */
export const dictationSupported = getSRCtor() !== null;

/** Append a dictated chunk to existing text with sensible spacing. */
export function appendDictation(prev: string, chunk: string): string {
  const c = chunk.trim();
  if (!c) return prev;
  if (!prev) return c;
  return /\s$/.test(prev) ? prev + c : prev + " " + c;
}

export interface UseDictationOptions {
  onFinal: (text: string) => void;
  onInterim?: (text: string) => void;
  lang?: string;
}

export interface UseDictationResult {
  supported: boolean;
  listening: boolean;
  error: string | null;
  start: () => void;
  stop: () => void;
  toggle: () => void;
}

export function useDictation(opts: UseDictationOptions): UseDictationResult {
  const { onFinal, onInterim, lang = "en-US" } = opts;
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const wantOnRef = useRef(false);
  const onFinalRef = useRef(onFinal);
  const onInterimRef = useRef(onInterim);
  onFinalRef.current = onFinal;
  onInterimRef.current = onInterim;

  const stop = useCallback(() => {
    wantOnRef.current = false;
    setListening(false);
    try {
      recRef.current?.stop();
    } catch {
      /* stop() throws if not started — ignore */
    }
  }, []);

  const start = useCallback(() => {
    const Ctor = getSRCtor();
    if (!Ctor) {
      setError("Dictation isn't supported in this browser.");
      return;
    }
    if (wantOnRef.current) return;
    setError(null);

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = lang;

    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const text = r[0]?.transcript ?? "";
        if (r.isFinal) onFinalRef.current(text);
        else interim += text;
      }
      if (interim && onInterimRef.current) onInterimRef.current(interim.trim());
    };

    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setError("Microphone permission denied.");
        wantOnRef.current = false;
        setListening(false);
      } else if (e.error !== "no-speech" && e.error !== "aborted") {
        setError(`Dictation error: ${e.error}`);
      }
    };

    rec.onend = () => {
      // Chrome silently ends long sessions (~60s). Restart while still toggled on.
      if (wantOnRef.current) {
        try {
          rec.start();
        } catch {
          /* double-start — ignore */
        }
      } else {
        setListening(false);
      }
    };

    recRef.current = rec;
    wantOnRef.current = true;
    try {
      rec.start();
      setListening(true);
    } catch {
      /* start() throws if already running — ignore */
    }
  }, [lang]);

  const toggle = useCallback(() => {
    if (wantOnRef.current) stop();
    else start();
  }, [start, stop]);

  // Stop listening + release the mic when the component unmounts.
  useEffect(
    () => () => {
      wantOnRef.current = false;
      try {
        recRef.current?.abort();
      } catch {
        /* ignore */
      }
    },
    [],
  );

  return { supported: dictationSupported, listening, error, start, stop, toggle };
}
