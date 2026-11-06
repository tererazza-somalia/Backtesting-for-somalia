"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Props {
  equityCurve: number[];
  equityDates: string[];
  initialCapital: number;
}

export default function EquityCurve({
  equityCurve,
  equityDates,
  initialCapital,
}: Props) {
  if (!equityCurve || equityCurve.length === 0) {
    return (
      <div className="bg-tv-surface border border-tv-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-semibold text-white">
            Equity Curve
          </span>
        </div>
        <div className="h-[200px] flex items-center justify-center text-tv-text-muted text-sm">
          Run a backtest to see the equity curve
        </div>
      </div>
    );
  }

  // Sample data to prevent rendering too many points
  const maxPoints = 200;
  const step = Math.max(1, Math.floor(equityCurve.length / maxPoints));

  const data = equityCurve
    .filter((_, i) => i % step === 0 || i === equityCurve.length - 1)
    .map((value, idx) => {
      const originalIdx = Math.min(idx * step, equityDates.length - 1);
      return {
        date: equityDates[originalIdx] || "",
        equity: value,
      };
    });

  const finalValue = equityCurve[equityCurve.length - 1];
  const isProfit = finalValue >= initialCapital;
  const color = isProfit ? "#26a69a" : "#ef5350";

  return (
    <div className="bg-tv-surface border border-tv-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-white">Equity Curve</span>
        <span
          className={`text-sm font-mono font-semibold ${
            isProfit ? "text-tv-profit" : "text-tv-loss"
          }`}
        >
          ${finalValue.toLocaleString()}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#1e222d" strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={{ fill: "#787b86", fontSize: 10 }}
            axisLine={{ stroke: "#2a2e39" }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: "#787b86", fontSize: 10 }}
            axisLine={{ stroke: "#2a2e39" }}
            tickLine={false}
            domain={["auto", "auto"]}
            tickFormatter={(v) => `$${v.toLocaleString()}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1e222d",
              border: "1px solid #2a2e39",
              borderRadius: "4px",
              color: "#d1d4dc",
              fontSize: "12px",
            }}
            formatter={(value: any) => [`$${Number(value).toLocaleString()}`, "Equity"]}
            labelFormatter={(label) => `Date: ${label}`}
          />
          <Area
            type="monotone"
            dataKey="equity"
            stroke={color}
            strokeWidth={2}
            fill="url(#equityGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
