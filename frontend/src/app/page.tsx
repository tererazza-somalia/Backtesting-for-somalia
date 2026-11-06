"use client";

import { useState, useEffect, useCallback } from "react";
import Navbar from "@/components/Navbar";
import type { ChartLayoutType } from "@/components/Navbar";
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

interface ChartSlotConfig {
  id: number;
  pair: string;
  timeframe: string;
  candles: CandleData[];
}

// Generate realistic simulated candles if backend API is offline or missing timeframe
function generateFallbackCandles(pair: string, timeframe: string): CandleData[] {
  const isJpy = pair.toUpperCase().includes("JPY");
  let basePrice = 1.1180;
  if (pair.includes("GBP")) basePrice = 1.2910;
  else if (pair.includes("JPY")) basePrice = 152.40;
  else if (pair.includes("AUD")) basePrice = 0.6580;
  else if (pair.includes("CAD")) basePrice = 1.3890;
  else if (pair.includes("CHF")) basePrice = 0.8840;

  const volatility = isJpy ? 0.35 : 0.0025;
  const wickRange = isJpy ? 0.15 : 0.0008;
  const precision = isJpy ? 3 : 5;

  const tfSeconds: Record<string, number> = {
    "1m": 60,
    "5m": 300,
    "15m": 900,
    "1H": 3600,
    "4H": 14400,
    "1D": 86400,
    "1W": 604800,
  };
  const step = tfSeconds[timeframe] || 86400;
  const count = 120;
  const nowSec = Math.floor(Date.now() / 1000);
  let startTime = nowSec - count * step;

  const result: CandleData[] = [];
  let curr = basePrice;

  for (let i = 0; i < count; i++) {
    const delta = (Math.random() - 0.495) * volatility;
    const open = curr;
    const close = open + delta;
    const high = Math.max(open, close) + Math.random() * wickRange;
    const low = Math.min(open, close) - Math.random() * wickRange;
    curr = close;
    startTime += step;

    result.push({
      time: startTime,
      open: Number(open.toFixed(precision)),
      high: Number(high.toFixed(precision)),
      low: Number(low.toFixed(precision)),
      close: Number(close.toFixed(precision)),
    });
  }
  return result;
}

export default function Dashboard() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Pairs & Strategies
  const [pairs, setPairs] = useState<ForexPair[]>([]);
  const [strategies, setStrategies] = useState<Record<string, StrategyInfo>>({});
  const [result, setResult] = useState<BacktestResult | null>(null);

  // ── MULTI-CHART LAYOUT STATE ──
  // "1": single, "2h": 2 side-by-side, "2v": 2 stacked, "4": 4-grid
  const [layout, setLayout] = useState<ChartLayoutType>("1");
  const [activeChartIndex, setActiveChartIndex] = useState<number>(0);
  const [syncPairAcrossCharts, setSyncPairAcrossCharts] = useState<boolean>(true);

  // Chart Slots (Slot 0: 1D, Slot 1: 1H, Slot 2: 15m, Slot 3: 5m)
  const [chartSlots, setChartSlots] = useState<ChartSlotConfig[]>([
    { id: 0, pair: "EURUSD", timeframe: "1D", candles: [] },
    { id: 1, pair: "EURUSD", timeframe: "1H", candles: [] },
    { id: 2, pair: "EURUSD", timeframe: "15m", candles: [] },
    { id: 3, pair: "EURUSD", timeframe: "5m", candles: [] },
  ]);

  const [initialCapital, setInitialCapital] = useState(10000);

  // Replay & Scissors
  const [isPlacingScissors, setIsPlacingScissors] = useState(false);
  const [replayActive, setReplayActive] = useState(false);
  const [activeCutDate, setActiveCutDate] = useState<string | null>(null);

  // Drawing & S/R Tools
  const [activeTool, setActiveTool] = useState<string>("crosshair");
  const [isAutoSROn, setIsAutoSROn] = useState(false);
  const [clearTrigger, setClearTrigger] = useState(0);

  // Loading & Error
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeSlot = chartSlots[activeChartIndex] || chartSlots[0];
  const currentPair = activeSlot.pair;
  const currentTimeframe = activeSlot.timeframe;

  // Load candle data for a slot
  const loadCandlesForSlot = useCallback(async (idx: number, pairStr: string, tf: string) => {
    try {
      const data = await fetchCandles(pairStr, tf);
      if (data && data.length > 0) {
        setChartSlots((prev) => {
          const next = [...prev];
          next[idx] = { ...next[idx], pair: pairStr, timeframe: tf, candles: data };
          return next;
        });
        return;
      }
    } catch (e) {}

    const fallback = generateFallbackCandles(pairStr, tf);
    setChartSlots((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], pair: pairStr, timeframe: tf, candles: fallback };
      return next;
    });
  }, []);

  // Initial Load: Fetch pairs, strategies, and candles for all slots
  useEffect(() => {
    async function init() {
      try {
        const [pairsData, strategiesData] = await Promise.all([
          fetchPairs(),
          fetchStrategies(),
        ]);
        setPairs(pairsData);
        setStrategies(strategiesData);
      } catch (err: any) {
        setError("Cannot connect to Python server on port 5000.");
      }

      // Populate initial candles for all 4 slots (Multi-Timeframe default: 1D, 1H, 15m, 5m)
      loadCandlesForSlot(0, "EURUSD", "1D");
      loadCandlesForSlot(1, "EURUSD", "1H");
      loadCandlesForSlot(2, "EURUSD", "15m");
      loadCandlesForSlot(3, "EURUSD", "5m");
    }
    init();
  }, [loadCandlesForSlot]);

  // Handle timeframe switch from top Navbar (affects active chart)
  const handleSelectTimeframe = async (newTf: string) => {
    setReplayActive(false);
    setIsPlacingScissors(false);
    setActiveCutDate(null);
    loadCandlesForSlot(activeChartIndex, activeSlot.pair, newTf);
  };

  // Handle pair switch from Watchlist or Navbar Search
  const handleSelectPair = async (pairId: string) => {
    setReplayActive(false);
    setIsPlacingScissors(false);
    setActiveCutDate(null);

    if (syncPairAcrossCharts) {
      // Sync symbol across all active charts with their respective timeframes
      chartSlots.forEach((slot, i) => {
        loadCandlesForSlot(i, pairId, slot.timeframe);
      });
    } else {
      // Update only the currently focused chart
      loadCandlesForSlot(activeChartIndex, pairId, activeSlot.timeframe);
    }
  };

  // Sub-chart specific timeframe change
  const handleSubChartTimeframe = (idx: number, newTf: string) => {
    const slot = chartSlots[idx];
    if (slot) loadCandlesForSlot(idx, slot.pair, newTf);
  };

  // Sub-chart specific pair change
  const handleSubChartPair = (idx: number, newPair: string) => {
    const slot = chartSlots[idx];
    if (slot) loadCandlesForSlot(idx, newPair, slot.timeframe);
  };

  // Replay toggle
  const handleToggleReplay = () => {
    if (replayActive || isPlacingScissors) {
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
      order_size_type: "lots",
      order_size_value: 1.0,
      process_orders_on_close: false,
      spread_pips: 0.0,
      cut_date: cutDate,
    });
  };

  // Paper Trade Logger
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

  // Helper to render an individual chart slot
  const renderChartSlot = (idx: number) => {
    const slot = chartSlots[idx];
    if (!slot) return null;
    const isMulti = layout !== "1";
    const isActive = activeChartIndex === idx;

    return (
      <CandlestickChart
        key={`chart_slot_${idx}`}
        candles={slot.candles}
        pair={slot.pair}
        timeframe={slot.timeframe}
        theme={theme}
        activeTool={isActive ? activeTool : "crosshair"}
        onToolChange={isActive ? setActiveTool : undefined}
        onManualTrade={handleManualTrade}
        onCutChange={isActive ? setActiveCutDate : undefined}
        onRunCutBacktest={handleRunCutBacktest}
        isPlacingScissors={isActive && isPlacingScissors}
        onFinishPlacingScissors={() => {
          setIsPlacingScissors(false);
          setReplayActive(true);
        }}
        replayActive={isActive && replayActive}
        onToggleReplay={handleToggleReplay}
        isAutoSROn={isAutoSROn}
        onToggleAutoSR={() => setIsAutoSROn((prev) => !prev)}
        clearTrigger={clearTrigger}
        isMultiChart={isMulti}
        isActiveChart={isActive}
        onActivate={() => setActiveChartIndex(idx)}
        onSubChartTimeframeChange={(newTf) => handleSubChartTimeframe(idx, newTf)}
        onSubChartPairChange={(newPair) => handleSubChartPair(idx, newPair)}
        pairs={pairs}
      />
    );
  };

  return (
    <div
      className={`h-screen w-screen flex flex-col overflow-hidden font-sans select-none ${
        isLight ? "bg-white text-[#131722]" : "bg-[#131722] text-[#d1d4dc]"
      }`}
    >
      {/* ── 1. TOP HEADER (TradingView Style + Multi-Chart Layout Switcher) ── */}
      {error && (
        <div className="absolute top-12 right-6 z-50 bg-[#f23645] text-white px-4 py-2.5 rounded-lg shadow-2xl flex items-center gap-3 text-xs font-semibold animate-bounce">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-white/80 hover:text-white font-bold ml-2">✕</button>
        </div>
      )}
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
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        isAutoSROn={isAutoSROn}
        onToggleAutoSR={() => setIsAutoSROn((prev) => !prev)}
        onClearLines={() => setClearTrigger((prev) => prev + 1)}
        layout={layout}
        onSelectLayout={setLayout}
        syncPairAcrossCharts={syncPairAcrossCharts}
        onToggleSyncPair={() => setSyncPairAcrossCharts((prev) => !prev)}
      />

      {/* ── 2. MAIN CENTER STAGE ── */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Drawing Toolbar */}
        <LeftDrawingToolbar
          theme={theme}
          activeTool={activeTool}
          onSelectTool={setActiveTool}
        />

        {/* Central Multi-Chart Stage (1 Chart, 2 Charts, or 4 Charts Grid) */}
        <div className="flex-1 flex overflow-hidden relative bg-white dark:bg-[#131722]">
          {/* Layout: Single Chart */}
          {layout === "1" && (
            <div className="w-full h-full relative">
              {renderChartSlot(0)}
            </div>
          )}

          {/* Layout: 2 Charts Side-by-Side (Split Horizontal) */}
          {layout === "2h" && (
            <div className="w-full h-full flex flex-row divide-x divide-[#e0e3eb] dark:divide-[#2a2e39]">
              <div className="w-1/2 h-full relative">
                {renderChartSlot(0)}
              </div>
              <div className="w-1/2 h-full relative">
                {renderChartSlot(1)}
              </div>
            </div>
          )}

          {/* Layout: 2 Charts Stacked (Split Vertical) */}
          {layout === "2v" && (
            <div className="w-full h-full flex flex-col divide-y divide-[#e0e3eb] dark:divide-[#2a2e39]">
              <div className="w-full h-1/2 relative">
                {renderChartSlot(0)}
              </div>
              <div className="w-full h-1/2 relative">
                {renderChartSlot(1)}
              </div>
            </div>
          )}

          {/* Layout: 4 Charts (2x2 Grid) */}
          {layout === "4" && (
            <div className="w-full h-full grid grid-cols-2 grid-rows-2 divide-x divide-y divide-[#e0e3eb] dark:divide-[#2a2e39]">
              <div className="w-full h-full relative">
                {renderChartSlot(0)}
              </div>
              <div className="w-full h-full relative">
                {renderChartSlot(1)}
              </div>
              <div className="w-full h-full relative">
                {renderChartSlot(2)}
              </div>
              <div className="w-full h-full relative">
                {renderChartSlot(3)}
              </div>
            </div>
          )}
        </div>

        {/* Right Watchlist & Quote Detail Sidebar */}
        <RightWatchlist
          pairs={pairs}
          currentPair={currentPair}
          onSelectPair={handleSelectPair}
          theme={theme}
          currentPrice={
            activeSlot.candles[activeSlot.candles.length - 1]?.close || 1.0845
          }
        />
      </div>

      {/* ── 3. BOTTOM DOCKABLE STRATEGY TESTER & TRADE LOG ── */}
      <BottomStrategyTester
        strategies={strategies}
        onRunBacktest={handleRunBacktest}
        loading={loading}
        result={result}
        currentPair={currentPair}
        currentTimeframe={currentTimeframe}
        onDataRefresh={() => loadCandlesForSlot(activeChartIndex, currentPair, currentTimeframe)}
        theme={theme}
        initialCapital={initialCapital}
      />
    </div>
  );
}
