/**
 * Workout session state management hook.
 *
 * Manages the full workout lifecycle: plan setup, live metrics from the
 * WebSocket, set/rep tracking, coach event dispatching, and history saving.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { saveExercise, getCoachFeedback } from "@/lib/api";

export interface WorkoutPlan {
  exercise: string;
  sets: number;
  repsPerSet: number;
}

export interface WorkoutMetrics {
  reps: number;
  pose_detected: boolean;
  [key: string]: unknown;
}

export interface CoachMessage {
  text: string;
  audio_base64: string | null;
  timestamp: number;
}

export type WorkoutPhase = "idle" | "active" | "completed";

const FRAME_INTERVAL_MS = 100; // ~10 fps capture rate

/** Speak payload pushed by the backend over the video WebSocket. */
export interface SpeakPayload {
  id: number;
  text: string;
  audio_base64: string | null;
}

export function useWorkout(userId: number | null) {
  const [plan, setPlan] = useState<WorkoutPlan>({
    exercise: "Squats",
    sets: 3,
    repsPerSet: 10,
  });
  const [phase, setPhase] = useState<WorkoutPhase>("idle");
  const [metrics, setMetrics] = useState<WorkoutMetrics>({ reps: 0, pose_detected: false });
  const [coachMessages, setCoachMessages] = useState<CoachMessage[]>([]);
  const [annotatedFrame, setAnnotatedFrame] = useState<string | null>(null);

  // Derived state
  const totalReps = metrics.reps ?? 0;
  const setsCompleted = plan.repsPerSet > 0 ? Math.floor(totalReps / plan.repsPerSet) : 0;
  const currentSetReps = plan.repsPerSet > 0 ? totalReps % plan.repsPerSet : 0;
  const workoutComplete = setsCompleted >= plan.sets && plan.sets > 0;

  // Track what we've already saved/notified
  const lastSavedSetsRef = useRef(0);
  const setCycleStartRef = useRef(Date.now());
  const workoutCompletedNotifiedRef = useRef(false);
  // Latest speak payload id consumed from the WebSocket (dedupe).
  const lastSpeakIdRef = useRef(0);

  // ── Coach event dispatcher ─────────────────────────────────────────
  // Fire-and-forget POST for MAJOR events (workout_started,
  // set_completed, workout_completed) — the backend generates LLM
  // feedback asynchronously. Minor form-issue cues no longer use HTTP:
  // the backend detects them per frame and pushes canned cues over the
  // WebSocket itself ("speak" payloads), skipping the LLM entirely.

  const dispatchCoachEvent = useCallback(
    (event: string, currentMetrics?: Record<string, unknown>) => {
      getCoachFeedback({
        event,
        exercise: plan.exercise,
        metrics: currentMetrics ?? metrics,
      })
        .then((res) => {
          if (res.text) {
            setCoachMessages((prev) => [
              ...prev,
              { text: res.text, audio_base64: res.audio_base64, timestamp: Date.now() },
            ]);
          }
        })
        .catch((e) => console.error("Coach feedback error:", e));
    },
    [plan.exercise, metrics],
  );

  // ── Workout lifecycle ──────────────────────────────────────────────

  const startWorkout = useCallback(() => {
    setPhase("active");
    lastSavedSetsRef.current = 0;
    setCycleStartRef.current = Date.now();
    workoutCompletedNotifiedRef.current = false;
    lastSpeakIdRef.current = 0;
    setCoachMessages([]);
    dispatchCoachEvent("workout_started", {});
  }, [dispatchCoachEvent]);

  const endWorkout = useCallback(() => {
    setPhase("idle");
    dispatchCoachEvent("workout_completed", metrics);
  }, [dispatchCoachEvent, metrics]);

  // ── Process incoming WebSocket metrics ─────────────────────────────

  const processMetrics = useCallback(
    (newMetrics: WorkoutMetrics, frame?: string, speak?: SpeakPayload) => {
      setMetrics(newMetrics);
      if (frame) setAnnotatedFrame(frame);

      // Instant form cue pushed over the WebSocket (dedupe by id).
      if (speak && speak.id > lastSpeakIdRef.current) {
        lastSpeakIdRef.current = speak.id;
        setCoachMessages((prev) => [
          ...prev,
          { text: speak.text, audio_base64: speak.audio_base64, timestamp: Date.now() },
        ]);
      }

      if (phase !== "active" || !userId) return;

      const reps = newMetrics.reps ?? 0;
      if (plan.repsPerSet <= 0 || plan.sets <= 0) return;

      const sets = Math.floor(reps / plan.repsPerSet);

      // Save newly completed sets to DB and notify coach
      if (sets > lastSavedSetsRef.current) {
        const newlyCompleted = sets - lastSavedSetsRef.current;
        const timeTaken = Math.round((Date.now() - setCycleStartRef.current) / 1000);

        saveExercise({
          user_id: userId,
          exercise_name: plan.exercise,
          reps: newlyCompleted * plan.repsPerSet,
          sets: newlyCompleted,
          time: timeTaken,
        }).catch(console.error);

        dispatchCoachEvent("set_completed", newMetrics);

        setCycleStartRef.current = Date.now();
        lastSavedSetsRef.current = sets;
      }

      // Workout completed notification (once)
      if (sets >= plan.sets && !workoutCompletedNotifiedRef.current) {
        workoutCompletedNotifiedRef.current = true;
        setPhase("completed");
        dispatchCoachEvent("workout_completed", newMetrics);
      }

      // NOTE: form issues and no-pose cues arrive via WebSocket "speak"
      // payloads — no HTTP dispatch needed here anymore.
    },
    [phase, userId, plan, dispatchCoachEvent],
  );

  // Reset when exercise changes
  useEffect(() => {
    lastSavedSetsRef.current = 0;
    setCycleStartRef.current = Date.now();
    workoutCompletedNotifiedRef.current = false;
  }, [plan.exercise]);

  return {
    plan,
    setPlan,
    phase,
    metrics,
    coachMessages,
    annotatedFrame,
    totalReps,
    setsCompleted,
    currentSetReps,
    workoutComplete,
    startWorkout,
    endWorkout,
    processMetrics,
  };
}
