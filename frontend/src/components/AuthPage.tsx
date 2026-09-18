import { useEffect, useState } from "react";
import { useAuthStore } from "../store/authStore";

export function AuthPage() {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  useEffect(() => {
    setUsername("");
    setEmail("");
    setPassword("");
    setError(null);
  }, []);

  const { login, register } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (tab === "login") {
        await login({ usernameOrEmail: username, password });
      } else {
        await register({ username, email, password, role: role as "user" | "educator" });
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleTabClick = (newTab: "login" | "register") => {
    setTab(newTab);
    setError(null);
    setUsername("");
    setEmail("");
    setPassword("");
  };

  return (
    <div className="auth-layout">
      {/* Left side: Terminal branding */}
      <div className="auth-sidebar glass-panel">
        <div className="auth-form-container">
          <div style={{ marginBottom: "3rem" }}>
            <h1 className="display-lg">FakeSE</h1>
            <p className="label-sm" style={{ marginTop: "0.5rem" }}>Digital Architecture Terminal</p>
          </div>

          <div className="auth-tabs">
            <button
              type="button"
              className={`auth-tab ${tab === "login" ? "active" : ""}`}
              onClick={() => handleTabClick("login")}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`auth-tab ${tab === "register" ? "active" : ""}`}
              onClick={() => handleTabClick("register")}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleSubmit} autoComplete="off" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {/* Honeypot inputs to trick browser autofill */}
            <input type="text" name="username" autoComplete="off" style={{ display: "none" }} />
            <input type="password" name="password" autoComplete="off" style={{ display: "none" }} />

            {tab === "register" && (
              <label className="form-label">
                Email Address
                <input
                  className="form-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="architect@sovereign.exchange"
                  autoComplete="off"
                  required
                />
              </label>
            )}

            <label className="form-label">
              Terminal Identity
              <input
                className="form-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="@username"
                autoComplete="off"
                required
              />
            </label>

            {tab === "register" && (
              <div className="form-label" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                Access Key
                <input
                  className="form-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setIsPasswordFocused(true)}
                  onBlur={() => setIsPasswordFocused(false)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                  style={{ borderColor: password.length > 0 && (password.length < 8 || password.length > 128) ? "var(--val-down)" : undefined }}
                />
                {(isPasswordFocused || password.length > 0) && (
                  <ul className="label-sm" style={{ listStyle: "none", padding: "0.5rem 0 0 0.5rem", margin: 0, color: "var(--on-surface-variant)" }}>
                    <li style={{ color: password.length >= 8 ? "var(--val-up)" : password.length > 0 ? "var(--val-down)" : "inherit" }}>• Must be at least 8 characters long</li>
                    <li style={{ color: password.length <= 128 ? "var(--val-up)" : password.length > 0 ? "var(--val-down)" : "inherit" }}>• Must be at most 128 characters long</li>
                  </ul>
                )}
              </div>
            )}

            {tab === "login" && (
              <label className="form-label">
                Access Key
                <input
                  className="form-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
              </label>
            )}

            {tab === "register" && (
              <label className="form-label">
                Access Level
                <select
                  className="form-select"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <option value="user">Trader (Default)</option>
                  <option value="educator">Educator (Admin)</option>
                </select>
              </label>
            )}

            {error && <div className="val-down label-sm" style={{ padding: "0.5rem 0", textTransform: "none" }}>Execution Failed: {error}</div>}

            <button type="submit" className="btn-primary" disabled={loading || (tab === 'register' && (password.length < 8 || password.length > 128))} style={{ marginTop: "1rem" }}>
              {loading ? "Initializing..." : "Initialize Session"}
            </button>
          </form>

          <div className="label-sm" style={{ marginTop: "3rem", color: "var(--on-surface-variant)", opacity: 0.7 }}>
            Demo credentials: username <strong style={{ color: "var(--on-surface)" }}>demo</strong> / pass <strong style={{ color: "var(--on-surface)" }}>demopass123</strong>
          </div>
        </div>
      </div>

      {/* Right side: Vibe area */}
      <div className="auth-hero">
        <div style={{ maxWidth: "600px", zIndex: 10 }}>
          <div className="badge badge-filled" style={{ marginBottom: "1rem" }}>Terminal V4.0.2 Stable</div>
          <h2 className="display-lg" style={{ marginBottom: "1.5rem" }}>
            Precision is the <br /><span style={{ color: "var(--primary-container)" }}>New Currency.</span>
          </h2>
          <p className="body-md" style={{ maxWidth: "480px" }}>
            Access a high-fidelity simulation engine designed for digital architects.
            Execute trades with zero latency and analyze portfolio variance with institutional-grade tools.
          </p>
        </div>

        <div className="auth-metric-card glass-panel">
          <div className="label-sm">Net Worth</div>
          <div className="headline-sm" style={{ marginTop: "0.5rem" }}>$2,481,092.40</div>
          <div className="label-md" style={{ marginTop: "0.75rem" }}>BTCUSD · SPX500</div>
        </div>
      </div>

      {/* Bottom Legal bar */}
      <div className="label-sm" style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "2rem 4rem", display: "flex", justifyContent: "space-between", zIndex: 20 }}>
        <div>© 2026 Sovereign Exchange. No real currency is traded.</div>
        <div style={{ display: "flex", gap: "2rem" }}>
          <span>Terms of Service</span>
          <span>Privacy Policy</span>
          <span>Risk Disclosure</span>
        </div>
      </div>
    </div>
  );
}