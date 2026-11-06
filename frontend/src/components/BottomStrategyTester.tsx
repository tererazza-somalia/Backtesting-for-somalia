"use client";

import { useState, useEffect, useRef } from "react";
import {
  Play,
  Loader2,
  ChevronUp,
  ChevronDown,
  BarChart2,
  ListOrdered,
  Settings,
  ArrowUpRight,
  ArrowDownRight,
  Code2,
  Upload,
  Copy,
  Check,
  X,
  FileSpreadsheet,
} from "lucide-react";
import type { StrategyInfo, BacktestResult } from "@/lib/api";
import { fetchPineScript, uploadTradingViewCsv } from "@/lib/api";
import EquityCurve from "./EquityCurve";

interface Props {
  strategies: Record<string, StrategyInfo>;
  onRunBacktest: (config: any) => void;
  loading: boolean;
  result: BacktestResult | null;
  currentPair: string;
  currentTimeframe?: string;
  onDataRefresh?: () => void;
  theme?: "light" | "dark";
  initialCapital: number;
}

export default function BottomStrategyTester({
  strategies,
  onRunBacktest,
  loading,
  result,
  currentPair,
  currentTimeframe = "1D",
  onDataRefresh,
  theme = "light",
  initialCapital,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "trades" | "settings">("overview");

  // Auto-expand whenever a backtest result arrives
  useEffect(() => {
    if (result) {
      setIsOpen(true);
    }
  }, [result]);

  // Strategy form states
  const [strategyName, setStrategyName] = useState("sma_crossover");
  const [fastPeriod, setFastPeriod] = useState(10);
  const [slowPeriod, setSlowPeriod] = useState(50);
  const [rsiPeriod, setRsiPeriod] = useState(14);
  const [rsiOversold, setRsiOversold] = useState(30);
  const [rsiOverbought, setRsiOverbought] = useState(70);

  // TradingView Strategy Properties
  const [capital, setCapital] = useState(initialCapital);
  const [orderSizeType, setOrderSizeType] = useState<"lots" | "contracts" | "cash" | "percent_of_equity">("lots");
  const [orderSizeValue, setOrderSizeValue] = useState(1.0);
  const [processOrdersOnClose, setProcessOrdersOnClose] = useState(false);
  const [spreadPips, setSpreadPips] = useState(0.0);

  // Pine Script Modal state
  const [isPineModalOpen, setIsPineModalOpen] = useState(false);
  const [pineScriptCode, setPineScriptCode] = useState("");
  const [isPineLoading, setIsPineLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // TV CSV Upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  const isLight = theme === "light";
  const bg = isLight ? "bg-white border-[#e0e3eb]" : "bg-[#181c27] border-[#2a2e39]";
  const borderCol = isLight ? "border-[#e0e3eb]" : "border-[#2a2e39]";
  const textMuted = isLight ? "text-[#787b86]" : "text-[#787b86]";
  const textMain = isLight ? "text-[#131722]" : "text-[#d1d4dc]";

  const getStrategyParams = () => {
    if (strategyName === "sma_crossover") {
      return { fast_period: fastPeriod, slow_period: slowPeriod };
    } else if (strategyName === "ema_crossover") {
      return { fast_period: fastPeriod || 9, slow_period: slowPeriod || 21 };
    } else if (strategyName === "rsi") {
      return { period: rsiPeriod, oversold: rsiOversold, overbought: rsiOverbought };
    }
    return { fast_period: fastPeriod, slow_period: slowPeriod };
  };

  const handleRun = () => {
    onRunBacktest({
      pair: currentPair,
      timeframe: currentTimeframe.toLowerCase(),
      strategy_name: strategyName,
      strategy_params: getStrategyParams(),
      initial_capital: capital,
      order_size_type: orderSizeType,
      order_size_value: orderSizeValue,
      process_orders_on_close: processOrdersOnClose,
      spread_pips: spreadPips,
    });
  };

  const handleOpenPineModal = async () => {
    setIsPineModalOpen(true);
    setIsPineLoading(true);
    setIsCopied(false);
    try {
      const code = await fetchPineScript({
        pair: currentPair,
        timeframe: currentTimeframe.toLowerCase(),
        strategy_name: strategyName,
        strategy_params: getStrategyParams(),
        initial_capital: capital,
        order_size_type: orderSizeType,
        order_size_value: orderSizeValue,
        process_orders_on_close: processOrdersOnClose,
        spread_pips: spreadPips,
      });
      setPineScriptCode(code);
    } catch (err) {
      setPineScriptCode("// Error generating Pine Script code");
    } finally {
      setIsPineLoading(false);
    }
  };

  const handleCopyPineScript = () => {
    navigator.clipboard.writeText(pineScriptCode);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadMessage(null);
    try {
      const res = await uploadTradingViewCsv(currentPair, currentTimeframe.toLowerCase(), file);
      setUploadMessage(res.message || "TradingView CSV imported successfully!");
      if (onDataRefresh) {
        onDataRefresh();
      }
      setTimeout(() => setUploadMessage(null), 4000);
    } catch (err: any) {
      setUploadMessage(err.response?.data?.error || "Failed to import CSV");
      setTimeout(() => setUploadMessage(null), 5000);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className={`border-t flex flex-col shrink-0 select-none transition-all ${bg}`}>
      {/* ── DOCK TAB BAR (TradingView Bottom Bar) ── */}
      <div className={`h-9 px-3 border-b flex items-center justify-between text-xs ${borderCol} ${isLight ? "bg-[#f8f9fd]" : "bg-[#1e222d]"}`}>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setActiveTab("overview");
              setIsOpen(true);
            }}
            className={`px-3 py-1 font-semibold flex items-center gap-1.5 rounded transition-colors ${
              activeTab === "overview" && isOpen
                ? "bg-[#2962ff] text-white"
                : `${textMuted} hover:text-blue-600`
            }`}
          >
            <BarChart2 size={13} />
            Strategy Tester
          </button>

          <button
            onClick={() => {
              setActiveTab("trades");
              setIsOpen(true);
            }}
            className={`px-3 py-1 font-semibold flex items-center gap-1.5 rounded transition-colors ${
              activeTab === "trades" && isOpen
                ? "bg-[#2962ff] text-white"
                : `${textMuted} hover:text-blue-600`
            }`}
          >
            <ListOrdered size={13} />
            List of Trades ({result?.total_trades || 0})
          </button>

          <button
            onClick={() => {
              setActiveTab("settings");
              setIsOpen(true);
            }}
            className={`px-3 py-1 font-semibold flex items-center gap-1.5 rounded transition-colors ${
              activeTab === "settings" && isOpen
                ? "bg-[#2962ff] text-white"
                : `${textMuted} hover:text-blue-600`
            }`}
          >
            <Settings size={13} />
            Strategy Settings
          </button>

          {/* Upload confirmation status pill */}
          {uploadMessage && (
            <span className="ml-2 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 animate-fadeIn">
              ✓ {uploadMessage}
            </span>
          )}
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2">
          {/* Hidden File Input for TradingView CSV */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".csv"
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            title="Import exported CSV from TradingView to guarantee 100% data parity"
            className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 border transition-colors ${borderCol} ${
              isLight ? "bg-white hover:bg-gray-100 text-[#131722]" : "bg-[#2a2e39] hover:bg-[#363a45] text-white"
            }`}
          >
            {isUploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            Import TV CSV
          </button>

          <button
            onClick={handleOpenPineModal}
            title="Get exact Pine Script v5 code to run on TradingView"
            className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 border transition-colors ${borderCol} ${
              isLight ? "bg-white hover:bg-gray-100 text-[#131722]" : "bg-[#2a2e39] hover:bg-[#363a45] text-white"
            }`}
          >
            <Code2 size={12} className="text-[#2962ff]" />
            Pine Script (v5)
          </button>

          <button
            onClick={handleRun}
            disabled={loading}
            className="bg-[#2962ff] hover:bg-[#1e53e5] disabled:opacity-50 text-white font-bold px-3 py-1 rounded flex items-center gap-1.5 text-xs transition-colors shadow-sm"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            Run Strategy
          </button>

          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`p-1 rounded ${textMuted} hover:text-[#131722] hover:bg-gray-200 dark:hover:bg-gray-700`}
            title={isOpen ? "Minimize Panel" : "Expand Panel"}
          >
            {isOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        </div>
      </div>

      {/* ── EXPANDED PANEL CONTENT ── */}
      {isOpen && (
        <div className="h-64 overflow-y-auto p-4 animate-fadeIn">
          {/* TAB 1: OVERVIEW METRICS */}
          {activeTab === "overview" && (
            <div className="flex flex-col lg:flex-row gap-5 h-full">
              {/* Summary Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 flex-1">
                <div className={`p-3 rounded-lg border ${borderCol} ${isLight ? "bg-[#f8f9fd]" : "bg-[#1e222d]"}`}>
                  <span className={`block text-[11px] ${textMuted} uppercase tracking-wider`}>Net Profit</span>
                  <div className={`text-xl font-bold font-mono mt-0.5 ${
                    (result?.total_profit || 0) >= 0 ? "text-[#089981]" : "text-[#f23645]"
                  }`}>
                    {(result?.total_profit || 0) >= 0 ? "+" : ""}${result?.total_profit ?? "0.00"}
                  </div>
                  <span className={`text-[11px] font-semibold ${
                    (result?.total_profit_pct || 0) >= 0 ? "text-[#089981]" : "text-[#f23645]"
                  }`}>
                    {(result?.total_profit_pct || 0) >= 0 ? "+" : ""}{result?.total_profit_pct ?? 0}%
                  </span>
                </div>

                <div className={`p-3 rounded-lg border ${borderCol} ${isLight ? "bg-[#f8f9fd]" : "bg-[#1e222d]"}`}>
                  <span className={`block text-[11px] ${textMuted} uppercase tracking-wider`}>Win Rate</span>
                  <div className="text-xl font-bold font-mono mt-0.5 text-[#131722] dark:text-white">
                    {result?.win_rate ?? 0}%
                  </div>
                  <span className={`text-[11px] ${textMuted}`}>
                    {result?.winning_trades ?? 0} wins / {result?.losing_trades ?? 0} losses
                  </span>
                </div>

                <div className={`p-3 rounded-lg border ${borderCol} ${isLight ? "bg-[#f8f9fd]" : "bg-[#1e222d]"}`}>
                  <span className={`block text-[11px] ${textMuted} uppercase tracking-wider`}>Max Drawdown</span>
                  <div className="text-xl font-bold font-mono mt-0.5 text-[#f23645]">
                    ${result?.max_drawdown ?? "0.00"}
                  </div>
                  <span className="text-[11px] font-semibold text-[#f23645]">
                    {result?.max_drawdown_pct ?? 0}%
                  </span>
                </div>

                <div className={`p-3 rounded-lg border ${borderCol} ${isLight ? "bg-[#f8f9fd]" : "bg-[#1e222d]"}`}>
                  <span className={`block text-[11px] ${textMuted} uppercase tracking-wider`}>Profit Factor</span>
                  <div className={`text-xl font-bold font-mono mt-0.5 ${
                    (result?.profit_factor || 0) >= 1.5 ? "text-[#089981]" : "text-[#131722] dark:text-white"
                  }`}>
                    {result?.profit_factor ?? "0.00"}
                  </div>
                  <span className={`text-[11px] ${textMuted}`}>Gross Profit / Loss</span>
                </div>

                <div className={`p-3 rounded-lg border ${borderCol} ${isLight ? "bg-[#f8f9fd]" : "bg-[#1e222d]"}`}>
                  <span className={`block text-[11px] ${textMuted} uppercase tracking-wider`}>Sharpe Ratio</span>
                  <div className="text-xl font-bold font-mono mt-0.5 text-[#131722] dark:text-white">
                    {result?.sharpe_ratio ?? "0.00"}
                  </div>
                  <span className={`text-[11px] ${textMuted}`}>Annualized Return/Risk</span>
                </div>

                <div className={`p-3 rounded-lg border ${borderCol} ${isLight ? "bg-[#f8f9fd]" : "bg-[#1e222d]"}`}>
                  <span className={`block text-[11px] ${textMuted} uppercase tracking-wider`}>Total Trades</span>
                  <div className="text-xl font-bold font-mono mt-0.5 text-[#2962ff]">
                    {result?.total_trades ?? 0}
                  </div>
                  <span className={`text-[11px] ${textMuted}`}>
                    Avg P&L: ${result?.avg_trade_pnl ?? "0.00"}
                  </span>
                </div>
              </div>

              {/* Equity Curve Mini-chart */}
              <div className={`w-full lg:w-96 rounded-lg border ${borderCol} p-2 flex flex-col justify-between ${isLight ? "bg-[#f8f9fd]" : "bg-[#1e222d]"}`}>
                <div className="flex items-center justify-between px-2 pt-1">
                  <span className="text-xs font-bold text-[#131722] dark:text-white">Performance Graph</span>
                  <span className="text-[11px] font-mono text-[#787b86]">Balance over time</span>
                </div>
                <div className="h-44">
                  <EquityCurve
                    equityCurve={result?.equity_curve || []}
                    equityDates={result?.equity_dates || []}
                    initialCapital={capital}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LIST OF TRADES */}
          {activeTab === "trades" && (
            <div className="overflow-x-auto">
              {!result || result.trades.length === 0 ? (
                <div className="py-12 text-center text-[#787b86]">
                  No backtest trades executed yet. Click &quot;Run Strategy&quot; to test.
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className={`border-b ${borderCol} ${textMuted} uppercase font-medium text-[10px]`}>
                      <th className="py-1.5 px-3 text-left">Trade #</th>
                      <th className="py-1.5 px-3 text-left">Type</th>
                      <th className="py-1.5 px-3 text-left">Entry Date</th>
                      <th className="py-1.5 px-3 text-right">Entry Price</th>
                      <th className="py-1.5 px-3 text-left">Exit Date</th>
                      <th className="py-1.5 px-3 text-right">Exit Price</th>
                      <th className="py-1.5 px-3 text-right">Profit / Loss ($)</th>
                      <th className="py-1.5 px-3 text-right">Bars</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.trades.map((t) => {
                      const isWin = t.pnl > 0;
                      return (
                        <tr
                          key={t.trade_id}
                          className={`border-b ${borderCol} ${isLight ? "hover:bg-gray-100" : "hover:bg-[#262b3d]"} transition-colors font-mono`}
                        >
                          <td className="py-1.5 px-3 text-[#787b86]">#{t.trade_id}</td>
                          <td className="py-1.5 px-3 font-sans font-bold">
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] ${
                                t.type === "LONG"
                                  ? "bg-emerald-100 text-[#089981]"
                                  : "bg-red-100 text-[#f23645]"
                              }`}
                            >
                              {t.type === "LONG" ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                              {t.type}
                            </span>
                          </td>
                          <td className="py-1.5 px-3 font-sans text-[#787b86]">{t.entry_date}</td>
                          <td className="py-1.5 px-3 text-right font-bold">{t.entry_price}</td>
                          <td className="py-1.5 px-3 font-sans text-[#787b86]">{t.exit_date}</td>
                          <td className="py-1.5 px-3 text-right font-bold">{t.exit_price}</td>
                          <td
                            className={`py-1.5 px-3 text-right font-bold ${
                              isWin ? "text-[#089981]" : "text-[#f23645]"
                            }`}
                          >
                            {isWin ? "+" : ""}${t.pnl}
                          </td>
                          <td className="py-1.5 px-3 text-right text-[#787b86]">{t.bars_held}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* TAB 3: STRATEGY SETTINGS (TradingView Parity Properties) */}
          {activeTab === "settings" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl">
              {/* Column 1: Strategy Model */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-[#787b86] uppercase">Strategy Model</label>
                <select
                  value={strategyName}
                  onChange={(e) => setStrategyName(e.target.value)}
                  className={`w-full p-2 rounded border text-xs font-semibold ${borderCol} ${isLight ? "bg-white" : "bg-[#1e222d] text-white"}`}
                >
                  {Object.entries(strategies).map(([k, s]) => (
                    <option key={k} value={k}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-[#787b86]">
                  {strategies[strategyName]?.description}
                </p>

                {/* Dynamic Strategy Parameters */}
                <div className="pt-2 border-t space-y-2">
                  {strategyName === "sma_crossover" || strategyName === "ema_crossover" ? (
                    <>
                      <div className="flex items-center justify-between text-xs">
                        <span>Fast Period</span>
                        <input
                          type="number"
                          value={fastPeriod}
                          onChange={(e) => setFastPeriod(parseInt(e.target.value) || 5)}
                          className={`w-20 p-1 border rounded text-right font-mono text-xs ${borderCol} ${isLight ? "bg-white" : "bg-[#1e222d] text-white"}`}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span>Slow Period</span>
                        <input
                          type="number"
                          value={slowPeriod}
                          onChange={(e) => setSlowPeriod(parseInt(e.target.value) || 20)}
                          className={`w-20 p-1 border rounded text-right font-mono text-xs ${borderCol} ${isLight ? "bg-white" : "bg-[#1e222d] text-white"}`}
                        />
                      </div>
                    </>
                  ) : strategyName === "rsi" ? (
                    <>
                      <div className="flex items-center justify-between text-xs">
                        <span>RSI Period</span>
                        <input
                          type="number"
                          value={rsiPeriod}
                          onChange={(e) => setRsiPeriod(parseInt(e.target.value) || 14)}
                          className={`w-20 p-1 border rounded text-right font-mono text-xs ${borderCol} ${isLight ? "bg-white" : "bg-[#1e222d] text-white"}`}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span>Oversold Line</span>
                        <input
                          type="number"
                          value={rsiOversold}
                          onChange={(e) => setRsiOversold(parseInt(e.target.value) || 30)}
                          className={`w-20 p-1 border rounded text-right font-mono text-xs ${borderCol} ${isLight ? "bg-white" : "bg-[#1e222d] text-white"}`}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span>Overbought Line</span>
                        <input
                          type="number"
                          value={rsiOverbought}
                          onChange={(e) => setRsiOverbought(parseInt(e.target.value) || 70)}
                          className={`w-20 p-1 border rounded text-right font-mono text-xs ${borderCol} ${isLight ? "bg-white" : "bg-[#1e222d] text-white"}`}
                        />
                      </div>
                    </>
                  ) : null}
                </div>
              </div>

              {/* Column 2: Order Sizing & Capital */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-[#787b86] uppercase">Order Sizing (Forex)</label>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span>Initial Capital ($)</span>
                    <input
                      type="number"
                      value={capital}
                      onChange={(e) => setCapital(parseFloat(e.target.value) || 1000)}
                      className={`w-24 p-1 border rounded text-right font-mono text-xs ${borderCol} ${isLight ? "bg-white" : "bg-[#1e222d] text-white"}`}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span>Order Size Type</span>
                    <select
                      value={orderSizeType}
                      onChange={(e: any) => setOrderSizeType(e.target.value)}
                      className={`w-36 p-1 border rounded text-xs font-semibold ${borderCol} ${isLight ? "bg-white" : "bg-[#1e222d] text-white"}`}
                    >
                      <option value="lots">Standard Lots</option>
                      <option value="contracts">Contracts (Units)</option>
                      <option value="cash">Fixed Cash ($)</option>
                      <option value="percent_of_equity">% of Equity</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span>
                      {orderSizeType === "lots"
                        ? "Lot Size (1.0 = 100k)"
                        : orderSizeType === "contracts"
                        ? "Contracts"
                        : orderSizeType === "cash"
                        ? "Amount ($)"
                        : "% Allocation"}
                    </span>
                    <input
                      type="number"
                      step={orderSizeType === "lots" ? 0.1 : 1}
                      value={orderSizeValue}
                      onChange={(e) => setOrderSizeValue(parseFloat(e.target.value) || 1.0)}
                      className={`w-24 p-1 border rounded text-right font-mono text-xs ${borderCol} ${isLight ? "bg-white" : "bg-[#1e222d] text-white"}`}
                    />
                  </div>
                </div>
              </div>

              {/* Column 3: Execution Timing & Spread */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-[#787b86] uppercase">Execution & Costs</label>
                <div className="space-y-2.5">
                  <div>
                    <label className="block text-[11px] text-[#787b86] mb-1">Fill Timing (TradingView Rule)</label>
                    <select
                      value={processOrdersOnClose ? "close" : "open"}
                      onChange={(e) => setProcessOrdersOnClose(e.target.value === "close")}
                      className={`w-full p-1.5 border rounded text-xs font-semibold ${borderCol} ${isLight ? "bg-white" : "bg-[#1e222d] text-white"}`}
                    >
                      <option value="open">Next Bar Open (TradingView Default)</option>
                      <option value="close">Signal Bar Close (Immediate Fill)</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <div>
                      <span className="block font-medium">Spread (pips)</span>
                      <span className="text-[10px] text-[#787b86]">TV default is 0.0</span>
                    </div>
                    <input
                      type="number"
                      step={0.1}
                      value={spreadPips}
                      onChange={(e) => setSpreadPips(parseFloat(e.target.value) || 0)}
                      className={`w-20 p-1 border rounded text-right font-mono text-xs ${borderCol} ${isLight ? "bg-white" : "bg-[#1e222d] text-white"}`}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TRADINGVIEW PINE SCRIPT V5 MODAL ── */}
      {isPineModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className={`w-full max-w-2xl rounded-xl shadow-2xl border flex flex-col max-h-[85vh] ${isLight ? "bg-white border-gray-300" : "bg-[#1e222d] border-[#2a2e39]"}`}>
            {/* Modal Header */}
            <div className={`px-5 py-3.5 border-b flex items-center justify-between ${borderCol}`}>
              <div className="flex items-center gap-2">
                <Code2 className="text-[#2962ff]" size={18} />
                <h3 className="font-bold text-sm text-[#131722] dark:text-white">
                  TradingView Pine Script (v5)
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-bold uppercase">
                  100% Matching Logic
                </span>
              </div>
              <button
                onClick={() => setIsPineModalOpen(false)}
                className="p-1 rounded text-[#787b86] hover:text-black dark:hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 flex-1 overflow-y-auto font-mono text-xs">
              <p className="font-sans text-xs text-[#787b86] mb-3">
                Paste this script into TradingView&apos;s <strong>Pine Editor</strong> (bottom of the TradingView chart) and click <strong>&quot;Add to chart&quot;</strong>. Both platforms will execute identical trades bar-for-bar.
              </p>

              {isPineLoading ? (
                <div className="py-12 flex justify-center items-center">
                  <Loader2 className="animate-spin text-[#2962ff]" size={24} />
                </div>
              ) : (
                <div className="relative">
                  <pre className={`p-4 rounded-lg overflow-x-auto text-[11px] leading-relaxed border ${isLight ? "bg-[#f8f9fd] border-gray-200 text-gray-800" : "bg-[#131722] border-gray-800 text-gray-200"}`}>
                    {pineScriptCode}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className={`px-5 py-3 border-t flex items-center justify-between ${borderCol} ${isLight ? "bg-gray-50" : "bg-[#181c27]"}`}>
              <span className="text-[11px] text-[#787b86]">
                Pine Script v5 &bull; Process Orders on Close: {processOrdersOnClose ? "True" : "False"}
              </span>
              <button
                onClick={handleCopyPineScript}
                className="bg-[#2962ff] hover:bg-[#1e53e5] text-white font-bold px-4 py-1.5 rounded flex items-center gap-1.5 text-xs transition-colors shadow-sm"
              >
                {isCopied ? <Check size={14} /> : <Copy size={14} />}
                {isCopied ? "Copied to Clipboard!" : "Copy Code"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
