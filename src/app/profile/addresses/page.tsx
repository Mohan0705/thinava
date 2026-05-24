'use client'

import { useState } from 'react'
import { MapPin, Pencil, Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { AddressEditor } from '@/components/auth/AddressEditor'
import { customerAuthApi } from '@/features/auth/api'
import { useAuthStore } from '@/store/authStore'
import type { Address } from '@/types'
import { toast } from 'sonner'

export default function ProfileAddressesPage() {
  const token = useAuthStore((state) => state.token)
  const addresses = useAuthStore((state) => state.user?.addresses || [])
  const setAddresses = useAuthStore((state) => state.setAddresses)
  const [editingAddress, setEditingAddress] = useState<Address | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleSaveAddress = async (payload: {
    label: string
    address: string
    landmark?: string
    latitude?: number | null
    longitude?: number | null
    is_default: boolean
  }) => {
    if (!token) {
      return
    }

    setSaving(true)

    try {
      editingAddress
        ? await customerAuthApi.updateAddress(token, editingAddress.id, payload)
        : await customerAuthApi.createAddress(token, payload)
      const refreshedAddresses = await customerAuthApi.getAddresses(token)
      setAddresses(refreshedAddresses)
      toast.success(editingAddress ? 'Address updated' : 'Address added')
      setIsModalOpen(false)
      setEditingAddress(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save address')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (addressId: string) => {
    if (!token) {
      return
    }

    try {
      await customerAuthApi.deleteAddress(token, addressId)
      const refreshedAddresses = await customerAuthApi.getAddresses(token)
      setAddresses(refreshedAddresses)
      toast.success('Address deleted')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to delete address')
    }
  }

  const openEditor = (address: Address | null) => {
    setEditingAddress(address)
    setIsModalOpen(true)
  }

  return (
    <>
      <Card className="overflow-hidden border-white/80 bg-[linear-gradient(180deg,#FFFFFF_0%,#FFF8F4_100%)] shadow-[0_30px_70px_-42px_rgba(17,24,39,0.28)]">
        <CardHeader className="border-b border-[#F2E6DE] bg-[radial-gradient(circle_at_top_right,rgba(255,107,53,0.08),transparent_28%),linear-gradient(180deg,#FFFDFB_0%,#FFF8F4_100%)] p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle className="text-2xl">Saved Addresses</CardTitle>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[#6B7280]">
                Keep your frequent delivery spots ready with a cleaner, faster Thinava address
                experience.
              </p>
            </div>
            <Button
              type="button"
              className="rounded-full px-5"
              onClick={() => openEditor(null)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Address
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {addresses.length === 0 ? (
            <div className="rounded-[1.8rem] border border-dashed border-[#F0CDBE] bg-[#FFF7F1] p-6 text-sm text-[#6B7280]">
              No saved addresses yet. Add your home, work, or hostel delivery spot to speed up
              checkout.
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {addresses.map((address) => (
                <div
                  key={address.id}
                  className="rounded-[1.8rem] border border-white/80 bg-white p-5 shadow-[0_20px_40px_-30px_rgba(17,24,39,0.22)]"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-[1.2rem] bg-[#FFF1E8]">
                      <MapPin className="h-5 w-5 text-[#FF6B35]" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <p className="text-lg font-black tracking-tight text-[#111827]">
                          {address.label}
                        </p>
                        {address.isDefault ? (
                          <Badge variant="secondary" className="rounded-full bg-[#FFF1E8] text-[#C2410C]">
                            Default
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-sm leading-6 text-[#4B5563]">{address.fullAddress}</p>
                      {address.landmark ? (
                        <p className="mt-2 text-sm text-[#6B7280]">Landmark: {address.landmark}</p>
                      ) : null}
                      {address.latitude && address.longitude ? (
                        <p className="mt-3 text-xs font-medium uppercase tracking-[0.2em] text-[#9CA3AF]">
                          {address.latitude}, {address.longitude}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-5 flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 rounded-full border-[#E5E7EB]"
                      onClick={() => openEditor(address)}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-full border-[#F5D0D0] text-rose-600 hover:bg-rose-50"
                      onClick={() => handleDelete(address.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setEditingAddress(null)
        }}
        className="max-w-2xl"
      >
        <div className="space-y-5">
          <div>
            <h2 className="text-[1.9rem] font-black tracking-tight text-slate-950">
              {editingAddress ? 'Edit address' : 'Add address'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Save a polished delivery destination with the same reliable Thinava address flow.
            </p>
          </div>
          <AddressEditor address={editingAddress} saving={saving} onSave={handleSaveAddress} />
        </div>
      </Modal>
    </>
  )
}
