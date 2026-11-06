import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

// ── Types ──

export interface ForexPair {
  id: string;
  name: string;
  base: string;
  quote: string;
}

export interface StrategyParam {
  type: string;
  default: number;
  min: number;
  max: number;
  label: string;
}

export interface StrategyInfo {
  name: string;
  description: string;
  params: Record<string, StrategyParam>;
}

export interface TradeRecord {
  trade_id: number;
  type: string;
  entry_date: string;
  exit_date: string;
  entry_price: number;
  exit_price: number;
  pnl: number;
  pnl_pct: number;
  bars_held: number;
}

export interface BacktestResult {
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: number;
  total_profit: number;
  total_profit_pct: number;
  max_drawdown: number;
  max_drawdown_pct: number;
  profit_factor: number;
  sharpe_ratio: number;
  avg_trade_pnl: number;
  avg_winner: number;
  avg_loser: number;
  best_trade: number;
  worst_trade: number;
  avg_bars_held: number;
  equity_curve: number[];
  equity_dates: string[];
  trades: TradeRecord[];
}

export interface CandleData {
  time: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
}

// ── API calls ──

export async function fetchPairs(): Promise<ForexPair[]> {
  const res = await api.get("/api/pairs");
  return res.data.pairs;
}

export async function fetchStrategies(): Promise<Record<string, StrategyInfo>> {
  const res = await api.get("/api/strategies");
  return res.data.strategies;
}

export async function fetchCandles(
  pair: string,
  timeframe = "1d",
  period?: string
): Promise<CandleData[]> {
  const params: Record<string, string> = { pair, timeframe };
  if (period) params.period = period;
  const res = await api.get("/api/candles", { params });
  return res.data.candles;
}

export async function runBacktest(config: {
  pair: string;
  timeframe?: string;
  period?: string;
  initial_capital?: number;
  risk_per_trade?: number;
  spread_pips?: number;
  strategy_name: string;
  strategy_params?: Record<string, number>;
  cut_date?: string;
}): Promise<BacktestResult> {
  const res = await api.post("/api/backtest", config);
  return res.data.result;
}
