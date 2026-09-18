import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { apiFetch } from "./api/client";
import { AuthPage } from "./components/AuthPage";
import { CompetitionBoard } from "./components/CompetitionBoard";
import { IndexTicker } from "./components/IndexTicker";
import { OrderForm } from "./components/OrderForm";
import { OrderHistory } from "./components/OrderHistory";
import { PortfolioCard } from "./components/PortfolioCard";
import { PriceTable } from "./components/PriceTable";
import { ProfilePanel } from "./components/ProfilePanel";
import { AdminPanel } from "./components/AdminPanel";
import { StockResearch } from "./components/StockResearch";
import { StockChartCard } from "./components/StockChartCard";
import { usePriceSocket } from "./hooks/usePriceSocket";
import { useAuthStore } from "./store/authStore";
import { useMarketStore } from "./store/marketStore";

type StocksResponse = { stocks: Array<{ ticker: string; price: number; ts: number }> };
type PortfolioResponse = {
  cash: number;
  totalHoldingsValue: number;
  totalPortfolioValue: number;
  totalUnrealizedPnl: number;
  holdings: Array<{
    ticker: string;
    quantity: number;
    avgCost: number;
    livePrice: number;
    marketValue: number;
    unrealizedPnl: number;
  }>;
};

type Tab = "market" | "research" | "portfolio" | "orders" | "leagues" | "profile" | "admin";

const TABS: { id: Tab; label: string; }[] = [
  { id: "market", label: "Dashboard" },
  { id: "research", label: "Asset Research" },
  { id: "orders", label: "Terminal" },
  { id: "portfolio", label: "Analytics" },
  { id: "leagues", label: "Leagues" },
  { id: "profile", label: "Profile" }
];

// Custom tooltip for the chart
function CustomTooltip({ active, payload }: any) {
  if (active && payload?.length) {
    return (
      <div className="glass-panel" style={{
        borderRadius: "0.5rem",
        padding: "0.75rem 1rem",
        color: "var(--on-surface-variant)"
      }}>
        <div className="title-sm">{payload[0].payload.name}</div>
        <div className="headline-sm" style={{ color: "var(--secondary-neon)", marginTop: "0.25rem" }}>
          ${Number(payload[0].value).toFixed(2)}
        </div>
      </div>
    );
  }
  return null;
}

export default function App() {
  usePriceSocket();

  const auth = useAuthStore();
  const prices = useMarketStore((state) => state.prices);
  const [activeTab, setActiveTab] = useState<Tab>("market");
  const [terminalTicker, setTerminalTicker] = useState<string>("RELIANCE.NS");

  const stocksQuery = useQuery({
    queryKey: ["stocks"],
    queryFn: () => apiFetch<StocksResponse>("/stocks"),
    refetchInterval: 5000
  });

  const portfolioQuery = useQuery({
    queryKey: ["portfolio", auth.token],
    queryFn: () => apiFetch<PortfolioResponse>("/portfolio", {}, auth.token!),
    enabled: Boolean(auth.token),
    refetchInterval: 8000
  });

  const orderedRows = useMemo(() => {
    const fromSocket = Object.entries(prices).map(([ticker, row]) => ({
      ticker,
      price: row.price,
      ts: row.ts
    }));
    if (fromSocket.length > 0)
      return fromSocket.sort((a, b) => a.ticker.localeCompare(b.ticker));
    const fetched = stocksQuery.data?.stocks ?? [];
    return [...fetched].sort((a, b) => a.ticker.localeCompare(b.ticker));
  }, [prices, stocksQuery.data?.stocks]);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Listen to strategy events
  const strategyEvent = useMarketStore(s => s.strategyEvent);
  
  const chartRows = orderedRows.map((row) => ({ name: row.ticker, price: row.price }));

  useEffect(() => {
    if (strategyEvent && auth.user?.role === "user") {
      let niceName = strategyEvent.strategy;
      if (niceName === "circuit_breaker") niceName = "Market Crash";
      if (niceName === "mean_reversion") niceName = "Market Recovery";
      if (niceName === "random_walk") niceName = "Normal Trading";
      if (niceName === "user_influence") niceName = "Live Trader Influence";
      
      setToastMessage(`⚠️ Global Event: ${niceName} Strategy Activated!`);
      const t = setTimeout(() => setToastMessage(null), 5000);
      return () => clearTimeout(t);
    }
  }, [strategyEvent?.id, strategyEvent?.strategy, auth.user?.role]);

  // Show auth page if not logged in
  if (!auth.user) {
    return <AuthPage />;
  }

  const initials = auth.user.username.slice(0, 2).toUpperCase();

  return (
    <div className="app-shell">
      {toastMessage && (
        <div style={{
          position: "fixed", bottom: "20px", right: "20px", zIndex: 9999,
          background: "var(--color-danger)", color: "white", padding: "1rem 2rem",
          borderRadius: "8px", fontWeight: "bold",
          boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
          animation: "fadein 0.3s ease-out"
        }}>
          {toastMessage}
        </div>
      )}
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div style={{ background: "var(--primary-container)", color: "var(--on-surface)", padding: "0.25rem 0.5rem", borderRadius: "0.25rem", fontFamily: "var(--font-command)", fontWeight: 700, fontSize: "1.2rem" }}>SE</div>
          <div>
            <h1 className="title-sm" style={{ letterSpacing: "0.05em" }}>The Sovereign</h1>
            <p className="label-sm" style={{ color: "var(--secondary-neon)" }}>Market Open</p>
          </div>
        </div>

        <nav className="nav-tabs" style={{ flex: 1 }}>
          <div className="label-sm" style={{ padding: "1rem", marginTop: "1rem", opacity: 0.5 }}>Core</div>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`nav-tab ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}

          <div className="label-sm" style={{ padding: "1rem", marginTop: "2rem", opacity: 0.5 }}>Management</div>
          <button className={`nav-tab ${activeTab === "admin" ? "active" : ""}`} onClick={() => setActiveTab("admin")}>Admin</button>
          <button className="nav-tab">Settings</button>
        </nav>

        <div style={{ padding: "1.5rem" }}>
          <button className="nav-tab" style={{ opacity: 0.7 }}>Support</button>
          <button className="nav-tab" style={{ opacity: 0.7 }} onClick={() => void auth.logout()}>Logout</button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="topbar">
          <div style={{ display: "flex", gap: "2rem", alignItems: "center" }}>
            <h1 className="headline-sm">FakeSE</h1>
            <div style={{ display: "flex", gap: "1rem" }}>
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  style={{
                    background: "none",
                    color: activeTab === tab.id ? "var(--on-surface)" : "var(--on-surface-variant)",
                    fontFamily: "var(--font-body)",
                    fontWeight: activeTab === tab.id ? 600 : 400,
                    borderBottom: activeTab === tab.id ? "2px solid var(--primary-container)" : "2px solid transparent",
                    paddingBottom: "0.5rem",
                    borderRadius: 0
                  }}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
            <button className="btn-primary" style={{ padding: "0.5rem 1.5rem" }} onClick={() => setActiveTab("orders")}>Trade</button>
            <button className="profile-avatar" onClick={() => setActiveTab("profile")} title="Open profile">
              {initials}
            </button>
            <button 
              className="btn-primary sell" 
              style={{ padding: "0.5rem 1rem", borderRadius: "100px", fontWeight: "bold", fontSize: "0.85rem" }}
              onClick={() => void auth.logout()}
            >
              Logout
            </button>
          </div>
        </header>

        <div className="content-area">
          <IndexTicker />

          {/* ── Dashboard (Market) Tab ── */}
          {activeTab === "market" && (
            <>
              <div className="grid-2">
                <div className="card">
                  <div className="card-header">
                    <div>
                      <div className="title-sm" style={{ color: "var(--on-surface-variant)" }}>Total Portfolio Value</div>
                      <div className="display-lg" style={{ marginTop: "0.5rem" }}>
                        ${portfolioQuery.data?.totalPortfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? "0.00"}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "3rem", marginTop: "1rem" }}>
                    <div>
                      <div className="label-sm">Buying Power</div>
                      <div className="headline-sm" style={{ marginTop: "0.25rem" }}>
                        ${portfolioQuery.data?.cash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? "0.00"}
                      </div>
                    </div>
                    <div>
                      <div className="label-sm">Daily P/L</div>
                      <div className={`headline-sm ${((portfolioQuery.data?.totalUnrealizedPnl ?? 0) >= 0) ? 'neon-pulse-up' : 'neon-pulse-down'}`} style={{ marginTop: "0.25rem" }}>
                        {((portfolioQuery.data?.totalUnrealizedPnl ?? 0) >= 0) ? '+' : ''}
                        ${portfolioQuery.data?.totalUnrealizedPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? "0.00"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card" style={{ background: "transparent" }}>
                  <div className="card-header">
                    <h2 className="title-sm">Trending Tickers</h2>
                  </div>
                  <PriceTable rows={orderedRows.slice(0, 5)} />
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <h2 className="title-sm">Execution Terminal (Real-time)</h2>
                </div>
                <div className="chart-wrap" style={{ height: "300px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartRows}>
                      <XAxis
                        dataKey="name"
                        tick={{ fill: "var(--text-3)", fontSize: 11, fontFamily: "var(--font-data)" }}
                        axisLine={{ stroke: "var(--outline-variant)" }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: "var(--text-3)", fontSize: 11, fontFamily: "var(--font-data)" }}
                        axisLine={false}
                        tickLine={false}
                        width={65}
                        tickFormatter={(v) => `$${v}`}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Line
                        type="monotone"
                        dataKey="price"
                        stroke="var(--secondary-neon)"
                        strokeWidth={2}
                        dot={{ fill: "var(--surface)", stroke: "var(--secondary-neon)", r: 4, strokeWidth: 2 }}
                        activeDot={{ r: 6, fill: "var(--secondary-neon)", stroke: "var(--surface)" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}
          {activeTab === "research" && auth.token && (
            <StockResearch token={auth.token} onTrade={(ticker) => {
               setTerminalTicker(ticker);
               setActiveTab("orders");
            }} />
          )}
          {/* ── Analytics (Portfolio) Tab ── */}
          {activeTab === "portfolio" && (
            <PortfolioCard data={portfolioQuery.data} token={auth.token} />
          )}

          {/* ── Terminal (Orders) Tab ── */}
          {activeTab === "orders" && auth.token && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "1.5rem", alignItems: "start" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                <StockChartCard token={auth.token} ticker={terminalTicker} />
                <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                    <OrderHistory token={auth.token} />
                </div>
              </div>
              <OrderForm
                initialTicker={terminalTicker}
                onTickerChange={(t) => setTerminalTicker(t)}
                onOrderPlaced={() => {
                  void portfolioQuery.refetch();
                }}
              />
            </div>
          )}

          {/* ── Competition Tab ── */}
          {activeTab === "leagues" && <CompetitionBoard />}

          {activeTab === "profile" && (
            <ProfilePanel
              user={auth.user}
              portfolioValue={portfolioQuery.data?.totalPortfolioValue}
              holdingsCount={portfolioQuery.data?.holdings.length}
              onLogout={() => void auth.logout()}
            />
          )}

          {activeTab === "admin" && <AdminPanel />}
        </div>
      </main>
    </div>
  );
}
