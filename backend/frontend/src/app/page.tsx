"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import LeftDrawingToolbar from "@/components/LeftDrawingToolbar";
import CandlestickChart from "@/components/CandlestickChart";
import RightWatchlist from "@/components/RightWatchlist";
import BottomStrategyTester from "@/components/BottomStrategyTester";
import {
  fetchPairs,
  fetchStrategies,
  fetchCandles,
  runBacktest,
} from "@/lib/api";
import type {
  ForexPair,
  StrategyInfo,
  BacktestResult,
  CandleData,
  TradeRecord,
} from "@/lib/api";

export default function Dashboard() {
  // Theme state: default to "light" mode to match user's TradingView screenshot!
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Data state
  const [pairs, setPairs] = useState<ForexPair[]>([]);
  const [strategies, setStrategies] = useState<Record<string, StrategyInfo>>({});
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [result, setResult] = useState<BacktestResult | null>(null);

  // Active pair & Timeframe
  const [currentPair, setCurrentPair] = useState("EURUSD");
  const [currentTimeframe, setCurrentTimeframe] = useState("1D");
  const [initialCapital, setInitialCapital] = useState(10000);

  // Scissors / Replay Cut State
  const [isPlacingScissors, setIsPlacingScissors] = useState(false);
  const [replayActive, setReplayActive] = useState(false);
  const [activeCutDate, setActiveCutDate] = useState<string | null>(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initial Load
  useEffect(() => {
    async function init() {
      try {
        const [pairsData, strategiesData] = await Promise.all([
          fetchPairs(),
          fetchStrategies(),
        ]);
        setPairs(pairsData);
        setStrategies(strategiesData);

        const candlesData = await fetchCandles("EURUSD", "1D");
        setCandles(candlesData);
      } catch (err: any) {
        setError("Cannot connect to Python server on port 5000.");
      }
    }
    init();
  }, []);

  // Timeframe switch
  const handleSelectTimeframe = async (newTf: string) => {
    setCurrentTimeframe(newTf);
    setReplayActive(false);
    setIsPlacingScissors(false);
    setActiveCutDate(null);
    setLoading(true);
    try {
      const candlesData = await fetchCandles(currentPair, newTf);
      setCandles(candlesData);
    } catch (err: any) {
      setError(`Failed to load ${newTf} data for ${currentPair}`);
    } finally {
      setLoading(false);
    }
  };

  // Pair switch
  const handleSelectPair = async (pairId: string) => {
    setCurrentPair(pairId);
    setReplayActive(false);
    setIsPlacingScissors(false);
    setActiveCutDate(null);
    try {
      const candlesData = await fetchCandles(pairId, currentTimeframe);
      setCandles(candlesData);
    } catch (err: any) {
      setError(`Failed to load data for ${pairId}`);
    }
  };

  // Replay Cut toggle
  const handleToggleReplay = () => {
    if (replayActive) {
      setReplayActive(false);
      setIsPlacingScissors(false);
      setActiveCutDate(null);
    } else {
      setIsPlacingScissors(true);
    }
  };

  // Backtest runner
  const handleRunBacktest = async (config: any) => {
    setLoading(true);
    setError(null);

    try {
      const finalConfig = {
        ...config,
        pair: config.pair || currentPair,
        timeframe: (config.timeframe || currentTimeframe).toLowerCase(),
        cut_date: config.cut_date || activeCutDate || undefined,
      };

      const backtestResult = await runBacktest(finalConfig);
      setResult(backtestResult);
      if (config.initial_capital) setInitialCapital(config.initial_capital);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Backtest failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRunCutBacktest = (cutDate: string) => {
    handleRunBacktest({
      pair: currentPair,
      timeframe: currentTimeframe.toLowerCase(),
      strategy_name: "sma_crossover",
      strategy_params: { fast_period: 10, slow_period: 50 },
      initial_capital: initialCapital,
      risk_per_trade: 0.02,
      spread_pips: 1.5,
      cut_date: cutDate,
    });
  };

  // Manual paper trade logger
  const handleManualTrade = (trade: TradeRecord) => {
    setResult((prev) => {
      if (!prev) {
        return {
          total_trades: 1,
          winning_trades: trade.pnl > 0 ? 1 : 0,
          losing_trades: trade.pnl <= 0 ? 1 : 0,
          win_rate: trade.pnl > 0 ? 100 : 0,
          total_profit: trade.pnl,
          total_profit_pct: trade.pnl_pct,
          max_drawdown: trade.pnl < 0 ? Math.abs(trade.pnl) : 0,
          max_drawdown_pct: trade.pnl < 0 ? Math.abs(trade.pnl_pct) : 0,
          profit_factor: trade.pnl > 0 ? 100 : 0,
          sharpe_ratio: 1.0,
          avg_trade_pnl: trade.pnl,
          avg_winner: trade.pnl > 0 ? trade.pnl : 0,
          avg_loser: trade.pnl <= 0 ? Math.abs(trade.pnl) : 0,
          best_trade: trade.pnl,
          worst_trade: trade.pnl,
          avg_bars_held: trade.bars_held,
          equity_curve: [initialCapital, initialCapital + trade.pnl],
          equity_dates: [trade.entry_date, trade.exit_date],
          trades: [trade],
        };
      }
      const newTrades = [trade, ...prev.trades];
      const wins = newTrades.filter((t) => t.pnl > 0).length;
      const netProfit = Math.round((prev.total_profit + trade.pnl) * 100) / 100;
      return {
        ...prev,
        total_trades: newTrades.length,
        winning_trades: wins,
        losing_trades: newTrades.length - wins,
        win_rate: Math.round((wins / newTrades.length) * 1000) / 10,
        total_profit: netProfit,
        total_profit_pct: Math.round((netProfit / initialCapital) * 10000) / 100,
        trades: newTrades,
        equity_curve: [
          ...prev.equity_curve,
          prev.equity_curve[prev.equity_curve.length - 1] + trade.pnl,
        ],
        equity_dates: [...prev.equity_dates, trade.exit_date],
      };
    });
  };

  const isLight = theme === "light";

  return (
    <div
      className={`h-screen w-screen flex flex-col overflow-hidden font-sans select-none ${
        isLight ? "bg-white text-[#131722]" : "bg-[#131722] text-[#d1d4dc]"
      }`}
    >
      {/* ── 1. TOP HEADER (TradingView Style) ── */}
      <Navbar
        currentPair={currentPair}
        pairs={pairs}
        onSelectPair={handleSelectPair}
        currentTimeframe={currentTimeframe}
        onSelectTimeframe={handleSelectTimeframe}
        theme={theme}
        onToggleTheme={() => setTheme(theme === "light" ? "dark" : "light")}
        replayActive={replayActive}
        isPlacingScissors={isPlacingScissors}
        onToggleReplay={handleToggleReplay}
      />

      {/* ── 2. MAIN CENTER STAGE ── */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Drawing Toolbar */}
        <LeftDrawingToolbar theme={theme} />

        {/* Central Full-Scale Candlestick Chart */}
        <CandlestickChart
          candles={candles}
          pair={currentPair}
          timeframe={currentTimeframe}
          theme={theme}
          onManualTrade={handleManualTrade}
          onCutChange={setActiveCutDate}
          onRunCutBacktest={handleRunCutBacktest}
          isPlacingScissors={isPlacingScissors}
          onFinishPlacingScissors={() => {
            setIsPlacingScissors(false);
            setReplayActive(true);
          }}
          replayActive={replayActive}
          onToggleReplay={handleToggleReplay}
        />

        {/* Right Watchlist & Quote Detail Sidebar */}
        <RightWatchlist
          pairs={pairs}
          currentPair={currentPair}
          onSelectPair={handleSelectPair}
          theme={theme}
          currentPrice={candles[candles.length - 1]?.close || 1.0845}
        />
      </div>

      {/* ── 3. BOTTOM DOCKABLE STRATEGY TESTER & TRADE LOG ── */}
      <BottomStrategyTester
        strategies={strategies}
        onRunBacktest={handleRunBacktest}
        loading={loading}
        result={result}
        currentPair={currentPair}
        theme={theme}
        initialCapital={initialCapital}
      />
    </div>
  );
}
