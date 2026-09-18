import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../api/client";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid
} from "recharts";
import { useMarketStore } from "../store/marketStore";

type HistoryPoint = {
  time: string;
  close: number;
};

type HistoryResponse = {
  ticker: string;
  range: string;
  source: string;
  points: HistoryPoint[];
};

type ProfileResponse = {
  ticker: string;
  source: string;
  name: string;
  sector: string;
  industry: string;
  marketCap: number | null;
  peRatio: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  description: string;
};

export function StockChartCard({ token, ticker }: { token: string; ticker: string }) {
  const [range, setRange] = useState<"1mo" | "3mo" | "6mo" | "1y" | "5y">("6mo");
  
  const prices = useMarketStore((state) => state.prices);
  const livePrice = prices[ticker]?.price;

  const historyQuery = useQuery({
    queryKey: ["history", ticker, range],
    queryFn: () => apiFetch<HistoryResponse>(`/stocks/${ticker}/history?range=${range}`, {}, token),
    retry: false
  });

  const profileQuery = useQuery({
    queryKey: ["profile", ticker],
    queryFn: () => apiFetch<ProfileResponse>(`/stocks/${ticker}/profile`, {}, token),
    retry: false
  });

  const chartData = historyQuery.data?.points.map(p => ({
    date: new Date(p.time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    price: p.close
  })) || [];

  if (livePrice && chartData.length > 0) {
     chartData[chartData.length - 1].price = livePrice;
  }

  return (
    <div className="card">
      <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 className="title-md">{profileQuery.data?.name || ticker}</h2>
          <div className="headline-sm" style={{ color: "var(--secondary-neon)", marginTop: "0.25rem" }}>
            {livePrice ? `₹${livePrice.toFixed(2)}` : (chartData.length > 0 ? `₹${chartData[chartData.length - 1].price}` : "Loading...")}
          </div>
        </div>
        
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {["1mo", "3mo", "6mo", "1y", "5y"].map(r => (
            <button
              key={r}
              onClick={() => setRange(r as any)}
              style={{
                background: range === r ? "var(--primary-container)" : "var(--surface-variant)",
                color: range === r ? "var(--on-surface)" : "var(--on-surface-variant)",
                border: "none",
                padding: "0.25rem 0.5rem",
                borderRadius: "0.25rem",
                cursor: "pointer",
                fontFamily: "var(--font-data)",
                fontSize: "0.85rem"
              }}
            >
              {r.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div style={{ height: "400px", marginTop: "2rem" }}>
        {historyQuery.isLoading ? (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-3)" }}>Loading chart...</div>
        ) : historyQuery.isError ? (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--error-color)" }}>Failed to load historical data</div>
        ) : chartData.length === 0 ? (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-3)" }}>No data available</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--secondary-neon)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--secondary-neon)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fill: "var(--text-3)", fontSize: 12, fontFamily: "var(--font-data)" }} axisLine={false} tickLine={false} minTickGap={30} />
              <YAxis domain={['auto', 'auto']} tick={{ fill: "var(--text-3)", fontSize: 12, fontFamily: "var(--font-data)" }} axisLine={false} tickLine={false} tickFormatter={(val) => `₹${val}`} />
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--outline-variant)" opacity={0.5} />
              <Tooltip
                contentStyle={{ backgroundColor: "var(--surface)", border: "1px solid var(--outline)", borderRadius: "0.5rem", color: "var(--on-surface)" }}
                itemStyle={{ color: "var(--secondary-neon)", fontWeight: "bold" }}
              />
              <Area type="monotone" dataKey="price" stroke="var(--secondary-neon)" strokeWidth={2} fillOpacity={1} fill="url(#colorPrice)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
