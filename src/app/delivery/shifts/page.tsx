'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  Loader,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { DeliveryBottomNav } from '@/components/delivery/DeliveryBottomNav'
import { deliveryApi } from '@/lib/delivery-api'
import { useDeliveryAuthStore } from '@/store/deliveryAuthStore'
import { DeliveryShift } from '@/types/delivery'

const shiftBlocks = [
  { id: 'breakfast', label: 'Breakfast', window: '7:00 AM - 11:00 AM', startHour: 7, startMinute: 0, endHour: 11, endMinute: 0 },
  { id: 'lunch', label: 'Lunch', window: '12:00 PM - 3:00 PM', startHour: 12, startMinute: 0, endHour: 15, endMinute: 0 },
  { id: 'dinner', label: 'Dinner', window: '7:00 PM - 11:00 PM', startHour: 19, startMinute: 0, endHour: 23, endMinute: 0 },
]

function buildShiftWindow(slot: typeof shiftBlocks[0]) {
  const now = new Date()
  const start = new Date(now)
  const end = new Date(now)
  start.setHours(slot.startHour, slot.startMinute, 0, 0)
  end.setHours(slot.endHour, slot.endMinute, 0, 0)
  if (end.getHours() < start.getHours()) {
    end.setDate(end.getDate() + 1)
  }
  if (start <= now) {
    start.setDate(start.getDate() + 1)
    end.setDate(end.getDate() + 1)
  }
  return { start, end }
}

export default function DeliveryShiftsPage() {
  const router = useRouter()
  const token = useDeliveryAuthStore((state) => state.token)
  const partner = useDeliveryAuthStore((state) => state.partner)

  const [loading, setLoading] = useState(true)
  const [selectedShiftId, setSelectedShiftId] = useState<string>('breakfast')
  const [bookedShifts, setBookedShifts] = useState<DeliveryShift[]>([])
  const [booking, setBooking] = useState(false)

  useEffect(() => {
    if (!token) {
      router.push('/delivery/login')
      return
    }

    void deliveryApi.getShifts(token)
      .then((shiftsResult) => {
        setBookedShifts(shiftsResult.shifts)
      })
      .catch(() => {
        toast.error('Failed to load shift center')
      })
      .finally(() => setLoading(false))
  }, [router, token])

  const selectedShift = shiftBlocks.find((s) => s.id === selectedShiftId) || shiftBlocks[0]

  const handleBookShift = async () => {
    if (!token || !selectedShift) return

    const { start, end } = buildShiftWindow(selectedShift)
    setBooking(true)

    try {
      const result = await deliveryApi.bookShift(token, {
        slot_label: selectedShift.label,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
      })

      setBookedShifts((current) => [result.shift, ...current])
      toast.success(`${selectedShift.label} shift booked successfully.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to book shift')
    } finally {
      setBooking(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#000A22] text-white">
        <Loader className="h-12 w-12 animate-spin text-orange-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#000A22_0%,#071833_28%,#f8fafc_28%,#f8fafc_100%)] pb-28">
      <div className="px-4 pb-6 pt-4 md:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-5 flex items-center justify-between text-white">
            <Link
              href="/delivery/dashboard"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 backdrop-blur"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>

            <div className="text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-orange-200">Thinava shifts</p>
              <h1 className="text-2xl font-bold">Shift planner</h1>
            </div>

            <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
              {partner?.is_online ? 'Live' : 'Offline'}
            </div>
          </div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="overflow-hidden border-0 bg-slate-950 text-white shadow-[0_35px_90px_-60px_rgba(0,10,34,0.95)]">
              <CardContent className="p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-200">Book a shift</p>
                <h2 className="mt-3 text-3xl font-bold">Choose your time block</h2>
                <p className="mt-3 text-sm text-white/60">
                  Select a shift slot and book it for tomorrow. Booked shifts strengthen your dispatch priority during the active window.
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-4">
              {shiftBlocks.map((shift, index) => (
                <motion.button
                  key={shift.id}
                  type="button"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => setSelectedShiftId(shift.id)}
                  className={`w-full rounded-[30px] border bg-white p-5 text-left shadow-[0_25px_80px_-60px_rgba(0,10,34,0.35)] transition ${
                    selectedShift.id === shift.id ? 'border-orange-200 ring-2 ring-orange-100' : 'border-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-lg font-bold text-slate-950">{shift.label}</p>
                      <p className="mt-1 text-sm text-slate-500">{shift.window}</p>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      className="rounded-full bg-gradient-to-r from-orange-500 to-orange-600 px-5"
                      disabled={booking}
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedShiftId(shift.id)
                        setTimeout(() => handleBookShift(), 0)
                      }}
                    >
                      {booking && selectedShift.id === shift.id ? (
                        <Loader className="h-4 w-4 animate-spin" />
                      ) : (
                        'Book'
                      )}
                    </Button>
                  </div>
                </motion.button>
              ))}
            </div>

            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="border-0 bg-white shadow-[0_25px_80px_-60px_rgba(0,10,34,0.35)]">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Booked shifts</p>
                      <h2 className="mt-2 text-2xl font-bold text-slate-950">Your schedule</h2>
                    </div>
                    <CalendarDays className="h-6 w-6 text-orange-500" />
                  </div>

                  <div className="mt-5 space-y-3">
                    {bookedShifts.length > 0 ? (
                      bookedShifts.map((shift) => (
                        <div key={shift.id} className="rounded-[24px] border border-slate-100 bg-slate-50 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-slate-950">{shift.slot_label}</p>
                              <p className="mt-1 text-sm text-slate-500">
                                {new Date(shift.starts_at).toLocaleString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })}{' '}
                                -{' '}
                                {new Date(shift.ends_at).toLocaleTimeString('en-IN', {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })}
                              </p>
                            </div>
                            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                              {shift.status}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">
                        No booked shifts yet.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>

      <DeliveryBottomNav />
    </div>
  )
}
