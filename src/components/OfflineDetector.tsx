'use client'

import { useEffect, useState, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

export function OfflineDetector({ children }: Props) {
  const [online, setOnline] = useState(true)

  useEffect(() => {
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  return (
    <>
      {!online && (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 px-4 py-2 text-center text-sm font-semibold text-white shadow-lg">
          You are offline. Some features may be unavailable.
        </div>
      )}
      {children}
    </>
  )
}
