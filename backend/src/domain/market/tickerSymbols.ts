const INDEX_ALIASES: Record<string, string> = {
  SENSEX: "BSESN",
  BSESN: "BSESN",
  "^BSESN": "BSESN",
  NIFTY: "NSEI",
  NIFTY50: "NSEI",
  NSEI: "NSEI",
  "^NSEI": "NSEI",
  SP500: "GSPC",
  SPX: "GSPC",
  GSPC: "GSPC",
  "^GSPC": "GSPC",
  NASDAQ: "IXIC",
  IXIC: "IXIC",
  "^IXIC": "IXIC",
  DOW: "DJI",
  DOWJONES: "DJI",
  DJI: "DJI",
  "^DJI": "DJI"
};

const INDEX_TO_YAHOO: Record<string, string> = {
  BSESN: "^BSESN",
  NSEI: "^NSEI",
  GSPC: "^GSPC",
  IXIC: "^IXIC",
  DJI: "^DJI"
};

export function normalizeTicker(input: string) {
  const upper = input.trim().toUpperCase();
  if (!upper) {
    return upper;
  }

  return INDEX_ALIASES[upper] ?? upper;
}

const SIM_TICKERS = ["FAKE", "TSIM", "NOVA", "ALFA", "ZENX"];

export function toYahooSymbol(input: string) {
  const normalized = normalizeTicker(input);
  if (INDEX_TO_YAHOO[normalized]) {
    return INDEX_TO_YAHOO[normalized];
  }
  
  if (SIM_TICKERS.includes(normalized)) {
    return normalized;
  }

  return normalized;
}