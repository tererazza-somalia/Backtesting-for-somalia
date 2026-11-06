"use client";

import { useState } from "react";
import {
  TrendingUp,
  Search,
  Clock,
  CandlestickChart as CandleIcon,
  SlidersHorizontal,
  Bell,
  RotateCcw,
  Undo2,
  Redo2,
  Save,
  Sun,
  Moon,
  Camera,
  Maximize,
  Scissors,
  Check,
  Target,
  Trash2,
} from "lucide-react";
import type { ForexPair } from "@/lib/api";

export type ChartLayoutType = "1" | "2h" | "2v" | "4";

interface Props {
  currentPair: string;
  pairs: ForexPair[];
  onSelectPair: (id: string) => void;
  currentTimeframe: string;
  onSelectTimeframe: (tf: string) => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  replayActive: boolean;
  isPlacingScissors: boolean;
  onToggleReplay: () => void;
  // S/R tools
  activeTool?: string;
  onSelectTool?: (tool: string) => void;
  isAutoSROn?: boolean;
  onToggleAutoSR?: () => void;
  onClearLines?: () => void;
  // Multi-chart layout
  layout?: ChartLayoutType;
  onSelectLayout?: (layout: ChartLayoutType) => void;
  syncPairAcrossCharts?: boolean;
  onToggleSyncPair?: () => void;
}

export default function Navbar({
  currentPair,
  pairs,
  onSelectPair,
  currentTimeframe,
  onSelectTimeframe,
  theme,
  onToggleTheme,
  replayActive,
  isPlacingScissors,
  onToggleReplay,
  activeTool,
  onSelectTool,
  isAutoSROn = false,
  onToggleAutoSR,
  onClearLines,
  layout = "1",
  onSelectLayout,
  syncPairAcrossCharts = true,
  onToggleSyncPair,
}: Props) {
  const [isPairDropdownOpen, setIsPairDropdownOpen] = useState(false);
  const [isLayoutMenuOpen, setIsLayoutMenuOpen] = useState(false);

  const isLight = theme === "light";
  const bg = isLight ? "bg-white border-[#e0e3eb]" : "bg-[#1e222d] border-[#2a2e39]";
  const textMuted = isLight ? "text-[#5d606b]" : "text-[#787b86]";
  const textMain = isLight ? "text-[#131722]" : "text-[#d1d4dc]";
  const hoverBg = isLight ? "hover:bg-[#f0f3fa]" : "hover:bg-[#2a2e39]";
  const activeBg = isLight ? "bg-[#e0e3eb] text-[#2962ff] font-bold" : "bg-[#2a2e39] text-[#2962ff] font-bold";
  const borderCol = isLight ? "border-[#e0e3eb]" : "border-[#2a2e39]";

  const intervals = ["1m", "5m", "15m", "1H", "4H", "1D", "1W"];

  return (
    <nav className={`h-11 border-b flex items-center justify-between px-2 text-xs select-none shrink-0 ${bg}`}>
      {/* ── LEFT SECTION: Logo, Symbol Search, Timeframes, Indicators, Replay, S/R Tools ── */}
      <div className="flex items-center gap-1.5 h-full">
        {/* Brand Name */}
        <div className="flex items-center gap-1.5 pr-2.5 border-r border-[#e0e3eb] dark:border-[#2a2e39] mr-1">
          <div className="w-6 h-6 bg-[#2962ff] rounded flex items-center justify-center text-white font-bold text-xs shadow-sm">
            IB
          </div>
          <span className={`font-bold tracking-tight text-[13px] ${textMain}`}>
            ilyaas <span className="text-[#2962ff]">backtesting</span>
          </span>
        </div>

        {/* Symbol Search Button */}
        <div className="relative">
          <button
            onClick={() => setIsPairDropdownOpen(!isPairDropdownOpen)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded border border-[#e0e3eb] dark:border-[#2a2e39] font-bold ${textMain} ${hoverBg} transition-colors`}
          >
            <Search size={13} className={textMuted} />
            <span>{currentPair}</span>
            <span className="text-[10px] text-gray-400 font-normal">FX</span>
          </button>

          {/* Symbol Selector Dropdown */}
          {isPairDropdownOpen && (
            <div className={`absolute top-full left-0 mt-1 w-52 rounded-lg border shadow-xl z-50 py-1 ${bg} ${borderCol}`}>
              <div className="px-3 py-1 text-[10px] uppercase font-bold text-[#787b86]">Select Instrument</div>
              {pairs.map((p) => (
                <div
                  key={p.id}
                  onClick={() => {
                    onSelectPair(p.id);
                    setIsPairDropdownOpen(false);
                  }}
                  className={`px-3 py-1.5 flex items-center justify-between cursor-pointer ${hoverBg} ${
                    p.id === currentPair ? "text-[#2962ff] font-bold" : textMain
                  }`}
                >
                  <span>{p.name}</span>
                  {p.id === currentPair && <Check size={12} className="text-[#2962ff]" />}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Timeframe Selectors (TradingView 1m 5m 15m 1H 4H 1D 1W) */}
        <div className="hidden md:flex items-center gap-0.5 border-l border-r border-[#e0e3eb] dark:border-[#2a2e39] px-1.5 mx-1">
          {intervals.map((intv) => (
            <button
              key={intv}
              onClick={() => onSelectTimeframe(intv)}
              className={`px-1.5 py-1 rounded text-xs transition-colors ${
                currentTimeframe === intv ? activeBg : `${textMuted} ${hoverBg}`
              }`}
            >
              {intv}
            </button>
          ))}
        </div>

        {/* Chart Style (Candles) */}
        <button className={`p-1.5 rounded ${textMuted} ${hoverBg}`} title="Candles">
          <CandleIcon size={16} />
        </button>

        {/* Indicators fx button */}
        <button
          className={`flex items-center gap-1 px-2 py-1 rounded border border-[#e0e3eb] dark:border-[#2a2e39] ${textMain} ${hoverBg} transition-colors font-semibold`}
        >
          <span className="font-serif italic font-bold text-[#2962ff]">ƒx</span>
          <span>Indicators</span>
        </button>

        {/* ✂️ TRADINGVIEW REPLAY BUTTON */}
        <button
          onClick={onToggleReplay}
          className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition-all shadow-sm ${
            replayActive
              ? "bg-red-500 text-white hover:bg-red-600"
              : isPlacingScissors
              ? "bg-[#2962ff] text-white"
              : "bg-blue-50 text-[#2962ff] hover:bg-blue-100 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800"
          }`}
          title="Cut / Bar Replay"
        >
          <Scissors size={13} className={replayActive || isPlacingScissors ? "-rotate-[25deg]" : ""} />
          <span>{replayActive ? "Exit Replay" : isPlacingScissors ? "Select a time" : "Replay"}</span>
        </button>

        {/* ── 🎯 SUPPORT & RESISTANCE TOOLBAR SHORTCUTS ── */}
        <div className="hidden sm:flex items-center gap-1 border-l border-[#e0e3eb] dark:border-[#2a2e39] pl-1.5 ml-1">
          {onToggleAutoSR && (
            <button
              onClick={onToggleAutoSR}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-bold transition-all shadow-sm ${
                isAutoSROn
                  ? "bg-[#2962ff] text-white"
                  : "bg-blue-50 text-[#2962ff] hover:bg-blue-100 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800"
              }`}
              title="Detect & Display Key Support & Resistance Levels"
            >
              <Target size={13} />
              <span>Auto S/R</span>
            </button>
          )}

          {onSelectTool && (
            <>
              <button
                onClick={() => onSelectTool(activeTool === "support" ? "crosshair" : "support")}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold transition-all border ${
                  activeTool === "support"
                    ? "bg-[#089981] text-white border-[#089981]"
                    : "border-[#e0e3eb] dark:border-[#2a2e39] text-[#089981] hover:bg-[#089981]/10"
                }`}
                title="Click on chart to set a Support Line"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#089981]" />
                <span>+ Support</span>
              </button>

              <button
                onClick={() => onSelectTool(activeTool === "resistance" ? "crosshair" : "resistance")}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold transition-all border ${
                  activeTool === "resistance"
                    ? "bg-[#f23645] text-white border-[#f23645]"
                    : "border-[#e0e3eb] dark:border-[#2a2e39] text-[#f23645] hover:bg-[#f23645]/10"
                }`}
                title="Click on chart to set a Resistance Line"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#f23645]" />
                <span>+ Resist</span>
              </button>
            </>
          )}

          {onClearLines && (
            <button
              onClick={onClearLines}
              className={`p-1.5 rounded ${textMuted} ${hoverBg}`}
              title="Clear All Support & Resistance Lines"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>

        {/* Undo / Redo */}
        <div className="hidden lg:flex items-center gap-0.5 border-l border-[#e0e3eb] dark:border-[#2a2e39] pl-1.5 ml-1">
          <button className={`p-1.5 rounded ${textMuted} ${hoverBg}`} title="Undo">
            <Undo2 size={14} />
          </button>
          <button className={`p-1.5 rounded ${textMuted} ${hoverBg}`} title="Redo">
            <Redo2 size={14} />
          </button>
        </div>
      </div>

      {/* ── RIGHT SECTION: Multi-Chart Layout Switcher, Theme, Save, Pro ── */}
      <div className="flex items-center gap-1.5">
        {/* ── ⊞ TRADINGVIEW MULTI-CHART LAYOUT SELECTOR ── */}
        {onSelectLayout && (
          <div className="relative">
            <button
              onClick={() => setIsLayoutMenuOpen(!isLayoutMenuOpen)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded border border-[#e0e3eb] dark:border-[#2a2e39] ${textMain} ${hoverBg} font-semibold transition-colors`}
              title="Select Multi-Chart Layout (1, 2, or 4 charts)"
            >
              {layout === "1" && (
                <div className="w-3.5 h-3.5 border border-current rounded-sm flex">
                  <div className="w-full h-full bg-[#2962ff] opacity-80" />
                </div>
              )}
              {layout === "2h" && (
                <div className="w-3.5 h-3.5 border border-current rounded-sm flex gap-0.5 p-0.5">
                  <div className="w-1/2 h-full bg-[#2962ff] opacity-80" />
                  <div className="w-1/2 h-full bg-[#2962ff] opacity-80" />
                </div>
              )}
              {layout === "2v" && (
                <div className="w-3.5 h-3.5 border border-current rounded-sm flex flex-col gap-0.5 p-0.5">
                  <div className="w-full h-1/2 bg-[#2962ff] opacity-80" />
                  <div className="w-full h-1/2 bg-[#2962ff] opacity-80" />
                </div>
              )}
              {layout === "4" && (
                <div className="w-3.5 h-3.5 border border-current rounded-sm grid grid-cols-2 grid-rows-2 gap-0.5 p-0.5">
                  <div className="bg-[#2962ff] opacity-80" />
                  <div className="bg-[#2962ff] opacity-80" />
                  <div className="bg-[#2962ff] opacity-80" />
                  <div className="bg-[#2962ff] opacity-80" />
                </div>
              )}
              <span className="text-[11px] font-bold hidden sm:inline">
                {layout === "1" ? "1 Chart" : layout === "2h" ? "2 Side" : layout === "2v" ? "2 Stack" : "4 Grid"}
              </span>
              <span className="text-[9px] text-gray-400">▾</span>
            </button>

            {/* Layout Dropdown Menu */}
            {isLayoutMenuOpen && (
              <div className={`absolute top-full right-0 mt-1 w-52 rounded-lg border shadow-2xl z-50 py-1.5 ${bg} ${borderCol}`}>
                <div className="px-3 py-1 text-[10px] uppercase font-bold text-[#787b86] border-b border-gray-100 dark:border-gray-800">
                  Select Chart Layout
                </div>

                {/* 1 Chart */}
                <button
                  onClick={() => {
                    onSelectLayout("1");
                    setIsLayoutMenuOpen(false);
                  }}
                  className={`w-full px-3 py-2 flex items-center justify-between text-left ${hoverBg} ${
                    layout === "1" ? "text-[#2962ff] font-bold bg-blue-50/50 dark:bg-blue-950/40" : textMain
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-4 h-4 border border-current rounded-sm p-0.5 flex">
                      <div className="w-full h-full bg-[#2962ff] opacity-70" />
                    </div>
                    <span>1 Chart (Full)</span>
                  </div>
                  {layout === "1" && <Check size={13} className="text-[#2962ff]" />}
                </button>

                {/* 2 Charts Side-by-Side */}
                <button
                  onClick={() => {
                    onSelectLayout("2h");
                    setIsLayoutMenuOpen(false);
                  }}
                  className={`w-full px-3 py-2 flex items-center justify-between text-left ${hoverBg} ${
                    layout === "2h" ? "text-[#2962ff] font-bold bg-blue-50/50 dark:bg-blue-950/40" : textMain
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-4 h-4 border border-current rounded-sm p-0.5 flex gap-0.5">
                      <div className="w-1/2 h-full bg-[#2962ff] opacity-70" />
                      <div className="w-1/2 h-full bg-[#2962ff] opacity-70" />
                    </div>
                    <span>2 Charts (Side-by-Side)</span>
                  </div>
                  {layout === "2h" && <Check size={13} className="text-[#2962ff]" />}
                </button>

                {/* 2 Charts Stacked */}
                <button
                  onClick={() => {
                    onSelectLayout("2v");
                    setIsLayoutMenuOpen(false);
                  }}
                  className={`w-full px-3 py-2 flex items-center justify-between text-left ${hoverBg} ${
                    layout === "2v" ? "text-[#2962ff] font-bold bg-blue-50/50 dark:bg-blue-950/40" : textMain
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-4 h-4 border border-current rounded-sm p-0.5 flex flex-col gap-0.5">
                      <div className="w-full h-1/2 bg-[#2962ff] opacity-70" />
                      <div className="w-full h-1/2 bg-[#2962ff] opacity-70" />
                    </div>
                    <span>2 Charts (Stacked)</span>
                  </div>
                  {layout === "2v" && <Check size={13} className="text-[#2962ff]" />}
                </button>

                {/* 4 Charts Grid */}
                <button
                  onClick={() => {
                    onSelectLayout("4");
                    setIsLayoutMenuOpen(false);
                  }}
                  className={`w-full px-3 py-2 flex items-center justify-between text-left ${hoverBg} ${
                    layout === "4" ? "text-[#2962ff] font-bold bg-blue-50/50 dark:bg-blue-950/40" : textMain
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-4 h-4 border border-current rounded-sm p-0.5 grid grid-cols-2 grid-rows-2 gap-0.5">
                      <div className="bg-[#2962ff] opacity-70" />
                      <div className="bg-[#2962ff] opacity-70" />
                      <div className="bg-[#2962ff] opacity-70" />
                      <div className="bg-[#2962ff] opacity-70" />
                    </div>
                    <span>4 Charts (2x2 Grid)</span>
                  </div>
                  {layout === "4" && <Check size={13} className="text-[#2962ff]" />}
                </button>

                {/* Sync Toggle */}
                {onToggleSyncPair && (
                  <div className="mt-1 pt-1.5 border-t border-gray-100 dark:border-gray-800 px-3 py-1 flex items-center justify-between">
                    <span className="text-[11px] text-[#787b86]">Sync Symbol</span>
                    <input
                      type="checkbox"
                      checked={syncPairAcrossCharts}
                      onChange={onToggleSyncPair}
                      className="cursor-pointer accent-[#2962ff]"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Light / Dark Mode Toggle */}
        <button
          onClick={onToggleTheme}
          className={`p-1.5 rounded ${textMuted} ${hoverBg} transition-colors`}
          title={isLight ? "Switch to Dark Theme" : "Switch to Light Theme"}
        >
          {isLight ? <Moon size={15} /> : <Sun size={15} className="text-amber-400" />}
        </button>

        <button className={`p-1.5 rounded ${textMuted} ${hoverBg}`} title="Take Screenshot">
          <Camera size={15} />
        </button>

        {/* Save Layout Button */}
        <button
          className={`flex items-center gap-1 px-2 py-1 rounded border border-[#e0e3eb] dark:border-[#2a2e39] ${textMain} ${hoverBg} font-semibold`}
        >
          <Save size={13} className="text-[#2962ff]" />
          <span>Save</span>
        </button>

        {/* Blue Upgrade Badge */}
        <div className="px-2.5 py-1 rounded bg-gradient-to-r from-[#2962ff] to-[#1e53e5] text-white font-extrabold text-[11px] tracking-wide shadow-sm">
          PRO FREE
        </div>
      </div>
    </nav>
  );
}
