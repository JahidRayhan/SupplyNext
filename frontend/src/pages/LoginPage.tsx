import { useState } from "react";
import { api, setToken } from "../api/client";
import type { AuthUser } from "../types";
import "./LoginPage.css";
import "./forecast-inventory.css";

export function LoginPage({ onLoggedIn }: { onLoggedIn: (user: AuthUser) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const { token, user } = await api.login(email, password);
      setToken(token);
      onLoggedIn(user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand-mark">SDCIP &middot; Release 1</div>
        <h1>SupplyNext sign in</h1>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={submit}>
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nusrat.jahan@supplynext.com"
              autoComplete="username"
              required
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <button className="btn-primary" type="submit" disabled={submitting} style={{ width: "100%" }}>
            {submitting ? "Signing in\u2026" : "Sign in"}
          </button>
        </form>

        <div className="login-hint">
          Pilot demo accounts share one password: <code>SDCIP-Pilot-2026</code>. Try{" "}
          <code>tanvir.ahmed@supplynext.com</code> (Executive) or <code>nusrat.jahan@supplynext.com</code> (Planner).
        </div>
      </div>
    </div>
  );
}
