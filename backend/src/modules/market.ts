import { Elysia, t } from "elysia";
import { sql } from "../lib/db";
import { getLivePrice } from "../lib/priceCache";
import { addPriceClient, removePriceClient } from "../lib/wsHub";
import { redis } from "../lib/redis";
import { normalizeTicker, toYahooSymbol } from "../domain/market/tickerSymbols";
import { marketAdapter } from "../domain/market/adapter";

type HistoryRange = "1mo" | "3mo" | "6mo" | "1y" | "5y";

const RANGE_MS: Record<HistoryRange, number> = {
  "1mo": 30 * 24 * 60 * 60 * 1000,
  "3mo": 90 * 24 * 60 * 60 * 1000,
  "6mo": 180 * 24 * 60 * 60 * 1000,
  "1y": 365 * 24 * 60 * 60 * 1000,
  "5y": 5 * 365 * 24 * 60 * 60 * 1000
};

const DB_BUCKET: Record<HistoryRange, string> = {
  "1mo": "1 hour",
  "3mo": "4 hours",
  "6mo": "12 hours",
  "1y": "1 day",
  "5y": "1 week"
};

async function fetchYahooHistory(ticker: string, range: HistoryRange) {
  try {
    const period1 = new Date(Date.now() - RANGE_MS[range]);
    const history = await marketAdapter.getHistoricalPrices(ticker, period1);
    return history;
  } catch (err: any) {
    throw new Error(`Yahoo history unavailable (${err.message})`);
  }
}

async function fetchDbHistory(ticker: string, range: HistoryRange) {
  const from = new Date(Date.now() - RANGE_MS[range]);
  const bucket = DB_BUCKET[range];

  const rows = await sql.unsafe(
    `SELECT time_bucket('${bucket}', time) as bucket, last(price, time)::text as close
     FROM price_ticks
     WHERE ticker = $1 AND time >= $2
     GROUP BY bucket
     ORDER BY bucket ASC`,
    [ticker, from.toISOString()]
  );

  return rows.map((row: any) => ({
    time: String(row.bucket),
    close: Number(row.close)
  }));
}

export const marketModule = new Elysia()
  .get("/stocks", async () => {
    const snapshot = await redis.hgetall("prices");

    const rows = Object.entries(snapshot).map(([ticker, value]) => {
      try {
        const parsed = JSON.parse(String(value)) as { price: number; ts: number };
        return { ticker, price: parsed.price, ts: parsed.ts };
      } catch {
        return { ticker, price: null, ts: null };
      }
    });

    return { stocks: rows };
  })
  .get("/stocks/:ticker/price", async ({ params, set }) => {
    const ticker = normalizeTicker(params.ticker);
    const cached = await getLivePrice(ticker);
    if (cached !== null) {
      return { ticker, price: cached, source: "redis" };
    }

    const latest = await sql<{ price: string; time: string }[]>`
      SELECT price::text, time::text
      FROM price_ticks
      WHERE ticker = ${ticker}
      ORDER BY time DESC
      LIMIT 1
    `;

    if (latest.length === 0) {
      set.status = 404;
      return { error: `No price found for ${ticker}` };
    }

    return {
      ticker,
      price: Number(latest[0].price),
      ts: latest[0].time,
      source: "timescaledb"
    };
  })
  .get(
    "/stocks/:ticker/candles",
    async ({ params, query }) => {
      const ticker = normalizeTicker(params.ticker);
      const interval = query.interval === "5m" ? "5m" : "1m";
      const from = query.from ? new Date(query.from) : new Date(Date.now() - 60 * 60 * 1000);
      const to = query.to ? new Date(query.to) : new Date();
      const viewName = interval === "5m" ? "ohlc_5m" : "ohlc_1m";

      const candles = await sql.unsafe(
        `SELECT bucket::text, open::text, high::text, low::text, close::text, volume
         FROM ${viewName}
         WHERE ticker = $1 AND bucket BETWEEN $2 AND $3
         ORDER BY bucket ASC`,
        [ticker, from.toISOString(), to.toISOString()]
      );

      return {
        ticker,
        interval,
        candles: candles.map((row: any) => ({
          bucket: row.bucket,
          open: Number(row.open),
          high: Number(row.high),
          low: Number(row.low),
          close: Number(row.close),
          volume: Number(row.volume)
        }))
      };
    },
    {
      query: t.Object({
        interval: t.Optional(t.Union([t.Literal("1m"), t.Literal("5m")])),
        from: t.Optional(t.String()),
        to: t.Optional(t.String())
      })
    }
  )
  .get(
    "/stocks/:ticker/history",
    async ({ params, query, set }) => {
      const ticker = normalizeTicker(params.ticker);
      const range = (query.range ?? "6mo") as HistoryRange;

      try {
        const yahooPoints = await fetchYahooHistory(ticker, range);
        if (yahooPoints.length > 0) {
          return { ticker, range, source: "yahoo", points: yahooPoints };
        }
      } catch {
      }

      const dbPoints = await fetchDbHistory(ticker, range);
      if (dbPoints.length > 0) {
        return { ticker, range, source: "timescaledb", points: dbPoints };
      }

      set.status = 404;
      return {
        error: `No historical data found for ${ticker}`,
        hint: "Try after simulator runs longer or choose a market ticker like TSLA"
      };
    },
    {
      query: t.Object({
        range: t.Optional(t.Union([t.Literal("1mo"), t.Literal("3mo"), t.Literal("6mo"), t.Literal("1y"), t.Literal("5y")]))
      })
    }
  )
  .get("/stocks/:ticker/profile", async ({ params, set }) => {
    const ticker = normalizeTicker(params.ticker);
    const REDIS_KEY = `profile:${ticker}`;

    // Cache Proxy Pattern
    const cached = await redis.get(REDIS_KEY);
    if (cached) {
      return { ticker, source: "redis", ...JSON.parse(cached) };
    }

    const profileData = await marketAdapter.getProfile(ticker);
    if (profileData) {
      // Setup TTL cache of 24h
      await redis.setex(REDIS_KEY, 86400, JSON.stringify(profileData));
      return { ticker, source: "yahoo", ...profileData };
    }

    set.status = 404;
    return {
      error: `No profile data found for ${ticker}`,
      hint: "Select a real market ticker."
    };
  })
  .ws("/ws/prices", {
    open(ws) {
      addPriceClient(ws as any);
      ws.send(JSON.stringify({ event: "connected", data: { channel: "price_channel" } }));
    },
    close(ws) {
      removePriceClient(ws as any);
    }
  });
