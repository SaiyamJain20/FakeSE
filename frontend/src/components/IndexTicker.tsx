import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../api/client";

type IndexQuote = {
  symbol: string;
  shortName: string;
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
};

type IndexesResponse = {
  indexes: IndexQuote[];
  source: "live" | "cache";
};

const INDEX_LABELS: Record<string, string> = {
  "^NSEI": "Nifty 50",
  "^BSESN": "Sensex",
  "^GSPC": "S&P 500",
  "^IXIC": "NASDAQ",
  "^DJI": "Dow Jones"
};

function fmt(n: number, decimals = 2) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function IndexTicker() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["indexes"],
    queryFn: () => apiFetch<IndexesResponse>("/indexes"),
    refetchInterval: 10_000,
    staleTime: 5_000
  });

  if (isLoading) {
    return (
      <div className="index-ticker">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="index-card" style={{ opacity: 0.4 }}>
            <div className="label-sm" style={{ marginBottom: "0.5rem" }}>Loading…</div>
            <div className="headline-sm">—</div>
          </div>
        ))}
      </div>
    );
  }

  if (isError || !data?.indexes?.length) {
    return (
      <div className="index-ticker">
        <div className="index-card" style={{ width: "100%" }}>
          <div className="title-sm" style={{ color: "var(--on-surface)" }}>Global Sentiment</div>
          <div className="label-md" style={{ marginTop: "0.5rem" }}>Market Closed / Reconnecting...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="index-ticker">
      {data.indexes.map((idx) => {
        const positive = idx.regularMarketChange >= 0;
        const label = INDEX_LABELS[idx.symbol] ?? idx.shortName;
        return (
          <div key={idx.symbol} className="index-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <div className="title-sm">{idx.symbol.replace("^", "")}</div>
              <div className="label-sm">{label}</div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div className="headline-sm">{fmt(idx.regularMarketPrice)}</div>
              <div className={`label-md ${positive ? "val-up" : "val-down"}`}>
                {positive ? "+" : ""}{fmt(idx.regularMarketChangePercent, 2)}%
              </div>
            </div>
            {/* Ambient shadow gradient block */}
            <div style={{
              display: "flex", gap: "2px", marginTop: "1rem", opacity: 0.8
            }}>
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} style={{ 
                  flex: 1, 
                  height: i === 5 ? "12px" : "8px", 
                  background: i === 5 ? `var(--${positive ? "secondary" : "error"}-neon)` : "var(--surface-container-highest)",
                  boxShadow: i === 5 ? `0 0 8px var(--${positive ? "secondary" : "error"}-neon)` : "none"
                }} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
