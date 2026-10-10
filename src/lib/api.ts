/**
 * API client for the FastAPI backend.
 *
 * All functions return parsed JSON. On error they throw an Error with
 * the response status text.
 */

const API_BASE = "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// ── Auth ────────────────────────────────────────────────────────────

export interface LoginResponse {
  user_id: number;
  username: string;
}

export function login(username: string) {
  return request<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username }),
  });
}

// ── Exercise history ────────────────────────────────────────────────

export interface ExerciseRecord {
  id: number;
  exercise_name: string;
  reps: number;
  sets: number;
  time: number;
  created_at: string;
}

export function getExerciseHistory(userId: number) {
  return request<ExerciseRecord[]>(`/exercises/history/${userId}`);
}

export function saveExercise(data: {
  user_id: number;
  exercise_name: string;
  reps: number;
  sets: number;
  time: number;
}) {
  return request<{ ok: boolean }>("/exercises/save", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ── Coach ───────────────────────────────────────────────────────────

export interface CoachFeedbackResponse {
  text: string;
  audio_base64: string | null;
}

export function getCoachFeedback(data: {
  event: string;
  exercise: string;
  metrics: Record<string, unknown>;
}) {
  return request<CoachFeedbackResponse>("/coach/feedback", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function askCoach(data: { question: string; context: string }) {
  return request<CoachFeedbackResponse>("/coach/ask", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function speechToText(audioBlob: Blob): Promise<{ text: string }> {
  const form = new FormData();
  form.append("audio", audioBlob, "recording.webm");
  const res = await fetch(`${API_BASE}/coach/stt`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}
