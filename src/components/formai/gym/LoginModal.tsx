/**
 * Login modal — simple username-based authentication.
 *
 * Sends the username to the backend, which creates a user if one
 * doesn't exist. Stores user_id and username in the app state.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { login } from "@/lib/api";

interface LoginModalProps {
  onLogin: (userId: number, username: string) => void;
}

export function LoginModal({ onLogin }: LoginModalProps) {
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim()) {
      setError("Name cannot be empty.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await login(username.trim());
      onLogin(res.user_id, res.username);
    } catch (e) {
      setError("Could not connect to server. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true" aria-label="Login">
        <div className="modal-title">
          <h2>🏋️ AI Real-time GYM Trainer</h2>
        </div>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 20 }}>
          Welcome! Please enter a username to start.
        </p>
        <form onSubmit={handleSubmit}>
          <label className="field">
            Name (unique)
            <input
              type="text"
              placeholder="e.g. Somu"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
            />
          </label>
          {error && <p style={{ color: "var(--destructive)", fontSize: 12, marginTop: 8 }}>{error}</p>}
          <div className="form-actions">
            <Button type="submit" disabled={loading}>
              {loading ? "Connecting..." : "Start Session"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
