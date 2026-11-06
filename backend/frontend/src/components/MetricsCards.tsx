"use client";

import {
  TrendingUp,
  TrendingDown,
  Target,
  AlertTriangle,
  BarChart3,
  Activity,
  Award,
  Clock,
} from "lucide-react";
import type { BacktestResult } from "@/lib/api";

interface Props {
  result: BacktestResult | null;
}

interface MetricCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  color?: "profit" | "loss" | "neutral" | "accent";
  subValue?: string;
}

function MetricCard({ label, value, icon, color = "neutral", subValue }: MetricCardProps) {
  const colorMap = {
    profit: "text-tv-profit",
    loss: "text-tv-loss",
    neutral: "text-tv-text",
    accent: "text-tv-accent",
  };

  const bgMap = {
    profit: "bg-tv-profit/10",
    loss: "bg-tv-loss/10",
    neutral: "bg-tv-border/50",
    accent: "bg-tv-accent/10",
  };

  return (
    <div className="bg-tv-surface border border-tv-border rounded-lg p-3 flex items-start gap-3">
      <div className={`p-2 rounded-lg ${bgMap[color]}`}>
        <span className={colorMap[color]}>{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-xs text-tv-text-muted uppercase tracking-wider truncate">
          {label}
        </p>
        <p className={`text-lg font-bold font-mono ${colorMap[color]}`}>
          {value}
        </p>
        {subValue && (
          <p className="text-xs text-tv-text-muted">{subValue}</p>
        )}
      </div>
    </div>
  );
}

export default function MetricsCards({ result }: Props) {
  if (!result) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="bg-tv-surface border border-tv-border rounded-lg p-3 h-20 animate-pulse"
          >
            <div className="h-3 bg-tv-border rounded w-20 mb-2" />
            <div className="h-5 bg-tv-border rounded w-16" />
          </div>
        ))}
      </div>
    );
  }

  const profitColor = result.total_profit >= 0 ? "profit" : "loss";

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <MetricCard
        label="Net Profit"
        value={`${result.total_profit >= 0 ? "+" : ""}$${result.total_profit.toLocaleString()}`}
        icon={result.total_profit >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
        color={profitColor}
        subValue={`${result.total_profit_pct >= 0 ? "+" : ""}${result.total_profit_pct}%`}
      />
      <MetricCard
        label="Win Rate"
        value={`${result.win_rate}%`}
        icon={<Target size={16} />}
        color={result.win_rate >= 50 ? "profit" : "loss"}
        subValue={`${result.winning_trades}W / ${result.losing_trades}L`}
      />
      <MetricCard
        label="Max Drawdown"
        value={`$${result.max_drawdown.toLocaleString()}`}
        icon={<AlertTriangle size={16} />}
        color="loss"
        subValue={`${result.max_drawdown_pct}%`}
      />
      <MetricCard
        label="Profit Factor"
        value={`${result.profit_factor}`}
        icon={<BarChart3 size={16} />}
        color={result.profit_factor >= 1.5 ? "profit" : result.profit_factor >= 1 ? "neutral" : "loss"}
        subValue={result.profit_factor >= 1.5 ? "Good" : result.profit_factor >= 1 ? "Break-even" : "Losing"}
      />
      <MetricCard
        label="Sharpe Ratio"
        value={`${result.sharpe_ratio}`}
        icon={<Activity size={16} />}
        color={result.sharpe_ratio >= 1 ? "profit" : "neutral"}
        subValue={result.sharpe_ratio >= 1 ? "Good" : "Weak"}
      />
      <MetricCard
        label="Total Trades"
        value={`${result.total_trades}`}
        icon={<BarChart3 size={16} />}
        color="accent"
      />
      <MetricCard
        label="Best / Worst"
        value={`$${result.best_trade}`}
        icon={<Award size={16} />}
        color="profit"
        subValue={`Worst: $${result.worst_trade}`}
      />
      <MetricCard
        label="Avg Hold Time"
        value={`${result.avg_bars_held} bars`}
        icon={<Clock size={16} />}
        color="neutral"
        subValue={`Avg P&L: $${result.avg_trade_pnl}`}
      />
    </div>
  );
}
