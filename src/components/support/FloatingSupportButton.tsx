'use client'

import { useState } from 'react'
import { MessageCircle, Phone, X } from 'lucide-react'
import { SUPPORT_WHATSAPP_LINK, SUPPORT_TEL, SUPPORT_PHONE_DISPLAY } from '@/lib/support'

export default function FloatingSupportButton() {
  const [open, setOpen] = useState(false)

  return (
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+6rem)] right-4 z-50 flex flex-col items-end gap-3 md:bottom-6 md:right-6">
      {open && (
        <div className="flex flex-col gap-2 animate-in slide-in-from-bottom-2 fade-in duration-200">
          <a
            href={SUPPORT_WHATSAPP_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-2xl bg-green-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-green-500/30 transition-all hover:bg-green-600 hover:scale-105"
          >
            <MessageCircle className="h-5 w-5" />
            WhatsApp Support
          </a>
          <a
            href={SUPPORT_TEL}
            className="flex items-center gap-3 rounded-2xl bg-slate-800 px-5 py-3 text-sm font-bold text-white shadow-lg transition-all hover:bg-slate-700 hover:scale-105"
          >
            <Phone className="h-5 w-5" />
            Call {SUPPORT_PHONE_DISPLAY}
          </a>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex h-14 w-14 items-center justify-center rounded-full shadow-xl transition-all hover:scale-110 ${
          open
            ? 'bg-slate-800 text-white rotate-45'
            : 'bg-green-500 text-white shadow-green-500/40 hover:bg-green-600'
        }`}
        aria-label={open ? 'Close support' : 'Open support'}
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </div>
  )
}
