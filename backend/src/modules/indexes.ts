import { Elysia } from "elysia";
import YahooFinanceClass from "yahoo-finance2";
import { redis } from "../lib/redis";

// Suppress the survey notice
const yahooFinance = new YahooFinanceClass({ suppressNotices: ['yahooSurvey'] });

const INDEXES = ["^NSEI", "^BSESN", "^GSPC", "^IXIC", "^DJI"] as const;
type IndexSymbol = (typeof INDEXES)[number];

const CACHE_KEY = "indexes:snapshot";
// Updating every 10 seconds as per user request to keep index prices real-time
const CACHE_TTL_SECONDS = 10;

export type IndexQuote = {
  symbol: string;
  shortName: string;
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
};

const INDEX_NAMES: Record<IndexSymbol, string> = {
  "^NSEI": "Nifty 50",
  "^BSESN": "Sensex",
  "^GSPC": "S&P 500",
  "^IXIC": "NASDAQ",
  "^DJI": "Dow Jones"
};

async function fetchIndexesFromYahoo(): Promise<IndexQuote[]> {
  const results: IndexQuote[] = [];

  for (const symbol of INDEXES) {
    try {
      const quote = await yahooFinance.quote(symbol, {
        fields: ["regularMarketPrice", "regularMarketPreviousClose", "regularMarketChange", "regularMarketChangePercent", "shortName"]
      });

      // Fallback method that fetches last day closing prices if market is closed / regular market price is null
      const livePrice = (quote as any).regularMarketPrice;
      const prevClose = (quote as any).regularMarketPreviousClose;
      const priceToUse = livePrice ?? prevClose ?? 0;

      results.push({
        symbol,
        shortName: (quote as any).shortName ?? INDEX_NAMES[symbol],
        regularMarketPrice: priceToUse,
        regularMarketChange: (quote as any).regularMarketChange ?? 0,
        regularMarketChangePercent: (quote as any).regularMarketChangePercent ?? 0
      });
    } catch {
      // Skip failed symbols rather than failing the whole request
    }
  }

  return results;
}

export const indexesModule = new Elysia().get("/indexes", async ({ set }) => {
  // 1. Serve from Redis cache if fresh
  const cached = await redis.get(CACHE_KEY);
  if (cached) {
    try {
      return { indexes: JSON.parse(cached) as IndexQuote[], source: "cache" };
    } catch {
      // Corrupted cache, fall through
    }
  }

  // 2. Fetch live via yahoo-finance2 (handles crumb auth automatically)
  try {
    const indexes = await fetchIndexesFromYahoo();

    if (indexes.length === 0) {
      set.status = 502;
      return {
        error: "No index data retrieved",
        hint: "Markets may be closed or Yahoo Finance is temporarily unavailable."
      };
    }

    await redis.set(CACHE_KEY, JSON.stringify(indexes), "EX", CACHE_TTL_SECONDS);
    return { indexes, source: "live" };
  } catch (err) {
    set.status = 502;
    return {
      error: "Failed to fetch index data",
      detail: String(err),
      hint: "Yahoo Finance may be rate-limiting. Try again in a few seconds."
    };
  }
});
