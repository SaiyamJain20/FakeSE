import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../api/client";
import { useMarketStore } from "../store/marketStore";
import { 
  TickerFormatter, 
  USFormattingStrategy, 
  NSEFormattingStrategy, 
  BSEFormattingStrategy,
  SIMFormattingStrategy
} from "../utils/tickerStrategy";
import { StockChartCard } from "./StockChartCard";



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

export function StockResearch({ token, onTrade }: { token: string; onTrade: (ticker: string) => void }) {
  const [exchange, setExchange] = useState<"NSE" | "BSE" | "US" | "SIM">("NSE");
  const [search, setSearch] = useState("RELIANCE");
  const [ticker, setTicker] = useState("RELIANCE.NS");
  const formatter = useMemo(() => {
    let strategy = new USFormattingStrategy();
    if (exchange === "NSE") strategy = new NSEFormattingStrategy();
    else if (exchange === "BSE") strategy = new BSEFormattingStrategy();
    else if (exchange === "SIM") strategy = new SIMFormattingStrategy();
    return new TickerFormatter(strategy);
  }, [exchange]);

  const profileQuery = useQuery({
    queryKey: ["profile", ticker],
    queryFn: () => apiFetch<ProfileResponse>(`/stocks/${ticker}/profile`, {}, token),
    retry: false
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) setTicker(formatter.format(search.trim().toUpperCase()));
  };

  const formatLargeNum = (num: number | null | undefined) => {
    if (!num) return "N/A";
    if (num >= 1e12) return `${(num / 1e12).toFixed(1)}T`;
    if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
    return num.toLocaleString();
  };

  return (
    <div style={{ display: "grid", gap: "1.5rem", gridTemplateColumns: "1fr 350px", alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        
        {/* Search Bar */}
        <div className="card" style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <form onSubmit={handleSearch} style={{ display: "flex", gap: "1rem", flex: 1 }}>
            <select
              className="form-select"
              value={exchange}
              onChange={(e) => setExchange(e.target.value as any)}
              style={{ width: "200px" }}
            >
              <option value="NSE">NSE (India)</option>
              <option value="BSE">BSE (India)</option>
              <option value="US">US Market</option>
              <option value="SIM">Simulator (e.g. FAKE)</option>
            </select>
            <input
              className="form-input"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={exchange === "SIM" ? "e.g. FAKE" : exchange === "US" ? "e.g. AAPL" : "e.g. RELIANCE, INFY"}
              style={{ flex: 1 }}
            />
            <button type="submit" className="btn-primary" style={{ padding: "0.75rem 2rem", fontSize: "1rem" }}>Search</button>
          </form>
        </div>

        {/* Chart */}
        <StockChartCard token={token} ticker={ticker} />
      </div>

      {/* Sidebar: Profile & Action */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        
        {/* Action Card */}
        <div className="card">
          <h3 className="title-sm" style={{ color: "var(--on-surface)", marginBottom: "1rem" }}>Trade {ticker}</h3>
          <button 
            className="btn-primary" 
            style={{ width: "100%", padding: "1rem", fontSize: "1.1rem", borderRadius: "100px", fontWeight: "bold" }}
            onClick={() => onTrade(ticker)}
          >
            Terminal Mode
          </button>
        </div>

        {/* Company Profile */}
        <div className="card">
          <div className="card-header">
            <h2>Company Profile</h2>
          </div>
          {profileQuery.isLoading ? (
             <div style={{ color: "var(--text-3)", padding: "1rem" }}>Loading profile...</div>
          ) : profileQuery.isError ? (
             <div style={{ color: "var(--text-3)", padding: "1rem" }}>Profile data unavailable for this ticker.</div>
          ) : profileQuery.data ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <div className="label-sm" style={{ color: "var(--text-3)" }}>Sector</div>
                <div className="body-md">{profileQuery.data.sector}</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <div className="label-sm" style={{ color: "var(--text-3)" }}>Market Cap</div>
                  <div className="body-md" style={{ fontFamily: "var(--font-data)" }}>{formatLargeNum(profileQuery.data.marketCap)}</div>
                </div>
                <div>
                  <div className="label-sm" style={{ color: "var(--text-3)" }}>P/E Ratio</div>
                  <div className="body-md" style={{ fontFamily: "var(--font-data)" }}>{profileQuery.data.peRatio?.toFixed(2) || "N/A"}</div>
                </div>
                <div>
                  <div className="label-sm" style={{ color: "var(--text-3)" }}>52W High</div>
                  <div className="body-md" style={{ fontFamily: "var(--font-data)" }}>{profileQuery.data.fiftyTwoWeekHigh ? `₹${profileQuery.data.fiftyTwoWeekHigh.toFixed(2)}` : "N/A"}</div>
                </div>
                <div>
                  <div className="label-sm" style={{ color: "var(--text-3)" }}>52W Low</div>
                  <div className="body-md" style={{ fontFamily: "var(--font-data)" }}>{profileQuery.data.fiftyTwoWeekLow ? `₹${profileQuery.data.fiftyTwoWeekLow.toFixed(2)}` : "N/A"}</div>
                </div>
              </div>
              <hr style={{ border: "none", borderTop: "1px solid var(--outline-variant)" }} />
              <div>
                <div className="label-sm" style={{ color: "var(--text-3)", marginBottom: "0.5rem" }}>About</div>
                <p className="body-sm" style={{ color: "var(--text-2)", lineHeight: 1.6, maxHeight: "150px", overflowY: "auto" }}>
                  {profileQuery.data.description || "No description available."}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
