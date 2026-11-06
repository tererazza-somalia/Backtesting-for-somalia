"use client";

import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import type { TradeRecord } from "@/lib/api";

interface Props {
  trades: TradeRecord[];
}

export default function TradeTable({ trades }: Props) {
  if (!trades || trades.length === 0) {
    return (
      <div className="bg-tv-surface border border-tv-border rounded-lg p-4">
        <span className="text-sm font-semibold text-white">Trade Log</span>
        <div className="mt-4 text-center text-tv-text-muted text-sm py-8">
          No trades yet — run a backtest to see the trade log
        </div>
      </div>
    );
  }

  return (
    <div className="bg-tv-surface border border-tv-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-tv-border flex items-center justify-between">
        <span className="text-sm font-semibold text-white">Trade Log</span>
        <span className="text-xs text-tv-text-muted">
          {trades.length} trades
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-tv-surface">
            <tr className="text-xs text-tv-text-muted uppercase tracking-wider border-b border-tv-border">
              <th className="px-4 py-2 text-left">#</th>
              <th className="px-4 py-2 text-left">Type</th>
              <th className="px-4 py-2 text-left">Entry Date</th>
              <th className="px-4 py-2 text-right">Entry Price</th>
              <th className="px-4 py-2 text-right">Exit Price</th>
              <th className="px-4 py-2 text-right">P&L</th>
              <th className="px-4 py-2 text-right">Bars</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((trade) => {
              const isWin = trade.pnl > 0;
              return (
                <tr
                  key={trade.trade_id}
                  className="border-b border-tv-border/50 hover:bg-tv-surface-hover transition-colors"
                >
                  <td className="px-4 py-2 text-tv-text-muted font-mono text-xs">
                    {trade.trade_id}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded ${
                        trade.type === "LONG"
                          ? "bg-tv-profit/15 text-tv-profit"
                          : "bg-tv-loss/15 text-tv-loss"
                      }`}
                    >
                      {trade.type === "LONG" ? (
                        <ArrowUpRight size={12} />
                      ) : (
                        <ArrowDownRight size={12} />
                      )}
                      {trade.type}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-tv-text-muted">
                    {trade.entry_date}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-xs">
                    {trade.entry_price}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-xs">
                    {trade.exit_price}
                  </td>
                  <td
                    className={`px-4 py-2 text-right font-mono text-xs font-semibold ${
                      isWin ? "text-tv-profit" : "text-tv-loss"
                    }`}
                  >
                    {isWin ? "+" : ""}${trade.pnl}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-xs text-tv-text-muted">
                    {trade.bars_held}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
