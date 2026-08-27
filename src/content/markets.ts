import marketsJson from './markets.json';

export type MarketCode = 'in' | 'ae' | 'sa' | 'sg' | 'ar';

export type MarketDef = {
  code: MarketCode;
  hreflang: string;
  name: string;
  currencyNote: string;
  headline: string;
  lede: string;
  localeHint: string;
};

export const MARKETS = marketsJson as MarketDef[];

export const MARKET_CODES = MARKETS.map((m) => m.code);

export function getMarket(code: string | undefined): MarketDef | undefined {
  return MARKETS.find((m) => m.code === code);
}

export function isMarketCode(code: string | undefined): code is MarketCode {
  return Boolean(code && MARKET_CODES.includes(code as MarketCode));
}
