"use client";

import { TrendingUp, Wallet } from "lucide-react";

interface FloatingCashMeterProps {
  floatingCash?: number;
  limit?: number;
  onRequestPickup?: () => void;
}

export default function FloatingCashMeter({
  floatingCash = 0,
  limit = 1500,
  onRequestPickup,
}: FloatingCashMeterProps) {
  const percentage = limit > 0 ? Math.min((floatingCash / limit) * 100, 100) : 0;

  const progressColor =
    percentage >= 85
      ? "bg-red-500"
      : percentage >= 60
        ? "bg-orange-500"
        : "bg-green-500";

  return (
    <div className="glass animate-float-in overflow-hidden rounded-[30px] border border-white/10 p-5">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-white/60">Floating Cash</p>

          <div className="mt-2 flex flex-wrap items-end gap-2">
            <h2 className="text-3xl font-black text-white">
              Rs. {Math.round(floatingCash)}
            </h2>

            <span className="mb-1 text-xs text-white/50">
              / Rs. {Math.round(limit)}
            </span>
          </div>
        </div>

        <div className="gradient-primary glow-orange flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl">
          <Wallet className="h-7 w-7 text-white" />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/60">Cash Limit Usage</span>

          <span className="font-semibold text-orange-300">
            {Math.round(percentage)}%
          </span>
        </div>

        <div className="h-3 overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={onRequestPickup}
        className="mt-5 flex w-full items-center justify-between rounded-2xl border border-orange-500/10 bg-orange-500/5 px-4 py-3 text-left transition hover:border-orange-400/25 hover:bg-orange-500/10"
      >
        <div>
          <p className="text-xs text-white/60">Today's Collection</p>

          <p className="mt-1 text-sm font-semibold text-white">
            Track COD balance realtime
          </p>
        </div>

        <TrendingUp className="h-5 w-5 text-orange-400" />
      </button>
    </div>
  );
}
