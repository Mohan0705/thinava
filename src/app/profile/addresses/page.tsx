'use client'

import { useState } from 'react'
import { MapPin, Pencil, Trash2 } from 'lucide-react'
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

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Saved Addresses</CardTitle>
          <p className="text-sm text-gray-600">
            Choose where your next order should arrive and keep your frequent locations ready.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {addresses.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-5 text-sm text-slate-500">
              No saved addresses yet. Add your home, work, or hostel delivery spot to speed up checkout.
            </div>
          ) : null}
          {addresses.map((address) => (
          <div key={address.id} className="rounded-2xl border p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
                <MapPin className="h-5 w-5 text-orange-600" />
              </div>
              <div className="flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <p className="font-semibold text-gray-900">{address.label}</p>
                  {address.isDefault ? (
                    <Badge variant="secondary" className="text-xs">
                      Default
                    </Badge>
                  ) : null}
                </div>
                <p className="text-sm text-gray-600">{address.fullAddress}</p>
                {address.landmark ? (
                  <p className="mt-1 text-sm text-gray-500">Landmark: {address.landmark}</p>
                ) : null}
                {address.latitude && address.longitude ? (
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-400">
                    {address.latitude}, {address.longitude}
                  </p>
                ) : null}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={() => { setEditingAddress(address); setIsModalOpen(true) }}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="text-rose-600" onClick={() => handleDelete(address.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}

          <Button variant="outline" className="w-full" onClick={() => { setEditingAddress(null); setIsModalOpen(true) }}>
          Add New Address
          </Button>
        </CardContent>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingAddress(null) }}>
        <div className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-950">{editingAddress ? 'Edit Address' : 'Add Address'}</h2>
            <p className="mt-1 text-sm text-slate-500">
              Use GPS coordinates now, and this flow is ready for richer Google Places integration later.
            </p>
          </div>
          <AddressEditor address={editingAddress} saving={saving} onSave={handleSaveAddress} />
        </div>
      </Modal>
    </>
  )
}
