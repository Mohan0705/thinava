'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Pencil, Plus, Trash2, Vegan, Drumstick, PackageX } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Textarea'
import { EmptyState } from '@/components/restaurant-panel/EmptyState'
import { ImageUploadField } from '@/components/restaurant-panel/ImageUploadField'
import { PanelSkeleton } from '@/components/restaurant-panel/PanelSkeleton'
import { RestaurantPanelShell } from '@/components/restaurant-panel/RestaurantPanelShell'
import { RestaurantRouteGuard } from '@/components/restaurant-panel/RestaurantRouteGuard'
import { restaurantPanelApi } from '@/lib/restaurant-panel-api'
import { getOptimizedCloudinaryImageUrl } from '@/lib/cloudinary-image'
import { formatPrice } from '@/lib/utils'
import { useRestaurantOwnerAuthStore } from '@/store/restaurantOwnerAuthStore'
import { RestaurantCategory, RestaurantPanelMenuItem } from '@/types/restaurant-panel'

interface MenuFormState {
  name: string
  description: string
  price: string
  image: string
  category_id: string
  is_veg: boolean
  is_bestseller: boolean
  in_stock: boolean
}

const selectClassName =
  'flex h-12 w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-base focus-visible:outline-none focus-visible:border-orange-500 focus-visible:ring-2 focus-visible:ring-orange-500/20 transition-all duration-200'

const createInitialFormState = (categoryId = ''): MenuFormState => ({
  name: '',
  description: '',
  price: '',
  image: '',
  category_id: categoryId,
  is_veg: false,
  is_bestseller: false,
  in_stock: true,
})

function MenuContent() {
  const token = useRestaurantOwnerAuthStore((state) => state.token)
  const [menuItems, setMenuItems] = useState<RestaurantPanelMenuItem[]>([])
  const [categories, setCategories] = useState<RestaurantCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<RestaurantPanelMenuItem | null>(null)
  const [form, setForm] = useState<MenuFormState>(createInitialFormState())
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let isMounted = true

    const loadData = async () => {
      if (!token) {
        return
      }

      try {
        const [menuResponse, categoryResponse] = await Promise.all([
          restaurantPanelApi.getMenu(token),
          restaurantPanelApi.getCategories(token),
        ])

        if (isMounted) {
          setMenuItems(menuResponse.menuItems)
          setCategories(categoryResponse.categories)
          setForm(createInitialFormState(categoryResponse.categories[0]?.id || ''))
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Unable to load menu')
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadData()

    return () => {
      isMounted = false
    }
  }, [token])

  const groupedItems = useMemo(() => {
    return menuItems.reduce<Record<string, RestaurantPanelMenuItem[]>>((accumulator, item) => {
      const key = item.category_name || item.category || 'Uncategorized'
      if (!accumulator[key]) {
        accumulator[key] = []
      }
      accumulator[key].push(item)
      return accumulator
    }, {})
  }, [menuItems])

  const openCreateModal = () => {
    setEditingItem(null)
    setForm(createInitialFormState(categories[0]?.id || ''))
    setModalOpen(true)
  }

  const openEditModal = (item: RestaurantPanelMenuItem) => {
    setEditingItem(item)
    setForm({
      name: item.name,
      description: item.description || '',
      price: String(item.price),
      image: item.image,
      category_id: item.category_id || categories[0]?.id || '',
      is_veg: item.is_veg,
      is_bestseller: item.is_bestseller,
      in_stock: item.in_stock,
    })
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    if (!token) {
      return
    }

    if (!form.category_id) {
      toast.error('Create at least one category before adding a menu item.')
      return
    }

    setSubmitting(true)

    try {
      const payload = {
        ...form,
        price: Number(form.price),
      }

      if (editingItem) {
        const response = await restaurantPanelApi.updateMenuItem(token, editingItem.id, payload)
        setMenuItems((current) =>
          current.map((item) => (item.id === editingItem.id ? response.menuItem : item))
        )
        toast.success('Menu item updated')
      } else {
        const response = await restaurantPanelApi.createMenuItem(token, payload)
        setMenuItems((current) => [response.menuItem, ...current])
        toast.success('Menu item created')
      }

      setModalOpen(false)
      setEditingItem(null)
      setForm(createInitialFormState(categories[0]?.id || ''))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save menu item')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleStock = async (item: RestaurantPanelMenuItem) => {
    if (!token) {
      return
    }

    try {
      const response = await restaurantPanelApi.toggleStock(token, item.id, !item.in_stock)
      setMenuItems((current) =>
        current.map((menuItem) => (menuItem.id === item.id ? response.menuItem : menuItem))
      )
      toast.success(`${item.name} is now ${response.menuItem.in_stock ? 'available' : 'out of stock'}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update stock')
    }
  }

  const handleDelete = async (item: RestaurantPanelMenuItem) => {
    if (!token) {
      return
    }

    const confirmed = window.confirm(`Delete ${item.name}?`)
    if (!confirmed) {
      return
    }

    try {
      await restaurantPanelApi.deleteMenuItem(token, item.id)
      setMenuItems((current) => current.filter((menuItem) => menuItem.id !== item.id))
      toast.success('Menu item deleted')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to delete menu item')
    }
  }

  if (loading) {
    return (
      <RestaurantPanelShell
        title="Menu"
        description="Create, edit, price, and toggle availability for every item customers can see."
      >
        <PanelSkeleton />
      </RestaurantPanelShell>
    )
  }

  return (
    <RestaurantPanelShell
      title="Menu"
      description="Create, edit, price, and toggle availability for every item customers can see."
      actions={
        <Button onClick={openCreateModal}>
          <Plus className="mr-2 h-4 w-4" />
          Add item
        </Button>
      }
    >
      <div className="space-y-6">
        {categories.length === 0 ? (
          <EmptyState
            title="Create categories first"
            description="Menu items need a category assignment so they can appear in the right section for customers."
            action={
              <Link href="/restaurant/categories">
                <Button>Create categories</Button>
              </Link>
            }
          />
        ) : null}

        {categories.length > 0 && menuItems.length === 0 ? (
          <EmptyState
            title="Your menu is ready for its first item"
            description="Add dishes, descriptions, pricing, and stock state so customers can start ordering."
            action={<Button onClick={openCreateModal}>Add first item</Button>}
          />
        ) : null}

        {Object.entries(groupedItems).map(([categoryName, items]) => (
          <section key={categoryName} className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-slate-950">{categoryName}</h2>
                <p className="text-sm text-slate-500">{items.length} item(s)</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {items.map((item) => (
                (() => {
                  const imageUrl = getOptimizedCloudinaryImageUrl(item.image, {
                    width: 640,
                    crop: 'fill',
                  })
                  return (
                <Card key={item.id} className="border border-white/60 bg-white/90">
                  <CardContent className="p-5">
                    <div className="mb-4 aspect-[16/10] overflow-hidden rounded-3xl bg-slate-100">
                      {imageUrl ? <img src={imageUrl} alt={item.name} className="h-full w-full object-cover" loading="lazy" /> : null}
                    </div>

                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-xl font-semibold text-slate-950">{item.name}</h3>
                        <p className="mt-1 text-sm text-slate-500">{item.description}</p>
                      </div>
                      <div
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          item.in_stock ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        {item.in_stock ? 'Available' : 'Out of stock'}
                      </div>
                    </div>

                    <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                      <span className="rounded-full bg-slate-100 px-3 py-1 font-medium">
                        {formatPrice(item.price)}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 font-medium">
                        {item.category_name}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 font-medium">
                        {item.is_veg ? <Vegan className="mr-1 h-4 w-4 text-emerald-600" /> : <Drumstick className="mr-1 h-4 w-4 text-rose-600" />}
                        {item.is_veg ? 'Veg' : 'Non-veg'}
                      </span>
                    </div>

                    <div className="grid gap-3">
                      <Button
                        variant={item.in_stock ? 'secondary' : 'outline'}
                        className="justify-center"
                        onClick={() => handleToggleStock(item)}
                      >
                        <PackageX className="mr-2 h-4 w-4" />
                        {item.in_stock ? 'Mark out of stock' : 'Mark available'}
                      </Button>

                      <div className="grid grid-cols-2 gap-3">
                        <Button variant="outline" onClick={() => openEditModal(item)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                        <Button variant="outline" onClick={() => handleDelete(item)} className="text-rose-600">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                  )
                })()
              ))}
            </div>
          </section>
        ))}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} className="max-w-3xl">
        <div className="space-y-5">
          <div>
            <h2 className="text-3xl font-semibold text-slate-950">
              {editingItem ? 'Edit menu item' : 'Add menu item'}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Keep the menu sharp with clear copy, accurate pricing, and dependable stock controls.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Item name</label>
                <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Description</label>
                <Textarea
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  placeholder="Describe the dish, spice level, or signature ingredients"
                />
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Price</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={(event) => setForm({ ...form, price: event.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Category</label>
                  <select
                    className={selectClassName}
                    value={form.category_id}
                    onChange={(event) => setForm({ ...form, category_id: event.target.value })}
                  >
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <ImageUploadField
                label="Food image"
                value={form.image}
                onChange={(value) => setForm({ ...form, image: value })}
                folder="menuItems"
                placeholder="https://res.cloudinary.com/.../thinava/menu-items/dish.jpg"
              />

              <div className="grid gap-3">
                {[
                  { key: 'is_veg', label: 'Vegetarian item' },
                  { key: 'is_bestseller', label: 'Mark as bestseller' },
                  { key: 'in_stock', label: 'Available to order' },
                ].map((toggle) => (
                  <label
                    key={toggle.key}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    <span className="font-medium text-slate-900">{toggle.label}</span>
                    <input
                      type="checkbox"
                      checked={Boolean(form[toggle.key as keyof MenuFormState])}
                      onChange={(event) =>
                        setForm({ ...form, [toggle.key]: event.target.checked } as MenuFormState)
                      }
                      className="h-5 w-5 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Saving...' : editingItem ? 'Save changes' : 'Create item'}
            </Button>
          </div>
        </div>
      </Modal>
    </RestaurantPanelShell>
  )
}

export default function RestaurantMenuPage() {
  return (
    <RestaurantRouteGuard>
      <MenuContent />
    </RestaurantRouteGuard>
  )
}
