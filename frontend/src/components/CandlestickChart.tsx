"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type { CandleData, TradeRecord, ForexPair } from "@/lib/api";
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
  Target,
  Minus,
  Trash2,
  Eye,
  EyeOff,
  ChevronRight,
} from "lucide-react";

interface Props {
  candles: CandleData[];
  pair: string;
  timeframe?: string;
  theme?: "light" | "dark";
  activeTool?: string;
  onToolChange?: (tool: string) => void;
  onManualTrade?: (trade: TradeRecord) => void;
  onCutChange?: (cutDate: string | null) => void;
  onRunCutBacktest?: (cutDate: string) => void;
  isPlacingScissors?: boolean;
  onFinishPlacingScissors?: () => void;
  replayActive?: boolean;
  onToggleReplay?: () => void;
  isAutoSROn?: boolean;
  onToggleAutoSR?: () => void;
  clearTrigger?: number;
  isMultiChart?: boolean;
  isActiveChart?: boolean;
  onActivate?: () => void;
  onSubChartTimeframeChange?: (newTf: string) => void;
  onSubChartPairChange?: (newPair: string) => void;
  pairs?: ForexPair[];
}

interface OpenPosition {
  type: "LONG" | "SHORT";
  entryPrice: number;
  entryDate: string;
  entryIndex: number;
  lotSize: number;
}

interface SRLine {
  id: string;
  type: "support" | "resistance";
  price: number;
  isAuto: boolean;
  lineObj?: any;
}

interface ContextMenuState {
  x: number;
  y: number;
  price: number | null;
  clickedLine: SRLine | null;
}

export default function CandlestickChart({
  candles,
  pair,
  timeframe = "1D",
  theme = "light",
  activeTool = "crosshair",
  onToolChange,
  onManualTrade,
  onCutChange,
  onRunCutBacktest,
  isPlacingScissors = false,
  onFinishPlacingScissors,
  replayActive = false,
  onToggleReplay,
  isAutoSROn = false,
  onToggleAutoSR,
  clearTrigger = 0,
  isMultiChart = false,
  isActiveChart = true,
  onActivate,
  onSubChartTimeframeChange,
  onSubChartPairChange,
  pairs = [],
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);
  const futureSeriesRef = useRef<any>(null);
  const candlesRef = useRef<CandleData[]>([]);
  const lastVisibleIndexRef = useRef<number | null>(null);
  const replayLineIndexRef = useRef<number | null>(null);
  const replayOverlayRef = useRef<HTMLDivElement>(null);
  const replayBadgeRef = useRef<HTMLDivElement>(null);
  const lastHoverIndexRef = useRef<number | null>(null);

  // ── 📏 MEASURE TOOL REFS & STATE ──
  const measureCanvasRef = useRef<HTMLCanvasElement>(null);
  const measureBadgeRef = useRef<HTMLDivElement>(null);
  const isMeasuringRef = useRef(false);
  const isLockedRef = useRef(false);
  const measureStartRef = useRef<{ x: number; y: number } | null>(null);
  const measureEndRef = useRef<{ x: number; y: number } | null>(null);

  // ── 🎯 SUPPORT & RESISTANCE STATE ──
  const [manualLines, setManualLines] = useState<SRLine[]>([]);
  const [autoLines, setAutoLines] = useState<SRLine[]>([]);
  const [isSRListCollapsed, setIsSRListCollapsed] = useState(false);
  const manualLinesRef = useRef<SRLine[]>([]);
  manualLinesRef.current = manualLines;

  // ── 🖱️ TRADINGVIEW CONTEXT MENU & OVERLAY TOGGLES ──
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [showTradingPad, setShowTradingPad] = useState(false);
  const [showSRPanel, setShowSRPanel] = useState(true);

  // ── ✂️ SCISSORS & REPLAY REFS & STATE ──
  const [replayLine, setReplayLine] = useState<{ x: number; label: string } | null>(null);
  const isPlacingScissorsRef = useRef(isPlacingScissors);
  isPlacingScissorsRef.current = isPlacingScissors;

  const onFinishPlacingScissorsRef = useRef(onFinishPlacingScissors);
  onFinishPlacingScissorsRef.current = onFinishPlacingScissors;

  const formatReplayBadgeRef = useRef<(t: string | number | undefined | null) => string>(() => "");
  const updateReplayOverlayRef = useRef<(index: number, fallbackX?: number) => void>(() => {});
  const updateReplayLineAtIndexRef = useRef<(index: number, fallbackX?: number) => void>(() => {});
  const applyBarReplaySplitRef = useRef<(index: number) => void>(() => {});

  // ── FIX FLAT CANDLE BODIES ──
  const isJpyPair = pair.toUpperCase().includes("JPY");
  const pipThresh = isJpyPair ? 0.03 : 0.0003;
  const precision = isJpyPair ? 3 : 5;

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

  const parseCandleDate = useCallback((t: string | number | undefined | null): Date | null => {
    if (t === undefined || t === null) return null;
    if (typeof t === "number") return new Date(t * 1000);
    const raw = String(t).trim();
    const iso = raw.includes("T")
      ? raw
      : raw.length <= 10
        ? `${raw}T00:00:00Z`
        : `${raw.replace(" ", "T")}Z`;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  }, []);

  const formatReplayBadge = useCallback(
    (t: string | number | undefined | null) => {
      const d = parseCandleDate(t);
      if (!d) return t == null ? "" : String(t);
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const dd = String(d.getUTCDate()).padStart(2, "0");
      const yy = String(d.getUTCFullYear()).slice(-2);
      const hh = String(d.getUTCHours()).padStart(2, "0");
      const mm = String(d.getUTCMinutes()).padStart(2, "0");
      return `Re: ${days[d.getUTCDay()]} ${dd} ${months[d.getUTCMonth()]} '${yy} ${hh}:${mm}`;
    },
    [parseCandleDate]
  );

  const [hoveredCandle, setHoveredCandle] = useState<CandleData | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  const [cutIndex, setCutIndex] = useState<number>(() => {
    return candles.length > 0 ? candles.length - 1 : 0;
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedMs, setSpeedMs] = useState<number>(700);

  const [orderQuantity, setOrderQuantity] = useState("1.00");
  const [position, setPosition] = useState<OpenPosition | null>(null);
  const [paperBalance, setPaperBalance] = useState(10000);
  const [floatingPnl, setFloatingPnl] = useState(0);

  const initializedRef = useRef(false);
  useEffect(() => {
    if (formattedCandles.length > 0 && !initializedRef.current) {
      initializedRef.current = true;
      setCutIndex(formattedCandles.length - 1);
    }
    if (formattedCandles.length > 0 && !replayActive) {
      setCutIndex(formattedCandles.length - 1);
    }
  }, [formattedCandles, replayActive]);

  useEffect(() => {
    if (onCutChange) {
      if (replayActive && formattedCandles[cutIndex]) {
        onCutChange(String(formattedCandles[cutIndex].time));
      } else {
        onCutChange(null);
      }
    }
  }, [replayActive, cutIndex, formattedCandles, onCutChange]);

  // ── 🌐 LIVE FOREX WEBSOCKET STREAMING ──
  const [isLiveActive, setIsLiveActive] = useState(true);
  const [liveQuote, setLiveQuote] = useState<{
    price: number;
    bid: number;
    ask: number;
    time: number;
  } | null>(null);
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [liveClock, setLiveClock] = useState("");

  useEffect(() => {
    setLiveClock(new Date().toISOString().slice(11, 19));
    const t = setInterval(() => {
      setLiveClock(new Date().toISOString().slice(11, 19));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const applyLiveTick = useCallback(
    (quote: number, bid: number, ask: number, epoch: number) => {
      setLiveQuote({ price: quote, bid, ask, time: epoch });

      if (!seriesRef.current || candlesRef.current.length === 0) return;

      const list = candlesRef.current;
      const lastIdx = list.length - 1;
      const lastCandle = list[lastIdx];
      if (!lastCandle) return;

      const isIntraday = typeof lastCandle.time === "number";
      let targetTime: string | number;

      if (isIntraday) {
        const tfSec =
          timeframe === "1m" ? 60 :
          timeframe === "5m" ? 300 :
          timeframe === "15m" ? 900 :
          timeframe === "30m" ? 1800 :
          timeframe === "1h" || timeframe === "1H" ? 3600 :
          timeframe === "4h" || timeframe === "4H" ? 14400 : 86400;

        const nowSec = epoch || Math.floor(Date.now() / 1000);
        targetTime = Math.floor(nowSec / tfSec) * tfSec;
      } else {
        const now = new Date();
        const y = now.getUTCFullYear();
        const m = String(now.getUTCMonth() + 1).padStart(2, "0");
        const d = String(now.getUTCDate()).padStart(2, "0");
        targetTime = `${y}-${m}-${d}`;
      }

      if (lastCandle.time === targetTime || (isIntraday && typeof targetTime === "number" && lastCandle.time > targetTime)) {
        const updatedCandle: CandleData = {
          ...lastCandle,
          high: Math.max(lastCandle.high, quote),
          low: Math.min(lastCandle.low, quote),
          close: quote,
        };
        list[lastIdx] = updatedCandle;
        try {
          seriesRef.current.update(updatedCandle);
        } catch (e) {}
      } else if (lastCandle.time < targetTime) {
        const newLiveCandle: CandleData = {
          time: targetTime,
          open: lastCandle.close,
          high: Math.max(lastCandle.close, quote),
          low: Math.min(lastCandle.close, quote),
          close: quote,
        };
        list.push(newLiveCandle);
        try {
          seriesRef.current.update(newLiveCandle);
          if (chartRef.current) {
            const total = list.length;
            chartRef.current.timeScale().setVisibleLogicalRange({
              from: Math.max(0, total - 45),
              to: total + 6,
            });
          }
        } catch (e) {}
      }
    },
    [timeframe]
  );

  useEffect(() => {
    if (!isLiveActive || replayActive || formattedCandles.length === 0) return;

    let ws: WebSocket | null = null;
    let fallbackTimer: any = null;
    let isDisposed = false;
    let receivedFirstTick = false;

    const startFallbackTicks = () => {
      if (fallbackTimer || isDisposed) return;
      const last = candlesRef.current[candlesRef.current.length - 1];
      let simPrice = last ? last.close : 1.0845;
      const spreadPips = pair.toUpperCase().includes("JPY") ? 0.02 : 0.00015;

      fallbackTimer = setInterval(() => {
        if (isDisposed) return;
        const tickMove = (Math.random() - 0.495) * (pair.toUpperCase().includes("JPY") ? 0.015 : 0.00008);
        simPrice = Math.max(0.0001, simPrice + tickMove);
        const bid = simPrice;
        const ask = simPrice + spreadPips;
        const epoch = Math.floor(Date.now() / 1000);
        applyLiveTick(simPrice, bid, ask, epoch);
      }, 1000);
    };

    try {
      const cleanPair = pair.toUpperCase().replace("/", "").trim();
      const symbolMap: Record<string, string> = {
        EURUSD: "frxEURUSD",
        GBPUSD: "frxGBPUSD",
        USDJPY: "frxUSDJPY",
        AUDUSD: "frxAUDUSD",
        USDCAD: "frxUSDCAD",
        USDCHF: "frxUSDCHF",
        NZDUSD: "frxNZDUSD",
        EURGBP: "frxEURGBP",
      };
      const derivSymbol = symbolMap[cleanPair] || `frx${cleanPair}`;

      ws = new WebSocket("wss://ws.derivws.com/websockets/v3?app_id=1089");

      ws.onopen = () => {
        if (isDisposed) return;
        setIsWsConnected(true);
        ws?.send(JSON.stringify({ ticks: derivSymbol }));
      };

      ws.onmessage = (event) => {
        if (isDisposed) return;
        try {
          const data = JSON.parse(event.data);
          if (data.tick && data.tick.quote) {
            receivedFirstTick = true;
            if (fallbackTimer) {
              clearInterval(fallbackTimer);
              fallbackTimer = null;
            }
            const quote = Number(data.tick.quote);
            const bid = Number(data.tick.bid ?? quote);
            const ask = Number(data.tick.ask ?? quote);
            const time = Number(data.tick.epoch ?? Math.floor(Date.now() / 1000));
            applyLiveTick(quote, bid, ask, time);
          }
        } catch (e) {}
      };

      ws.onerror = () => {
        startFallbackTicks();
      };

      ws.onclose = () => {
        setIsWsConnected(false);
      };
    } catch (err) {
      startFallbackTicks();
    }

    const safetyTimer = setTimeout(() => {
      if (!receivedFirstTick && !isDisposed) {
        startFallbackTicks();
      }
    }, 2500);

    return () => {
      isDisposed = true;
      clearTimeout(safetyTimer);
      if (fallbackTimer) clearInterval(fallbackTimer);
      if (ws) {
        try {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ forget_all: "ticks" }));
          }
          ws.close();
        } catch (e) {}
      }
    };
  }, [pair, isLiveActive, replayActive, formattedCandles.length, applyLiveTick]);

  const currentCandle = useMemo(() => {
    const list = candlesRef.current.length > 0 ? candlesRef.current : formattedCandles;
    const base = replayActive
      ? formattedCandles[cutIndex] || formattedCandles[formattedCandles.length - 1]
      : list[list.length - 1] || formattedCandles[formattedCandles.length - 1];

    if (!base) return null;
    if (!replayActive && liveQuote) {
      return {
        ...base,
        high: Math.max(base.high, liveQuote.price),
        low: Math.min(base.low, liveQuote.price),
        close: liveQuote.price,
      };
    }
    return base;
  }, [formattedCandles, cutIndex, replayActive, liveQuote]);

  const applyVisibleToIndex = useCallback((index: number | null, force = false) => {
    const list = candlesRef.current;
    if (!seriesRef.current) return;

    if (index === null || list.length === 0) {
      lastVisibleIndexRef.current = null;
      try {
        seriesRef.current.setData(list);
        futureSeriesRef.current?.setData([]);
      } catch (e) {}
      return;
    }

    const idx = Math.max(0, Math.min(Math.round(index), list.length - 1));
    if (!force && lastVisibleIndexRef.current === idx) return;
    lastVisibleIndexRef.current = idx;

    try {
      seriesRef.current.setData(list.slice(0, idx + 1));
      futureSeriesRef.current?.setData([]);
    } catch (e) {}
  }, []);

  const updateReplayLineAtIndex = useCallback(
    (index: number, fallbackX?: number) => {
      const list = candlesRef.current;
      const candle = list[index];
      if (!candle || !chartRef.current) return;
      replayLineIndexRef.current = index;

      let x = fallbackX;
      try {
        const coord = chartRef.current?.timeScale()?.timeToCoordinate(candle.time);
        if (coord != null) x = coord;
      } catch (e) {}
      if (x == null) return;

      setReplayLine({
        x,
        label: formatReplayBadge(candle.time),
      });

      const el = replayOverlayRef.current;
      if (el) {
        el.style.display = "block";
        el.style.left = `${x}px`;
      }
      if (replayBadgeRef.current) {
        replayBadgeRef.current.textContent = formatReplayBadge(candle.time);
      }
    },
    [formatReplayBadge]
  );

  const updateReplayOverlay = updateReplayLineAtIndex;

  // ── PREVIEW SPLIT: Solid left, Transparent right (TradingView preview mode) ──
  const applyBarReplaySplit = useCallback((hoverIdx: number) => {
    const list = candlesRef.current;
    if (!seriesRef.current || !futureSeriesRef.current || list.length === 0) return;

    if (lastHoverIndexRef.current === hoverIdx) return;
    lastHoverIndexRef.current = hoverIdx;

    const safeIdx = Math.max(0, Math.min(hoverIdx, list.length - 1));
    try {
      seriesRef.current.setData(list.slice(0, safeIdx + 1));
      futureSeriesRef.current.setData(list.slice(safeIdx + 1));
    } catch (e) {}
  }, []);

  const applyCutAtIndex = useCallback(
    (targetIndex: number) => {
      isPlacingScissorsRef.current = false;
      const list = candlesRef.current;

      const safeIdx = Math.max(0, Math.min(targetIndex, list.length - 1));
      setCutIndex(safeIdx);
      setIsPlaying(false);

      // 1. Solid candles up to cut point
      lastVisibleIndexRef.current = safeIdx;
      lastHoverIndexRef.current = null;
      try {
        seriesRef.current?.setData(list.slice(0, safeIdx + 1));
      } catch (e) {}

      // 2. Hide all future candles 100%!
      try {
        futureSeriesRef.current?.setData([]);
      } catch (e) {}

      // 3. Hide scissors line completely
      setReplayLine(null);
      replayLineIndexRef.current = null;
      if (replayOverlayRef.current) replayOverlayRef.current.style.display = "none";

      if (onFinishPlacingScissorsRef.current) {
        onFinishPlacingScissorsRef.current();
      }
    },
    []
  );

  useEffect(() => {
    if (!isPlacingScissors || !chartRef.current) return;

    const handleCutClick = (param: any) => {
      if (!param) return;

      const list = candlesRef.current;
      let idx = -1;

      if (param.time) {
        const targetTime = param.time;
        idx = list.findIndex((c) => {
          if (c.time === targetTime) return true;
          if (typeof targetTime === "object" && targetTime !== null) {
            const formatted = `${targetTime.year}-${String(targetTime.month).padStart(2, "0")}-${String(targetTime.day).padStart(2, "0")}`;
            return c.time === formatted;
          }
          return false;
        });
      }

      // Fallback: If param.time didn't match directly, use mouse X coordinate to find closest bar
      if (idx === -1 && param.point && chartRef.current) {
        try {
          const logical = chartRef.current.timeScale().coordinateToLogical(param.point.x);
          if (logical !== null) {
            const roundedIdx = Math.round(logical);
            if (roundedIdx >= 0 && roundedIdx < list.length) {
              idx = roundedIdx;
            }
          }
        } catch (e) {}
      }

      if (idx !== -1) {
        applyCutAtIndex(idx);
      }
    };

    chartRef.current.subscribeClick(handleCutClick);

    return () => {
      if (chartRef.current) {
        try {
          chartRef.current.unsubscribeClick(handleCutClick);
        } catch (e) {}
      }
    };
  }, [isPlacingScissors, applyCutAtIndex]);

  formatReplayBadgeRef.current = formatReplayBadge;
  updateReplayOverlayRef.current = updateReplayOverlay;
  updateReplayLineAtIndexRef.current = updateReplayLineAtIndex;
  applyBarReplaySplitRef.current = applyBarReplaySplit;

  // ── ⚡ ULTRA-SMOOTH STEP FORWARD (O(1) incremental update, no lag) ──
  const stepForward = useCallback(() => {
    const list = candlesRef.current.length > 0 ? candlesRef.current : formattedCandles;
    if (cutIndex >= list.length - 1) {
      setIsPlaying(false);
      return;
    }
    const nextIdx = cutIndex + 1;
    const nextBar = list[nextIdx];
    setCutIndex(nextIdx);

    if (seriesRef.current && nextBar) {
      try {
        seriesRef.current.update(nextBar);
        lastVisibleIndexRef.current = nextIdx;
      } catch (e) {
        applyVisibleToIndex(nextIdx, true);
      }
    }
    updateReplayLineAtIndex(nextIdx);
  }, [cutIndex, formattedCandles, applyVisibleToIndex, updateReplayLineAtIndex]);

  // ── 🎬 REPLAY SCRUB & STEP (future bars stay 100% hidden) ──
  useEffect(() => {
    if (!seriesRef.current || !chartRef.current || !replayActive || isPlacingScissors) return;

    applyVisibleToIndex(cutIndex);
    updateReplayLineAtIndex(cutIndex);

    if (position) {
      const candle = formattedCandles[cutIndex];
      if (candle) {
        const currentPrice = candle.close;
        const isLong = position.type === "LONG";
        const pipsDiff = isLong
          ? currentPrice - position.entryPrice
          : position.entryPrice - currentPrice;
        const pipSize = pair.includes("JPY") ? 0.01 : 0.0001;
        const pnl = (pipsDiff / pipSize) * 10 * position.lotSize;
        setFloatingPnl(Math.round(pnl * 100) / 100);
      }
    }
  }, [cutIndex, replayActive, isPlacingScissors, position, pair, formattedCandles, applyVisibleToIndex, updateReplayLineAtIndex]);

  // ── ⏱️ REPLAY TIMER (Advances cutIndex on Play with 60fps incremental updates) ──
  useEffect(() => {
    if (!isPlaying || !replayActive) return;

    const timer = setInterval(() => {
      setCutIndex((prev) => {
        const list = candlesRef.current.length > 0 ? candlesRef.current : formattedCandles;
        const maxIdx = list.length - 1;
        if (prev >= maxIdx) {
          setIsPlaying(false);
          return prev;
        }
        const nextIdx = prev + 1;
        const nextBar = list[nextIdx];
        if (seriesRef.current && nextBar) {
          try {
            seriesRef.current.update(nextBar);
            lastVisibleIndexRef.current = nextIdx;
          } catch (e) {}
        }
        updateReplayLineAtIndex(nextIdx);
        return nextIdx;
      });
    }, speedMs);

    return () => clearInterval(timer);
  }, [isPlaying, replayActive, speedMs, formattedCandles, updateReplayLineAtIndex]);

  // ── 🔄 RESTORE FULL CHART ON EXIT REPLAY OR CANCEL SCISSORS ──
  useEffect(() => {
    if (replayActive || isPlacingScissors) return;
    if (!seriesRef.current || !chartRef.current) return;

    applyVisibleToIndex(null, true);
    replayLineIndexRef.current = null;
    lastHoverIndexRef.current = null;
    setReplayLine(null);
    try {
      futureSeriesRef.current?.setData([]);
    } catch (e) {}
    if (replayOverlayRef.current) replayOverlayRef.current.style.display = "none";
  }, [replayActive, isPlacingScissors, formattedCandles, applyVisibleToIndex]);

  useEffect(() => {
    if (!isPlacingScissors || !chartRef.current) return;
    const list = candlesRef.current;
    if (list.length === 0) return;
    lastVisibleIndexRef.current = null;
    lastHoverIndexRef.current = null;
    try {
      const range = chartRef.current.timeScale().getVisibleLogicalRange();
      const mid = range ? Math.round((range.from + range.to) / 2) : Math.floor(list.length / 2);
      const idx = Math.max(0, Math.min(mid, list.length - 1));
      applyBarReplaySplit(idx);
      updateReplayLineAtIndex(idx);
    } catch (e) {}
  }, [isPlacingScissors, applyBarReplaySplit, updateReplayLineAtIndex]);

  useEffect(() => {
    if (!chartRef.current) return;
    const hideCrosshair = isPlacingScissors || replayActive;
    try {
      chartRef.current.applyOptions({
        crosshair: {
          vertLine: { visible: !hideCrosshair },
          horzLine: { visible: !isPlacingScissors },
        },
      });
    } catch (e) {}
  }, [isPlacingScissors, replayActive]);

  // ── 📏 MEASURE TOOL LOGIC ──
  const clearMeasure = useCallback(() => {
    isMeasuringRef.current = false;
    isLockedRef.current = false;
    measureStartRef.current = null;
    measureEndRef.current = null;
    if (measureCanvasRef.current) {
      const ctx = measureCanvasRef.current.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, measureCanvasRef.current.width, measureCanvasRef.current.height);
    }
    if (measureBadgeRef.current) {
      measureBadgeRef.current.style.display = "none";
    }
  }, []);

  const drawMeasure = useCallback(
    (start: { x: number; y: number }, end: { x: number; y: number }) => {
      const canvas = measureCanvasRef.current;
      if (!canvas || !seriesRef.current || !chartRef.current) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const priceStart = seriesRef.current.coordinateToPrice(start.y);
      const priceEnd = seriesRef.current.coordinateToPrice(end.y);
      if (priceStart === null || priceEnd === null) return;

      const isJpy = pair.toUpperCase().includes("JPY");
      const pipMultiplier = isJpy ? 100 : 10000;
      const prec = isJpy ? 3 : 5;
      const priceDiff = priceEnd - priceStart;
      const pips = Math.round(priceDiff * pipMultiplier * 10) / 10;
      const pctDiff = (priceDiff / priceStart) * 100;
      const isPositive = priceDiff >= 0;

      let barCount = 0;
      try {
        const timeScale = chartRef.current.timeScale();
        const l1 = timeScale.coordinateToLogical(start.x);
        const l2 = timeScale.coordinateToLogical(end.x);
        if (l1 !== null && l2 !== null) {
          barCount = Math.abs(Math.round(l2 - l1));
        }
      } catch (e) {}

      const x = Math.min(start.x, end.x);
      const y = Math.min(start.y, end.y);
      const w = Math.abs(start.x - end.x);
      const h = Math.abs(start.y - end.y);

      const fillColor = isPositive ? "rgba(8, 153, 129, 0.16)" : "rgba(242, 54, 69, 0.16)";
      const borderColor = isPositive ? "#089981" : "#f23645";

      ctx.fillStyle = fillColor;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(x, y, w, h);

      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      ctx.setLineDash([]);

      const badge = measureBadgeRef.current;
      if (badge) {
        const sign = isPositive ? "+" : "";
        badge.innerHTML = `
          <div style="font-weight: 700; color: ${borderColor}; font-size: 13px; display: flex; align-items: center; gap: 4px;">
            <span>${sign}${pips} pips</span>
            <span style="font-size: 11px; opacity: 0.85;">(${sign}${pctDiff.toFixed(2)}%)</span>
          </div>
          <div style="font-size: 11px; color: ${theme === 'light' ? '#5d606b' : '#9b9eb5'}; margin-top: 3px; font-weight: 500;">
            ${barCount} bars &bull; ${priceStart.toFixed(prec)} ➔ ${priceEnd.toFixed(prec)}
          </div>
        `;
        badge.style.display = "block";

        const badgeW = 190;
        const badgeH = 55;
        let badgeX = end.x + 14;
        let badgeY = end.y + 14;
        if (badgeX + badgeW > canvas.width) badgeX = end.x - badgeW - 10;
        if (badgeY + badgeH > canvas.height) badgeY = end.y - badgeH - 10;
        badge.style.left = `${Math.max(10, badgeX)}px`;
        badge.style.top = `${Math.max(10, badgeY)}px`;
      }
    },
    [pair, theme]
  );

  const syncMeasureCanvasSize = useCallback(() => {
    if (measureCanvasRef.current && containerRef.current) {
      measureCanvasRef.current.width = containerRef.current.clientWidth;
      measureCanvasRef.current.height = containerRef.current.clientHeight;
      if (measureStartRef.current && measureEndRef.current && activeTool === "measure") {
        drawMeasure(measureStartRef.current, measureEndRef.current);
      }
    }
  }, [drawMeasure, activeTool]);

  useEffect(() => {
    syncMeasureCanvasSize();
    if (activeTool !== "measure") {
      clearMeasure();
    }
  }, [activeTool, syncMeasureCanvasSize, clearMeasure]);

  // ── 🎯 SUPPORT & RESISTANCE METHODS ──
  const addManualLine = useCallback(
    (type: "support" | "resistance", price: number) => {
      if (!seriesRef.current) return;
      const isSup = type === "support";
      const color = isSup ? "#089981" : "#f23645";
      const roundedPrice = Number(price.toFixed(precision));

      try {
        const lineObj = seriesRef.current.createPriceLine({
          price: roundedPrice,
          color: color,
          lineWidth: 2,
          lineStyle: 0,
          axisLabelVisible: true,
          title: isSup ? "Support" : "Resistance",
        });

        const newLine: SRLine = {
          id: `manual_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          type,
          price: roundedPrice,
          isAuto: false,
          lineObj,
        };

        setManualLines((prev) => [...prev, newLine]);
      } catch (e) {}
    },
    [precision]
  );

  const removeLine = useCallback((id: string) => {
    setManualLines((prev) => {
      const found = prev.find((l) => l.id === id);
      if (found && found.lineObj && seriesRef.current) {
        try {
          seriesRef.current.removePriceLine(found.lineObj);
        } catch (e) {}
      }
      return prev.filter((l) => l.id !== id);
    });

    setAutoLines((prev) => {
      const found = prev.find((l) => l.id === id);
      if (found && found.lineObj && seriesRef.current) {
        try {
          seriesRef.current.removePriceLine(found.lineObj);
        } catch (e) {}
      }
      return prev.filter((l) => l.id !== id);
    });
  }, []);

  const clearAllSRLines = useCallback(() => {
    if (seriesRef.current) {
      manualLines.forEach((l) => {
        if (l.lineObj) {
          try {
            seriesRef.current.removePriceLine(l.lineObj);
          } catch (e) {}
        }
      });
      autoLines.forEach((l) => {
        if (l.lineObj) {
          try {
            seriesRef.current.removePriceLine(l.lineObj);
          } catch (e) {}
        }
      });
    }
    setManualLines([]);
    setAutoLines([]);
  }, [manualLines, autoLines]);

  useEffect(() => {
    if (clearTrigger && clearTrigger > 0) {
      clearAllSRLines();
    }
  }, [clearTrigger, clearAllSRLines]);

  useEffect(() => {
    if (activeTool === "trash") {
      clearAllSRLines();
      clearMeasure();
      if (onToolChange) onToolChange("crosshair");
    } else if (activeTool === "auto_sr") {
      if (onToggleAutoSR) onToggleAutoSR();
      if (onToolChange) onToolChange("crosshair");
    }
  }, [activeTool, clearAllSRLines, clearMeasure, onToolChange, onToggleAutoSR]);

  const applyAutoSR = useCallback(() => {
    if (!seriesRef.current) return;

    autoLines.forEach((l) => {
      if (l.lineObj) {
        try {
          seriesRef.current.removePriceLine(l.lineObj);
        } catch (e) {}
      }
    });

    if (!isAutoSROn || formattedCandles.length < 20) {
      setAutoLines([]);
      return;
    }

    const list = formattedCandles;
    const windowSize = 8;
    const swingHighs: number[] = [];
    const swingLows: number[] = [];

    for (let i = windowSize; i < list.length - windowSize; i++) {
      const high = list[i].high;
      const low = list[i].low;
      let isHigh = true;
      let isLow = true;

      for (let j = 1; j <= windowSize; j++) {
        if (list[i - j].high > high || list[i + j].high > high) isHigh = false;
        if (list[i - j].low < low || list[i + j].low < low) isLow = false;
        if (!isHigh && !isLow) break;
      }

      if (isHigh) swingHighs.push(high);
      if (isLow) swingLows.push(low);
    }

    const clusterLevels = (arr: number[]) => {
      if (arr.length === 0) return [];
      const clusters: { price: number; count: number }[] = [];
      arr.forEach((val) => {
        const match = clusters.find((c) => Math.abs(c.price - val) / c.price < 0.0035);
        if (match) {
          match.count++;
          match.price = (match.price * (match.count - 1) + val) / match.count;
        } else {
          clusters.push({ price: val, count: 1 });
        }
      });
      clusters.sort((a, b) => b.count - a.count);
      return clusters.slice(0, 3).map((c) => Number(c.price.toFixed(precision)));
    };

    const resists = clusterLevels(swingHighs);
    const supps = clusterLevels(swingLows);

    const newAutoLines: SRLine[] = [];

    resists.forEach((p, idx) => {
      try {
        const lineObj = seriesRef.current.createPriceLine({
          price: p,
          color: "#f23645",
          lineWidth: 2,
          lineStyle: 2,
          axisLabelVisible: true,
          title: "Auto Resist",
        });
        newAutoLines.push({
          id: `auto_res_${idx}_${Date.now()}`,
          type: "resistance",
          price: p,
          isAuto: true,
          lineObj,
        });
      } catch (e) {}
    });

    supps.forEach((p, idx) => {
      try {
        const lineObj = seriesRef.current.createPriceLine({
          price: p,
          color: "#089981",
          lineWidth: 2,
          lineStyle: 2,
          axisLabelVisible: true,
          title: "Auto Supp",
        });
        newAutoLines.push({
          id: `auto_sup_${idx}_${Date.now()}`,
          type: "support",
          price: p,
          isAuto: true,
          lineObj,
        });
      } catch (e) {}
    });

    setAutoLines(newAutoLines);
  }, [isAutoSROn, formattedCandles, precision, autoLines]);

  useEffect(() => {
    applyAutoSR();
  }, [isAutoSROn, formattedCandles]);

  // ── 🖱️ CONTEXT MENU ACTIONS & HANDLERS ──
  const handleResetChartView = useCallback(() => {
    if (chartRef.current) {
      try {
        const total = candlesRef.current.length > 0 ? candlesRef.current.length : formattedCandles.length;
        if (total > 0) {
          chartRef.current.timeScale().setVisibleLogicalRange({
            from: Math.max(0, total - 75),
            to: total + 6,
          });
        }
      } catch (e) {}
    }
    setContextMenu(null);
  }, [formattedCandles.length]);

  const handleRemoveAllDrawings = useCallback(() => {
    clearAllSRLines();
    clearMeasure();
    if (onToolChange) onToolChange("crosshair");
    setContextMenu(null);
  }, [clearAllSRLines, clearMeasure, onToolChange]);

  const handleRemoveIndicators = useCallback(() => {
    if (isAutoSROn && onToggleAutoSR) {
      onToggleAutoSR();
    }
    autoLines.forEach((l) => {
      if (l.lineObj && seriesRef.current) {
        try {
          seriesRef.current.removePriceLine(l.lineObj);
        } catch (e) {}
      }
    });
    setAutoLines([]);
    setContextMenu(null);
  }, [isAutoSROn, onToggleAutoSR, autoLines]);

  const handleCleanChart = useCallback(() => {
    clearAllSRLines();
    clearMeasure();
    if (isAutoSROn && onToggleAutoSR) {
      onToggleAutoSR();
    }
    if (onToolChange) onToolChange("crosshair");
    setShowSRPanel(false);
    setShowTradingPad(false);
    setContextMenu(null);
  }, [clearAllSRLines, clearMeasure, isAutoSROn, onToggleAutoSR, onToolChange]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!containerRef.current || !seriesRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;

      let price: number | null = null;
      try {
        price = seriesRef.current.coordinateToPrice(relativeY);
        if (price !== null && !isNaN(price)) {
          price = Number(price.toFixed(precision));
        }
      } catch (err) {}

      // Check if user right-clicked close to an existing S/R line
      let clickedLine: SRLine | null = null;
      const allLines = [...manualLines, ...autoLines];
      for (const line of allLines) {
        try {
          const lineY = seriesRef.current.priceToCoordinate(line.price);
          if (lineY !== null && Math.abs(lineY - relativeY) <= 14) {
            clickedLine = line;
            break;
          }
        } catch (err) {}
      }

      // Safe viewport positioning so menu never overflows screen
      const menuWidth = 230;
      const menuHeight = 310;
      const winW = typeof window !== "undefined" ? window.innerWidth : 1200;
      const winH = typeof window !== "undefined" ? window.innerHeight : 800;

      const posX = e.clientX + menuWidth > winW ? Math.max(10, winW - menuWidth - 10) : e.clientX;
      const posY = e.clientY + menuHeight > winH ? Math.max(10, winH - menuHeight - 10) : e.clientY;

      setContextMenu({
        x: posX,
        y: posY,
        price,
        clickedLine,
      });
    },
    [precision, manualLines, autoLines]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setContextMenu(null);
        clearMeasure();
        if (measureCanvasRef.current) {
          const ctx = measureCanvasRef.current.getContext("2d");
          if (ctx) ctx.clearRect(0, 0, measureCanvasRef.current.width, measureCanvasRef.current.height);
        }
        if (activeTool !== "crosshair" && onToolChange) {
          onToolChange("crosshair");
        }
      } else if (e.altKey && (e.key === "r" || e.key === "R")) {
        e.preventDefault();
        handleResetChartView();
      } else if (e.key === " " && replayActive) {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      } else if (e.key === "ArrowRight" && replayActive) {
        e.preventDefault();
        setIsPlaying(false);
        stepForward();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTool, onToolChange, clearMeasure, handleResetChartView, replayActive, stepForward]);

  const handleMeasureMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (activeTool === "support" || activeTool === "resistance") {
      if (seriesRef.current) {
        const price = seriesRef.current.coordinateToPrice(y);
        if (price !== null && !isNaN(price)) {
          addManualLine(activeTool, price);
        }
      }
      const ctx = e.currentTarget.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, e.currentTarget.width, e.currentTarget.height);
      if (onToolChange) onToolChange("crosshair");
      return;
    }

    if (activeTool !== "measure") return;
    if (!isMeasuringRef.current || isLockedRef.current) {
      isMeasuringRef.current = true;
      isLockedRef.current = false;
      measureStartRef.current = { x, y };
      measureEndRef.current = { x, y };
      drawMeasure({ x, y }, { x, y });
    } else {
      isLockedRef.current = true;
      measureEndRef.current = { x, y };
      drawMeasure(measureStartRef.current!, { x, y });
    }
  };

  const handleMeasureMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = measureCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (activeTool === "support" || activeTool === "resistance") {
      const ctx = canvas.getContext("2d");
      if (!ctx || !seriesRef.current) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const price = seriesRef.current.coordinateToPrice(y);
      if (price === null || isNaN(price)) return;

      const isSup = activeTool === "support";
      const color = isSup ? "#089981" : "#f23645";
      const label = isSup ? "Support" : "Resistance";

      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
      ctx.setLineDash([]);

      const tagText = `${label}: ${price.toFixed(precision)}`;
      ctx.font = "bold 12px sans-serif";
      const textMetrics = ctx.measureText(tagText);
      const tagW = textMetrics.width + 16;
      const tagH = 22;
      const tagX = Math.min(x + 14, canvas.width - tagW - 12);
      const tagY = y - tagH / 2;

      ctx.fillStyle = color;
      ctx.beginPath();
      if ((ctx as any).roundRect) {
        (ctx as any).roundRect(tagX, tagY, tagW, tagH, 4);
      } else {
        ctx.rect(tagX, tagY, tagW, tagH);
      }
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.textBaseline = "middle";
      ctx.fillText(tagText, tagX + 8, y);
      return;
    }

    if (activeTool !== "measure" || !isMeasuringRef.current || isLockedRef.current) return;
    measureEndRef.current = { x, y };
    if (measureStartRef.current) {
      drawMeasure(measureStartRef.current, { x, y });
    }
  };

  // ── 1. Create Chart ──
  useEffect(() => {
    if (!containerRef.current) return;

    let disposed = false;
    let resizeObserver: ResizeObserver | null = null;

    import("lightweight-charts").then((LightweightCharts) => {
      if (disposed || !containerRef.current) return;

      if (chartRef.current) {
        try {
          chartRef.current.remove();
        } catch (e) {}
        chartRef.current = null;
        seriesRef.current = null;
        futureSeriesRef.current = null;
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }

      const isLight = theme === "light";
      const isJpy = pair.toUpperCase().includes("JPY");
      const prec = isJpy ? 3 : 5;
      const minMove = isJpy ? 0.001 : 0.00001;

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
          barSpacing: 12,
          minBarSpacing: 3,
          rightOffset: 12,
        },
        rightPriceScale: {
          borderColor: isLight ? "#e0e3eb" : "#2a2e39",
          autoScale: true,
          scaleMargins: {
            top: 0.1,
            bottom: 0.05,
          },
        },
      });

      const seriesOptions = {
        upColor: "#089981",
        downColor: "#f23645",
        borderVisible: true,
        borderUpColor: "#089981",
        borderDownColor: "#f23645",
        wickVisible: true,
        wickUpColor: "#089981",
        wickDownColor: "#f23645",
        priceLineVisible: true,
        priceLineSource: 0,
        priceLineWidth: 1,
        priceLineColor: "#089981",
        priceLineStyle: 1,
        priceFormat: {
          type: "price" as const,
          precision: prec,
          minMove: minMove,
        },
      };

      let series: any;
      if (typeof (chart as any).addCandlestickSeries === "function") {
        series = (chart as any).addCandlestickSeries(seriesOptions);
      } else if (LightweightCharts.CandlestickSeries) {
        series = chart.addSeries(LightweightCharts.CandlestickSeries, seriesOptions);
      }

      const futureOptions = {
        upColor: isLight ? "rgba(8, 153, 129, 0.25)" : "rgba(8, 153, 129, 0.20)",
        downColor: isLight ? "rgba(242, 54, 69, 0.25)" : "rgba(242, 54, 69, 0.20)",
        borderVisible: true,
        borderUpColor: isLight ? "rgba(8, 153, 129, 0.35)" : "rgba(8, 153, 129, 0.28)",
        borderDownColor: isLight ? "rgba(242, 54, 69, 0.35)" : "rgba(242, 54, 69, 0.28)",
        wickVisible: true,
        wickUpColor: isLight ? "rgba(8, 153, 129, 0.35)" : "rgba(8, 153, 129, 0.28)",
        wickDownColor: isLight ? "rgba(242, 54, 69, 0.35)" : "rgba(242, 54, 69, 0.28)",
        priceLineVisible: false,
        lastValueVisible: false,
        priceFormat: {
          type: "price" as const,
          precision: prec,
          minMove: minMove,
        },
      };

      let futureSeries: any = null;
      if (typeof (chart as any).addCandlestickSeries === "function") {
        futureSeries = (chart as any).addCandlestickSeries(futureOptions);
      } else if (LightweightCharts.CandlestickSeries) {
        futureSeries = chart.addSeries(LightweightCharts.CandlestickSeries, futureOptions);
      }

      chartRef.current = chart;
      seriesRef.current = series;
      futureSeriesRef.current = futureSeries;

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

      if (series && manualLinesRef.current.length > 0) {
        manualLinesRef.current.forEach((l) => {
          try {
            l.lineObj = series.createPriceLine({
              price: l.price,
              color: l.type === "support" ? "#089981" : "#f23645",
              lineWidth: 2,
              lineStyle: 0,
              axisLabelVisible: true,
              title: l.type === "support" ? "Support" : "Resistance",
            });
          } catch (e) {}
        });
      }

      const currentList = candlesRef.current;
      if (currentList.length > 0 && series) {
        try {
          series.setData(currentList);
          const total = currentList.length;
          chart.timeScale().setVisibleLogicalRange({
            from: Math.max(0, total - 75),
            to: total + 6,
          });
        } catch (e) {}
      }

      chart.subscribeCrosshairMove((param: any) => {
        if (disposed) return;

        if (param && param.point) {
          setMousePos({ x: param.point.x, y: param.point.y });

          if (isPlacingScissorsRef.current) {
            const list = candlesRef.current;
            let idx = -1;
            if (param.time) {
              idx = list.findIndex((c) => c.time === param.time);
            }
            if (idx === -1) {
              try {
                const logical = chart.timeScale().coordinateToLogical(param.point.x);
                if (logical !== null) idx = Math.round(logical);
              } catch (e) {}
            }
            if (idx >= 0 && idx < list.length) {
              applyBarReplaySplitRef.current(idx);
              updateReplayLineAtIndexRef.current(idx, param.point.x);
            }
          }
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

      if (typeof ResizeObserver !== "undefined" && containerRef.current) {
        resizeObserver = new ResizeObserver((entries) => {
          if (disposed || !chartRef.current) return;
          for (const entry of entries) {
            const w = Math.floor(entry.contentRect.width);
            const h = Math.floor(entry.contentRect.height);
            if (w > 0 && h > 0) {
              chartRef.current.applyOptions({ width: w, height: h });
              syncMeasureCanvasSize();
            }
          }
        });
        resizeObserver.observe(containerRef.current);
      }

      chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
        if (disposed) return;
        const idx = replayLineIndexRef.current;
        if (idx == null) return;
        updateReplayLineAtIndexRef.current(idx);
      });
    });

    return () => {
      disposed = true;
      if (resizeObserver) resizeObserver.disconnect();
      if (chartRef.current) {
        try {
          chartRef.current.remove();
        } catch (e) {}
        chartRef.current = null;
        seriesRef.current = null;
        futureSeriesRef.current = null;
      }
    };
  }, [theme, pair, timeframe]);

  const handleBuy = () => {
    if (!currentCandle) return;
    const entryPrice = liveQuote ? liveQuote.ask : currentCandle.close;
    setPosition({
      type: "LONG",
      entryPrice: entryPrice,
      entryDate: formatDisplayTime(currentCandle.time),
      entryIndex: cutIndex,
      lotSize: parseFloat(orderQuantity) || 1.0,
    });
  };

  const handleSell = () => {
    if (!currentCandle) return;
    const entryPrice = liveQuote ? liveQuote.bid : currentCandle.close;
    setPosition({
      type: "SHORT",
      entryPrice: entryPrice,
      entryDate: formatDisplayTime(currentCandle.time),
      entryIndex: cutIndex,
      lotSize: parseFloat(orderQuantity) || 1.0,
    });
  };

  const handleClosePosition = () => {
    if (!position || !currentCandle) return;

    const exitPrice = liveQuote
      ? position.type === "LONG"
        ? liveQuote.bid
        : liveQuote.ask
      : currentCandle.close;
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
  const changeVal = displayCandle ? (displayCandle.close - displayCandle.open).toFixed(precision) : "0.00000";
  const changePct =
    displayCandle && displayCandle.open > 0
      ? (((displayCandle.close - displayCandle.open) / displayCandle.open) * 100).toFixed(2)
      : "0.00";
  const displayPair = pair.length === 6 ? `${pair.slice(0, 3)}/${pair.slice(3)}` : pair;

  return (
    <div
      onClick={onActivate}
      onContextMenu={handleContextMenu}
      className={`flex-1 flex flex-col relative select-none w-full h-full min-h-0 bg-white dark:bg-[#131722] overflow-hidden transition-all ${
        isMultiChart
          ? isActiveChart
            ? "ring-2 ring-inset ring-[#2962ff] shadow-md"
            : "hover:ring-1 hover:ring-inset hover:ring-[#2962ff]/40 opacity-95"
          : ""
      }`}
    >
      {/* ── TOP-LEFT TRADINGVIEW OVERLAY: Symbol Info, Interactive BUY/SELL Pad & Live OHLC ── */}
      <div className="absolute top-2.5 left-3.5 z-20 flex flex-col gap-1.5 pointer-events-auto">
        {/* Row 1: Symbol, Live Forex Pill, Trade Toggle & OHLC values */}
        <div className="flex items-center gap-2 text-xs font-semibold flex-wrap">
          <div className="flex items-center gap-1.5 font-bold text-[#131722] dark:text-white">
            {isMultiChart && onSubChartPairChange && pairs.length > 0 ? (
              <select
                value={pair}
                onChange={(e) => onSubChartPairChange(e.target.value)}
                className="bg-transparent font-bold text-sm text-[#2962ff] outline-none cursor-pointer"
              >
                {pairs.map((p) => (
                  <option key={p.id} value={p.id} className="bg-white dark:bg-[#1e222d] text-[#131722] dark:text-white">
                    {p.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-sm">{displayPair}</span>
            )}

            {isMultiChart && onSubChartTimeframeChange ? (
              <select
                value={timeframe}
                onChange={(e) => onSubChartTimeframeChange(e.target.value)}
                className="bg-gray-100 dark:bg-gray-800 text-[11px] font-bold px-1.5 py-0.5 rounded outline-none cursor-pointer text-[#131722] dark:text-white border border-gray-300 dark:border-gray-700"
              >
                {["1m", "5m", "15m", "1H", "4H", "1D", "1W"].map((tf) => (
                  <option key={tf} value={tf} className="bg-white dark:bg-[#1e222d]">
                    {tf}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-[11px] font-normal text-[#787b86]">&bull; {timeframe} &bull; OANDA</span>
            )}

            {isMultiChart && isActiveChart && (
              <span className="bg-[#2962ff] text-white text-[9px] px-1.5 py-0.5 rounded font-extrabold uppercase tracking-wider shadow-sm">
                Active
              </span>
            )}
          </div>

          {/* LIVE STATUS PILL */}
          <button
            onClick={() => setIsLiveActive((prev) => !prev)}
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold transition-all border shadow-sm ${
              isLiveActive && !replayActive
                ? "bg-emerald-50 dark:bg-emerald-950/60 text-[#089981] border-emerald-300 dark:border-emerald-800"
                : "bg-gray-100 dark:bg-gray-800 text-gray-500 border-gray-300 dark:border-gray-700"
            }`}
            title="Click to pause or resume Live Market streaming"
          >
            <span className="relative flex h-2 w-2">
              {isLiveActive && !replayActive && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  isLiveActive && !replayActive ? "bg-[#089981]" : "bg-gray-400"
                }`}
              ></span>
            </span>
            <span>{replayActive ? "REPLAY" : isLiveActive ? "LIVE" : "PAUSED"}</span>
          </button>

          {/* TOGGLE TRADING PAD BUTTON */}
          <button
            onClick={() => setShowTradingPad((prev) => !prev)}
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors flex items-center gap-1 ${
              showTradingPad
                ? "bg-blue-50 dark:bg-blue-950/60 text-[#2962ff] border-blue-200 dark:border-blue-900"
                : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 border-transparent hover:border-gray-200 dark:hover:border-gray-700"
            }`}
            title={showTradingPad ? "Hide Buy/Sell buttons" : "Show Buy/Sell buttons (Right-click chart for more options)"}
          >
            <TrendingUp size={11} />
            <span>{showTradingPad ? "TRADE ▲" : "TRADE ▼"}</span>
          </button>

          {displayCandle && (
            <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono">
              <span className="text-[#787b86]">
                O <span className={isUp ? "text-[#089981]" : "text-[#f23645]"}>{displayCandle.open.toFixed(precision)}</span>
              </span>
              <span className="text-[#787b86]">
                H <span className={isUp ? "text-[#089981]" : "text-[#f23645]"}>{displayCandle.high.toFixed(precision)}</span>
              </span>
              <span className="text-[#787b86]">
                L <span className={isUp ? "text-[#089981]" : "text-[#f23645]"}>{displayCandle.low.toFixed(precision)}</span>
              </span>
              <span className="text-[#787b86]">
                C <span className={isUp ? "text-[#089981] font-bold" : "text-[#f23645] font-bold"}>{displayCandle.close.toFixed(precision)}</span>
              </span>
              <span className={`font-bold ${isUp ? "text-[#089981]" : "text-[#f23645]"}`}>
                {Number(changeVal) >= 0 ? "+" : ""}{changeVal} ({Number(changePct) >= 0 ? "+" : ""}{changePct}%)
              </span>
            </div>
          )}
        </div>

        {/* Row 2: TRADINGVIEW INTERACTIVE BUY/SELL ORDER PAD (Toggleable via right-click or TRADE button) */}
        {showTradingPad && (!isMultiChart || isActiveChart) && (
          <div className="flex items-center gap-1 animate-fadeIn">
            <div className="flex items-stretch rounded border border-[#e0e3eb] dark:border-[#2a2e39] bg-white dark:bg-[#1e222d] shadow-sm overflow-hidden text-xs">
              <button
                onClick={handleSell}
                className="px-2.5 py-1 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 text-[#f23645] font-bold flex flex-col items-center border-r border-[#e0e3eb] dark:border-[#2a2e39] transition-colors"
              >
                <span className="text-[11px] font-mono">
                  {liveQuote ? liveQuote.bid.toFixed(precision) : currentCandle?.close.toFixed(precision) || "0.00000"}
                </span>
                <span className="text-[9px] uppercase tracking-wider font-extrabold">SELL</span>
              </button>

              <div className="flex items-center px-1.5 bg-gray-50 dark:bg-[#131722]">
                <input
                  type="text"
                  value={orderQuantity}
                  onChange={(e) => setOrderQuantity(e.target.value)}
                  className="w-10 text-center font-mono font-bold text-xs bg-transparent outline-none text-[#131722] dark:text-white"
                />
              </div>

              <button
                onClick={handleBuy}
                className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 text-[#2962ff] font-bold flex flex-col items-center border-l border-[#e0e3eb] dark:border-[#2a2e39] transition-colors"
              >
                <span className="text-[11px] font-mono">
                  {liveQuote ? liveQuote.ask.toFixed(precision) : currentCandle?.close.toFixed(precision) || "0.00000"}
                </span>
                <span className="text-[9px] uppercase tracking-wider font-extrabold">BUY</span>
              </button>
            </div>

            <button
              onClick={() => setShowTradingPad(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5 rounded text-[11px]"
              title="Hide Buy/Sell buttons (Right-click chart to show again)"
            >
              ✕
            </button>

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
        )}
      </div>

      {/* ── 🎯 INTERACTIVE S/R PLACEMENT NOTIFICATION BANNER ── */}
      {(activeTool === "support" || activeTool === "resistance") && (
        <div
          className="absolute top-3 left-1/2 -translate-x-1/2 z-30 px-4 py-1.5 rounded-full text-xs font-bold text-white shadow-2xl flex items-center gap-2 border animate-pulse"
          style={{
            backgroundColor: activeTool === "support" ? "#089981" : "#f23645",
            borderColor: "rgba(255,255,255,0.4)",
          }}
        >
          <span className="w-2 h-2 rounded-full bg-white" />
          <span>
            Click anywhere on the chart to set a {activeTool === "support" ? "Support" : "Resistance"} line (Esc to cancel)
          </span>
        </div>
      )}

      {/* ── 📐 S/R LEVELS FLOATING MANAGER PANEL ── */}
      {showSRPanel && (manualLines.length > 0 || autoLines.length > 0) && (
        <div className="absolute top-12 right-4 z-30 bg-white/95 dark:bg-[#1e222d]/95 border border-[#e0e3eb] dark:border-[#2a2e39] rounded-lg shadow-xl text-xs backdrop-blur-md overflow-hidden w-52 animate-fadeIn">
          <div className="flex items-center justify-between px-2.5 py-1.5 bg-gray-50 dark:bg-[#181c27] border-b border-[#e0e3eb] dark:border-[#2a2e39] font-bold">
            <span className="flex items-center gap-1.5 text-[#131722] dark:text-white">
              <Target size={12} className="text-[#2962ff]" />
              <span>S/R Levels ({manualLines.length + autoLines.length})</span>
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsSRListCollapsed(!isSRListCollapsed)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-[11px] px-1"
                title={isSRListCollapsed ? "Expand" : "Collapse"}
              >
                {isSRListCollapsed ? "▾" : "▴"}
              </button>
              <button
                onClick={() => setShowSRPanel(false)}
                className="text-gray-400 hover:text-red-500 text-[11px] px-1"
                title="Hide panel (Right-click chart to show again)"
              >
                ✕
              </button>
            </div>
          </div>
          {!isSRListCollapsed && (
            <div className="max-h-48 overflow-y-auto p-1.5 flex flex-col gap-1">
              {[...manualLines, ...autoLines]
                .sort((a, b) => b.price - a.price)
                .map((line) => {
                  const isSup = line.type === "support";
                  const color = isSup ? "#089981" : "#f23645";
                  return (
                    <div
                      key={line.id}
                      className="flex items-center justify-between px-2 py-1 rounded bg-gray-50/80 dark:bg-[#131722]/80 border-l-[3px]"
                      style={{ borderLeftColor: color }}
                    >
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold" style={{ color }}>
                          {line.isAuto ? "Auto " : ""}{isSup ? "Support" : "Resistance"}
                        </span>
                        <span className="font-mono text-[11px] font-semibold text-[#131722] dark:text-white">
                          {line.price.toFixed(precision)}
                        </span>
                      </div>
                      <button
                        onClick={() => removeLine(line.id)}
                        className="text-gray-400 hover:text-red-500 p-1 transition-colors text-xs"
                        title="Remove this line"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* ── ✂️ THE FLOATING REPLAY CONTROLLER ── */}
      {replayActive && (
        <div className="absolute top-3 right-4 z-30 flex items-center gap-2 bg-white dark:bg-[#1e222d] border border-[#e0e3eb] dark:border-[#2a2e39] rounded-lg shadow-xl px-3 py-1.5 text-xs animate-fadeIn">
          <div className="flex items-center gap-1.5 font-bold text-amber-500 pr-2 border-r border-gray-200 dark:border-gray-700">
            <Scissors size={14} className="-rotate-90" />
            <span>{formatDisplayTime(currentCandle?.time)}</span>
          </div>

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

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-[#131722] dark:text-white"
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          </button>

          <button
            onClick={() => {
              setIsPlaying(false);
              stepForward();
            }}
            className="px-2 py-0.5 rounded font-bold bg-blue-50 text-[#2962ff] hover:bg-blue-100 dark:bg-blue-950/60 transition-colors flex items-center gap-1"
            title="Reveal Next 1 Bar (Space to Play/Pause, → to Step)"
          >
            <SkipForward size={13} />
            <span>Step</span>
          </button>

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

          {onRunCutBacktest && (
            <button
              onClick={() => {
                const targetCandle = formattedCandles[cutIndex] || currentCandle;
                if (targetCandle) {
                  onRunCutBacktest(String(targetCandle.time));
                }
              }}
              className="bg-[#089981] hover:bg-[#07806c] text-white px-2.5 py-1 rounded font-bold flex items-center gap-1 text-[11px] shadow-sm ml-1"
            >
              <Sparkles size={11} /> Backtest Cut
            </button>
          )}

          <button
            onClick={onToggleReplay}
            className="text-gray-400 hover:text-red-500 p-1 ml-1"
            title="Restore Full Chart"
          >
            <XCircle size={15} />
          </button>
        </div>
      )}

      {/* ── ✂️ TRADINGVIEW BAR-REPLAY CUT LINE (Only shown while previewing scissors before cut) ── */}
      {isPlacingScissors && replayLine && (
        <div
          className="absolute top-0 bottom-0 pointer-events-none z-30"
          style={{ left: `${replayLine.x}px`, transform: "translateX(-50%)" }}
        >
          <div className="w-[2px] h-full bg-[#2962ff]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]">
            <Scissors size={18} strokeWidth={2.25} className="-rotate-[25deg]" />
          </div>
          <div className="absolute bottom-[22px] left-1/2 -translate-x-1/2 bg-[#2962ff] text-white text-[11px] font-semibold tracking-wide px-2 py-[3px] rounded-[3px] whitespace-nowrap shadow-md">
            {replayLine.label}
          </div>
        </div>
      )}

      {/* ── THE CANVAS CONTAINER ── */}
      <div
        ref={containerRef}
        className={`w-full h-full flex-1 relative min-h-0 ${isPlacingScissors ? "cursor-none" : ""}`}
        style={{ minHeight: "100%", width: "100%" }}
      />

      {/* ── 📏 MEASURE TOOL & S/R DRAWING CANVAS OVERLAY ── */}
      <canvas
        ref={measureCanvasRef}
        onMouseDown={handleMeasureMouseDown}
        onMouseMove={handleMeasureMouseMove}
        onContextMenu={handleContextMenu}
        className={`absolute inset-0 w-full h-full z-20 ${
          !isPlacingScissors && (activeTool === "measure" || activeTool === "support" || activeTool === "resistance")
            ? "pointer-events-auto cursor-crosshair"
            : "pointer-events-none"
        }`}
      />
      <div
        ref={measureBadgeRef}
        className="hidden absolute z-30 pointer-events-none rounded-lg px-3 py-2 text-xs font-mono shadow-2xl border backdrop-blur-md bg-white/95 dark:bg-[#1e222d]/95 border-[#2962ff]/40 text-[#131722] dark:text-white"
      />

      {/* ── WATERMARK ── */}
      <div className="absolute bottom-6 left-4 pointer-events-none opacity-20 dark:opacity-10 text-xs font-black tracking-widest uppercase text-gray-500">
        ilyaas backtesting
      </div>

      {/* ── 🖱️ TRADINGVIEW-STYLE RIGHT-CLICK CONTEXT MENU ── */}
      {contextMenu && (
        <>
          {/* Backdrop to dismiss menu when clicking anywhere */}
          <div
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu(null);
            }}
          />

          <div
            style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
            className="fixed z-50 min-w-[220px] bg-white dark:bg-[#1e222d] border border-[#e0e3eb] dark:border-[#2a2e39] rounded-lg shadow-2xl py-1 text-xs select-none backdrop-blur-md animate-fadeIn text-[#131722] dark:text-[#d1d4dc]"
          >
            {/* If clicked near a line: option to delete that line */}
            {contextMenu.clickedLine && (
              <>
                <button
                  onClick={() => {
                    removeLine(contextMenu.clickedLine!.id);
                    setContextMenu(null);
                  }}
                  className="w-full px-3 py-1.5 flex items-center justify-between text-left hover:bg-red-50 dark:hover:bg-red-950/40 text-[#f23645] font-semibold transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Trash2 size={13} />
                    <span>Remove this {contextMenu.clickedLine.isAuto ? "Auto " : ""}{contextMenu.clickedLine.type} line</span>
                  </span>
                  <span className="font-mono text-[10px] opacity-75">
                    {contextMenu.clickedLine.price.toFixed(precision)}
                  </span>
                </button>
                <div className="my-1 border-t border-[#e0e3eb] dark:border-[#2a2e39]" />
              </>
            )}

            {/* Reset Chart View */}
            <button
              onClick={handleResetChartView}
              className="w-full px-3 py-1.5 flex items-center justify-between text-left hover:bg-gray-100 dark:hover:bg-[#2a2e39] transition-colors"
            >
              <span className="flex items-center gap-2">
                <RotateCcw size={13} className="text-[#787b86]" />
                <span>Reset chart view</span>
              </span>
              <span className="text-[10px] text-[#787b86]">Alt+R</span>
            </button>

            <div className="my-1 border-t border-[#e0e3eb] dark:border-[#2a2e39]" />

            {/* Add Support / Resistance at clicked price */}
            {contextMenu.price !== null && (
              <>
                <button
                  onClick={() => {
                    addManualLine("support", contextMenu.price!);
                    setContextMenu(null);
                  }}
                  className="w-full px-3 py-1.5 flex items-center gap-2 text-left hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-[#089981] font-semibold transition-colors"
                >
                  <Minus size={14} className="stroke-[3]" />
                  <span>Add Support at {contextMenu.price.toFixed(precision)}</span>
                </button>

                <button
                  onClick={() => {
                    addManualLine("resistance", contextMenu.price!);
                    setContextMenu(null);
                  }}
                  className="w-full px-3 py-1.5 flex items-center gap-2 text-left hover:bg-red-50 dark:hover:bg-red-950/40 text-[#f23645] font-semibold transition-colors"
                >
                  <Minus size={14} className="stroke-[3]" />
                  <span>Add Resistance at {contextMenu.price.toFixed(precision)}</span>
                </button>
                <div className="my-1 border-t border-[#e0e3eb] dark:border-[#2a2e39]" />
              </>
            )}

            {/* Remove item with hover submenu */}
            <div className="relative group">
              <button
                onClick={handleRemoveAllDrawings}
                className="w-full px-3 py-1.5 flex items-center justify-between text-left hover:bg-red-50 dark:hover:bg-red-950/40 text-[#f23645] font-semibold transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Trash2 size={13} />
                  <span>Remove</span>
                </span>
                <ChevronRight size={12} className="text-[#787b86]" />
              </button>

              <div
                className={`hidden group-hover:block absolute top-0 ${
                  contextMenu.x + 420 > (typeof window !== "undefined" ? window.innerWidth : 1200)
                    ? "right-full mr-1"
                    : "left-full ml-1"
                } bg-white dark:bg-[#1e222d] border border-[#e0e3eb] dark:border-[#2a2e39] rounded-lg shadow-2xl py-1 min-w-[200px] z-50 backdrop-blur-md`}
              >
                <button
                  onClick={handleRemoveAllDrawings}
                  className="w-full px-3 py-1.5 flex items-center gap-2 text-left hover:bg-red-50 dark:hover:bg-red-950/40 text-[#f23645] font-semibold transition-colors"
                >
                  <Trash2 size={12} />
                  <span>Remove drawings</span>
                </button>
                <button
                  onClick={handleRemoveIndicators}
                  className="w-full px-3 py-1.5 flex items-center gap-2 text-left hover:bg-gray-100 dark:hover:bg-[#2a2e39] text-[#131722] dark:text-[#d1d4dc] transition-colors"
                >
                  <Target size={12} className="text-[#2962ff]" />
                  <span>Remove indicators</span>
                </button>
                <button
                  onClick={handleCleanChart}
                  className="w-full px-3 py-1.5 flex items-center gap-2 text-left hover:bg-red-50 dark:hover:bg-red-950/40 text-[#f23645] font-bold transition-colors"
                >
                  <XCircle size={12} />
                  <span>Remove drawings & indicators</span>
                </button>
              </div>
            </div>

            {/* Direct Clean Chart Button (Only Candlesticks) */}
            <button
              onClick={handleCleanChart}
              className="w-full px-3 py-1.5 flex items-center gap-2 text-left hover:bg-red-50 dark:hover:bg-red-950/40 text-[#f23645] font-semibold transition-colors"
              title="Clears all lines and overlays to show only pure candles"
            >
              <XCircle size={13} />
              <span>Clean chart (Only candles)</span>
            </button>

            <div className="my-1 border-t border-[#e0e3eb] dark:border-[#2a2e39]" />

            {/* Toggle Buy/Sell buttons */}
            <button
              onClick={() => {
                setShowTradingPad((prev) => !prev);
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 flex items-center justify-between text-left hover:bg-gray-100 dark:hover:bg-[#2a2e39] transition-colors"
            >
              <span className="flex items-center gap-2">
                {showTradingPad ? <EyeOff size={13} className="text-[#787b86]" /> : <Eye size={13} className="text-[#787b86]" />}
                <span>{showTradingPad ? "Hide Buy/Sell buttons" : "Show Buy/Sell buttons"}</span>
              </span>
            </button>

            {/* Toggle S/R Panel */}
            <button
              onClick={() => {
                setShowSRPanel((prev) => !prev);
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 flex items-center justify-between text-left hover:bg-gray-100 dark:hover:bg-[#2a2e39] transition-colors"
            >
              <span className="flex items-center gap-2">
                {showSRPanel ? <EyeOff size={13} className="text-[#787b86]" /> : <Eye size={13} className="text-[#787b86]" />}
                <span>{showSRPanel ? "Hide S/R levels panel" : "Show S/R levels panel"}</span>
              </span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
