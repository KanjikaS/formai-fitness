<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep FormAI's shared shell and session-only demo state in `src/components/formai`; the root provider lets activity logs stay consistent across pages without storing sensitive profile data.
- Use separate TanStack leaf routes for every wellness area and profile flow so navigation and page metadata remain independent.
- Never call real analysis services in this UI prototype; label recording, calorie estimation, personalization, and pose detection previews explicitly.

## Gym Route — AI Workout Integration

The `/gym` route is connected to a real FastAPI backend (`../backend/`) for live pose detection and AI coaching.

### Key files added

- `src/lib/api.ts` — API client for all backend REST endpoints (auth, exercises, coach)
- `src/hooks/use-websocket.ts` — generic WebSocket hook for the video pipeline
- `src/hooks/use-workout.ts` — workout session state (plan, metrics, coach events, history saving)
- `src/components/formai/gym/CameraFeed.tsx` — camera capture → WebSocket → annotated frame display
- `src/components/formai/gym/WorkoutPlanForm.tsx` — exercise/sets/reps form + start/end controls
- `src/components/formai/gym/MetricsPanel.tsx` — live exercise metrics (reps, angles, status labels)
- `src/components/formai/gym/CoachChat.tsx` — AI coach messages with audio playback + mic input
- `src/components/formai/gym/WorkoutHistory.tsx` — aggregated workout history table
- `src/components/formai/gym/LoginModal.tsx` — username login (stores to localStorage + FormProvider state)

### Backend dependency

The gym features require the FastAPI backend running at `http://localhost:8000`.
Set `GROQ_API_KEY` in `backend/.env` for voice coaching features.
