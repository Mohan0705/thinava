'use client'

import { useEffect, useState } from 'react'
import { PauseCircle, Power, Save, Store } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { ImageUploadField } from '@/components/restaurant-panel/ImageUploadField'
import { PanelSkeleton } from '@/components/restaurant-panel/PanelSkeleton'
import { RestaurantPanelShell } from '@/components/restaurant-panel/RestaurantPanelShell'
import { RestaurantRouteGuard } from '@/components/restaurant-panel/RestaurantRouteGuard'
import { StatusBadge } from '@/components/restaurant-panel/StatusBadge'
import { restaurantPanelApi } from '@/lib/restaurant-panel-api'
import { useRestaurantOwnerAuthStore } from '@/store/restaurantOwnerAuthStore'
import { RestaurantPanelSettings } from '@/types/restaurant-panel'

function SettingsContent() {
  const token = useRestaurantOwnerAuthStore((state) => state.token)
  const [settings, setSettings] = useState<RestaurantPanelSettings | null>(null)
  const [cuisinesInput, setCuisinesInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [locating, setLocating] = useState(false)

  useEffect(() => {
    let isMounted = true

    const loadSettings = async () => {
      if (!token) {
        return
      }

      try {
        const response = await restaurantPanelApi.getSettings(token)
        if (isMounted) {
          setSettings(response.settings)
          setCuisinesInput(response.settings.cuisines.join(', '))
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Unable to load settings')
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadSettings()

    return () => {
      isMounted = false
    }
  }, [token])

  const updateSettings = <K extends keyof RestaurantPanelSettings>(key: K, value: RestaurantPanelSettings[K]) => {
    setSettings((current) => (current ? { ...current, [key]: value } : current))
  }

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Browser location is not available')
      return
    }

    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        updateSettings('latitude', Number(position.coords.latitude.toFixed(6)))
        updateSettings('longitude', Number(position.coords.longitude.toFixed(6)))
        toast.success('Current location captured')
        setLocating(false)
      },
      () => {
        toast.error('Unable to get current location')
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 12000 }
    )
  }

  const buildPayload = (manualOverride?: boolean) => {
    if (!settings) return null

    return {
      name: settings.name.trim(),
      image: settings.image || '',
      logo: settings.logo || '',
      banner_image: settings.banner_image || '',
      description: settings.description || '',
      opening_time: settings.opening_time || '',
      closing_time: settings.closing_time || '',
      timezone: settings.timezone || 'Asia/Kolkata',
      is_manually_closed: manualOverride ?? Boolean(settings.is_manually_closed),
      minimum_order: Number(settings.minimum_order || 0),
      delivery_radius_km: Number(settings.delivery_radius_km || 0),
      formatted_address: settings.formatted_address || '',
      place_id: settings.place_id || '',
      latitude: settings.latitude ?? null,
      longitude: settings.longitude ?? null,
      offer: settings.offer || '',
      cuisines: cuisinesInput
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      delivery_time: String(settings.delivery_time || ''),
      price_for_one: Number(settings.price_for_one || 0),
    }
  }

  const saveSettings = async (manualOverride?: boolean, successMessage = 'Restaurant settings updated') => {
    if (!token || !settings) {
      return
    }

    setSubmitting(true)

    try {
      const payload = buildPayload(manualOverride)
      if (!payload) return
      const response = await restaurantPanelApi.updateSettings(token, payload)
      setSettings(response.settings)
      setCuisinesInput(response.settings.cuisines.join(', '))
      toast.success(successMessage)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update settings')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = async () => saveSettings()

  const handleManualOverride = async (closed: boolean) => {
    await saveSettings(
      closed,
      closed ? 'Restaurant manually closed' : 'Restaurant reopened. Timings now control availability.'
    )
  }

  if (loading || !settings) {
    return (
      <RestaurantPanelShell
        title="Settings"
        description="Control the storefront details customers see, along with operational timing and delivery rules."
      >
        <PanelSkeleton />
      </RestaurantPanelShell>
    )
  }

  return (
    <RestaurantPanelShell
      title="Settings"
      description="Control the storefront details customers see, along with operational timing and delivery rules."
      actions={
        <div className="flex items-center gap-3">
          <StatusBadge status={settings.status} />
          <Button onClick={handleSubmit} disabled={submitting}>
            <Save className="mr-2 h-4 w-4" />
            {submitting ? 'Saving...' : 'Save settings'}
          </Button>
        </div>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <Card className="border border-white/60 bg-white/90">
            <CardContent className="p-6">
              <div className="mb-5 flex items-center gap-3">
                <div className="rounded-2xl bg-slate-950 p-3 text-white">
                  <Store className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-slate-950">Restaurant identity</h2>
                  <p className="text-sm text-slate-500">Keep your brand assets and storefront messaging up to date.</p>
                </div>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Restaurant name</label>
                  <Input value={settings.name} onChange={(event) => updateSettings('name', event.target.value)} />
                </div>

                <ImageUploadField
                  label="Restaurant card image"
                  value={settings.image}
                  onChange={(value) => updateSettings('image', value)}
                  folder="restaurants"
                  placeholder="https://res.cloudinary.com/.../thinava/restaurants/cover.jpg"
                />

                <ImageUploadField
                  label="Logo"
                  value={settings.logo}
                  onChange={(value) => updateSettings('logo', value)}
                  folder="restaurants"
                  placeholder="https://res.cloudinary.com/.../thinava/restaurants/logo.png"
                />

                <ImageUploadField
                  label="Banner image"
                  value={settings.banner_image || ''}
                  onChange={(value) => updateSettings('banner_image', value)}
                  folder="restaurants"
                  placeholder="https://res.cloudinary.com/.../thinava/restaurants/banner.jpg"
                />

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Description</label>
                  <Textarea
                    value={settings.description || ''}
                    onChange={(event) => updateSettings('description', event.target.value)}
                    placeholder="Tell customers what makes your restaurant worth ordering from."
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-white/60 bg-white/90">
            <CardContent className="p-6">
              <h2 className="text-2xl font-semibold text-slate-950">Operations and service area</h2>
              <p className="mt-2 text-sm text-slate-500">These values shape when and how customers can place orders.</p>

              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Opening time</label>
                  <Input
                    type="time"
                    value={settings.opening_time || ''}
                    onChange={(event) => updateSettings('opening_time', event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Closing time</label>
                  <Input
                    type="time"
                    value={settings.closing_time || ''}
                    onChange={(event) => updateSettings('closing_time', event.target.value)}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-semibold text-slate-700">Timezone</label>
                  <Input
                    value={settings.timezone || 'Asia/Kolkata'}
                    onChange={(event) => updateSettings('timezone', event.target.value)}
                    placeholder="Asia/Kolkata"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Minimum order</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={settings.minimum_order}
                    onChange={(event) => updateSettings('minimum_order', Number(event.target.value))}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Delivery radius (km)</label>
                  <Input
                    type="number"
                    min="1"
                    value={settings.delivery_radius_km}
                    onChange={(event) => updateSettings('delivery_radius_km', Number(event.target.value))}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-semibold text-slate-700">Restaurant address</label>
                  <Textarea
                    value={settings.formatted_address || ''}
                    onChange={(event) => updateSettings('formatted_address', event.target.value)}
                    placeholder="Exact pickup address for riders and customers"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Latitude</label>
                  <Input
                    type="number"
                    step="0.000001"
                    value={settings.latitude ?? ''}
                    onChange={(event) =>
                      updateSettings('latitude', event.target.value ? Number(event.target.value) : null)
                    }
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Longitude</label>
                  <Input
                    type="number"
                    step="0.000001"
                    value={settings.longitude ?? ''}
                    onChange={(event) =>
                      updateSettings('longitude', event.target.value ? Number(event.target.value) : null)
                    }
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <div className="flex flex-wrap gap-3">
                    <Button type="button" variant="outline" onClick={useCurrentLocation} disabled={locating}>
                      {locating ? 'Detecting location...' : 'Use Current Location'}
                    </Button>
                    {settings.latitude !== null && settings.latitude !== undefined && settings.longitude !== null && settings.longitude !== undefined ? (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${settings.latitude},${settings.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition-all duration-200 hover:bg-gray-50"
                      >
                        Open in Google Maps
                      </a>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Delivery time</label>
                  <Input
                    value={settings.delivery_time}
                    onChange={(event) => updateSettings('delivery_time', event.target.value)}
                    placeholder="25-35 mins"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Price for one</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={settings.price_for_one}
                    onChange={(event) => updateSettings('price_for_one', Number(event.target.value))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border border-white/60 bg-white/90">
            <CardContent className="p-6">
              <h2 className="text-2xl font-semibold text-slate-950">Availability and merchandising</h2>
              <p className="mt-2 text-sm text-slate-500">Set live operating mode, cuisines, and promotional offer text.</p>

              <div className="mt-5 space-y-5">
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-slate-700">Manual availability override</label>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold text-slate-900">
                          {settings.is_manually_closed ? 'Manually closed' : 'Timing controlled'}
                        </div>
                        <p className="mt-1 text-xs font-medium text-slate-500">
                          {settings.is_manually_closed
                            ? 'Customers can browse, but checkout is blocked until you reopen.'
                            : 'Opening and closing time decide whether customers can order.'}
                        </p>
                      </div>
                      <StatusBadge status={settings.status} />
                    </div>

                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      <Button
                        type="button"
                        variant={settings.is_manually_closed ? 'outline' : 'default'}
                        onClick={() => handleManualOverride(true)}
                        disabled={submitting || settings.is_manually_closed}
                        className="justify-center"
                      >
                        <PauseCircle className="mr-2 h-4 w-4" />
                        Manually Close
                      </Button>
                      <Button
                        type="button"
                        variant={!settings.is_manually_closed ? 'outline' : 'default'}
                        onClick={() => handleManualOverride(false)}
                        disabled={submitting || !settings.is_manually_closed}
                        className="justify-center"
                      >
                        <Power className="mr-2 h-4 w-4" />
                        Reopen
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Offer banner</label>
                  <Input
                    value={settings.offer || ''}
                    onChange={(event) => updateSettings('offer', event.target.value)}
                    placeholder="20% OFF on lunch combos"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Cuisines</label>
                  <Input
                    value={cuisinesInput}
                    onChange={(event) => setCuisinesInput(event.target.value)}
                    placeholder="Biryani, Fast Food, Tiffins, Beverages"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-white/60 bg-slate-950 text-white">
            <CardContent className="p-6">
              <div className="mb-3 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-200">
                Storefront preview
              </div>
              <h2 className="text-2xl font-semibold">{settings.name}</h2>
              <p className="mt-2 text-sm text-slate-300">{settings.description || 'Add a description so customers understand your specialty.'}</p>
              <div className="mt-5 space-y-2 text-sm text-slate-300">
                <div>Status: {settings.status}</div>
                <div>Hours: {settings.opening_time || '--'} to {settings.closing_time || '--'} ({settings.timezone || 'Asia/Kolkata'})</div>
                {settings.nextOpeningTime ? <div>Next opening: {settings.nextOpeningTime}</div> : null}
                {settings.closesAt ? <div>Closes at: {settings.closesAt}</div> : null}
                <div>Delivery radius: {settings.delivery_radius_km} km</div>
                <div>Address: {settings.formatted_address || 'Add exact pickup address'}</div>
                <div>Minimum order: {settings.minimum_order}</div>
                <div>Cuisines: {(cuisinesInput || 'No cuisines added').toString()}</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </RestaurantPanelShell>
  )
}

export default function RestaurantSettingsPage() {
  return (
    <RestaurantRouteGuard>
      <SettingsContent />
    </RestaurantRouteGuard>
  )
}
