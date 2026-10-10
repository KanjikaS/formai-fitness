/**
 * Workout plan form — exercise selection, sets/reps inputs, and start/end controls.
 *
 * Shown before and during a workout session.
 */

import { Button } from "@/components/ui/button";
import { Play, Square, TriangleAlert } from "lucide-react";
import { useFormAI } from "@/components/formai/state";

const EXERCISE_OPTIONS = [
  "Squats",
  "Push-ups",
  "Biceps Curls (Dumbbell)",
  "Shoulder Press",
  "Lunges",
];

interface WorkoutPlanFormProps {
  exercise: string;
  sets: number;
  repsPerSet: number;
  active: boolean;
  onExerciseChange: (v: string) => void;
  onSetsChange: (v: number) => void;
  onRepsChange: (v: number) => void;
  onStart: () => void;
  onEnd: () => void;
}

export function WorkoutPlanForm({
  exercise,
  sets,
  repsPerSet,
  active,
  onExerciseChange,
  onSetsChange,
  onRepsChange,
  onStart,
  onEnd,
}: WorkoutPlanFormProps) {
  const { profile } = useFormAI();
  const restricted = profile.restrictedExercises ?? [];
  const restrictedSelected = restricted.includes(exercise);
  if (active) {
    return (
      <div className="workout-active-bar">
        <div className="workout-info">
          <strong>{exercise}</strong>
          <span>{sets} sets × {repsPerSet} reps</span>
        </div>
        <Button variant="destructive" onClick={onEnd}>
          <Square size={16} /> End Workout
        </Button>
      </div>
    );
  }

  return (
    <div className="workout-plan-form">
      <div className="form-grid">
        <label className="field">
          Exercise
          <select value={exercise} onChange={(e) => onExerciseChange(e.target.value)}>
            {EXERCISE_OPTIONS.map((opt) => (
              <option key={opt} value={opt} disabled={restricted.includes(opt)}>{opt}{restricted.includes(opt) ? ' · Not recommended for you' : ''}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Sets
          <input
            type="number"
            min={1}
            max={50}
            value={sets}
            onChange={(e) => onSetsChange(Math.max(1, parseInt(e.target.value) || 1))}
          />
        </label>
        <label className="field">
          Reps per Set
          <input
            type="number"
            min={1}
            max={50}
            value={repsPerSet}
            onChange={(e) => onRepsChange(Math.max(1, parseInt(e.target.value) || 1))}
          />
        </label>
      </div>
      {restricted.length > 0 && (
        <div className="notice pink">
          <TriangleAlert size={20} />
          <span>
            Based on your health profile, {restricted.join(' and ')}{' '}
            {restricted.length > 1 ? 'are' : 'is'} not recommended — please avoid
            these exercises, or use significantly lighter weights and stop if you
            feel any discomfort.
          </span>
        </div>
      )}
      <div className="form-actions">
        <Button onClick={onStart} disabled={restrictedSelected}>
          <Play size={16} /> Start Workout
        </Button>
      </div>
    </div>
  );
}
