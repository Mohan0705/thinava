"use client";

import { Bell, Wallet, Wifi } from "lucide-react";

interface RiderHeaderProps {
  riderName?: string;
  floatingCash?: number;
  isOnline?: boolean;
}

export default function RiderHeader({
  riderName = "Delivery Partner",
  floatingCash = 0,
  isOnline = true,
}: RiderHeaderProps) {
  return (
    <header className="sticky top-0 z-40 px-4 pt-4">
      <div className="glass animate-float-in relative overflow-hidden rounded-[28px] border border-white/10 p-4">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 via-transparent to-orange-400/5" />

        <div className="relative flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FF7A2F] to-[#FF5A36] text-lg font-bold text-white shadow-[0_0_30px_rgba(255,122,47,0.35)]">
                {riderName.charAt(0)}
              </div>

              <span
                className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-[#020B2D] ${
                  isOnline ? "bg-green-400" : "bg-red-500"
                }`}
              />
            </div>

            <div>
              <h1 className="text-lg font-bold text-white">{riderName}</h1>

              <div className="mt-1 flex items-center gap-2 text-xs text-white/70">
                <span className="live-dot" />
                <span>{isOnline ? "Live Tracking Active" : "Offline"}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="glass-soft flex items-center gap-2 rounded-2xl border border-orange-500/20 px-3 py-2">
              <Wallet className="h-4 w-4 text-orange-400" />
              <span className="text-sm font-semibold text-white">
                ₹{floatingCash}
              </span>
            </div>

            <button className="glass-soft relative flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 text-white transition-all hover:border-orange-400/30 hover:bg-white/5">
              <Bell className="h-5 w-5" />

              <span className="absolute right-2 top-2 h-2 w-2 animate-pulse rounded-full bg-orange-400" />
            </button>

            <div className="hidden rounded-2xl border border-green-500/20 bg-green-500/10 px-3 py-2 md:flex md:items-center md:gap-2">
              <Wifi className="h-4 w-4 text-green-400" />
              <span className="text-xs font-medium text-green-300">
                Connected
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
