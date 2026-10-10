/**
 * Coach chat panel — displays AI coaching messages with audio playback.
 *
 * Shows the latest coach feedback as text and auto-plays audio.
 * Includes a mic button for asking free-form questions via STT.
 * Only one audio plays at a time; audio stops on workout end or mic start.
 */

import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from "react";
import { Bot, Mic, MicOff, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { speechToText, askCoach } from "@/lib/api";
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

export const CoachChat = forwardRef<CoachChatHandle, CoachChatProps>(
  function CoachChat({ messages, exercise, metrics }, ref) {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [recording, setRecording] = useState(false);
    const [asking, setAsking] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
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

    const toggleRecording = useCallback(async () => {
      if (recording) {
        mediaRecorderRef.current?.stop();
        setRecording(false);
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
      } catch (e) {
        console.error("Mic access denied:", e);
      }
    }, [recording, exercise, metrics, stopAudio, playAudio]);

    return (
      <div className="coach-chat">
        <div className="coach-header">
          <Bot size={18} />
          <h3>AI Coach</h3>
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
        `}</style>
      </div>
    );
  },
);
