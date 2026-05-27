"use client";

import Link from "next/link";
import { ArrowRight, Clock3, MapPin, Navigation } from "lucide-react";

interface FloatingLiveOrderProps {
  orderId?: string;
  restaurantName?: string;
  customerName?: string;
  pickupDistance?: string;
  dropDistance?: string;
  earnings?: number;
  status?: string;
  isActive?: boolean;
}

export default function FloatingLiveOrder({
  orderId = "TNV-2048",
  restaurantName = "Pizza Hub",
  customerName = "Rahul",
  pickupDistance = "1.2 km",
  dropDistance = "4.6 km",
  earnings = 85,
  status = "ACTIVE",
  isActive = true,
}: FloatingLiveOrderProps) {
  return (
    <div className="glass animate-pop overflow-hidden rounded-[30px] border border-orange-500/20">
      <div className="gradient-primary relative overflow-hidden px-5 py-4">
        <div className="absolute inset-0 bg-white/5" />

        <div className="relative flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.18em] text-white/70">
              {isActive ? "Active Mission" : "Dispatch Radar"}
            </p>

            <h2 className="mt-1 truncate text-xl font-black text-white">
              {orderId}
            </h2>
          </div>

          <div className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white">
            {status}
          </div>
        </div>
      </div>

      <div className="space-y-4 p-5">
        <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
          <div className="flex items-start gap-3">
            <div className="mt-1 rounded-xl bg-orange-500/10 p-2">
              <MapPin className="h-5 w-5 text-orange-400" />
            </div>

            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-white/50">
                Pickup
              </p>

              <h3 className="mt-1 truncate text-sm font-semibold text-white">
                {restaurantName}
              </h3>

              <p className="mt-1 text-xs text-white/60">
                {pickupDistance} {isActive ? "away" : ""}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center">
          <ArrowRight className="h-5 w-5 text-orange-400" />
        </div>

        <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
          <div className="flex items-start gap-3">
            <div className="mt-1 rounded-xl bg-orange-500/10 p-2">
              <Navigation className="h-5 w-5 text-orange-400" />
            </div>

            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-white/50">
                Drop
              </p>

              <h3 className="mt-1 truncate text-sm font-semibold text-white">
                {customerName}
              </h3>

              <p className="mt-1 text-xs text-white/60">
                {dropDistance} {isActive ? "remaining" : ""}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-2xl border border-orange-500/10 bg-orange-500/5 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <Clock3 className="h-4 w-4 shrink-0 text-orange-300" />

            <span className="truncate text-sm text-white/70">
              {isActive ? "Estimated Earnings" : "Next Mission"}
            </span>
          </div>

          <span className="text-lg font-bold text-orange-300">
            {isActive ? `Rs. ${Math.round(earnings)}` : "Ready"}
          </span>
        </div>

        {isActive ? (
          <Link
            href="/delivery/active-order"
            className="gradient-primary glow-orange flex h-14 w-full items-center justify-center rounded-2xl text-sm font-bold tracking-wide text-white transition-all hover:scale-[1.01]"
          >
            Open Live Delivery
          </Link>
        ) : (
          <Link
            href="/delivery/orders"
            className="flex h-14 w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sm font-bold tracking-wide text-white/85 transition-all hover:border-orange-400/30 hover:bg-white/10"
          >
            Scan Live Orders
          </Link>
        )}
      </div>
    </div>
  );
}
