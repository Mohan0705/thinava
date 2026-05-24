'use client'

import { useState } from 'react'
import { MessageCircle, Phone, X } from 'lucide-react'
import { SUPPORT_WHATSAPP_LINK, SUPPORT_TEL, SUPPORT_PHONE_DISPLAY } from '@/lib/support'

export default function FloatingSupportButton() {
  const [open, setOpen] = useState(false)

  return (
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] right-4 z-40 flex flex-col items-end gap-2 md:bottom-6 md:right-6">
      {open && (
        <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <a
            href={SUPPORT_WHATSAPP_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 rounded-xl bg-thinava-success px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-transform hover:scale-[1.02]"
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </a>
          <a
            href={SUPPORT_TEL}
            className="flex items-center gap-2.5 rounded-xl bg-thinava-text px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-transform hover:scale-[1.02]"
          >
            <Phone className="h-4 w-4" />
            Call {SUPPORT_PHONE_DISPLAY}
          </a>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-all thinava-touch ${
          open
            ? 'bg-thinava-text text-white'
            : 'bg-thinava-success text-white hover:brightness-105'
        }`}
        aria-label={open ? 'Close support' : 'Open support'}
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </button>
    </div>
  )
}
