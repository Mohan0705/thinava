'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Plus, Trash2, Edit, ChevronDown, ChevronUp, ToggleLeft, ToggleRight,
  ArrowLeft, Loader2, Image as ImageIcon, X, GripVertical, Package,
  Tag, Layers, Star, Clock, Flame, Leaf, ShoppingCart
} from 'lucide-react'
import { AdminPageShell } from '@/components/admin/AdminPageShell'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { adminApi } from '@/features/admin/api'
import { useAdminAuthStore } from '@/features/admin/auth-store'
import { adminPermissions } from '@/features/admin/permissions'
import { useAdminRealtimeSync } from '@/lib/realtimeManager'

interface Category {
  id: string
  name: string
  description: string | null
  display_order: number
  item_count: number
}

interface Variant {
  id: string
  name: string
  price: number
  offer_price: number | null
  is_default: boolean
  display_order: number
}

interface Addon {
  id: string
  name: string
  price: number
  is_required: boolean
  max_quantity: number
  display_order: number
}

interface MenuItem {
  id: string
  name: string
  description: string | null
  price: number
  offer_price: number | null
  image: string | null
  category_id: string | null
  category_name: string | null
  is_veg: boolean
  is_bestseller: boolean
  is_recommended: boolean
  is_available: boolean
  in_stock: boolean
  preparation_time: number
  spice_level: string
  calories: number
  display_order: number
  variants: Variant[]
  addons: Addon[]
}

export default function AdminRestaurantMenuPage() {
  const params = useParams()
  const router = useRouter()
  const token = useAdminAuthStore((state) => state.token)
  const restaurantId = params?.id as string

  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [showCategoryForm, setShowCategoryForm] = useState(false)
  const [showItemForm, setShowItemForm] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [expandedItem, setExpandedItem] = useState<string | null>(null)

  // Category form state
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' })

  // Item form state
  const [itemForm, setItemForm] = useState({
    name: '', description: '', price: '', offerPrice: '', image: '',
    categoryId: '', isVeg: true, isBestseller: false, isRecommended: false,
    isAvailable: true, inStock: true, preparationTime: '0', spiceLevel: 'medium',
    calories: '0', displayOrder: '0'
  })

  const fetchMenu = useCallback(async () => {
    if (!token || !restaurantId) return
    try {
      const res = await adminApi.getRestaurantMenu(token, restaurantId)
      if (res.success) {
        setCategories(res.categories)
        setItems(res.items)
      }
    } catch (error) {
      toast.error('Failed to load menu')
    } finally {
      setIsLoading(false)
    }
  }, [token, restaurantId])

  useEffect(() => {
    fetchMenu()
  }, [token, restaurantId, fetchMenu])

  useAdminRealtimeSync(token, () => fetchMenu())

  const filteredItems = selectedCategory
    ? items.filter(i => i.category_id === selectedCategory)
    : items

  const handleCreateCategory = async () => {
    if (!categoryForm.name.trim()) {
      toast.error('Category name required')
      return
    }
    try {
      await adminApi.createMenuCategory(token || '', restaurantId, categoryForm)
      toast.success('Category created')
      setCategoryForm({ name: '', description: '' })
      setShowCategoryForm(false)
      fetchMenu()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create category')
    }
  }

  const handleUpdateCategory = async () => {
    if (!editingCategory || !categoryForm.name.trim()) return
    try {
      await adminApi.updateMenuCategory(token || '', restaurantId, editingCategory.id, categoryForm)
      toast.success('Category updated')
      setEditingCategory(null)
      setCategoryForm({ name: '', description: '' })
      setShowCategoryForm(false)
      fetchMenu()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update category')
    }
  }

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Delete this category? Items will become uncategorized.')) return
    try {
      await adminApi.deleteMenuCategory(token || '', restaurantId, id)
      toast.success('Category deleted')
      fetchMenu()
    } catch (error) {
      toast.error('Failed to delete category')
    }
  }

  const handleCreateItem = async () => {
    if (!itemForm.name.trim() || !itemForm.price) {
      toast.error('Name and price required')
      return
    }
    try {
      await adminApi.createMenuItem(token || '', restaurantId, {
        ...itemForm,
        price: parseFloat(itemForm.price),
        offerPrice: itemForm.offerPrice ? parseFloat(itemForm.offerPrice) : null,
        preparationTime: parseInt(itemForm.preparationTime) || 0,
        calories: parseInt(itemForm.calories) || 0,
        displayOrder: parseInt(itemForm.displayOrder) || 0,
      })
      toast.success('Item created')
      resetItemForm()
      setShowItemForm(false)
      fetchMenu()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create item')
    }
  }

  const handleUpdateItem = async () => {
    if (!editingItem || !itemForm.name.trim() || !itemForm.price) return
    try {
      await adminApi.updateMenuItem(token || '', restaurantId, editingItem.id, {
        ...itemForm,
        price: parseFloat(itemForm.price),
        offerPrice: itemForm.offerPrice ? parseFloat(itemForm.offerPrice) : null,
        preparationTime: parseInt(itemForm.preparationTime) || 0,
        calories: parseInt(itemForm.calories) || 0,
        displayOrder: parseInt(itemForm.displayOrder) || 0,
      })
      toast.success('Item updated')
      setEditingItem(null)
      resetItemForm()
      setShowItemForm(false)
      fetchMenu()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update item')
    }
  }

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Delete this item?')) return
    try {
      await adminApi.deleteMenuItem(token || '', restaurantId, id)
      toast.success('Item deleted')
      fetchMenu()
    } catch (error) {
      toast.error('Failed to delete item')
    }
  }

  const handleToggleStock = async (id: string, inStock: boolean) => {
    try {
      await adminApi.toggleItemStock(token || '', restaurantId, id, !inStock)
      fetchMenu()
    } catch (error) {
      toast.error('Failed to update stock')
    }
  }

  const openEditItem = (item: MenuItem) => {
    setEditingItem(item)
    setItemForm({
      name: item.name, description: item.description || '', price: String(item.price),
      offerPrice: item.offer_price ? String(item.offer_price) : '', image: item.image || '',
      categoryId: item.category_id || '', isVeg: item.is_veg, isBestseller: item.is_bestseller,
      isRecommended: item.is_recommended, isAvailable: item.is_available, inStock: item.in_stock,
      preparationTime: String(item.preparation_time), spiceLevel: item.spice_level,
      calories: String(item.calories), displayOrder: String(item.display_order)
    })
    setShowItemForm(true)
  }

  const resetItemForm = () => {
    setItemForm({
      name: '', description: '', price: '', offerPrice: '', image: '',
      categoryId: selectedCategory || '', isVeg: true, isBestseller: false, isRecommended: false,
      isAvailable: true, inStock: true, preparationTime: '0', spiceLevel: 'medium',
      calories: '0', displayOrder: '0'
    })
  }

  const openNewItem = () => {
    setEditingItem(null)
    resetItemForm()
    setShowItemForm(true)
  }

  const openEditCategory = (cat: Category) => {
    setEditingCategory(cat)
    setCategoryForm({ name: cat.name, description: cat.description || '' })
    setShowCategoryForm(true)
  }

  const openNewCategory = () => {
    setEditingCategory(null)
    setCategoryForm({ name: '', description: '' })
    setShowCategoryForm(true)
  }

  if (isLoading) {
    return (
      <AdminPageShell title="Menu Management" description="Loading menu..." permission={adminPermissions.restaurants}>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        </div>
      </AdminPageShell>
    )
  }

  return (
    <AdminPageShell
      title="Restaurant Menu"
      description={`Manage menu items, categories, variants, and addons for this restaurant.`}
      permission={adminPermissions.restaurants}
      actions={
        <div className="flex gap-2">
          <Button onClick={() => router.back()} variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <Button onClick={openNewCategory} variant="outline" size="sm" className="border-orange-500/30 text-orange-400">
            <Tag className="w-4 h-4 mr-2" /> Add Category
          </Button>
          <Button onClick={openNewItem} size="sm" className="bg-orange-500 hover:bg-orange-600 text-white">
            <Plus className="w-4 h-4 mr-2" /> Add Item
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Category Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition ${
              !selectedCategory ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            All Items ({items.length})
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition ${
                selectedCategory === cat.id ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {cat.name} ({cat.item_count})
            </button>
          ))}
        </div>

        {/* Items Grid */}
        {filteredItems.length === 0 ? (
          <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-12 text-center">
            <Package className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-300 mb-2">No menu items</h3>
            <p className="text-slate-500 mb-4">Add items to get started</p>
            <Button onClick={openNewItem} size="sm" className="bg-orange-500 hover:bg-orange-600 text-white">
              <Plus className="w-4 h-4 mr-2" /> Add First Item
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredItems.map(item => (
              <div key={item.id} className="bg-slate-900/80 rounded-2xl border border-slate-800 overflow-hidden">
                <div className="p-4 flex items-start gap-4">
                  {/* Image */}
                  <div className="w-20 h-20 rounded-xl bg-slate-800 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-slate-600" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-white text-base">{item.name}</h3>
                        {item.description && (
                          <p className="text-sm text-slate-400 mt-0.5 line-clamp-1">{item.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="text-right">
                          <div className="font-bold text-white">₹{item.price}</div>
                          {item.offer_price && (
                            <div className="text-xs text-orange-400 line-through">₹{item.offer_price}</div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Badges */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <Badge variant={item.is_veg ? 'success' : 'destructive'} className="text-xs">
                        {item.is_veg ? 'Veg' : 'Non-Veg'}
                      </Badge>
                      {item.is_bestseller && (
                        <Badge className="bg-amber-500/20 text-amber-400 text-xs"><Star className="w-3 h-3 mr-1" />Bestseller</Badge>
                      )}
                      {item.is_recommended && (
                        <Badge className="bg-blue-500/20 text-blue-400 text-xs"><Flame className="w-3 h-3 mr-1" />Recommended</Badge>
                      )}
                      {!item.in_stock && (
                        <Badge variant="destructive" className="text-xs">Out of Stock</Badge>
                      )}
                      {!item.is_available && (
                        <Badge variant="secondary" className="text-xs">Unavailable</Badge>
                      )}
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />{item.preparation_time}min
                      </span>
                    </div>

                    {/* Variants & Addons count */}
                    {(item.variants.length > 0 || item.addons.length > 0) && (
                      <div className="flex gap-3 mt-2 text-xs text-slate-500">
                        {item.variants.length > 0 && (
                          <span className="flex items-center gap-1"><Layers className="w-3 h-3" />{item.variants.length} variants</span>
                        )}
                        {item.addons.length > 0 && (
                          <span className="flex items-center gap-1"><ShoppingCart className="w-3 h-3" />{item.addons.length} addons</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleToggleStock(item.id, item.in_stock)}
                      className={`p-2 rounded-lg transition ${item.in_stock ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-slate-500 hover:bg-slate-700'}`}
                      title={item.in_stock ? 'In Stock' : 'Out of Stock'}
                    >
                      {item.in_stock ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                    </button>
                    <button onClick={() => openEditItem(item)} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDeleteItem(item.id)} className="p-2 rounded-lg text-rose-400 hover:bg-rose-500/10 transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
                      className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition"
                    >
                      {expandedItem === item.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded: Variants & Addons */}
                {expandedItem === item.id && (
                  <div className="border-t border-slate-800 p-4 bg-slate-950/50 space-y-4">
                    {/* Variants */}
                    {item.variants.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
                          <Layers className="w-4 h-4" /> Variants
                        </h4>
                        <div className="space-y-2">
                          {item.variants.map(v => (
                            <div key={v.id} className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2">
                              <div className="flex items-center gap-2">
                                {v.is_default && <Badge className="bg-blue-500/20 text-blue-400 text-xs">Default</Badge>}
                                <span className="text-sm text-white">{v.name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-white">{v.price}</span>
                                {v.offer_price && <span className="text-xs text-orange-400 line-through">₹{v.offer_price}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Addons */}
                    {item.addons.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
                          <ShoppingCart className="w-4 h-4" /> Addons
                        </h4>
                        <div className="space-y-2">
                          {item.addons.map(a => (
                            <div key={a.id} className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2">
                              <div className="flex items-center gap-2">
                                {a.is_required && <Badge className="bg-rose-500/20 text-rose-400 text-xs">Required</Badge>}
                                <span className="text-sm text-white">{a.name}</span>
                              </div>
                              <span className="text-sm font-medium text-white">+₹{a.price}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {item.variants.length === 0 && item.addons.length === 0 && (
                      <p className="text-sm text-slate-500">No variants or addons configured</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Category Form Modal */}
        {showCategoryForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl">
              <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                <h2 className="text-xl font-bold text-white">{editingCategory ? 'Edit Category' : 'New Category'}</h2>
                <button onClick={() => { setShowCategoryForm(false); setEditingCategory(null) }} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Name *</label>
                  <input
                    type="text"
                    value={categoryForm.name}
                    onChange={e => setCategoryForm({ ...categoryForm, name: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-orange-500 focus:outline-none"
                    placeholder="e.g., Biryani"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
                  <textarea
                    value={categoryForm.description}
                    onChange={e => setCategoryForm({ ...categoryForm, description: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-orange-500 focus:outline-none"
                    rows={3}
                    placeholder="Optional description"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <Button onClick={() => { setShowCategoryForm(false); setEditingCategory(null) }} variant="outline" className="flex-1">
                    Cancel
                  </Button>
                  <Button onClick={editingCategory ? handleUpdateCategory : handleCreateCategory} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white">
                    {editingCategory ? 'Update' : 'Create'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Item Form Modal */}
        {showItemForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl my-8">
              <div className="p-6 border-b border-slate-800 flex justify-between items-center sticky top-0 bg-slate-900 rounded-t-2xl">
                <h2 className="text-xl font-bold text-white">{editingItem ? 'Edit Item' : 'New Menu Item'}</h2>
                <button onClick={() => { setShowItemForm(false); setEditingItem(null) }} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-300 mb-1">Item Name *</label>
                    <input
                      type="text"
                      value={itemForm.name}
                      onChange={e => setItemForm({ ...itemForm, name: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-orange-500 focus:outline-none"
                      placeholder="e.g., Chicken Biryani"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
                    <textarea
                      value={itemForm.description}
                      onChange={e => setItemForm({ ...itemForm, description: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-orange-500 focus:outline-none"
                      rows={2}
                      placeholder="Item description"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Price (₹) *</label>
                    <input
                      type="number"
                      value={itemForm.price}
                      onChange={e => setItemForm({ ...itemForm, price: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-orange-500 focus:outline-none"
                      placeholder="199"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Offer Price (₹)</label>
                    <input
                      type="number"
                      value={itemForm.offerPrice}
                      onChange={e => setItemForm({ ...itemForm, offerPrice: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-orange-500 focus:outline-none"
                      placeholder="149"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Category</label>
                    <select
                      value={itemForm.categoryId}
                      onChange={e => setItemForm({ ...itemForm, categoryId: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-orange-500 focus:outline-none"
                    >
                      <option value="">No Category</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Image URL</label>
                    <input
                      type="text"
                      value={itemForm.image}
                      onChange={e => setItemForm({ ...itemForm, image: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-orange-500 focus:outline-none"
                      placeholder="https://..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Prep Time (min)</label>
                    <input
                      type="number"
                      value={itemForm.preparationTime}
                      onChange={e => setItemForm({ ...itemForm, preparationTime: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Spice Level</label>
                    <select
                      value={itemForm.spiceLevel}
                      onChange={e => setItemForm({ ...itemForm, spiceLevel: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-orange-500 focus:outline-none"
                    >
                      <option value="mild">Mild</option>
                      <option value="medium">Medium</option>
                      <option value="hot">Hot</option>
                      <option value="extra-hot">Extra Hot</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Calories</label>
                    <input
                      type="number"
                      value={itemForm.calories}
                      onChange={e => setItemForm({ ...itemForm, calories: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Toggles */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={itemForm.isVeg} onChange={e => setItemForm({ ...itemForm, isVeg: e.target.checked })} className="sr-only peer" />
                    <div className="w-10 h-6 bg-slate-700 rounded-full peer-checked:bg-emerald-500 transition relative">
                      <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition peer-checked:translate-x-4" />
                    </div>
                    <span className="text-sm text-slate-300 flex items-center gap-1"><Leaf className="w-4 h-4" /> Vegetarian</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={itemForm.isBestseller} onChange={e => setItemForm({ ...itemForm, isBestseller: e.target.checked })} className="sr-only peer" />
                    <div className="w-10 h-6 bg-slate-700 rounded-full peer-checked:bg-amber-500 transition relative">
                      <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition peer-checked:translate-x-4" />
                    </div>
                    <span className="text-sm text-slate-300 flex items-center gap-1"><Star className="w-4 h-4" /> Bestseller</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={itemForm.isRecommended} onChange={e => setItemForm({ ...itemForm, isRecommended: e.target.checked })} className="sr-only peer" />
                    <div className="w-10 h-6 bg-slate-700 rounded-full peer-checked:bg-blue-500 transition relative">
                      <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition peer-checked:translate-x-4" />
                    </div>
                    <span className="text-sm text-slate-300 flex items-center gap-1"><Flame className="w-4 h-4" /> Recommended</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={itemForm.inStock} onChange={e => setItemForm({ ...itemForm, inStock: e.target.checked })} className="sr-only peer" />
                    <div className="w-10 h-6 bg-slate-700 rounded-full peer-checked:bg-emerald-500 transition relative">
                      <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition peer-checked:translate-x-4" />
                    </div>
                    <span className="text-sm text-slate-300">In Stock</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={itemForm.isAvailable} onChange={e => setItemForm({ ...itemForm, isAvailable: e.target.checked })} className="sr-only peer" />
                    <div className="w-10 h-6 bg-slate-700 rounded-full peer-checked:bg-orange-500 transition relative">
                      <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition peer-checked:translate-x-4" />
                    </div>
                    <span className="text-sm text-slate-300">Available</span>
                  </label>
                </div>

                <div className="flex gap-3 pt-4 border-t border-slate-800">
                  <Button onClick={() => { setShowItemForm(false); setEditingItem(null) }} variant="outline" className="flex-1">
                    Cancel
                  </Button>
                  <Button onClick={editingItem ? handleUpdateItem : handleCreateItem} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white">
                    {editingItem ? 'Update Item' : 'Add Item'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminPageShell>
  )
}
