import { useState } from "react";
import { apiFetch } from "../api/client";
import { useAuthStore } from "../store/authStore";

export function AdminPanel() {
  const { token, user } = useAuthStore();
  const [competitionId, setCompetitionId] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const [histTicker, setHistTicker] = useState("AAPL");
  const [histStart, setHistStart] = useState("2023-01-01");
  const [histEnd, setHistEnd] = useState("2023-01-31");

  // The simulator event triggers require admin/educator role,
  // We'll use the existing /competitions/:id/event endpoint.
  // We can default to a dummy ID like 'global' if the user doesn't specify one,
  // since the simulator strategy is global behind the scenes anyway.

  const triggerEvent = async (type: string, metadata: any = {}) => {
    try {
      setLoading(true);
      setStatus("");
      
      const compId = competitionId.trim() || "00000000-0000-0000-0000-000000000000";

      await apiFetch(
        `/competitions/${compId}/event`,
        {
          method: "PUT",
          body: JSON.stringify({ type, metadata })
        },
        token
      );
      setStatus(`Successfully triggered: ${type}`);
    } catch (err: any) {
      console.error(err);
      setStatus(`Error: ${err.message || "Failed to trigger event"}`);
    } finally {
      setLoading(false);
    }
  };

  if (user?.role === "user") {
    return (
      <div className="card" style={{ maxWidth: 600, margin: "2rem auto" }}>
        <h2>Admin Dashboard</h2>
        <p className="muted" style={{ marginTop: "1rem" }}>
          You do not have access to this area. (Your role is: <strong style={{ color: "var(--color-primary)" }}>{user.role}</strong>). 
          Only admins or educators can trigger global market shocks.
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ maxWidth: 600, margin: "2rem auto", border: "1px solid var(--color-border)" }}>
      <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span style={{ color: "var(--color-danger)" }}>⚠️</span> Global Event Controls
      </h2>
      <p className="muted" style={{ marginTop: "0.5rem", marginBottom: "2rem" }}>
        Trigger market shocks globally below. This will instantly send a message to the Python Simulation Engine via Kafka.
      </p>

      <div style={{ marginBottom: "2rem" }}>
        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>
          Target Competition ID (Optional):
        </label>
        <input 
          type="text" 
          placeholder="Paste UUID or leave blank" 
          value={competitionId}
          onChange={(e) => setCompetitionId(e.target.value)}
          style={{ width: "100%", padding: "0.5rem" }}
        />
      </div>

      <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <button 
          className="btn-danger" 
          onClick={() => triggerEvent("circuit_breaker", { max_pct: 0.15, drift: -0.1, volatility: 0.05 })}
          disabled={loading}
          style={{ padding: "1rem", background: "var(--color-danger)", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
        >
          <strong>📉 Trigger Market Crash</strong>
          <div style={{ fontSize: "0.75rem", marginTop: "0.5rem", opacity: 0.8 }}>
            Halt extreme volatility and force a rapid crash.
          </div>
        </button>

        <button 
          className="btn-success" 
          onClick={() => triggerEvent("mean_reversion", { target_mean: 100, mean_strength: 0.2 })}
          disabled={loading}
          style={{ padding: "1rem", background: "var(--color-success)", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
        >
          <strong>📈 Trigger Mean Reversion</strong>
          <div style={{ fontSize: "0.75rem", marginTop: "0.5rem", opacity: 0.8 }}>
            Snap stock prices magnetically back to base value.
          </div>
        </button>

        <button 
          className="btn-primary" 
          onClick={() => triggerEvent("random_walk", { volatility: 0.05, drift: 0.001 })}
          disabled={loading}
          style={{ padding: "1rem", background: "var(--color-primary)", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
        >
          <strong>🎲 Restore Random Walk (Normal)</strong>
          <div style={{ fontSize: "0.75rem", marginTop: "0.5rem", opacity: 0.8 }}>
            Return the simulation to default behavior.
          </div>
        </button>

        <button 
          className="btn-primary" 
          onClick={() => triggerEvent("user_influence", { volatility: 0.05, drift: 0.001 })}
          disabled={loading}
          style={{ padding: "1rem", background: "var(--color-primary)", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", filter: "hue-rotate(270deg)" }}
        >
          <strong>👥 Enable Live Trader Influence</strong>
          <div style={{ fontSize: "0.75rem", marginTop: "0.5rem", opacity: 0.8 }}>
            Let standard users push the price up and down.
          </div>
        </button>
      </div>

      <div style={{ marginTop: "2rem", padding: "1.5rem", borderTop: "1px solid var(--color-border)", background: "var(--color-surface-mixed)", borderRadius: "4px" }}>
        <h3 style={{ marginBottom: "1rem", color: "var(--color-primary)" }}>Historical Market Data Simulation</h3>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <label className="label-sm" style={{ display: "block", marginBottom: "0.25rem" }}>Ticker</label>
            <input type="text" placeholder="Ticker (e.g. AAPL)" value={histTicker} onChange={e => setHistTicker(e.target.value)} style={{ padding: "0.5rem" }} />
          </div>
          <div>
            <label className="label-sm" style={{ display: "block", marginBottom: "0.25rem" }}>From Date</label>
            <input type="date" value={histStart} onChange={e => setHistStart(e.target.value)} style={{ padding: "0.5rem" }} />
          </div>
          <div>
            <label className="label-sm" style={{ display: "block", marginBottom: "0.25rem" }}>To Date</label>
            <input type="date" value={histEnd} onChange={e => setHistEnd(e.target.value)} style={{ padding: "0.5rem" }} />
          </div>
          <div style={{ marginTop: "1.25rem" }}>
            <button 
              className="btn-primary" 
              onClick={() => triggerEvent("replicate_history", { ticker: histTicker.toUpperCase(), start_date: histStart, end_date: histEnd })}
              disabled={loading}
              style={{ padding: "0.5rem 1.5rem" }}
            >
              Start Historical Replay
            </button>
          </div>
        </div>
        <p className="muted" style={{ fontSize: "0.85rem", marginTop: "1rem" }}>
          This will instruct the simulation engine to fetch and replay accurate time-series data for the selected stock across the specified date range. Great for creating backtesting environments during a competition.
        </p>
      </div>

      {status && (
        <div style={{ marginTop: "1.5rem", padding: "1rem", background: "var(--color-surface-mixed)", borderRadius: "4px", border: "1px solid var(--color-border)", color: status.includes("Error") ? "var(--color-danger)" : "var(--color-success)" }}>
          {status}
        </div>
      )}
    </div>
  );
}
