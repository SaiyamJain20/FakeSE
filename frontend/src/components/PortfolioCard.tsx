import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../api/client";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Holding = {
  ticker: string;
  quantity: number;
  avgCost: number;
  livePrice: number;
  marketValue: number;
  unrealizedPnl: number;
};

type Portfolio = {
  cash: number;
  totalHoldingsValue: number;
  totalPortfolioValue: number;
  totalUnrealizedPnl: number;
  holdings: Holding[];
};

type HistoryRow = {
  id: string;
  ticker: string;
  type: "market" | "limit" | "stop_loss";
  side: "buy" | "sell";
  quantity: number;
  status: "pending" | "filled" | "cancelled";
  filledPrice: string | null;
  createdAt: string;
  executedAt: string | null;
};

type Props = {
  data?: Portfolio;
  token: string | null;
};

type HistoryRange = "1mo" | "3mo" | "6mo" | "1y" | "5y";

type StockHistoryResponse = {
  ticker: string;
  range: HistoryRange;
  source: "yahoo" | "timescaledb";
  points: Array<{ time: string; close: number }>;
};

function fmtCur(n: number) {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function PnlCell({ value }: { value: number }) {
  const sign = value >= 0 ? "+" : "";
  return (
    <span className={value >= 0 ? "good" : "bad"}>
      {sign}{fmtCur(value)}
    </span>
  );
}

export function PortfolioCard({ data, token }: Props) {
  const [tab, setTab] = useState<"holdings" | "history">("holdings");
  const [historyRange, setHistoryRange] = useState<HistoryRange>("6mo");
  const [selectedTicker, setSelectedTicker] = useState<string>("");

  useEffect(() => {
    if (!data?.holdings.length) {
      return;
    }
    const tickers = data.holdings.map((holding) => holding.ticker);
    if (!selectedTicker || !tickers.includes(selectedTicker)) {
      setSelectedTicker(tickers[0]);
    }
  }, [data?.holdings, selectedTicker]);

  const historyQuery = useQuery({
    queryKey: ["portfolio-history", token],
    queryFn: () => apiFetch<{ history: HistoryRow[] }>("/portfolio/history?limit=50", {}, token!),
    enabled: Boolean(token) && tab === "history",
    staleTime: 10_000
  });

  const stockHistoryQuery = useQuery({
    queryKey: ["stock-history", selectedTicker, historyRange],
    queryFn: () => apiFetch<StockHistoryResponse>(`/stocks/${selectedTicker}/history?range=${historyRange}`),
    enabled: Boolean(selectedTicker) && tab === "holdings"
  });

  const selectedHolding = useMemo(
    () => data?.holdings.find((holding) => holding.ticker === selectedTicker),
    [data?.holdings, selectedTicker]
  );

  const growthStats = useMemo(() => {
    const points = stockHistoryQuery.data?.points ?? [];
    if (points.length < 2) {
      return { change: 0, changePct: 0 };
    }

    const first = points[0].close;
    const last = points[points.length - 1].close;
    const change = last - first;
    const changePct = first === 0 ? 0 : (change / first) * 100;
    return { change, changePct };
  }, [stockHistoryQuery.data?.points]);

  if (!data) {
    return (
      <div className="card">
        <div className="card-header"><h2>Portfolio</h2></div>
        <p className="muted">Login to view your holdings and trade history.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2>Portfolio</h2>
        <div className="inner-tabs">
          <button className={`inner-tab ${tab === "holdings" ? "active" : ""}`} onClick={() => setTab("holdings")}>Holdings</button>
          <button className={`inner-tab ${tab === "history" ? "active" : ""}`} onClick={() => setTab("history")}>History</button>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-cell">
          <span>Cash</span>
          <strong>{fmtCur(data.cash)}</strong>
        </div>
        <div className="stat-cell">
          <span>Total Value</span>
          <strong>{fmtCur(data.totalPortfolioValue)}</strong>
        </div>
        <div className="stat-cell">
          <span>Unrealized P&amp;L</span>
          <strong><PnlCell value={data.totalUnrealizedPnl} /></strong>
        </div>
      </div>

      {tab === "holdings" && (
        data.holdings.length === 0 ? (
          <p className="muted">No holdings — place a buy order to get started.</p>
        ) : (
          <>
            <div className="card-inner" style={{ padding: "1rem", display: "grid", gap: "0.9rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                <div className="title-sm">Growth Analytics</div>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <select className="form-select" value={selectedTicker} onChange={(event) => setSelectedTicker(event.target.value)}>
                    {data.holdings.map((holding) => (
                      <option key={holding.ticker} value={holding.ticker}>{holding.ticker}</option>
                    ))}
                  </select>
                  <select className="form-select" value={historyRange} onChange={(event) => setHistoryRange(event.target.value as HistoryRange)}>
                    <option value="1mo">1M</option>
                    <option value="3mo">3M</option>
                    <option value="6mo">6M</option>
                    <option value="1y">1Y</option>
                    <option value="5y">5Y</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", gap: "2rem", alignItems: "center", flexWrap: "wrap" }}>
                <div>
                  <div className="label-sm">Stock Change</div>
                  <div className={growthStats.change >= 0 ? "val-up" : "val-down"} style={{ fontWeight: 700 }}>
                    {growthStats.change >= 0 ? "+" : ""}{growthStats.change.toFixed(2)} ({growthStats.changePct.toFixed(2)}%)
                  </div>
                </div>
                <div>
                  <div className="label-sm">Your Position P&amp;L</div>
                  <div style={{ fontWeight: 700 }}><PnlCell value={selectedHolding?.unrealizedPnl ?? 0} /></div>
                </div>
              </div>

              <div style={{ width: "100%", height: "220px" }}>
                {stockHistoryQuery.isLoading ? (
                  <p className="muted">Loading stock history…</p>
                ) : stockHistoryQuery.isError || !stockHistoryQuery.data?.points?.length ? (
                  <p className="muted">No chart data for this ticker/range yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stockHistoryQuery.data.points.map((point) => ({
                      time: new Date(point.time).toLocaleDateString("en-IN", { month: "short", day: "2-digit" }),
                      close: point.close
                    }))}>
                      <CartesianGrid stroke="var(--outline-variant)" strokeDasharray="3 3" />
                      <XAxis dataKey="time" tick={{ fill: "var(--on-surface-variant)", fontSize: 11 }} />
                      <YAxis tick={{ fill: "var(--on-surface-variant)", fontSize: 11 }} />
                      <Tooltip />
                      <Area type="monotone" dataKey="close" stroke="var(--secondary-neon)" fill="rgba(68,223,163,0.2)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="label-sm" style={{ opacity: 0.7 }}>
                Source: {stockHistoryQuery.data?.source ?? "n/a"}
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ticker</th>
                    <th>Qty</th>
                    <th>Avg Cost</th>
                    <th>Live Price</th>
                    <th>Mkt Value</th>
                    <th>P&amp;L</th>
                  </tr>
                </thead>
                <tbody>
                  {data.holdings.map((h) => (
                    <tr key={h.ticker}>
                      <td><strong>{h.ticker}</strong></td>
                      <td>{h.quantity}</td>
                      <td>{fmtCur(h.avgCost)}</td>
                      <td>{fmtCur(h.livePrice)}</td>
                      <td>{fmtCur(h.marketValue)}</td>
                      <td><PnlCell value={h.unrealizedPnl} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>

        )
      )}

      {tab === "history" && (
        historyQuery.isLoading ? (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span className="spinner" />
            <span className="muted">Loading history…</span>
          </div>
        ) : historyQuery.isError ? (
          <p className="muted">Failed to load history.</p>
        ) : !historyQuery.data?.history?.length ? (
          <p className="muted">No trade history yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th>Side</th>
                  <th>Type</th>
                  <th>Qty</th>
                  <th>Fill Price</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {historyQuery.data.history.map((row) => (
                  <tr key={row.id}>
                    <td><strong>{row.ticker}</strong></td>
                    <td className={row.side === "buy" ? "good" : "bad"} style={{ fontWeight: 600 }}>
                      {row.side.toUpperCase()}
                    </td>
                    <td style={{ color: "var(--text-2)", textTransform: "capitalize" }}>
                      {row.type.replace("_", " ")}
                    </td>
                    <td>{row.quantity}</td>
                    <td>{row.filledPrice ? fmtCur(Number(row.filledPrice)) : "—"}</td>
                    <td>
                      <span className={`badge badge-${row.status}`}>{row.status}</span>
                    </td>
                    <td style={{ color: "var(--text-2)" }}>
                      {new Date(row.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}
