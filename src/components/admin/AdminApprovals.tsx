'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, XCircle, Clock, Search, Filter, MoreVertical, Download } from 'lucide-react'
import { httpClient } from '@/lib/api-client'
import { toast } from 'sonner'

interface PendingRestaurant {
  id: string
  restaurant_id: string
  restaurant_name: string
  owner_name: string
  owner_email: string
  owner_phone: string
  gst_number?: string
  fssai_license?: string
  address_full: string
  created_at: string
}

interface PendingRider {
  id: string
  full_name: string
  phone: string
  email?: string
  vehicle_type: string
  vehicle_number: string
  zone: string
  created_at: string
}

// ============================================================
// ADMIN RESTAURANT APPROVALS
// ============================================================

export function AdminRestaurantApprovals() {
  const [restaurants, setRestaurants] = useState<PendingRestaurant[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectModal, setShowRejectModal] = useState(false)

  useEffect(() => {
    fetchPendingRestaurants()
  }, [])

  const fetchPendingRestaurants = async () => {
    try {
      const response = await httpClient.get('/admin-extended/restaurants/pending')
      setRestaurants(response.data.pending)
    } catch (error) {
      toast.error('Failed to fetch pending restaurants')
    } finally {
      setIsLoading(false)
    }
  }

  const handleApprove = async (restaurantId: string) => {
    try {
      await httpClient.post(`/admin-extended/restaurants/${restaurantId}/approve`)
      toast.success('Restaurant approved!')
      setRestaurants(restaurants.filter(r => r.restaurant_id !== restaurantId))
    } catch (error) {
      toast.error('Failed to approve restaurant')
    }
  }

  const handleReject = async (restaurantId: string) => {
    if (!rejectReason.trim()) {
      toast.error('Please provide a reason')
      return
    }

    try {
      await httpClient.post(`/admin-extended/restaurants/${restaurantId}/reject`, {
        rejectionReason: rejectReason
      })
      toast.success('Restaurant rejected')
      setRestaurants(restaurants.filter(r => r.restaurant_id !== restaurantId))
      setShowRejectModal(false)
      setRejectReason('')
    } catch (error) {
      toast.error('Failed to reject restaurant')
    }
  }

  if (isLoading) {
    return <div className="text-center py-12">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Pending Restaurants</h2>
        <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full font-semibold">
          {restaurants.length} pending
        </span>
      </div>

      <div className="space-y-3">
        {restaurants.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-2" />
            <p className="text-gray-600">All restaurants have been reviewed!</p>
          </div>
        ) : (
          restaurants.map((restaurant) => (
            <motion.div
              key={restaurant.restaurant_id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-bold text-lg text-gray-900">{restaurant.restaurant_name}</h3>
                  <div className="grid grid-cols-2 gap-4 mt-3 text-sm text-gray-600">
                    <div>
                      <p className="font-medium text-gray-700">Owner</p>
                      <p>{restaurant.owner_name}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700">Phone</p>
                      <p>{restaurant.owner_phone}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700">Email</p>
                      <p>{restaurant.owner_email}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700">Address</p>
                      <p className="text-xs">{restaurant.address_full}</p>
                    </div>
                    {restaurant.gst_number && (
                      <div>
                        <p className="font-medium text-gray-700">GST</p>
                        <p>{restaurant.gst_number}</p>
                      </div>
                    )}
                    {restaurant.fssai_license && (
                      <div>
                        <p className="font-medium text-gray-700">FSSAI</p>
                        <p>{restaurant.fssai_license}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 ml-4">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleApprove(restaurant.restaurant_id)}
                    className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-medium transition flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Approve
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setSelectedId(restaurant.restaurant_id)
                      setShowRejectModal(true)
                    }}
                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium transition flex items-center gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </motion.button>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && selectedId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md">
            <h3 className="font-bold text-lg mb-4">Reject Restaurant</h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection..."
              className="w-full border border-gray-300 rounded-lg p-3 mb-4 focus:outline-none focus:border-orange-500"
              rows={3}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowRejectModal(false)}
                className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReject(selectedId)}
                className="flex-1 bg-red-500 text-white py-2 rounded-lg font-medium"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// ADMIN RIDER APPROVALS
// ============================================================

export function AdminRiderApprovals() {
  const [riders, setRiders] = useState<PendingRider[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectModal, setShowRejectModal] = useState(false)

  useEffect(() => {
    fetchPendingRiders()
  }, [])

  const fetchPendingRiders = async () => {
    try {
      const response = await httpClient.get('/admin-extended/riders/pending')
      setRiders(response.data.pending)
    } catch (error) {
      toast.error('Failed to fetch pending riders')
    } finally {
      setIsLoading(false)
    }
  }

  const handleApprove = async (riderId: string) => {
    try {
      await httpClient.post(`/admin-extended/riders/${riderId}/approve`)
      toast.success('Rider approved!')
      setRiders(riders.filter(r => r.id !== riderId))
    } catch (error) {
      toast.error('Failed to approve rider')
    }
  }

  const handleReject = async (riderId: string) => {
    if (!rejectReason.trim()) {
      toast.error('Please provide a reason')
      return
    }

    try {
      await httpClient.post(`/admin-extended/riders/${riderId}/reject`, {
        rejectionReason: rejectReason
      })
      toast.success('Rider rejected')
      setRiders(riders.filter(r => r.id !== riderId))
      setShowRejectModal(false)
      setRejectReason('')
    } catch (error) {
      toast.error('Failed to reject rider')
    }
  }

  if (isLoading) {
    return <div className="text-center py-12">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Pending Riders</h2>
        <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full font-semibold">
          {riders.length} pending
        </span>
      </div>

      <div className="space-y-3">
        {riders.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-2" />
            <p className="text-gray-600">All riders have been reviewed!</p>
          </div>
        ) : (
          riders.map((rider) => (
            <motion.div
              key={rider.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-bold text-lg text-gray-900">{rider.full_name}</h3>
                  <div className="grid grid-cols-2 gap-4 mt-3 text-sm text-gray-600">
                    <div>
                      <p className="font-medium text-gray-700">Phone</p>
                      <p>{rider.phone}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700">Email</p>
                      <p>{rider.email || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700">Vehicle</p>
                      <p>{rider.vehicle_type} • {rider.vehicle_number}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700">Zone</p>
                      <p>{rider.zone}</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 ml-4">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleApprove(rider.id)}
                    className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-medium transition flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Approve
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setSelectedId(rider.id)
                      setShowRejectModal(true)
                    }}
                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium transition flex items-center gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </motion.button>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && selectedId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md">
            <h3 className="font-bold text-lg mb-4">Reject Rider</h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection..."
              className="w-full border border-gray-300 rounded-lg p-3 mb-4 focus:outline-none focus:border-orange-500"
              rows={3}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowRejectModal(false)}
                className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReject(selectedId)}
                className="flex-1 bg-red-500 text-white py-2 rounded-lg font-medium"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// ADMIN MENU MANAGEMENT
// ============================================================

interface MenuCategory {
  id: string
  name: string
  description: string
  icon?: string
  display_order: number
}

interface MenuItem {
  id: string
  admin_category_id: string
  name: string
  description: string
  base_price: number
  is_veg: boolean
  is_featured: boolean
  is_trending: boolean
}

export function AdminMenuManagement() {
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [showNewCategoryForm, setShowNewCategoryForm] = useState(false)
  const [showNewItemForm, setShowNewItemForm] = useState(false)

  const [newCategory, setNewCategory] = useState({ name: '', description: '', icon: '', displayOrder: 0 })
  const [newItem, setNewItem] = useState({
    name: '',
    description: '',
    basePrice: '',
    isVeg: true,
    isFeatured: false,
    isTrending: false
  })

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    try {
      const response = await httpClient.get('/admin-extended/menu/categories')
      setCategories(response.data.categories)
      if (response.data.categories.length > 0) {
        setSelectedCategory(response.data.categories[0].id)
        fetchItems(response.data.categories[0].id)
      }
    } catch (error) {
      toast.error('Failed to fetch categories')
    }
  }

  const fetchItems = async (categoryId: string) => {
    try {
      const response = await httpClient.get(`/admin-extended/menu/items/${categoryId}`)
      setItems(response.data.items)
    } catch (error) {
      toast.error('Failed to fetch items')
    }
  }

  const handleCreateCategory = async () => {
    try {
      await httpClient.post('/admin-extended/menu/category/create', newCategory)
      toast.success('Category created!')
      setNewCategory({ name: '', description: '', icon: '', displayOrder: 0 })
      setShowNewCategoryForm(false)
      fetchCategories()
    } catch (error) {
      toast.error('Failed to create category')
    }
  }

  const handleCreateItem = async () => {
    if (!selectedCategory || !newItem.name || !newItem.basePrice) {
      toast.error('Please fill all fields')
      return
    }

    try {
      await httpClient.post('/admin-extended/menu/item/create', {
        categoryId: selectedCategory,
        name: newItem.name,
        description: newItem.description,
        basePrice: parseFloat(newItem.basePrice),
        isVeg: newItem.isVeg,
        isFeatured: newItem.isFeatured,
        isTrending: newItem.isTrending
      })
      toast.success('Item created!')
      setNewItem({ name: '', description: '', basePrice: '', isVeg: true, isFeatured: false, isTrending: false })
      setShowNewItemForm(false)
      selectedCategory && fetchItems(selectedCategory)
    } catch (error) {
      toast.error('Failed to create item')
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Categories */}
      <div className="lg:col-span-1">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg">Categories</h3>
            <button
              onClick={() => setShowNewCategoryForm(true)}
              className="bg-orange-500 text-white px-3 py-1 rounded text-sm font-medium"
            >
              + New
            </button>
          </div>

          {showNewCategoryForm && (
            <div className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3">
              <input
                type="text"
                value={newCategory.name}
                onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                placeholder="Category name"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
              <textarea
                value={newCategory.description}
                onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                placeholder="Description"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                rows={2}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreateCategory}
                  className="flex-1 bg-green-500 text-white py-2 rounded font-medium text-sm"
                >
                  Create
                </button>
                <button
                  onClick={() => setShowNewCategoryForm(false)}
                  className="flex-1 bg-gray-300 py-2 rounded font-medium text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCategory(cat.id)
                  fetchItems(cat.id)
                }}
                className={`w-full text-left p-3 rounded-lg font-medium transition ${
                  selectedCategory === cat.id
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="lg:col-span-2">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg">
              Items {selectedCategory && `(${items.length})`}
            </h3>
            {selectedCategory && (
              <button
                onClick={() => setShowNewItemForm(true)}
                className="bg-orange-500 text-white px-3 py-1 rounded text-sm font-medium"
              >
                + Add Item
              </button>
            )}
          </div>

          {showNewItemForm && selectedCategory && (
            <div className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3">
              <input
                type="text"
                value={newItem.name}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                placeholder="Item name"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
              <textarea
                value={newItem.description}
                onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                placeholder="Description"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                rows={2}
              />
              <input
                type="number"
                value={newItem.basePrice}
                onChange={(e) => setNewItem({ ...newItem, basePrice: e.target.value })}
                placeholder="Price"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newItem.isVeg}
                  onChange={(e) => setNewItem({ ...newItem, isVeg: e.target.checked })}
                />
                <span className="text-sm">Vegetarian</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newItem.isFeatured}
                  onChange={(e) => setNewItem({ ...newItem, isFeatured: e.target.checked })}
                />
                <span className="text-sm">Featured</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newItem.isTrending}
                  onChange={(e) => setNewItem({ ...newItem, isTrending: e.target.checked })}
                />
                <span className="text-sm">Trending</span>
              </label>
              <div className="flex gap-2">
                <button
                  onClick={handleCreateItem}
                  className="flex-1 bg-green-500 text-white py-2 rounded font-medium text-sm"
                >
                  Add
                </button>
                <button
                  onClick={() => setShowNewItemForm(false)}
                  className="flex-1 bg-gray-300 py-2 rounded font-medium text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="p-3 border border-gray-200 rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">
                      {item.name}
                      {item.is_veg && <span className="text-green-600 ml-2">🌱</span>}
                    </h4>
                    <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                    <div className="flex gap-2 mt-2">
                      <span className="text-sm font-bold text-orange-600">₹{item.base_price}</span>
                      {item.is_featured && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">Featured</span>}
                      {item.is_trending && <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">Trending</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
