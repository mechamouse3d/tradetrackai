import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.API_KEY || import.meta.env.VITE_GOOGLE_API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export interface WatchlistAnalysis {
  marketTrend: string;
  watchlistAnalysis: {
    symbol: string;
    recommendation: 'BUY' | 'SELL' | 'HOLD';
    justification: string;
  }[];
  recommendedAdditions: {
    symbol: string;
    companyName: string;
    justification: string;
  }[];
}

export interface WatchlistMetrics {
  symbol: string;
  currentPrice: number;
  currency: string;
  growth1M: string;
  growth6M: string;
  growth1Y: string;
  peRatio: string;
  marketCap: string;
}

export interface StockSearchResult {
  symbol: string;
  name: string;
}

const cleanAndParseJSON = (text: string | undefined): any => {
  if (!text) return null;
  let clean = text.replace(/```json\s*|```/g, '').trim();
  const match = clean.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  if (match) clean = match[0];
  try {
    return JSON.parse(clean);
  } catch (e) {
    console.error("JSON Parse Error. Raw Text:", text);
    return null;
  }
};

export const analyzeWatchlist = async (symbols: string[]): Promise<WatchlistAnalysis> => {
  if (!symbols || symbols.length === 0) {
    return {
      marketTrend: "No symbols in watchlist to analyze.",
      watchlistAnalysis: [],
      recommendedAdditions: []
    };
  }

  const prompt = `You are a world-class AI financial analyst. I have a watchlist of the following stocks: ${symbols.join(', ')}.
  
  Please execute the following analysis:
  1. Monitor and summarize the overall market trends and major indices (e.g., SPY, QQQ, DIA).
  2. Perform a technical analysis of the charts for my watchlist stocks based on the latest available market data.
  3. Analyze the current sentiment for these stocks by monitoring recent news, social media sentiment (e.g., X's fintwit community, mainstream media), and subreddits like r/wallstreetbets.
  4. Give a definitive 'BUY', 'SELL', or 'HOLD' recommendation for each stock in the watchlist, along with a brief justification based on the technicals and sentiment.
  5. Given the market analysis and the types of stocks I am watching, recommend 2-3 OTHER stocks to buy that are from "good", highly reputable companies with strong fundamentals.
  
  Provide the response STRICTLY as a JSON object with no markdown formatting or other text, matching this exact structure:
  {
    "marketTrend": "string",
    "watchlistAnalysis": [
      { "symbol": "string", "recommendation": "BUY" | "SELL" | "HOLD", "justification": "string" }
    ],
    "recommendedAdditions": [
      { "symbol": "string", "companyName": "string", "justification": "string" }
    ]
  }`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        // Enabling the Google Search tool grounds the model in real-time news, Reddit, and X sentiment
        tools: [{ googleSearch: {} }],
      }
    });

    return cleanAndParseJSON(response.text) as WatchlistAnalysis;
  } catch (error) {
    console.error("Watchlist analysis failed:", error);
    throw error;
  }
};

export const searchStockSymbols = async (query: string): Promise<StockSearchResult[]> => {
  if (!query || query.trim().length === 0) return [];
  
  const prompt = `Find up to 5 real stock market tickers that best match the search query: "${query}".
  Provide the response STRICTLY as a JSON array of objects with no markdown formatting or other text, matching this exact structure:
  [
    { "symbol": "string", "name": "string" }
  ]`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    return cleanAndParseJSON(response.text) as StockSearchResult[] || [];
  } catch (error) {
    console.error("Symbol search failed:", error);
    return [];
  }
};

export const getWatchlistMetrics = async (symbols: string[]): Promise<WatchlistMetrics[]> => {
  if (!symbols || symbols.length === 0) return [];
  
  const prompt = `Perform a real-time Google Search to get the latest financial metrics for the following stock tickers: ${symbols.join(', ')}.
  For each stock, find:
  1. Current real-time price (as a number)
  2. Currency (e.g., USD, CAD)
  3. 1-Month Growth (percentage string, e.g., "+5.2%" or "-2.1%")
  4. 6-Month Growth
  5. 1-Year Growth
  6. P/E Ratio (string, e.g., "35.2" or "N/A")
  7. Market Cap (string, e.g., "$3.2T" or "$150B")
  
  Provide the response STRICTLY as a JSON array of objects with no markdown formatting or other text, matching this exact structure:
  [
    {
      "symbol": "string",
      "currentPrice": number,
      "currency": "string",
      "growth1M": "string",
      "growth6M": "string",
      "growth1Y": "string",
      "peRatio": "string",
      "marketCap": "string"
    }
  ]`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      }
    });
    
    return cleanAndParseJSON(response.text) as WatchlistMetrics[] || [];
  } catch (error) {
    console.error("Metrics fetch failed:", error);
    throw error;
  }
};