/**
 * Workout history table — displays past exercise records from the backend.
 *
 * Fetches from GET /exercises/history/{userId} and shows an aggregated
 * table grouped by exercise and date.
 */

import { useEffect, useState } from "react";
import { getExerciseHistory, type ExerciseRecord } from "@/lib/api";

interface WorkoutHistoryProps {
  userId: number;
}

interface AggregatedRow {
  exercise: string;
  date: string;
  totalReps: number;
  totalSets: number;
  totalTime: number;
}

export function WorkoutHistory({ userId }: WorkoutHistoryProps) {
  const [records, setRecords] = useState<ExerciseRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getExerciseHistory(userId)
      .then(setRecords)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userId]);

  // Aggregate by exercise + date
  const aggregated = aggregateRecords(records);

  if (loading) return <p className="history-loading">Loading workout history...</p>;
  if (aggregated.length === 0) return <p className="history-empty">No workout history found.</p>;

  return (
    <div className="workout-history">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Exercise</th>
            <th>Reps</th>
            <th>Sets</th>
            <th>Time (sec)</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {aggregated.map((row, i) => (
            <tr key={`${row.exercise}-${row.date}`}>
              <td>{i + 1}</td>
              <td>{row.exercise}</td>
              <td>{row.totalReps}</td>
              <td>{row.totalSets}</td>
              <td>{row.totalTime}</td>
              <td>{row.date}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <style>{`
        .workout-history { overflow-x: auto; }
        .workout-history table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .workout-history th, .workout-history td {
          padding: 10px 12px;
          text-align: left;
          border-bottom: 1px solid var(--border);
        }
        .workout-history th {
          font-weight: 600;
          color: var(--muted-foreground);
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .workout-history tbody tr:hover { background: var(--muted); }
        .history-loading, .history-empty {
          padding: 20px;
          text-align: center;
          color: var(--muted-foreground);
          font-size: 13px;
        }
      `}</style>
    </div>
  );
}

function aggregateRecords(records: ExerciseRecord[]): AggregatedRow[] {
  const map = new Map<string, AggregatedRow>();

  for (const r of records) {
    const date = r.created_at.split(" ")[0] ?? ""; // "2025-10-10 15:30:00" -> "2025-10-10"
    const key = `${r.exercise_name}|${date}`;

    const existing = map.get(key);
    if (existing) {
      existing.totalReps += r.reps;
      existing.totalSets += r.sets;
      existing.totalTime += r.time;
    } else {
      map.set(key, {
        exercise: r.exercise_name,
        date,
        totalReps: r.reps,
        totalSets: r.sets,
        totalTime: r.time,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
}
