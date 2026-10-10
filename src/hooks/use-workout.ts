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
  const lastFormCheckRef = useRef(0);
  const setCycleStartRef = useRef(Date.now());
  const workoutCompletedNotifiedRef = useRef(false);

  // ── Coach event dispatcher ─────────────────────────────────────────

  const dispatchCoachEvent = useCallback(
    async (event: string, currentMetrics?: Record<string, unknown>) => {
      try {
        const res = await getCoachFeedback({
          event,
          exercise: plan.exercise,
          metrics: currentMetrics ?? metrics,
        });
        if (res.text) {
          setCoachMessages((prev) => [
            ...prev,
            { text: res.text, audio_base64: res.audio_base64, timestamp: Date.now() },
          ]);
        }
      } catch (e) {
        console.error("Coach feedback error:", e);
      }
    },
    [plan.exercise, metrics],
  );

  // ── Workout lifecycle ──────────────────────────────────────────────

  const startWorkout = useCallback(() => {
    setPhase("active");
    lastSavedSetsRef.current = 0;
    setCycleStartRef.current = Date.now();
    workoutCompletedNotifiedRef.current = false;
    setCoachMessages([]);
    dispatchCoachEvent("workout_started", {});
  }, [dispatchCoachEvent]);

  const endWorkout = useCallback(() => {
    setPhase("idle");
    dispatchCoachEvent("workout_completed", metrics);
  }, [dispatchCoachEvent, metrics]);

  // ── Process incoming WebSocket metrics ─────────────────────────────

  const processMetrics = useCallback(
    (newMetrics: WorkoutMetrics, frame?: string) => {
      setMetrics(newMetrics);
      if (frame) setAnnotatedFrame(frame);

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

      // No pose detected notification (rate-limited by backend)
      if (!newMetrics.pose_detected) {
        dispatchCoachEvent("no_pose_detected", {
          issue: "No pose detected! Please step into the camera frame.",
        });
      }

      // Ongoing form check (throttled to every 2 seconds)
      const now = Date.now();
      if (now - lastFormCheckRef.current >= 2000) {
        lastFormCheckRef.current = now;
        dispatchCoachEvent("ongoing_form_check", newMetrics);
      }
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
