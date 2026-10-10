/**
 * Live camera feed with WebSocket pose detection.
 *
 * Captures video from the user's camera, sends frames to the backend
 * via WebSocket, and displays the annotated result overlaid on the
 * live video.
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { Camera, CameraOff } from "lucide-react";
import { useWebSocket } from "@/hooks/use-websocket";
import type { WorkoutMetrics } from "@/hooks/use-workout";

const WS_URL = "ws://localhost:8000/ws/video";
const CAPTURE_WIDTH = 640;
const CAPTURE_HEIGHT = 480;
const FRAME_INTERVAL_MS = 100;

interface SpeakPayload {
  id: number;
  text: string;
  audio_base64: string | null;
}

interface WSResponse {
  frame?: string;
  metrics?: WorkoutMetrics;
  speak?: SpeakPayload;
  error?: string;
}

interface CameraFeedProps {
  exercise: string;
  active: boolean;
  onMetrics: (metrics: WorkoutMetrics, frame?: string, speak?: SpeakPayload) => void;
}

export function CameraFeed({ exercise, active, onMetrics }: CameraFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [annotatedSrc, setAnnotatedSrc] = useState<string | null>(null);

  const { status, lastMessage, send } = useWebSocket<WSResponse>(active ? WS_URL : null);

  // Start/stop camera
  useEffect(() => {
    if (!active) {
      stopCamera();
      return;
    }
    startCamera();
    return stopCamera;
  }, [active]);

  // Process WebSocket responses
  useEffect(() => {
    if (!lastMessage) return;
    if (lastMessage.error) {
      console.error("WS error:", lastMessage.error);
      return;
    }
    if (lastMessage.frame) {
      setAnnotatedSrc(`data:image/jpeg;base64,${lastMessage.frame}`);
    }
    if (lastMessage.metrics) {
      onMetrics(lastMessage.metrics, lastMessage.frame, lastMessage.speak);
    }
  }, [lastMessage, onMetrics]);

  // Send frames when camera is on and WS is open
  useEffect(() => {
    if (status !== "open" || !active || !cameraOn) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      captureAndSend();
    }, FRAME_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [status, active, cameraOn, exercise]);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: CAPTURE_WIDTH, height: CAPTURE_HEIGHT, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraOn(true);
      }
    } catch (e) {
      console.error("Camera access denied:", e);
    }
  }

  function stopCamera() {
    setCameraOn(false);
    setAnnotatedSrc(null);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  const captureAndSend = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    canvas.width = CAPTURE_WIDTH;
    canvas.height = CAPTURE_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, CAPTURE_WIDTH, CAPTURE_HEIGHT);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
    const base64 = dataUrl.split(",")[1];

    send({ frame: base64, exercise });
  }, [exercise, send]);

  if (!active) return null;

  return (
    <div className="camera-feed">
      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {!cameraOn && (
        <div className="camera-placeholder">
          {status === "error" ? (
            <>
              <CameraOff size={38} />
              <p>Could not connect to backend. Is the server running?</p>
            </>
          ) : (
            <>
              <Camera size={38} />
              <p>Starting camera...</p>
            </>
          )}
        </div>
      )}

      {/* Live video — always visible when camera is on */}
      <video
        ref={videoRef}
        style={{ display: cameraOn ? "block" : "none" }}
        className="camera-video"
        muted
        playsInline
      />

      {/* Annotated frame overlay from backend */}
      {cameraOn && annotatedSrc && (
        <img
          src={annotatedSrc}
          alt="Pose detection"
          className="camera-annotated"
        />
      )}

      <style>{`
        .camera-feed {
          width: 100%;
          max-width: 640px;
          border-radius: 8px;
          overflow: hidden;
          background: #000;
          aspect-ratio: 4/3;
          position: relative;
        }
        .camera-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transform: scaleX(-1); /* mirror */
        }
        .camera-annotated {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .camera-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          gap: 15px;
          color: #888;
          font-size: 14px;
        }
      `}</style>
    </div>
  );
}
