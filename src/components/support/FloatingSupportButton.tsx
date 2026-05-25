'use client'

import { useState } from 'react'
import { MessageCircle, Phone, X } from 'lucide-react'
import { SUPPORT_WHATSAPP_LINK, SUPPORT_TEL, SUPPORT_PHONE_DISPLAY } from '@/lib/support'

export default function FloatingSupportButton() {
  const [open, setOpen] = useState(false)

  return (
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] right-4 z-40 flex flex-col items-end gap-2 md:bottom-6 md:right-6">
      {open && (
        <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <a
            href={SUPPORT_WHATSAPP_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 rounded-2xl bg-[#22C55E] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-6px_rgba(34,197,94,0.55)] transition-transform active:scale-[0.98]"
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </a>
          <a
            href={SUPPORT_TEL}
            className="flex items-center gap-2.5 rounded-2xl bg-[#1F2937] px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-transform active:scale-[0.98]"
          >
            <Phone className="h-4 w-4" />
            Call {SUPPORT_PHONE_DISPLAY}
          </a>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex h-[52px] w-[52px] items-center justify-center rounded-full transition-all duration-200 thinava-touch ${
          open
            ? 'bg-[#1F2937] text-white shadow-lg'
            : 'bg-[#22C55E] text-white shadow-[0_8px_28px_-4px_rgba(34,197,94,0.65)] ring-4 ring-[#22C55E]/20'
        }`}
        aria-label={open ? 'Close support' : 'Open support'}
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </button>
    </div>
  )
}
