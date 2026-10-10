import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useRef, useEffect } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Heading, SectionTitle } from "@/components/formai/common";
import { useFormAI } from "@/components/formai/state";
import { useWorkout } from "@/hooks/use-workout";
import { CameraFeed } from "@/components/formai/gym/CameraFeed";
import { WorkoutPlanForm } from "@/components/formai/gym/WorkoutPlanForm";
import { MetricsPanel } from "@/components/formai/gym/MetricsPanel";
import { CoachChat, type CoachChatHandle } from "@/components/formai/gym/CoachChat";
import { WorkoutHistory } from "@/components/formai/gym/WorkoutHistory";
import { LoginModal } from "@/components/formai/gym/LoginModal";

export const Route = createFileRoute("/gym")({
  head: () => ({
    meta: [
      { title: "Gym — FormAI" },
      { name: "description", content: "AI-powered real-time workout with pose detection and voice coaching." },
      { property: "og:title", content: "Gym — FormAI" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Gym,
});

function Gym() {
  const { gymUser, setGymUser } = useFormAI();

  const userId = gymUser?.user_id ?? null;
  const username = gymUser?.username ?? "";

  const handleLogin = useCallback((id: number, name: string) => {
    setGymUser({ user_id: id, username: name });
  }, [setGymUser]);

  // Workout state
  const workout = useWorkout(userId);
  const coachRef = useRef<CoachChatHandle>(null);

  // Stop coach audio when workout ends
  const handleEndWorkout = useCallback(() => {
    coachRef.current?.stopAudio();
    workout.endWorkout();
  }, [workout]);

  // Also stop audio when phase transitions away from active/completed
  useEffect(() => {
    if (workout.phase === "idle") {
      coachRef.current?.stopAudio();
    }
  }, [workout.phase]);

  if (!userId) {
    return (
      <>
        <Heading
          title="AI Real-time GYM Coach"
          subtitle="Real-time pose detection with proactive AI voice coaching"
          eyebrow="GYM · AI COACH"
        />
        <LoginModal onLogin={handleLogin} />
      </>
    );
  }

  return (
    <>
      <Heading
        title="AI Real-time GYM Coach"
        subtitle={`Logged in as ${username} — Real-time pose detection with AI voice coaching`}
        eyebrow="GYM · AI COACH"
      />

      {/* Workout Plan Section */}
      <SectionTitle
        title="Workout Plan"
        subtitle="Choose your exercise, sets and reps, then start your workout."
      />
      <div className="panel">
        <WorkoutPlanForm
          exercise={workout.plan.exercise}
          sets={workout.plan.sets}
          repsPerSet={workout.plan.repsPerSet}
          active={workout.phase === "active"}
          onExerciseChange={(v) => workout.setPlan((p) => ({ ...p, exercise: v }))}
          onSetsChange={(v) => workout.setPlan((p) => ({ ...p, sets: v }))}
          onRepsChange={(v) => workout.setPlan((p) => ({ ...p, repsPerSet: v }))}
          onStart={workout.startWorkout}
          onEnd={handleEndWorkout}
        />
      </div>

      {/* Camera + Metrics (visible during workout) */}
      {workout.phase === "active" && (
        <div className="workout-session">
          <div className="workout-main">
            <CameraFeed
              exercise={workout.plan.exercise}
              active={workout.phase === "active"}
              onMetrics={workout.processMetrics}
            />
          </div>
          <div className="workout-sidebar">
            <MetricsPanel
              exercise={workout.plan.exercise}
              metrics={workout.metrics}
              totalReps={workout.totalReps}
              setsCompleted={workout.setsCompleted}
              currentSetReps={workout.currentSetReps}
              targetSets={workout.plan.sets}
              repsPerSet={workout.plan.repsPerSet}
            />
            <div className="mt-4">
              <CoachChat
                ref={coachRef}
                messages={workout.coachMessages}
                exercise={workout.plan.exercise}
                metrics={workout.metrics}
              />
            </div>
          </div>
        </div>
      )}

      {/* Workout complete banner */}
      {workout.phase === "completed" && (
        <div className="workout-complete-banner">
          <Check size={24} />
          <div>
            <h3>Workout Complete! 🎉</h3>
            <p>
              {workout.plan.exercise} — {workout.totalReps} total reps across {workout.setsCompleted} sets.
            </p>
          </div>
          <Button onClick={handleEndWorkout}>Back to Plan</Button>
        </div>
      )}

      {/* Workout History */}
      <div className="mt-8">
        <SectionTitle
          title="Workout History"
          subtitle="Your past exercise sessions."
        />
        <WorkoutHistory userId={userId} />
      </div>

      <style>{`
        .workout-active-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0;
        }
        .workout-info {
          display: flex;
          gap: 12px;
          align-items: center;
          font-size: 14px;
        }
        .workout-info strong { font-size: 16px; }
        .workout-session {
          display: grid;
          grid-template-columns: 1.5fr 1fr;
          gap: 24px;
          margin-top: 24px;
        }
        .workout-main { min-width: 0; }
        .workout-sidebar { min-width: 0; }
        .workout-complete-banner {
          display: flex;
          align-items: center;
          gap: 16px;
          background: var(--sage);
          border-radius: 8px;
          padding: 20px 24px;
          margin-top: 24px;
        }
        .workout-complete-banner h3 { font-size: 18px; }
        .workout-complete-banner p { font-size: 13px; color: var(--muted-foreground); margin-top: 4px; }
        .workout-complete-banner > div { flex: 1; }
        @media (max-width: 900px) {
          .workout-session { grid-template-columns: 1fr; }
        }
      `}</style>
    </>
  );
}
