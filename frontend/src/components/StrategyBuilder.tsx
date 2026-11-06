"use client";

import { useState, useEffect } from "react";
import { Play, Loader2, Settings } from "lucide-react";
import type { ForexPair, StrategyInfo, StrategyParam } from "@/lib/api";

interface Props {
  pairs: ForexPair[];
  strategies: Record<string, StrategyInfo>;
  onRunBacktest: (config: {
    pair: string;
    strategy_name: string;
    strategy_params: Record<string, number>;
    initial_capital: number;
    risk_per_trade: number;
    spread_pips: number;
  }) => void;
  loading: boolean;
}

export default function StrategyBuilder({
  pairs,
  strategies,
  onRunBacktest,
  loading,
}: Props) {
  const [pair, setPair] = useState("EURUSD");
  const [strategyName, setStrategyName] = useState("sma_crossover");
  const [params, setParams] = useState<Record<string, number>>({});
  const [capital, setCapital] = useState(10000);
  const [riskPct, setRiskPct] = useState(2);
  const [spreadPips, setSpreadPips] = useState(1.5);

  // Update params when strategy changes
  useEffect(() => {
    const strat = strategies[strategyName];
    if (strat) {
      const defaults: Record<string, number> = {};
      Object.entries(strat.params).forEach(([key, p]) => {
        defaults[key] = p.default;
      });
      setParams(defaults);
    }
  }, [strategyName, strategies]);

  const handleRun = () => {
    onRunBacktest({
      pair,
      strategy_name: strategyName,
      strategy_params: params,
      initial_capital: capital,
      risk_per_trade: riskPct / 100,
      spread_pips: spreadPips,
    });
  };

  const currentStrategy = strategies[strategyName];

  return (
    <div className="w-full lg:w-72 bg-tv-surface border-r border-tv-border flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-3 border-b border-tv-border flex items-center gap-2">
        <Settings size={14} className="text-tv-accent" />
        <span className="text-sm font-semibold text-white">
          Strategy Builder
        </span>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {/* Forex Pair */}
        <div>
          <label className="block text-xs text-tv-text-muted mb-1.5 uppercase tracking-wider">
            Currency Pair
          </label>
          <select
            value={pair}
            onChange={(e) => setPair(e.target.value)}
            className="w-full bg-tv-bg border border-tv-border rounded px-3 py-2 text-sm text-tv-text focus:border-tv-accent focus:outline-none transition-colors"
          >
            {pairs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Strategy */}
        <div>
          <label className="block text-xs text-tv-text-muted mb-1.5 uppercase tracking-wider">
            Strategy
          </label>
          <select
            value={strategyName}
            onChange={(e) => setStrategyName(e.target.value)}
            className="w-full bg-tv-bg border border-tv-border rounded px-3 py-2 text-sm text-tv-text focus:border-tv-accent focus:outline-none transition-colors"
          >
            {Object.entries(strategies).map(([key, strat]) => (
              <option key={key} value={key}>
                {strat.name}
              </option>
            ))}
          </select>
          {currentStrategy && (
            <p className="text-xs text-tv-text-muted mt-1.5">
              {currentStrategy.description}
            </p>
          )}
        </div>

        {/* Strategy Parameters */}
        {currentStrategy && (
          <div>
            <label className="block text-xs text-tv-text-muted mb-1.5 uppercase tracking-wider">
              Parameters
            </label>
            <div className="space-y-2">
              {Object.entries(currentStrategy.params).map(
                ([key, p]: [string, StrategyParam]) => (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-tv-text-muted">
                        {p.label}
                      </span>
                      <span className="text-xs text-tv-accent font-mono">
                        {params[key] ?? p.default}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={p.min}
                      max={p.max}
                      step={p.type === "float" ? 0.1 : 1}
                      value={params[key] ?? p.default}
                      onChange={(e) =>
                        setParams({
                          ...params,
                          [key]: parseFloat(e.target.value),
                        })
                      }
                      className="w-full h-1 bg-tv-border rounded-lg appearance-none cursor-pointer accent-tv-accent"
                    />
                  </div>
                )
              )}
            </div>
          </div>
        )}

        {/* Divider */}
        <hr className="border-tv-border" />

        {/* Account Settings */}
        <div>
          <label className="block text-xs text-tv-text-muted mb-1.5 uppercase tracking-wider">
            Initial Capital ($)
          </label>
          <input
            type="number"
            value={capital}
            onChange={(e) => setCapital(parseFloat(e.target.value) || 0)}
            className="w-full bg-tv-bg border border-tv-border rounded px-3 py-2 text-sm text-tv-text focus:border-tv-accent focus:outline-none transition-colors font-mono"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-tv-text-muted mb-1.5 uppercase tracking-wider">
              Risk %
            </label>
            <input
              type="number"
              value={riskPct}
              step={0.5}
              min={0.1}
              max={100}
              onChange={(e) => setRiskPct(parseFloat(e.target.value) || 0)}
              className="w-full bg-tv-bg border border-tv-border rounded px-3 py-2 text-sm text-tv-text focus:border-tv-accent focus:outline-none transition-colors font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-tv-text-muted mb-1.5 uppercase tracking-wider">
              Spread (pips)
            </label>
            <input
              type="number"
              value={spreadPips}
              step={0.1}
              min={0}
              max={50}
              onChange={(e) => setSpreadPips(parseFloat(e.target.value) || 0)}
              className="w-full bg-tv-bg border border-tv-border rounded px-3 py-2 text-sm text-tv-text focus:border-tv-accent focus:outline-none transition-colors font-mono"
            />
          </div>
        </div>

        {/* Run Button */}
        <button
          onClick={handleRun}
          disabled={loading}
          className="w-full bg-tv-accent hover:bg-tv-accent-hover disabled:opacity-50 text-white font-semibold py-3 rounded flex items-center justify-center gap-2 transition-colors mt-2"
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play size={18} />
              Run Backtest
            </>
          )}
        </button>
      </div>
    </div>
  );
}
