"use client";

import { ReactNode } from "react";
import DeliveryBottomNav from "@/components/delivery/DeliveryBottomNav";

interface DeliveryPageShellProps {
  children: ReactNode;
  className?: string;
}

export default function DeliveryPageShell({
  children,
  className = "",
}: DeliveryPageShellProps) {
  return (
    <main
      className={`relative min-h-screen overflow-hidden bg-[#020B2D] text-white ${className}`}
    >
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute right-[-120px] top-[-80px] h-[320px] w-[320px] rounded-full bg-orange-500/10 blur-3xl" />

        <div className="absolute bottom-[-100px] left-[-100px] h-[260px] w-[260px] rounded-full bg-orange-400/10 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 pb-28 pt-2 md:px-6 md:pb-10">
        {children}
      </div>

      <DeliveryBottomNav />
    </main>
  );
}
