"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Navigation,
  Wallet,
  CalendarClock,
  User,
} from "lucide-react";

const tabs = [
  {
    to: "/delivery/dashboard",
    label: "Home",
    icon: Home,
  },
  {
    to: "/delivery/orders",
    label: "Live",
    icon: Navigation,
  },
  {
    to: "/delivery/earnings",
    label: "Earnings",
    icon: Wallet,
  },
  {
    to: "/delivery/shifts",
    label: "Shifts",
    icon: CalendarClock,
  },
  {
    to: "/delivery/profile",
    label: "Profile",
    icon: User,
  },
] as const;

export function DeliveryBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-[90] px-4 pb-4 pt-2 md:hidden">
      <div className="pointer-events-auto mx-auto max-w-md">
        <div className="glass relative overflow-hidden rounded-full border border-white/10 px-2 py-2 shadow-2xl backdrop-blur-2xl">
          <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 via-transparent to-orange-400/5" />

          <div className="relative flex items-center justify-between gap-1">
            {tabs.map(({ to, label, icon: Icon }) => {
              const active = pathname === to;

              return (
                <Link
                  key={to}
                  href={to}
                  className={`
                    group relative flex flex-1 flex-col items-center justify-center
                    gap-1 rounded-full px-2 py-2.5
                    transition-all duration-300 ease-out
                    ${
                      active
                        ? "text-white"
                        : "text-white/60 hover:text-white/90"
                    }
                  `}
                >
                  {active && (
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#FF7A2F] to-[#FF5A36] shadow-[0_0_24px_rgba(255,122,47,0.45)]" />
                  )}

                  {active && (
                    <div className="absolute inset-0 rounded-full bg-orange-500/20 blur-xl" />
                  )}

                  <div className="relative z-10">
                    <Icon
                      className={`
                        h-5 w-5 transition-all duration-300
                        ${active ? "scale-110" : "scale-100"}
                      `}
                      strokeWidth={active ? 2.5 : 2}
                    />
                  </div>

                  <span
                    className={`
                      relative z-10 text-[10px] font-medium tracking-wide
                      transition-all duration-300
                      ${active ? "opacity-100" : "opacity-80"}
                    `}
                  >
                    {label}
                  </span>

                  {active && (
                    <span className="absolute -top-0.5 right-[30%] h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}

export default DeliveryBottomNav;
