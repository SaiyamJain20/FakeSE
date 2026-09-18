import { normalizeTicker, toYahooSymbol } from "./tickerSymbols";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

/**
 * The Adapter interface defining the standard contract for fetching market data.
 * This obeys the Dependency Inversion Principle, decoupling the rest of the application
 * from the specific external data provider (e.g., Yahoo Finance).
 */
export interface IMarketDataAdapter {
  getLivePrice(ticker: string): Promise<number | null>;
  getBulkLivePrices(tickers: string[]): Promise<Array<{ ticker: string; price: number; volume: number }>>;
  getHistoricalPrices(ticker: string, from: Date): Promise<Array<{ time: string; close: number }>>;
  getProfile(ticker: string): Promise<any>;
}

/**
 * Concrete implementation of the Adapter pattern for Yahoo Finance.
 * Encapsulates all library-specific fetching and data mapping logic.
 */
export class YahooFinanceAdapter implements IMarketDataAdapter {
  async getLivePrice(ticker: string): Promise<number | null> {
    const symbol = toYahooSymbol(ticker);
    try {
      const result = await yahooFinance.quote(symbol);
      const live = Number(result?.regularMarketPrice ?? 0);
      if (Number.isFinite(live) && live > 0) return live;

      const previousClose = Number(result?.regularMarketPreviousClose ?? 0);
      if (Number.isFinite(previousClose) && previousClose > 0) return previousClose;

      const history = await yahooFinance.chart(symbol, { period1: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) });
      if (history?.quotes?.length) {
        for (let idx = history.quotes.length - 1; idx >= 0; idx -= 1) {
          const value = history.quotes[idx].close;
          if (value && Number.isFinite(value) && value > 0) return value;
        }
      }
    } catch (err) {
      console.error(`[YahooFinanceAdapter] Failed spot price for ${symbol}:`, err);
    }
    return null;
  }

  async getBulkLivePrices(tickers: string[]): Promise<Array<{ ticker: string; price: number; volume: number }>> {
    if (tickers.length === 0) return [];
    
    const symbols = tickers.map(toYahooSymbol);
    try {
      const results = await yahooFinance.quote(symbols);
      const resultsArray = Array.isArray(results) ? results : [results];
      
      if (!resultsArray || resultsArray.length === 0) return [];

      const fetched: Array<{ ticker: string; price: number; volume: number }> = [];

      for (const row of resultsArray) {
        const live = Number(row?.regularMarketPrice ?? row?.regularMarketPreviousClose ?? 0);
        if (Number.isFinite(live) && live > 0) {
          const symbolStr = String(row.symbol);
          const internalTicker = tickers.find(t => toYahooSymbol(t) === symbolStr) || 
            tickers.find(t => t.toUpperCase() === symbolStr.toUpperCase()) || symbolStr;

          const totalVolume = Number(row?.regularMarketVolume ?? 0);
          const tickVolume = Math.max(1, Math.floor(Math.random() * (totalVolume > 10000 ? 50 : 10)));

          fetched.push({
            ticker: normalizeTicker(internalTicker),
            price: live,
            volume: tickVolume
          });
        }
      }
      return fetched;
    } catch (err) {
      console.error("[YahooFinanceAdapter] Failed bulk fetching:", err);
      return [];
    }
  }

  async getHistoricalPrices(ticker: string, from: Date): Promise<Array<{ time: string; close: number }>> {
    const symbol = toYahooSymbol(ticker);
    try {
      const history = await yahooFinance.chart(symbol, {
        period1: from,
        interval: "1d"
      });

      if (!history?.quotes || history.quotes.length === 0) return [];

      const points: Array<{ time: string; close: number }> = [];
      for (const quote of history.quotes) {
        if (quote.close && Number.isFinite(quote.close) && quote.date) {
          points.push({ time: quote.date.toISOString(), close: quote.close });
        }
      }
      return points;
    } catch (err: any) {
      throw new Error(`Yahoo history unavailable (${err.message})`);
    }
  }

  async getProfile(ticker: string): Promise<any> {
    const symbol = toYahooSymbol(ticker);
    try {
      const summary = await yahooFinance.quoteSummary(symbol, {
        modules: ["assetProfile", "summaryDetail", "price"]
      });

      return {
        name: summary.price?.shortName || ticker,
        sector: summary.assetProfile?.sector || "N/A",
        industry: summary.assetProfile?.industry || "N/A",
        marketCap: summary.summaryDetail?.marketCap || null,
        peRatio: summary.summaryDetail?.trailingPE || null,
        fiftyTwoWeekHigh: summary.summaryDetail?.fiftyTwoWeekHigh || null,
        fiftyTwoWeekLow: summary.summaryDetail?.fiftyTwoWeekLow || null,
        description: summary.assetProfile?.longBusinessSummary || ""
      };
    } catch (err: any) {
      console.error("[YahooFinanceAdapter] Failed profile fetch:", err.message);
      return null;
    }
  }
}

// Export a singleton instance of the adapter to be used throughout the app
export const marketAdapter: IMarketDataAdapter = new YahooFinanceAdapter();