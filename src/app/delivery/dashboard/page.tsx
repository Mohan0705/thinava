"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Bike,
  Clock3,
  IndianRupee,
  LogOut,
  MessageCircle,
  Phone,
  Star,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import DeliveryPageShell from "@/components/delivery/DeliveryPageShell";
import FloatingCashMeter from "@/components/delivery/FloatingCashMeter";
import FloatingLiveOrder from "@/components/delivery/FloatingLiveOrder";
import RiderHeader from "@/components/delivery/RiderHeader";
import { Button } from "@/components/ui/Button";
import { deliveryApi } from "@/lib/delivery-api";
import { API_BASE_URL } from "@/lib/api";
import { useRiderDashboardSync } from "@/lib/realtimeManager";
import { logSocketStatus } from "@/lib/socket-debug";
import { useDeliveryAuthStore } from "@/store/deliveryAuthStore";
import { useDeliveryOrderStore } from "@/store/deliveryOrderStore";
import type { CashPickupRequest, RiderWallet } from "@/types/delivery";

const formatCurrency = (value: number | undefined) =>
  `Rs. ${Number(value || 0).toFixed(0)}`;

const progressTarget = 20;

export default function DeliveryDashboardPage() {
  const router = useRouter();
  const token = useDeliveryAuthStore((state) => state.token);
  const partner = useDeliveryAuthStore((state) => state.partner);
  const setPartner = useDeliveryAuthStore((state) => state.setPartner);
  const logout = useDeliveryAuthStore((state) => state.logout);
  const activeOrder = useDeliveryOrderStore((state) => state.activeOrder);

  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(partner?.is_online ?? false);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [todayDeliveries, setTodayDeliveries] = useState(0);
  const [toggling, setToggling] = useState(false);
  const [recentReviews, setRecentReviews] = useState<any[]>([]);
  const [displayOnlineTime, setDisplayOnlineTime] = useState("0h 0m");
  const [wallet, setWallet] = useState<RiderWallet | null>(null);
  const [supportPhone, setSupportPhone] = useState("+919160776152");
  const [supportWhatsapp, setSupportWhatsapp] = useState("919160776152");
  const [requestingPickup, setRequestingPickup] = useState(false);
  const [pickupRequests, setPickupRequests] = useState<CashPickupRequest[]>([]);
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [rating, setRating] = useState<number>(0);

  const hasActiveOrder = Boolean(activeOrder || partner?.current_order_id);

  const loadDashboard = async () => {
    try {
      console.log("[DASHBOARD] Loading dashboard data...");
      const [earningsResult, profileResult] = await Promise.all([
        deliveryApi.getTodayEarnings(token!),
        deliveryApi.getProfile(token!),
      ]);

      const earnings = Number(earningsResult.earnings.total_amount || 0);
      const deliveries = Number(earningsResult.earnings.deliveries || 0);
      console.log("[DASHBOARD] API earnings:", { earnings, deliveries });

      setTodayEarnings(earnings);
      setTodayDeliveries(deliveries);
      setPartner(profileResult.profile);
      setIsOnline(profileResult.profile.is_online);
      setRating(Number(profileResult.profile.average_rating || 0));

      const profile = profileResult.profile;
      if (profile?.id) {
        try {
          const [walletRes, supportRes, reviewsRes] = await Promise.all([
            deliveryApi.getWallet(token!),
            deliveryApi.getSupportInfo(token!),
            fetch(`${API_BASE_URL}/ratings/analytics/rider/${profile.id}`, {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            })
              .then((res) => res.json())
              .catch(() => ({ analytics: { recent_reviews: [] } })),
          ]);

          setWallet(walletRes.wallet);
          setSupportPhone(supportRes.phone);
          setSupportWhatsapp(supportRes.whatsapp);

          if (reviewsRes.analytics?.recent_reviews) {
            setRecentReviews(reviewsRes.analytics.recent_reviews);
          }

          if (reviewsRes.analytics?.average) {
            const freshRating = Number(reviewsRes.analytics.average);
            if (freshRating > 0) setRating(freshRating);
          }
        } catch {
          // non-critical dashboard extras
        }
      }
    } catch {
      toast.error("Failed to load delivery dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      router.push("/delivery/login");
      return;
    }

    logSocketStatus("[DASHBOARD_MOUNT] Socket status check");
    const riderId = useDeliveryAuthStore.getState().partner?.id;
    console.log("[DASHBOARD] Dashboard mounted", {
      tokenLength: token.length,
      riderId,
      timestamp: new Date().toISOString(),
    });

    void loadDashboard();
  }, [router, token]);

  useRiderDashboardSync(token, (event) => {
    console.log("[DASHBOARD] Event callback triggered:", event.type);
    const store = useDeliveryAuthStore.getState();

    if (event.type === "earnings_updated" && event.data?.earnings) {
      const newEarnings = Number(
        event.data.earnings.total_amount ||
          store.realtimeStats.todayEarnings ||
          0,
      );
      const newDeliveries = Number(
        event.data.earnings.deliveries ||
          store.realtimeStats.todayDeliveries ||
          0,
      );
      console.log("[DASHBOARD] Updating from earnings_updated:", {
        newEarnings,
        newDeliveries,
      });
      setTodayEarnings(newEarnings);
      setTodayDeliveries(newDeliveries);
    }

    if (event.type === "stats_updated" && event.data?.stats) {
      const stats = event.data.stats;
      console.log("[DASHBOARD] Updating from stats_updated:", stats);
      if (stats.average_rating) setRating(Number(stats.average_rating));
      if (stats.total_deliveries) {
        setTodayDeliveries(Number(stats.total_deliveries));
      }
      if (stats.total_earned) setTodayEarnings(Number(stats.total_earned));
    }

    if (event.type === "wallet_updated" && event.data?.wallet) {
      console.log("[DASHBOARD] Updating from wallet_updated:", event.data.wallet);
      setWallet(event.data.wallet);
    }
  });

  useEffect(() => {
    if (!token) return;

    console.log("[DASHBOARD] Starting fallback polling interval");
    const pollInterval = setInterval(() => {
      console.log("[DASHBOARD] Fallback poll triggered");
      void loadDashboard();
    }, 5000);

    return () => {
      clearInterval(pollInterval);
      console.log("[DASHBOARD] Stopped fallback polling");
    };
  }, [token]);

  useEffect(() => {
    if (!isOnline) {
      setDisplayOnlineTime("0h 0m");
      return;
    }

    const updateTime = () => {
      const onlineSince = partner?.online_since;
      if (!onlineSince) return;

      const elapsedMs = Date.now() - new Date(onlineSince).getTime();
      const totalSeconds = Math.floor(elapsedMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      setDisplayOnlineTime(`${hours}h ${minutes}m`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [isOnline, partner?.online_since]);

  const handleToggleOnline = async () => {
    if (isOnline && hasActiveOrder) {
      toast.error("Complete active order before going offline.");
      return;
    }

    setToggling(true);
    try {
      const result = await deliveryApi.setOnlineStatus(token!, !isOnline);
      const nextOnline = result.is_online;
      setIsOnline(nextOnline);
      if (partner) {
        setPartner({
          ...partner,
          is_online: nextOnline,
          online_since:
            result.online_since ?? (nextOnline ? new Date().toISOString() : null),
        });
      }
      toast.success(
        nextOnline
          ? "You are live for new dispatch offers."
          : "You are offline for now.",
      );
    } catch {
      toast.error("Failed to update live status");
    } finally {
      setToggling(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push("/delivery/login");
  };

  const handleRequestPickup = async () => {
    if (!token) return;
    setRequestingPickup(true);
    try {
      const result = await deliveryApi.requestCashPickup(token);
      setPickupRequests((prev) => [result.request, ...prev]);
      toast.success("Cash pickup requested. Support will contact you soon.");
      setShowPickupModal(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to request pickup",
      );
    } finally {
      setRequestingPickup(false);
    }
  };

  const initials = useMemo(() => {
    const label = partner?.full_name || "TP";
    return label
      .split(" ")
      .map((part) => part.charAt(0))
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }, [partner?.full_name]);

  const floatingCash = wallet?.floating_cash ?? partner?.cash_in_hand ?? 0;
  const floatingCashLimit = wallet?.floating_cash_limit ?? 1500;
  const cashPercent =
    floatingCashLimit > 0
      ? Math.round((floatingCash / floatingCashLimit) * 100)
      : 0;
  const progressPercent = Math.max(
    8,
    Math.min(100, (todayDeliveries / progressTarget) * 100),
  );

  const stats = [
    {
      label: "Today's Earnings",
      value: formatCurrency(todayEarnings),
      icon: IndianRupee,
      tone: "text-orange-300",
    },
    {
      label: "Completed Orders",
      value: String(todayDeliveries),
      icon: Bike,
      tone: "text-sky-300",
    },
    {
      label: "Online Hours",
      value: displayOnlineTime,
      icon: Clock3,
      tone: "text-emerald-300",
    },
    {
      label: "Rating",
      value: rating > 0 ? rating.toFixed(1) : "New",
      icon: Star,
      tone: "text-yellow-300",
    },
  ];

  const shifts = [
    { name: "Breakfast", time: "6 AM - 9 AM", active: false },
    { name: "Lunch", time: "9 AM - 12 PM", active: true },
    { name: "Snacks", time: "12 PM - 4 PM", active: false },
    { name: "Dinner", time: "4 PM - 7 PM", active: false },
  ];

  if (loading) {
    return (
      <DeliveryPageShell>
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-orange-400/30 border-t-orange-400" />
            <p className="mt-4 text-sm text-white/60">
              Loading Thinava rider command center...
            </p>
          </div>
        </div>
      </DeliveryPageShell>
    );
  }

  return (
    <DeliveryPageShell>
      <div className="space-y-5">
        {cashPercent >= 80 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-[24px] border p-4 ${
              cashPercent >= 100
                ? "border-red-400/30 bg-red-500/15"
                : "border-orange-400/30 bg-orange-500/15"
            }`}
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-orange-200" />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-white">
                  Cash collection at {cashPercent}%
                </p>
                <p className="mt-1 text-sm text-white/65">
                  Request pickup or call support to keep COD dispatch clear.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPickupModal(true)}
                className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-orange-700"
              >
                Pickup
              </button>
            </div>
          </motion.div>
        )}

        <RiderHeader
          riderName={partner?.full_name || "Delivery Partner"}
          floatingCash={floatingCash}
          isOnline={isOnline}
        />

        <section className="glass relative overflow-hidden rounded-[32px] border border-orange-500/15 p-6">
          <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-orange-500/10 blur-3xl" />

          <div className="relative">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm text-white/60">Today's Progress</p>

                <h1 className="mt-2 text-3xl font-black text-white">
                  {isOnline ? "Ready for deliveries" : "Go online to dispatch"}
                </h1>

                {hasActiveOrder && (
                  <p className="mt-2 text-sm font-medium text-orange-200">
                    Active order locked. Complete it before going offline.
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={handleToggleOnline}
                disabled={toggling || (isOnline && hasActiveOrder)}
                className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl transition ${
                  isOnline
                    ? "gradient-primary glow-orange text-white"
                    : "border border-white/10 bg-white/5 text-white/70"
                } disabled:cursor-not-allowed disabled:opacity-70`}
                aria-label={isOnline ? "Go offline" : "Go online"}
              >
                <Bike className="h-8 w-8" />
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleToggleOnline}
                disabled={toggling || (isOnline && hasActiveOrder)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  isOnline
                    ? "border-emerald-400/35 bg-emerald-500/15 text-emerald-200"
                    : "border-white/10 bg-white/5 text-white/75"
                } disabled:cursor-not-allowed disabled:opacity-70`}
              >
                {toggling ? "Updating..." : isOnline ? "Online" : "Offline"}
              </button>

              <button
                type="button"
                onClick={() => router.push("/delivery/profile")}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80"
              >
                {initials}
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="rounded-full border border-red-400/20 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200"
              >
                <LogOut className="mr-1.5 inline h-4 w-4" />
                Logout
              </button>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              {stats.map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.label}
                    className="glass-soft rounded-2xl border border-white/5 p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Icon className={`h-5 w-5 ${item.tone}`} />

                      <span className="text-xs text-green-400">LIVE</span>
                    </div>

                    <h3 className="mt-4 truncate text-2xl font-black text-white">
                      {item.value}
                    </h3>

                    <p className="mt-1 text-xs text-white/60">{item.label}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/60">
                  {todayDeliveries} / {progressTarget} delivery target
                </span>
                <span className="font-semibold text-orange-300">
                  {Math.round(progressPercent)}%
                </span>
              </div>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-orange-400 to-orange-500 transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        <FloatingLiveOrder
          orderId={
            activeOrder?.id
              ? `TNV-${activeOrder.id.slice(0, 8).toUpperCase()}`
              : hasActiveOrder
                ? "Syncing active order"
                : "No active order"
          }
          restaurantName={activeOrder?.restaurant_name || "Waiting for dispatch"}
          customerName={activeOrder?.customer_name || "Live offers will appear here"}
          pickupDistance={
            activeOrder?.pickup_distance_km
              ? `${Number(activeOrder.pickup_distance_km).toFixed(1)} km`
              : "--"
          }
          dropDistance={
            activeOrder?.dropoff_distance_km || activeOrder?.route_distance_km
              ? `${Number(
                  activeOrder.dropoff_distance_km || activeOrder.route_distance_km,
                ).toFixed(1)} km`
              : "--"
          }
          earnings={Number(activeOrder?.estimated_earnings || 0)}
          status={activeOrder?.delivery_status || (isOnline ? "STANDBY" : "OFFLINE")}
          isActive={Boolean(activeOrder)}
        />

        <FloatingCashMeter
          floatingCash={floatingCash}
          limit={floatingCashLimit}
          onRequestPickup={() => setShowPickupModal(true)}
        />

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Shift Schedule</h2>

            <button
              type="button"
              onClick={() => router.push("/delivery/shifts")}
              className="text-sm text-orange-300"
            >
              View All
            </button>
          </div>

          <div className="space-y-3">
            {shifts.map((shift) => (
              <div
                key={shift.name}
                className={`glass flex items-center justify-between gap-3 rounded-2xl border p-4 ${
                  shift.active ? "border-orange-500/30" : "border-white/5"
                }`}
              >
                <div>
                  <h3 className="font-semibold text-white">{shift.name}</h3>

                  <p className="mt-1 text-sm text-white/60">{shift.time}</p>
                </div>

                <button
                  type="button"
                  onClick={() => router.push("/delivery/shifts")}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                    shift.active
                      ? "gradient-primary text-white shadow-[0_0_24px_rgba(255,122,47,0.35)]"
                      : "bg-white/5 text-white/70 hover:bg-white/10"
                  }`}
                >
                  {shift.active ? "Booked" : "Book Shift"}
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="glass grid gap-3 rounded-[28px] border border-white/10 p-4 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => window.open(`https://wa.me/${supportWhatsapp}`, "_blank")}
            className="glass-soft flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white"
          >
            <MessageCircle className="h-4 w-4 text-green-300" />
            WhatsApp
          </button>
          <button
            type="button"
            onClick={() => window.open(`tel:${supportPhone}`, "_blank")}
            className="glass-soft flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white"
          >
            <Phone className="h-4 w-4 text-sky-300" />
            Call
          </button>
          <button
            type="button"
            onClick={() => setShowPickupModal(true)}
            className="glass-soft flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white"
          >
            <Wallet className="h-4 w-4 text-orange-300" />
            Pickup
          </button>
        </section>

        {recentReviews.length > 0 && (
          <section className="glass rounded-[28px] border border-white/10 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Customer Feedback</h2>
              <Star className="h-5 w-5 text-yellow-300" />
            </div>

            <div className="mt-4 space-y-3">
              {recentReviews.slice(0, 3).map((review, index) => (
                <div
                  key={`${review.created_at || "review"}-${index}`}
                  className="rounded-2xl border border-white/5 bg-white/[0.03] p-4"
                >
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-3 w-3 ${
                          star <= (review.rider_rating || 0)
                            ? "fill-yellow-400 text-yellow-400"
                            : "fill-white/15 text-white/15"
                        }`}
                      />
                    ))}
                    <span className="ml-2 text-xs text-white/40">
                      {review.created_at
                        ? new Date(review.created_at).toLocaleDateString()
                        : ""}
                    </span>
                  </div>
                  {review.review_text && (
                    <p className="mt-2 text-sm text-white/70">
                      {review.review_text}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-white/40">
                    {review.customer_name}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {showPickupModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass w-full max-w-md rounded-[28px] border border-white/10 p-6"
          >
            <h3 className="text-xl font-bold text-white">Request Cash Pickup</h3>
            <p className="mt-2 text-sm text-white/60">
              Your current floating cash is{" "}
              <strong className="text-white">{formatCurrency(floatingCash)}</strong>.
              A support agent will contact you to collect the cash.
            </p>

            {pickupRequests.filter((request) => request.status === "pending")
              .length > 0 && (
              <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-400/10 p-4">
                <p className="text-sm font-semibold text-amber-200">
                  Pending pickup request
                </p>
                <p className="mt-1 text-xs text-amber-100/70">
                  You already have a pending pickup request. Support will contact
                  you shortly.
                </p>
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <Button
                type="button"
                className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600"
                disabled={
                  requestingPickup ||
                  pickupRequests.some((request) => request.status === "pending")
                }
                onClick={handleRequestPickup}
              >
                {requestingPickup ? "Requesting..." : "Confirm Request"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1 border-white/15 bg-white/5 text-white hover:bg-white/10"
                onClick={() => setShowPickupModal(false)}
              >
                Cancel
              </Button>
            </div>

            <div className="mt-4 flex gap-3">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="flex-1 border-green-300/25 bg-green-500/10 text-green-200"
                onClick={() => {
                  if (supportWhatsapp) {
                    window.open(`https://wa.me/${supportWhatsapp}`, "_blank");
                  }
                }}
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                WhatsApp
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="flex-1 border-sky-300/25 bg-sky-500/10 text-sky-200"
                onClick={() => {
                  if (supportPhone) window.open(`tel:${supportPhone}`, "_blank");
                }}
              >
                <Phone className="mr-2 h-4 w-4" />
                Call
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </DeliveryPageShell>
  );
}
