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
} from "lucide-react";
import type { ForexPair } from "@/lib/api";

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
}: Props) {
  const [isPairDropdownOpen, setIsPairDropdownOpen] = useState(false);

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
      {/* ── LEFT SECTION: Logo, Symbol Search, Timeframes, Indicators, Replay ── */}
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

        {/* ✂️ TRADINGVIEW REPLAY BUTTON (Iconic Rewind Icon) */}
        <button
          onClick={onToggleReplay}
          className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition-all shadow-sm ${
            replayActive
              ? "bg-red-500 text-white hover:bg-red-600"
              : isPlacingScissors
              ? "bg-amber-500 text-black animate-bounce"
              : "bg-blue-50 text-[#2962ff] hover:bg-blue-100 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800"
          }`}
          title="Cut / Bar Replay"
        >
          <Scissors size={13} className={replayActive || isPlacingScissors ? "-rotate-90" : ""} />
          <span>{replayActive ? "Exit Replay" : isPlacingScissors ? "Click Candle!" : "Replay"}</span>
        </button>

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

      {/* ── RIGHT SECTION: Theme Toggle, Save, Layout, Upgrade ── */}
      <div className="flex items-center gap-1.5">
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
