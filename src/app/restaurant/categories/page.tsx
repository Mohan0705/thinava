'use client'

import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Textarea'
import { EmptyState } from '@/components/restaurant-panel/EmptyState'
import { PanelSkeleton } from '@/components/restaurant-panel/PanelSkeleton'
import { RestaurantPanelShell } from '@/components/restaurant-panel/RestaurantPanelShell'
import { RestaurantRouteGuard } from '@/components/restaurant-panel/RestaurantRouteGuard'
import { restaurantPanelApi } from '@/lib/restaurant-panel-api'
import { useRestaurantOwnerAuthStore } from '@/store/restaurantOwnerAuthStore'
import { RestaurantCategory } from '@/types/restaurant-panel'

function CategoriesContent() {
  const token = useRestaurantOwnerAuthStore((state) => state.token)
  const [categories, setCategories] = useState<RestaurantCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<RestaurantCategory | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let isMounted = true

    const loadCategories = async () => {
      if (!token) {
        return
      }

      try {
        const response = await restaurantPanelApi.getCategories(token)
        if (isMounted) {
          setCategories(response.categories)
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Unable to load categories')
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadCategories()

    return () => {
      isMounted = false
    }
  }, [token])

  const openCreateModal = () => {
    setEditingCategory(null)
    setName('')
    setDescription('')
    setModalOpen(true)
  }

  const openEditModal = (category: RestaurantCategory) => {
    setEditingCategory(category)
    setName(category.name)
    setDescription(category.description || '')
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    if (!token) {
      return
    }

    setSubmitting(true)

    try {
      if (editingCategory) {
        const response = await restaurantPanelApi.updateCategory(token, editingCategory.id, {
          name,
          description,
        })
        setCategories((current) =>
          current.map((category) => (category.id === editingCategory.id ? response.category : category))
        )
        toast.success('Category updated')
      } else {
        const response = await restaurantPanelApi.createCategory(token, { name, description })
        setCategories((current) => [...current, response.category].sort((a, b) => a.display_order - b.display_order))
        toast.success('Category created')
      }

      setModalOpen(false)
      setEditingCategory(null)
      setName('')
      setDescription('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save category')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReorder = async (index: number, direction: 'up' | 'down') => {
    if (!token) {
      return
    }

    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= categories.length) {
      return
    }

    const reordered = [...categories]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(targetIndex, 0, moved)
    setCategories(reordered)

    try {
      const response = await restaurantPanelApi.reorderCategories(
        token,
        reordered.map((category) => category.id)
      )
      setCategories(response.categories)
      toast.success('Category order updated')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to reorder categories')
    }
  }

  const handleDelete = async (category: RestaurantCategory) => {
    if (!token) {
      return
    }

    const confirmed = window.confirm(`Delete ${category.name}? Menu items will move to Uncategorized.`)
    if (!confirmed) {
      return
    }

    try {
      await restaurantPanelApi.deleteCategory(token, category.id)
      setCategories((current) => current.filter((item) => item.id !== category.id))
      toast.success('Category deleted')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to delete category')
    }
  }

  if (loading) {
    return (
      <RestaurantPanelShell
        title="Categories"
        description="Create menu sections that are easy for customers to browse and easy for your team to manage."
      >
        <PanelSkeleton />
      </RestaurantPanelShell>
    )
  }

  return (
    <RestaurantPanelShell
      title="Categories"
      description="Create menu sections that are easy for customers to browse and easy for your team to manage."
      actions={
        <Button onClick={openCreateModal}>
          <Plus className="mr-2 h-4 w-4" />
          Add category
        </Button>
      }
    >
      {categories.length === 0 ? (
        <EmptyState
          title="No categories created yet"
          description="Start with sections like Biryani, Tiffins, Fast Food, or Beverages so the menu stays structured."
          action={<Button onClick={openCreateModal}>Create first category</Button>}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {categories.map((category, index) => (
            <Card key={category.id} className="border border-white/60 bg-white/90">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="mb-2 inline-flex rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-orange-700">
                      Position {index + 1}
                    </div>
                    <h2 className="text-2xl font-semibold text-slate-950">{category.name}</h2>
                    <p className="mt-2 text-sm text-slate-500">{category.description || 'No description added yet.'}</p>
                    <div className="mt-3 text-sm font-medium text-slate-700">
                      {category.item_count} linked menu item(s)
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Button variant="outline" size="icon" disabled={index === 0} onClick={() => handleReorder(index, 'up')}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={index === categories.length - 1}
                      onClick={() => handleReorder(index, 'down')}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <Button variant="outline" onClick={() => openEditModal(category)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                  <Button variant="outline" className="text-rose-600" onClick={() => handleDelete(category)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)}>
        <div className="space-y-5">
          <div>
            <h2 className="text-3xl font-semibold text-slate-950">
              {editingCategory ? 'Edit category' : 'Add category'}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Categories control how dishes are grouped and ordered across the storefront.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Category name</label>
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Biryani" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Description</label>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Optional note to help your team understand this section"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Saving...' : editingCategory ? 'Save changes' : 'Create category'}
            </Button>
          </div>
        </div>
      </Modal>
    </RestaurantPanelShell>
  )
}

export default function RestaurantCategoriesPage() {
  return (
    <RestaurantRouteGuard>
      <CategoriesContent />
    </RestaurantRouteGuard>
  )
}
