"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type { CandleData, TradeRecord } from "@/lib/api";
import {
  Scissors,
  Play,
  Pause,
  SkipForward,
  TrendingUp,
  TrendingDown,
  XCircle,
  Sparkles,
  RotateCcw,
} from "lucide-react";

interface Props {
  candles: CandleData[];
  pair: string;
  timeframe?: string;
  theme?: "light" | "dark";
  onManualTrade?: (trade: TradeRecord) => void;
  onCutChange?: (cutDate: string | null) => void;
  onRunCutBacktest?: (cutDate: string) => void;
  isPlacingScissors?: boolean;
  onFinishPlacingScissors?: () => void;
  replayActive?: boolean;
  onToggleReplay?: () => void;
}

interface OpenPosition {
  type: "LONG" | "SHORT";
  entryPrice: number;
  entryDate: string;
  entryIndex: number;
  lotSize: number;
}

export default function CandlestickChart({
  candles,
  pair,
  timeframe = "1D",
  theme = "light",
  onManualTrade,
  onCutChange,
  onRunCutBacktest,
  isPlacingScissors = false,
  onFinishPlacingScissors,
  replayActive = false,
  onToggleReplay,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);
  const candlesRef = useRef<CandleData[]>([]);

  // ── FIX FLAT CANDLE BODIES (YAHOO FINANCE FOREX DATA BUG) ──
  // In 24h continuous forex, Open is the previous day's Close.
  // Yahoo Finance's forex feed buggedly sets Open == Close, collapsing candlestick bodies into 1px dashes.
  // We reconstruct the true authentic continuous forex open:
  const isJpyPair = pair.toUpperCase().includes("JPY");
  const pipThresh = isJpyPair ? 0.03 : 0.0003;

  const formattedCandles = useMemo(() => {
    return candles.map((c, i) => {
      let open = c.open;
      if (i > 0 && Math.abs(c.open - c.close) < pipThresh) {
        open = candles[i - 1].close;
      }
      return {
        ...c,
        open: open,
        high: Math.max(c.high, open, c.close),
        low: Math.min(c.low, open, c.close),
      };
    });
  }, [candles, pipThresh]);

  useEffect(() => {
    candlesRef.current = formattedCandles;
  }, [formattedCandles]);

  // Helper to format string or integer UNIX timestamp for display
  const formatDisplayTime = useCallback((t: string | number | undefined | null) => {
    if (t === undefined || t === null) return "";
    if (typeof t === "number") {
      const d = new Date(t * 1000);
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const day = String(d.getUTCDate()).padStart(2, "0");
      const h = String(d.getUTCHours()).padStart(2, "0");
      const min = String(d.getUTCMinutes()).padStart(2, "0");
      return `${y}-${m}-${day} ${h}:${min}`;
    }
    return String(t);
  }, []);

  // Hover legend
  const [hoveredCandle, setHoveredCandle] = useState<CandleData | null>(null);

  // Mouse tracking for scissors
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  // Replay scrubber state (defaults to latest bar)
  const [cutIndex, setCutIndex] = useState<number>(() => {
    return candles.length > 0 ? candles.length - 1 : 0;
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedMs, setSpeedMs] = useState<number>(700);

  // Quick Trading Pad states (TradingView top-left buy/sell widget)
  const [orderQuantity, setOrderQuantity] = useState("1.00");
  const [position, setPosition] = useState<OpenPosition | null>(null);
  const [paperBalance, setPaperBalance] = useState(10000);
  const [floatingPnl, setFloatingPnl] = useState(0);

  // Initialize cutIndex at the latest candle
  useEffect(() => {
    if (formattedCandles.length > 0) {
      setCutIndex((prev) => {
        if (prev === 0 || !replayActive) {
          return formattedCandles.length - 1;
        }
        return prev;
      });
    }
  }, [formattedCandles.length, replayActive]);

  useEffect(() => {
    if (onCutChange) {
      if (replayActive && formattedCandles[cutIndex]) {
        onCutChange(String(formattedCandles[cutIndex].time));
      } else {
        onCutChange(null);
      }
    }
  }, [replayActive, cutIndex, formattedCandles, onCutChange]);

  const currentCandle = formattedCandles[cutIndex] || formattedCandles[formattedCandles.length - 1];

  // Helper: Apply cut at candle index
  const applyCutAtIndex = useCallback(
    (targetIndex: number) => {
      if (targetIndex < 10) targetIndex = 10;
      if (targetIndex >= candlesRef.current.length)
        targetIndex = candlesRef.current.length - 1;

      setCutIndex(targetIndex);
      setIsPlaying(false);

      if (onFinishPlacingScissors) onFinishPlacingScissors();

      if (seriesRef.current && chartRef.current) {
        const visible = candlesRef.current.slice(0, targetIndex + 1);
        seriesRef.current.setData(visible);

        const total = visible.length;
        chartRef.current.timeScale().setVisibleLogicalRange({
          from: Math.max(0, total - 75), // Shows ~75 candles leading up to the cut date
          to: total + 25, // 25 blank bars into the empty future
        });
      }
    },
    [onFinishPlacingScissors]
  );

  // ── 1. Create Chart (Styled exactly like TradingView) ──
  useEffect(() => {
    if (!containerRef.current) return;

    let disposed = false;
    let resizeHandler: (() => void) | null = null;
    let resizeObserver: ResizeObserver | null = null;

    import("lightweight-charts").then((LightweightCharts) => {
      if (disposed || !containerRef.current) return;

      if (chartRef.current) {
        try {
          chartRef.current.remove();
        } catch (e) {}
        chartRef.current = null;
        seriesRef.current = null;
      }

      const isLight = theme === "light";
      const isJpy = pair.toUpperCase().includes("JPY");
      const precision = isJpy ? 3 : 5;
      const minMove = isJpy ? 0.001 : 0.00001;

      // Authentic TradingView Chart Theme
      const chart = LightweightCharts.createChart(containerRef.current, {
        layout: {
          background: { color: isLight ? "#ffffff" : "#131722" },
          textColor: isLight ? "#131722" : "#9db2c6",
          fontSize: 12,
        },
        grid: {
          vertLines: { color: isLight ? "#ebeef3" : "#1e222d", style: 1 },
          horzLines: { color: isLight ? "#ebeef3" : "#1e222d", style: 1 },
        },
        crosshair: {
          mode: 0,
          vertLine: {
            color: isLight ? "#9598a1" : "#4a5163",
            width: 1,
            style: 2,
            labelBackgroundColor: "#131722",
          },
          horzLine: {
            color: isLight ? "#9598a1" : "#4a5163",
            width: 1,
            style: 2,
            labelBackgroundColor: "#131722",
          },
        },
        timeScale: {
          borderColor: isLight ? "#e0e3eb" : "#2a2e39",
          timeVisible: true,
          secondsVisible: false,
          barSpacing: 12, // Authentic TradingView candle spacing (~75 bars visible)
          minBarSpacing: 3,
          rightOffset: 12,
        },
        rightPriceScale: {
          borderColor: isLight ? "#e0e3eb" : "#2a2e39",
          autoScale: true,
          scaleMargins: {
            top: 0.1,
            bottom: 0.15,
          },
        },
      });

      // Candlestick Series (Exact TradingView Colors & Fill)
      const seriesOptions = {
        upColor: "#089981",          // Exact TradingView Emerald Teal
        downColor: "#f23645",        // Exact TradingView Vivid Red
        borderVisible: true,         // Sharp solid border
        borderUpColor: "#089981",
        borderDownColor: "#f23645",
        wickVisible: true,
        wickUpColor: "#089981",      // Crisp 1px wicks
        wickDownColor: "#f23645",
        // Hide the dotted price-line on the right scale until data is fully loaded.
        // Leaving it visible causes a stale price label (e.g. 1.08452) to persist
        // on-screen whenever the pair changes or the chart re-mounts — Bug #3.
        priceLineVisible: false,
        priceFormat: {
          type: "price" as const,
          precision: precision,
          minMove: minMove,
        },
      };

      let series: any;
      if (typeof (chart as any).addCandlestickSeries === "function") {
        series = (chart as any).addCandlestickSeries(seriesOptions);
      } else if (LightweightCharts.CandlestickSeries) {
        series = chart.addSeries(LightweightCharts.CandlestickSeries, seriesOptions);
      }

      chartRef.current = chart;
      seriesRef.current = series;

      // Remove any injected TradingView attribution logo or watermark
      const removeTvLogos = () => {
        if (!containerRef.current) return;
        const logos = containerRef.current.querySelectorAll(
          '#tv-attr-logo, a[href*="tradingview.com"], div[class*="tv-logo"], .tv-circle-logo'
        );
        logos.forEach((el) => (el as HTMLElement).style.setProperty("display", "none", "important"));
      };
      removeTvLogos();
      setTimeout(removeTvLogos, 200);

      // Populate initial data
      const currentList = candlesRef.current;
      if (currentList.length > 0 && series) {
        try {
          const sliceEnd = replayActive ? cutIndex + 1 : currentList.length;
          const visible = currentList.slice(0, sliceEnd);
          series.setData(visible);

          // Re-enable the price line now that real data is loaded — this prevents
          // the stale label (Bug #3) that appears before setData clears the canvas.
          series.applyOptions({
            priceLineVisible: true,
            priceLineSource: 0,
            priceLineWidth: 1,
            priceLineColor: visible[visible.length - 1]?.close >= visible[visible.length - 1]?.open
              ? "#089981"  // Green line when last bar is bullish
              : "#f23645", // Red line when last bar is bearish
            priceLineStyle: 1,
          });

          const total = visible.length;
          chart.timeScale().setVisibleLogicalRange({
            from: Math.max(0, total - 75), // Shows ~75 bars for expansive market structure
            to: total + (replayActive ? 25 : 6),
          });
        } catch (e) {}
      }

      // Crosshair tracking
      chart.subscribeCrosshairMove((param: any) => {
        if (disposed) return;

        if (param && param.point) {
          setMousePos({ x: param.point.x, y: param.point.y });
        } else {
          setMousePos(null);
        }

        if (param && param.time) {
          let t: string;
          if (typeof param.time === "number") {
            const d = new Date(param.time * 1000);
            const y = d.getUTCFullYear();
            const m = String(d.getUTCMonth() + 1).padStart(2, "0");
            const day = String(d.getUTCDate()).padStart(2, "0");
            const h = String(d.getUTCHours()).padStart(2, "0");
            const min = String(d.getUTCMinutes()).padStart(2, "0");
            t = `${y}-${m}-${day} ${h}:${min}`;
          } else if (typeof param.time === "string") {
            t = param.time;
          } else {
            t = `${param.time.year}-${String(param.time.month).padStart(2, "0")}-${String(param.time.day).padStart(2, "0")}`;
          }
          setHoveredDate(t);
        } else {
          setHoveredDate(null);
        }

        if (!param || !param.time || !param.seriesData || !series) {
          setHoveredCandle(null);
          return;
        }
        try {
          const c = param.seriesData.get(series);
          setHoveredCandle(c || null);
        } catch (e) {
          setHoveredCandle(null);
        }
      });

      // Chart click for scissors cut
      chart.subscribeClick((param: any) => {
        if (disposed || !param || !param.time) return;

        const targetTime = param.time;
        const list = candlesRef.current;
        const idx = list.findIndex((c) => {
          if (c.time === targetTime) return true;
          if (typeof targetTime === "object" && targetTime !== null) {
            const formatted = `${targetTime.year}-${String(targetTime.month).padStart(2, "0")}-${String(targetTime.day).padStart(2, "0")}`;
            return c.time === formatted;
          }
          return false;
        });

        if (idx !== -1) {
          applyCutAtIndex(idx);
        }
      });

      // ── RESIZE OBSERVER (Guarantees chart expands to 100% full screen height & width) ──
      if (typeof ResizeObserver !== "undefined" && containerRef.current) {
        resizeObserver = new ResizeObserver((entries) => {
          if (disposed || !chartRef.current) return;
          for (const entry of entries) {
            const w = Math.floor(entry.contentRect.width);
            const h = Math.floor(entry.contentRect.height);
            if (w > 0 && h > 0) {
              chartRef.current.applyOptions({ width: w, height: h });
            }
          }
        });
        resizeObserver.observe(containerRef.current);
      }

      resizeHandler = () => {
        if (disposed || !containerRef.current || !chartRef.current) return;
        try {
          const w = containerRef.current.clientWidth;
          const h = containerRef.current.clientHeight;
          if (w > 0 && h > 0) {
            chartRef.current.applyOptions({ width: w, height: h });
          }
        } catch (e) {}
      };

      const dblClickHandler = () => {
        if (disposed || !chartRef.current) return;
        const total = candlesRef.current.length;
        chartRef.current.timeScale().setVisibleLogicalRange({
          from: Math.max(0, total - 75),
          to: total + 6,
        });
      };

      window.addEventListener("resize", resizeHandler);
      if (containerRef.current) {
        containerRef.current.addEventListener("dblclick", dblClickHandler);
      }
      resizeHandler();
    });

    return () => {
      disposed = true;
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (resizeHandler) {
        window.removeEventListener("resize", resizeHandler);
      }
      if (chartRef.current) {
        try {
          chartRef.current.remove();
        } catch (e) {}
        chartRef.current = null;
        seriesRef.current = null;
      }
    };
  }, [pair, theme, applyCutAtIndex]);

  // ── 2. Update visible candles on replay scrub ──
  useEffect(() => {
    if (!chartRef.current || !seriesRef.current || formattedCandles.length === 0) return;

    try {
      const sliceEnd = replayActive ? cutIndex + 1 : formattedCandles.length;
      const visible = formattedCandles.slice(0, sliceEnd);
      seriesRef.current.setData(visible);

      const total = visible.length;
      chartRef.current.timeScale().setVisibleLogicalRange({
        from: Math.max(0, total - 75), // Shows ~75 bars for expansive market structure
        to: total + (replayActive ? 25 : 6),
      });
    } catch (e) {}

    // Floating P&L
    if (position && currentCandle) {
      const currentPrice = currentCandle.close;
      const isLong = position.type === "LONG";
      const pipsDiff = isLong
        ? currentPrice - position.entryPrice
        : position.entryPrice - currentPrice;
      const pipSize = pair.includes("JPY") ? 0.01 : 0.0001;
      const pnl = (pipsDiff / pipSize) * 10 * position.lotSize;
      setFloatingPnl(Math.round(pnl * 100) / 100);
    }
  }, [cutIndex, replayActive, position, currentCandle, pair, formattedCandles]);

  // ── 3. Replay Timer ──
  useEffect(() => {
    if (!isPlaying || !replayActive) return;

    const timer = setInterval(() => {
      setCutIndex((prev) => {
        if (prev >= formattedCandles.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, speedMs);

    return () => clearInterval(timer);
  }, [isPlaying, replayActive, formattedCandles.length, speedMs]);

  // ── 4. Trading Pad Execution ──
  const handleBuy = () => {
    if (!currentCandle) return;
    if (position) handleClosePosition();

    setPosition({
      type: "LONG",
      entryPrice: currentCandle.close,
      entryDate: formatDisplayTime(currentCandle.time),
      entryIndex: cutIndex,
      lotSize: parseFloat(orderQuantity) || 1.0,
    });
    setFloatingPnl(0);
  };

  const handleSell = () => {
    if (!currentCandle) return;
    if (position) handleClosePosition();

    setPosition({
      type: "SHORT",
      entryPrice: currentCandle.close,
      entryDate: formatDisplayTime(currentCandle.time),
      entryIndex: cutIndex,
      lotSize: parseFloat(orderQuantity) || 1.0,
    });
    setFloatingPnl(0);
  };

  const handleClosePosition = () => {
    if (!position || !currentCandle) return;

    const exitPrice = currentCandle.close;
    const isLong = position.type === "LONG";
    const pipSize = pair.includes("JPY") ? 0.01 : 0.0001;
    const pips = isLong
      ? (exitPrice - position.entryPrice) / pipSize
      : (position.entryPrice - exitPrice) / pipSize;

    const pnl = Math.round(pips * 10 * position.lotSize * 100) / 100;
    setPaperBalance((prev) => Math.round((prev + pnl) * 100) / 100);

    if (onManualTrade) {
      onManualTrade({
        trade_id: Date.now(),
        type: position.type,
        entry_date: position.entryDate,
        exit_date: formatDisplayTime(currentCandle.time),
        entry_price: position.entryPrice,
        exit_price: exitPrice,
        pnl: pnl,
        pnl_pct: Math.round((pnl / paperBalance) * 10000) / 100,
        bars_held: cutIndex - position.entryIndex,
      });
    }

    setPosition(null);
    setFloatingPnl(0);
  };

  const isLight = theme === "light";
  const displayCandle = hoveredCandle || currentCandle;
  const isUp = displayCandle ? displayCandle.close >= displayCandle.open : true;
  const changeVal = displayCandle ? (displayCandle.close - displayCandle.open).toFixed(5) : "0.00000";
  const changePct =
    displayCandle && displayCandle.open > 0
      ? (((displayCandle.close - displayCandle.open) / displayCandle.open) * 100).toFixed(2)
      : "0.00";
  const hiddenBarsCount = candles.length - 1 - cutIndex;
  const displayPair = pair.length === 6 ? `${pair.slice(0, 3)}/${pair.slice(3)}` : pair;

  return (
    <div className="flex-1 flex flex-col relative select-none w-full h-full min-h-0 bg-white dark:bg-[#131722] overflow-hidden">
      {/* ── TOP-LEFT TRADINGVIEW OVERLAY: Symbol Info, Interactive BUY/SELL Pad & Live OHLC ── */}
      <div className="absolute top-2.5 left-3.5 z-20 flex flex-col gap-1.5 pointer-events-auto">
        {/* Row 1: Symbol & OHLC values */}
        <div className="flex items-center gap-2.5 text-xs font-semibold">
          <div className="flex items-center gap-1.5 font-bold text-[#131722] dark:text-white">
            <span className="text-sm">{displayPair}</span>
            <span className="text-[11px] font-normal text-[#787b86]">&bull; {timeframe} &bull; OANDA</span>
          </div>

          {displayCandle && (
            <div className="flex items-center gap-2 text-[11px] font-mono">
              <span className="text-[#787b86]">
                O <span className={isUp ? "text-[#089981]" : "text-[#f23645]"}>{displayCandle.open}</span>
              </span>
              <span className="text-[#787b86]">
                H <span className={isUp ? "text-[#089981]" : "text-[#f23645]"}>{displayCandle.high}</span>
              </span>
              <span className="text-[#787b86]">
                L <span className={isUp ? "text-[#089981]" : "text-[#f23645]"}>{displayCandle.low}</span>
              </span>
              <span className="text-[#787b86]">
                C <span className={isUp ? "text-[#089981] font-bold" : "text-[#f23645] font-bold"}>{displayCandle.close}</span>
              </span>
              <span className={`font-bold ${isUp ? "text-[#089981]" : "text-[#f23645]"}`}>
                {Number(changeVal) >= 0 ? "+" : ""}{changeVal} ({Number(changePct) >= 0 ? "+" : ""}{changePct}%)
              </span>
            </div>
          )}
        </div>

        {/* Row 2: TRADINGVIEW INTERACTIVE BUY/SELL ORDER PAD (From user's screenshot) */}
        <div className="flex items-center gap-1">
          <div className="flex items-stretch rounded border border-[#e0e3eb] dark:border-[#2a2e39] bg-white dark:bg-[#1e222d] shadow-sm overflow-hidden text-xs">
            {/* SELL BUTTON */}
            <button
              onClick={handleSell}
              className="px-2.5 py-1 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 text-[#f23645] font-bold flex flex-col items-center border-r border-[#e0e3eb] dark:border-[#2a2e39] transition-colors"
            >
              <span className="text-[11px] font-mono">{currentCandle?.close || "0.00000"}</span>
              <span className="text-[9px] uppercase tracking-wider font-extrabold">SELL</span>
            </button>

            {/* LOT SIZE INPUT */}
            <div className="flex items-center px-1.5 bg-gray-50 dark:bg-[#131722]">
              <input
                type="text"
                value={orderQuantity}
                onChange={(e) => setOrderQuantity(e.target.value)}
                className="w-10 text-center font-mono font-bold text-xs bg-transparent outline-none text-[#131722] dark:text-white"
              />
            </div>

            {/* BUY BUTTON */}
            <button
              onClick={handleBuy}
              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 text-[#2962ff] font-bold flex flex-col items-center border-l border-[#e0e3eb] dark:border-[#2a2e39] transition-colors"
            >
              <span className="text-[11px] font-mono">{currentCandle?.close || "0.00000"}</span>
              <span className="text-[9px] uppercase tracking-wider font-extrabold">BUY</span>
            </button>
          </div>

          {/* OPEN POSITION BADGE */}
          {position && (
            <div className="flex items-center gap-1.5 bg-white dark:bg-[#1e222d] border border-[#e0e3eb] dark:border-[#2a2e39] px-2 py-1 rounded shadow-sm text-xs">
              <span className={`font-bold ${position.type === "LONG" ? "text-[#089981]" : "text-[#f23645]"}`}>
                {position.type} @ {position.entryPrice}
              </span>
              <span className={`font-mono font-bold ${floatingPnl >= 0 ? "text-[#089981]" : "text-[#f23645]"}`}>
                {floatingPnl >= 0 ? "+" : ""}${floatingPnl}
              </span>
              <button
                onClick={handleClosePosition}
                className="bg-red-500 hover:bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded font-bold"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── ✂️ THE FLOATING REPLAY CONTROLLER (TradingView Bar Replay Dock) ── */}
      {replayActive && (
        <div className="absolute top-3 right-4 z-30 flex items-center gap-2 bg-white dark:bg-[#1e222d] border border-[#e0e3eb] dark:border-[#2a2e39] rounded-lg shadow-xl px-3 py-1.5 text-xs animate-fadeIn">
          <div className="flex items-center gap-1.5 font-bold text-amber-500 pr-2 border-r border-gray-200 dark:border-gray-700">
            <Scissors size={14} className="-rotate-90" />
            <span>{formatDisplayTime(currentCandle?.time)}</span>
          </div>

          {/* Scrubber slider */}
          <input
            type="range"
            min={15}
            max={formattedCandles.length - 1}
            value={cutIndex}
            onChange={(e) => {
              setIsPlaying(false);
              setCutIndex(parseInt(e.target.value));
            }}
            className="w-28 h-1.5 bg-gray-200 dark:bg-gray-700 rounded cursor-pointer accent-[#2962ff]"
          />

          {/* Play / Pause */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-[#131722] dark:text-white"
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          </button>

          {/* Step 1 Bar */}
          <button
            onClick={() => {
              setIsPlaying(false);
              if (cutIndex < formattedCandles.length - 1) setCutIndex((prev) => prev + 1);
            }}
            className="px-2 py-0.5 rounded font-bold bg-blue-50 text-[#2962ff] hover:bg-blue-100 dark:bg-blue-950/60 transition-colors flex items-center gap-1"
            title="Reveal Next 1 Bar"
          >
            <SkipForward size={13} />
            <span>Step</span>
          </button>

          {/* Speed Selector */}
          <select
            value={speedMs}
            onChange={(e) => setSpeedMs(parseInt(e.target.value))}
            className="bg-transparent border border-gray-200 dark:border-gray-700 rounded px-1 text-xs cursor-pointer text-[#131722] dark:text-white"
          >
            <option value={1500}>0.5x</option>
            <option value={700}>1x</option>
            <option value={350}>2x</option>
            <option value={150}>5x</option>
          </select>

          {/* Backtest Up to Cut Button */}
          {onRunCutBacktest && (
            <button
              onClick={() => onRunCutBacktest(String(currentCandle.time))}
              className="bg-[#089981] hover:bg-[#07806c] text-white px-2.5 py-1 rounded font-bold flex items-center gap-1 text-[11px] shadow-sm ml-1"
            >
              <Sparkles size={11} /> Backtest Cut
            </button>
          )}

          {/* Exit Replay */}
          <button
            onClick={onToggleReplay}
            className="text-gray-400 hover:text-red-500 p-1 ml-1"
            title="Restore Full Chart"
          >
            <XCircle size={15} />
          </button>
        </div>
      )}

      {/* ── ✂️ RED VERTICAL CUT LINE FOLLOWING MOUSE IN CUT MODE ── */}
      {isPlacingScissors && mousePos && (
        <div
          className="absolute top-0 bottom-0 pointer-events-none z-30 flex flex-col items-center"
          style={{ left: `${mousePos.x}px` }}
        >
          <div className="bg-[#f23645] text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-lg flex items-center gap-1 animate-pulse">
            <Scissors size={11} className="-rotate-90" />
            <span>Click to Cut</span>
          </div>
          <div className="w-[1.5px] flex-1 bg-[#f23645] border-r border-dashed border-red-300 shadow-[0_0_8px_rgba(242,54,69,0.8)]" />
          {hoveredDate && (
            <div className="bg-[#131722] text-white text-[10px] font-mono font-bold px-1.5 py-0.5 rounded mb-8 shadow-md">
              {hoveredDate}
            </div>
          )}
        </div>
      )}

      {/* ── THE CANVAS CONTAINER (Fills 100% Full Height & Width) ── */}
      <div
        ref={containerRef}
        className={`w-full h-full flex-1 relative min-h-0 ${isPlacingScissors ? "cursor-crosshair" : ""}`}
        style={{ minHeight: "100%", width: "100%" }}
      />

      {/* ── WATERMARK (Like TradingView bottom-left watermark) ── */}
      <div className="absolute bottom-6 left-4 pointer-events-none opacity-20 dark:opacity-10 text-xs font-black tracking-widest uppercase text-gray-500">
        ilyaas backtesting
      </div>
    </div>
  );
}
