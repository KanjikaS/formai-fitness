import { useEffect, useRef, useState } from 'react';
import { CameraOff, Loader2 } from 'lucide-react';

const MODEL_URL = 'https://teachablemachine.withgoogle.com/models/u7-PyfCzb/';
const TFJS_SRC = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@1.3.1/dist/tf.min.js';
const TMPOSE_SRC = 'https://cdn.jsdelivr.net/npm/@teachablemachine/pose@0.8/dist/teachablemachine-pose.min.js';
const SIZE = 400;

declare global {
  interface Window {
    tmPose?: any;
  }
}

// Load each CDN script once; resolve when its onload fires. Subsequent mounts
// reuse the already-attached tag instead of duplicating it.
const scriptPromises = new Map<string, Promise<void>>();
function loadScript(src: string): Promise<void> {
  const existing = scriptPromises.get(src);
  if (existing) return existing;
  const p = new Promise<void>((resolve, reject) => {
    const tag = document.createElement('script');
    tag.src = src;
    tag.async = true;
    tag.onload = () => resolve();
    tag.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(tag);
  });
  scriptPromises.set(src, p);
  return p;
}

type Prediction = { className: string; probability: number };

export function YogaPoseDetector() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const webcamRef = useRef<any>(null);
  const modelRef = useRef<any>(null);
  const rafRef = useRef<number>(0);
  const cancelledRef = useRef(false);
  const [top, setTop] = useState<Prediction | null>(null);
  const [status, setStatus] = useState<'loading' | 'running' | 'error'>('loading');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    cancelledRef.current = false;

    async function start() {
      try {
        await loadScript(TFJS_SRC);
        await loadScript(TMPOSE_SRC);
        if (cancelledRef.current) return;

        const tmPose = window.tmPose;
        if (!tmPose) throw new Error('tmPose failed to initialize');

        const model = await tmPose.load(`${MODEL_URL}model.json`, `${MODEL_URL}metadata.json`);
        modelRef.current = model;

        const webcam = new tmPose.Webcam(SIZE, SIZE, true);
        webcamRef.current = webcam;
        await webcam.setup();
        if (cancelledRef.current) { webcam.stop(); return; }
        await webcam.play();

        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx) throw new Error('Canvas unavailable');
        setStatus('running');

        const loop = async () => {
          if (cancelledRef.current) return;
          webcam.update();
          const { pose, posenetOutput } = await model.estimatePose(webcam.canvas);
          const prediction: Prediction[] = await model.predict(posenetOutput);

          // Top class by probability (fixes the original page's parseInt-key bug).
          let best = prediction[0];
          for (const p of prediction) if (p.probability > best.probability) best = p;
          setTop(best);

          ctx.drawImage(webcam.canvas, 0, 0);
          if (pose) {
            const minPartConfidence = 0.5;
            tmPose.drawKeypoints(pose.keypoints, minPartConfidence, ctx);
            tmPose.drawSkeleton(pose.keypoints, minPartConfidence, ctx);
          }
          rafRef.current = window.requestAnimationFrame(loop);
        };
        rafRef.current = window.requestAnimationFrame(loop);
      } catch (e) {
        if (cancelledRef.current) return;
        setStatus('error');
        setError(e instanceof Error ? e.message : 'Camera or model failed to start.');
      }
    }

    start();

    return () => {
      cancelledRef.current = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      try { webcamRef.current?.stop(); } catch { /* already stopped */ }
      webcamRef.current = null;
      modelRef.current = null;
    };
  }, []);

  return (
    <div className="yoga-detector">
      <div className="camera-frame yoga-detector-frame">
        <canvas ref={canvasRef} width={SIZE} height={SIZE} className="yoga-detector-canvas" />
        {status === 'loading' && (
          <div className="yoga-detector-overlay">
            <Loader2 className="animate-spin" />
            <p>Starting camera and loading the pose model…</p>
          </div>
        )}
        {status === 'error' && (
          <div className="yoga-detector-overlay">
            <CameraOff />
            <p>{error || 'Unable to start pose detection.'}</p>
          </div>
        )}
      </div>
      {status === 'running' && top && (
        <p className="yoga-detector-label">
          Pose: <strong>{top.className}</strong> · {(top.probability * 100).toFixed(0)}%
        </p>
      )}
      <p className="health-note">
        Live pose detection runs entirely in your browser. No video is recorded or uploaded.
      </p>
    </div>
  );
}
