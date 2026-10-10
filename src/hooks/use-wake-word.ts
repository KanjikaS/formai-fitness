/**
 * useWakeWord — wake-word ("hey coach") detection via the browser-native
 * Web Speech API (SpeechRecognition / webkitSpeechRecognition).
 *
 * - No new dependencies; unsupported browsers (e.g. Firefox) report
 *   `isSupported: false` so callers can hide the feature.
 * - Runs in continuous mode with auto-restart while enabled.
 * - Fires `onWake` when an interim/final transcript contains the wake
 *   phrase (case-insensitive), then debounces briefly to avoid
 *   double-firing on repeated results for the same utterance.
 */

import { useCallback, useEffect, useRef, useState } from "react";

const WAKE_PHRASE = "hey coach";
/** Minimum ms between wake activations. */
const WAKE_DEBOUNCE_MS = 2000;

// Minimal type declarations for the Web Speech API, which is not fully
// covered by the standard TypeScript DOM lib.
interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (
    (w["SpeechRecognition"] as SpeechRecognitionCtor | undefined) ??
    (w["webkitSpeechRecognition"] as SpeechRecognitionCtor | undefined) ??
    null
  );
}

export interface UseWakeWordOptions {
  /** Called when the wake phrase is detected. */
  onWake: () => void;
  /**
   * Pause detection while true (e.g. while a question is being
   * recorded/answered) without losing the user's enabled preference.
   */
  paused?: boolean;
}

export interface UseWakeWordResult {
  /** Whether the browser supports the Web Speech API. */
  isSupported: boolean;
  /** Whether the user has enabled wake-word listening. */
  enabled: boolean;
  /** Whether the recognizer is actively listening right now. */
  listening: boolean;
  /** Toggle wake-word listening on/off. */
  toggle: () => void;
}

export function useWakeWord({ onWake, paused = false }: UseWakeWordOptions): UseWakeWordResult {
  const [isSupported] = useState(() => getSpeechRecognitionCtor() !== null);
  // Enabled by default: recognition starts on mount (the initial page
  // interaction serves as the user-gesture context). If the browser blocks
  // auto-start or permission is denied, it degrades gracefully to "off"
  // and the user can still toggle it back on manually.
  const [enabled, setEnabled] = useState(() => getSpeechRecognitionCtor() !== null);
  const [listening, setListening] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const lastWakeRef = useRef(0);
  // Keep latest callbacks/flags in refs so the recognizer's handlers
  // (attached once at start) always see current values.
  const onWakeRef = useRef(onWake);
  onWakeRef.current = onWake;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const stop = useCallback(() => {
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    if (rec) {
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try {
        rec.stop();
      } catch {
        // Ignore — may already be stopped.
      }
    }
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor || recognitionRef.current) return;

    const rec = new Ctor();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i]?.[0]?.transcript;
        if (!transcript) continue;
        if (transcript.toLowerCase().includes(WAKE_PHRASE)) {
          const now = Date.now();
          if (now - lastWakeRef.current < WAKE_DEBOUNCE_MS) return;
          lastWakeRef.current = now;
          onWakeRef.current();
          return;
        }
      }
    };

    rec.onerror = (event) => {
      // Permission denied or fatal audio errors: give up gracefully.
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setEnabled(false);
        enabledRef.current = false;
        stop();
      }
    };

    rec.onend = () => {
      // Auto-restart while still enabled and not paused; some browsers
      // end continuous recognition after a silence timeout.
      recognitionRef.current = null;
      if (enabledRef.current && !pausedRef.current) {
        start();
      } else {
        setListening(false);
      }
    };

    try {
      rec.start();
      recognitionRef.current = rec;
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [stop]);

  // Start/stop the recognizer based on enabled + paused state.
  useEffect(() => {
    if (enabled && !paused) {
      start();
    } else {
      stop();
    }
  }, [enabled, paused, start, stop]);

  // Stop on unmount.
  useEffect(() => stop, [stop]);

  const toggle = useCallback(() => {
    setEnabled((prev) => !prev);
  }, []);

  return { isSupported, enabled, listening, toggle };
}
