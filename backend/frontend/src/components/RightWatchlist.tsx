"use client";

import { useState } from "react";
import { Plus, MoreHorizontal, ChevronDown, TrendingUp, TrendingDown } from "lucide-react";
import type { ForexPair } from "@/lib/api";

interface Props {
  pairs: ForexPair[];
  currentPair: string;
  onSelectPair: (pairId: string) => void;
  theme?: "light" | "dark";
  currentPrice?: number;
  priceChange?: number;
}

export default function RightWatchlist({
  pairs,
  currentPair,
  onSelectPair,
  theme = "light",
  currentPrice = 1.0845,
  priceChange = 0.28,
}: Props) {
  const isLight = theme === "light";
  const bg = isLight ? "bg-white border-[#e0e3eb]" : "bg-[#1e222d] border-[#2a2e39]";
  const textMuted = isLight ? "text-[#787b86]" : "text-[#787b86]";
  const textMain = isLight ? "text-[#131722]" : "text-[#d1d4dc]";
  const rowHover = isLight ? "hover:bg-[#f0f3fa]" : "hover:bg-[#262b3d]";
  const rowActive = isLight ? "bg-[#e8ecf4]" : "bg-[#2a2e39]";
  const borderCol = isLight ? "border-[#e0e3eb]" : "border-[#2a2e39]";

  // Mock rates & changes for watchlist pairs
  const mockPairData: Record<string, { last: string; chg: string; chgPct: string; isUp: boolean }> = {
    EURUSD: { last: "1.08452", chg: "+0.0032", chgPct: "+0.30%", isUp: true },
    GBPUSD: { last: "1.29140", chg: "-0.0018", chgPct: "-0.14%", isUp: false },
    USDJPY: { last: "152.480", chg: "+0.640", chgPct: "+0.42%", isUp: true },
    AUDUSD: { last: "0.65820", chg: "+0.0009", chgPct: "+0.14%", isUp: true },
    USDCAD: { last: "1.38910", chg: "-0.0022", chgPct: "-0.16%", isUp: false },
    USDCHF: { last: "0.88420", chg: "+0.0004", chgPct: "+0.05%", isUp: true },
    NZDUSD: { last: "0.59760", chg: "-0.0011", chgPct: "-0.18%", isUp: false },
    EURGBP: { last: "0.83980", chg: "+0.0012", chgPct: "+0.14%", isUp: true },
    EURJPY: { last: "165.380", chg: "+0.820", chgPct: "+0.50%", isUp: true },
    GBPJPY: { last: "196.920", chg: "+0.450", chgPct: "+0.23%", isUp: true },
  };

  const selectedData = mockPairData[currentPair] || {
    last: currentPrice.toFixed(5),
    chg: "+0.0015",
    chgPct: "+0.14%",
    isUp: true,
  };

  return (
    <div
      className={`w-72 border-l flex flex-col justify-between shrink-0 select-none text-xs ${bg}`}
    >
      {/* ── TOP HEADER: Watchlist title & icons ── */}
      <div>
        <div className={`px-3 py-2.5 border-b flex items-center justify-between font-semibold ${borderCol}`}>
          <div className="flex items-center gap-1 cursor-pointer">
            <span className={`text-sm ${textMain}`}>Watchlist</span>
            <ChevronDown size={14} className={textMuted} />
          </div>
          <div className={`flex items-center gap-2 ${textMuted}`}>
            <button className="hover:text-blue-600 transition-colors">
              <Plus size={16} />
            </button>
            <button className="hover:text-blue-600 transition-colors">
              <MoreHorizontal size={16} />
            </button>
          </div>
        </div>

        {/* Column Headers */}
        <div className={`px-3 py-1.5 flex items-center justify-between text-[11px] font-medium border-b ${borderCol} ${textMuted}`}>
          <span>Symbol</span>
          <div className="flex items-center gap-4">
            <span>Last</span>
            <span>Chg%</span>
          </div>
        </div>

        {/* Category Header */}
        <div className="px-3 py-1 text-[10px] uppercase font-bold tracking-wider text-[#787b86] flex items-center gap-1 mt-1">
          <ChevronDown size={11} />
          <span>MAJOR FOREX PAIRS</span>
        </div>

        {/* Pair Rows */}
        <div className="overflow-y-auto max-h-[380px]">
          {pairs.map((p) => {
            const data = mockPairData[p.id] || {
              last: "1.0000",
              chg: "0.0000",
              chgPct: "0.00%",
              isUp: true,
            };
            const isSelected = p.id === currentPair;

            return (
              <div
                key={p.id}
                onClick={() => onSelectPair(p.id)}
                className={`px-3 py-2 flex items-center justify-between cursor-pointer transition-colors ${
                  isSelected ? rowActive : rowHover
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${
                      isSelected ? "bg-[#2962ff]" : "bg-transparent"
                    }`}
                  />
                  <div>
                    <span className={`font-bold ${textMain}`}>{p.name}</span>
                    <span className={`block text-[10px] ${textMuted}`}>{p.id}</span>
                  </div>
                </div>

                <div className="text-right font-mono">
                  <div className={`font-semibold ${textMain}`}>{data.last}</div>
                  <div
                    className={`text-[10px] font-bold ${
                      data.isUp ? "text-[#089981]" : "text-[#f23645]"
                    }`}
                  >
                    {data.chgPct}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── BOTTOM SYMBOL DETAILS CARD (Like TradingView's Apple Card) ── */}
      <div className={`p-3.5 border-t ${borderCol} ${isLight ? "bg-[#f8f9fd]" : "bg-[#181c27]"}`}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-sm text-[#131722] dark:text-white">
              {currentPair.slice(0, 3)}/{currentPair.slice(3)}
            </span>
            <span className="text-[10px] px-1 py-0.2 rounded bg-blue-100 text-blue-700 font-semibold">
              FOREX
            </span>
          </div>
          <span className="text-[11px] text-[#787b86]">Spot &bull; OANDA</span>
        </div>

        {/* Big Price Display */}
        <div className="mt-2 mb-1">
          <div className="text-2xl font-bold font-mono tracking-tight text-[#131722] dark:text-white">
            {selectedData.last} <span className="text-xs font-normal text-[#787b86]">USD</span>
          </div>
          <div className={`text-xs font-bold font-mono mt-0.5 flex items-center gap-1 ${
            selectedData.isUp ? "text-[#089981]" : "text-[#f23645]"
          }`}>
            {selectedData.isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            <span>{selectedData.chg} ({selectedData.chgPct})</span>
          </div>
        </div>

        {/* Mini stats */}
        <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-[#e0e3eb] dark:border-[#2a2e39] text-[11px]">
          <div>
            <span className="text-[#787b86] block text-[10px]">Day Range</span>
            <span className="font-mono font-semibold text-[#131722] dark:text-white">
              {(parseFloat(selectedData.last) - 0.004).toFixed(4)} - {(parseFloat(selectedData.last) + 0.003).toFixed(4)}
            </span>
          </div>
          <div>
            <span className="text-[#787b86] block text-[10px]">Spread</span>
            <span className="font-mono font-semibold text-[#131722] dark:text-white">1.5 pips</span>
          </div>
        </div>
      </div>
    </div>
  );
}
