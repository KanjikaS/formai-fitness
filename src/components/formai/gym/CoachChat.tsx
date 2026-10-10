/**
 * Coach chat panel — displays AI coaching messages with audio playback.
 *
 * Shows the latest coach feedback as text and auto-plays audio.
 * Includes a mic button for asking free-form questions via STT.
 * Only one audio plays at a time; audio stops on workout end or mic start.
 */

import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from "react";
import { Bot, Ear, Mic, MicOff, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { speechToText, askCoach } from "@/lib/api";
import { useWakeWord } from "@/hooks/use-wake-word";
import type { CoachMessage } from "@/hooks/use-workout";

export interface CoachChatHandle {
  /** Stop any currently playing coach audio. */
  stopAudio: () => void;
}

interface CoachChatProps {
  messages: CoachMessage[];
  exercise: string;
  metrics: Record<string, unknown>;
}

// Silence auto-stop tuning for question recording.
/** Sample rate for the audio level monitor (ms). */
const LEVEL_SAMPLE_MS = 100;
/** RMS (0..1) above which audio counts as speech. */
const SPEECH_RMS_THRESHOLD = 0.02;
/** Min. continuous speech before silence can trigger auto-stop (ms). */
const MIN_SPEECH_MS = 300;
/** Continuous silence after speech that triggers auto-stop (ms). */
const SILENCE_TIMEOUT_MS = 1500;
/** Hard cap on a single question recording (ms). */
const MAX_RECORDING_MS = 30_000;

export const CoachChat = forwardRef<CoachChatHandle, CoachChatProps>(
  function CoachChat({ messages, exercise, metrics }, ref) {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [recording, setRecording] = useState(false);
    const [asking, setAsking] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const monitorIntervalRef = useRef<number | null>(null);
    const monitorCtxRef = useRef<AudioContext | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    /** Stop and clear any playing audio. */
    const stopAudio = useCallback(() => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
    }, []);

    // Expose stopAudio to parent
    useImperativeHandle(ref, () => ({ stopAudio }), [stopAudio]);

    /** Play audio from base64, stopping any current playback first. */
    const playAudio = useCallback(
      (base64: string) => {
        stopAudio();
        const audio = new Audio(`data:audio/mp3;base64,${base64}`);
        audioRef.current = audio;
        audio.play().catch(() => {});
      },
      [stopAudio],
    );

    // Auto-play latest message audio
    useEffect(() => {
      const latest = messages[messages.length - 1];
      if (!latest?.audio_base64) return;
      playAudio(latest.audio_base64);
    }, [messages, playAudio]);

    // Scroll to bottom on new message
    useEffect(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    /** Tear down the silence monitor (interval + AudioContext). */
    const cleanupMonitor = useCallback(() => {
      if (monitorIntervalRef.current !== null) {
        clearInterval(monitorIntervalRef.current);
        monitorIntervalRef.current = null;
      }
      if (monitorCtxRef.current) {
        monitorCtxRef.current.close().catch(() => {});
        monitorCtxRef.current = null;
      }
    }, []);

    /**
     * Stop the current recording — used by BOTH the manual "Stop" button
     * and the silence auto-stop. Single cleanup path: tears down the
     * monitor, then stops the MediaRecorder (its onstop handler runs the
     * STT → askCoach → play flow).
     */
    const stopRecording = useCallback(() => {
      cleanupMonitor();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      setRecording(false);
    }, [cleanupMonitor]);

    /**
     * Monitor mic levels on the recording stream and auto-stop after a
     * major pause: SILENCE_TIMEOUT_MS of continuous silence, but only once
     * at least MIN_SPEECH_MS of speech has been detected (never
     * instant-stops). A MAX_RECORDING_MS hard cap acts as a safety net.
     */
    const startSilenceMonitor = useCallback(
      (stream: MediaStream) => {
        try {
          const Ctx =
            window.AudioContext ??
            (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
          if (!Ctx) return;

          const ctx = new Ctx();
          monitorCtxRef.current = ctx;
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 512;
          ctx.createMediaStreamSource(stream).connect(analyser);
          const samples = new Float32Array(analyser.fftSize);

          let speechMs = 0;
          let silenceMs = 0;
          let elapsedMs = 0;

          monitorIntervalRef.current = window.setInterval(() => {
            elapsedMs += LEVEL_SAMPLE_MS;
            if (elapsedMs >= MAX_RECORDING_MS) {
              stopRecording();
              return;
            }

            analyser.getFloatTimeDomainData(samples);
            let sum = 0;
            for (let i = 0; i < samples.length; i++) {
              const s = samples[i] ?? 0;
              sum += s * s;
            }
            const rms = Math.sqrt(sum / samples.length);

            if (rms >= SPEECH_RMS_THRESHOLD) {
              speechMs += LEVEL_SAMPLE_MS;
              silenceMs = 0;
            } else {
              silenceMs += LEVEL_SAMPLE_MS;
            }

            if (speechMs >= MIN_SPEECH_MS && silenceMs >= SILENCE_TIMEOUT_MS) {
              stopRecording();
            }
          }, LEVEL_SAMPLE_MS);
        } catch {
          // Level monitoring unavailable — recording still works with the
          // manual Stop button.
        }
      },
      [stopRecording],
    );

    // Clean up monitor + recorder on unmount.
    useEffect(() => {
      return () => {
        cleanupMonitor();
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
        }
      };
    }, [cleanupMonitor]);

    const toggleRecording = useCallback(async () => {
      if (recording) {
        stopRecording();
        return;
      }

      // Stop coach audio before listening to user
      stopAudio();

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
        mediaRecorderRef.current = recorder;
        chunksRef.current = [];

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          if (blob.size === 0) return;

          setAsking(true);
          try {
            const { text: question } = await speechToText(blob);
            if (question.trim()) {
              const context = `Exercise: ${exercise}. Current metrics: ${JSON.stringify(metrics)}`;
              const res = await askCoach({ question, context });
              if (res.audio_base64) {
                playAudio(res.audio_base64);
              }
            }
          } catch (e) {
            console.error("Ask coach error:", e);
          } finally {
            setAsking(false);
          }
        };

        recorder.start();
        setRecording(true);
        startSilenceMonitor(stream);
      } catch (e) {
        console.error("Mic access denied:", e);
      }
    }, [recording, exercise, metrics, stopAudio, playAudio, stopRecording, startSilenceMonitor]);

    // Wake-word: pause detection while recording/answering to avoid mic
    // interference, then resume automatically once the answer finishes.
    const wakePaused = recording || asking;
    const handleWake = useCallback(() => {
      if (wakePaused) return;
      // Same path as the explicit "Ask Coach" button.
      toggleRecording();
    }, [wakePaused, toggleRecording]);

    const wakeWord = useWakeWord({ onWake: handleWake, paused: wakePaused });

    return (
      <div className="coach-chat">
        <div className="coach-header">
          <Bot size={18} />
          <h3>AI Coach</h3>
          <Button
            variant={wakeWord.enabled ? "default" : "outline"}
            size="sm"
            onClick={wakeWord.toggle}
            disabled={!wakeWord.isSupported}
            title={
              !wakeWord.isSupported
                ? '"Hey Coach" voice activation is not supported in this browser'
                : wakeWord.enabled
                  ? 'Disable "Hey Coach" voice activation'
                  : 'Enable "Hey Coach" voice activation'
            }
          >
            <Ear size={14} className={wakeWord.listening ? "wake-listening" : undefined} />
            Hey Coach
          </Button>
          <Button
            variant={recording ? "destructive" : "outline"}
            size="sm"
            onClick={toggleRecording}
            disabled={asking}
          >
            {recording ? <MicOff size={14} /> : <Mic size={14} />}
            {asking ? "Thinking..." : recording ? "Stop" : "Ask Coach"}
          </Button>
        </div>

        <div className="coach-messages">
          {messages.length === 0 && (
            <p className="coach-empty">Start a workout to get AI coaching feedback.</p>
          )}
          {messages.map((msg, i) => (
            <div key={i} className="coach-message">
              <div className="coach-message-text">{msg.text}</div>
              {msg.audio_base64 && (
                <button
                  className="coach-replay"
                  onClick={() => playAudio(msg.audio_base64!)}
                  title="Replay audio"
                >
                  <Volume2 size={14} />
                </button>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <style>{`
          .coach-chat {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 8px;
            display: flex;
            flex-direction: column;
            max-height: 400px;
          }
          .coach-header {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 14px 16px;
            border-bottom: 1px solid var(--border);
          }
          .coach-header h3 { font-size: 15px; flex: 1; }
          .coach-messages {
            flex: 1;
            overflow-y: auto;
            padding: 12px 16px;
            display: flex;
            flex-direction: column;
            gap: 10px;
          }
          .coach-empty {
            font-size: 12px;
            color: var(--muted-foreground);
            text-align: center;
            padding: 20px;
          }
          .coach-message {
            display: flex;
            align-items: flex-start;
            gap: 8px;
            background: var(--secondary);
            border-radius: 6px;
            padding: 10px 12px;
            font-size: 13px;
            line-height: 1.5;
          }
          .coach-message-text { flex: 1; }
          .coach-replay {
            background: none;
            border: none;
            cursor: pointer;
            color: var(--primary);
            padding: 2px;
          }
          .wake-listening {
            animation: wake-pulse 1.6s ease-in-out infinite;
          }
          @keyframes wake-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.35; }
          }
        `}</style>
      </div>
    );
  },
);
