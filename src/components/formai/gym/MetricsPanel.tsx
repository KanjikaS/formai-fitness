/**
 * Live metrics panel — displays real-time exercise metrics from pose detection.
 *
 * Shows progress (reps, sets) and exercise-specific metrics (angles, status).
 */

import type { WorkoutMetrics } from "@/hooks/use-workout";

/** Safely get a numeric metric value. */
function num(m: WorkoutMetrics, key: string): number {
  const v = m[key];
  return typeof v === "number" ? v : 0;
}

/** Safely get a string metric value. */
function str(m: WorkoutMetrics, key: string): string {
  const v = m[key];
  return typeof v === "string" ? v : "N/A";
}

interface MetricsPanelProps {
  exercise: string;
  metrics: WorkoutMetrics;
  totalReps: number;
  setsCompleted: number;
  currentSetReps: number;
  targetSets: number;
  repsPerSet: number;
}

export function MetricsPanel({
  exercise,
  metrics,
  totalReps,
  setsCompleted,
  currentSetReps,
  targetSets,
  repsPerSet,
}: MetricsPanelProps) {
  return (
    <div className="metrics-panel">
      <h3>Progress</h3>
      <div className="metrics-grid">
        <div className="metric-card">
          <span className="metric-value">{totalReps}</span>
          <span className="metric-label">Total Reps</span>
        </div>
        <div className="metric-card">
          <span className="metric-value">{currentSetReps} / {repsPerSet}</span>
          <span className="metric-label">Current Set</span>
        </div>
        <div className="metric-card">
          <span className="metric-value">{setsCompleted} / {targetSets}</span>
          <span className="metric-label">Sets Done</span>
        </div>
      </div>

      <h3 className="mt-4">{exercise} Metrics</h3>
      <div className="metrics-grid">
        {exercise === "Squats" && (
          <>
            <MetricRow label="Knee Angle" value={`${num(metrics, "knee_angle")}°`} />
            <MetricRow label="Back Angle" value={`${num(metrics, "back_angle")}°`} />
            <MetricRow label="Depth" value={str(metrics, "depth_status")} />
          </>
        )}
        {exercise === "Push-ups" && (
          <>
            <MetricRow label="Elbow Angle" value={`${num(metrics, "elbow_angle")}°`} />
            <MetricRow label="Body Alignment" value={str(metrics, "body_alignment")} />
            <MetricRow label="Hip Position" value={str(metrics, "hip_status")} />
          </>
        )}
        {exercise === "Biceps Curls (Dumbbell)" && (
          <>
            <MetricRow label="Elbow Angle" value={`${num(metrics, "elbow_angle")}°`} />
            <MetricRow label="Shoulder" value={str(metrics, "shoulder_status")} />
            <MetricRow label="Swing" value={str(metrics, "swing_status")} />
          </>
        )}
        {exercise === "Shoulder Press" && (
          <>
            <MetricRow label="Elbow Angle" value={`${num(metrics, "elbow_angle")}°`} />
            <MetricRow label="Extension" value={str(metrics, "extension_status")} />
            <MetricRow label="Back Arch" value={str(metrics, "back_arch_status")} />
          </>
        )}
        {exercise === "Lunges" && (
          <>
            <MetricRow label="Front Knee" value={`${num(metrics, "front_knee_angle")}°`} />
            <MetricRow label="Torso Angle" value={`${num(metrics, "torso_angle")}°`} />
            <MetricRow label="Balance" value={str(metrics, "balance_status")} />
          </>
        )}
      </div>

      <style>{`
        .metrics-panel h3 { font-size: 16px; margin-bottom: 12px; }
        .metrics-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .metric-card {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 14px;
          text-align: center;
        }
        .metric-value {
          font-family: 'Outfit', sans-serif;
          font-size: 24px;
          font-weight: 600;
          display: block;
        }
        .metric-label {
          font-size: 11px;
          color: var(--muted-foreground);
          margin-top: 4px;
          display: block;
        }
        .metric-row {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 12px;
          text-align: center;
        }
        .metric-row .value {
          font-family: 'Outfit', sans-serif;
          font-size: 18px;
          font-weight: 600;
          display: block;
        }
        .metric-row .label {
          font-size: 10px;
          color: var(--muted-foreground);
          margin-top: 4px;
          display: block;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
      `}</style>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-row">
      <span className="value">{value}</span>
      <span className="label">{label}</span>
    </div>
  );
}
