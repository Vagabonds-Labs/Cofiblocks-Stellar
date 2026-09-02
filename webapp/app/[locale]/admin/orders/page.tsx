'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useParams } from 'next/navigation'
import { useUser } from '@/lib/providers/UserProvider'
import { useManageOrders } from '@/hooks/admin/useManageOrders'
import { AdminOrderRow } from '@/components/orders/AdminOrderRow'
import { OrderCard } from '@/components/orders/OrderCard'
import { 
  FunnelIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'

export default function AdminOrdersPage() {
  const t = useTranslations()
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const { user, loading: userLoading } = useUser()
  
  const {
    orders,
    events,
    loading,
    eventsLoading,
    error,
    filters,
    showFilters,
    setShowFilters,
    handleFilterChange,
    clearFilters,
    hasActiveFilters,
    refetchOrders,
  } = useManageOrders(user)

  // Check if user is admin and redirect if not
  useEffect(() => {
    if (!userLoading) {
      if (!user) {
        router.push(`/${locale}/login?redirect=admin/orders`)
        return
      }
      if (!user.isAdmin) {
        router.push(`/${locale}`)
        return
      }
    }
  }, [user, userLoading, router, locale])

  if (userLoading || !user || !user.isAdmin) {
    return (
      <div className="min-h-screen bg-white">
        <div className="flex items-center justify-center min-h-[calc(100vh-80px)]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Manage orders</h1>
          <p className="text-gray-600">View and filter all orders in the system</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 text-gray-700 hover:text-green-600 transition-colors"
            >
              <FunnelIcon className="w-5 h-5" />
              <span className="font-medium">Filters</span>
              {hasActiveFilters && (
                <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
                  Active
                </span>
              )}
            </button>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-gray-500 hover:text-red-600 transition-colors flex items-center gap-1"
              >
                <XMarkIcon className="w-4 h-4" />
                Clear all
              </button>
            )}
          </div>
          
          {showFilters && (
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">All</option>
                  <option value="PAID">Paid</option>
                  <option value="IN_DELIVERY">In Delivery</option>
                  <option value="DELIVERED">Delivered</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Buyer Address
                </label>
                <input
                  type="text"
                  value={filters.buyerId}
                  onChange={(e) => handleFilterChange('buyerId', e.target.value)}
                  placeholder="Enter buyer address..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product ID
                </label>
                <input
                  type="text"
                  value={filters.productId}
                  onChange={(e) => handleFilterChange('productId', e.target.value)}
                  placeholder="Enter product ID..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Delivery Method
                </label>
                <select
                  value={filters.deliveryMethod}
                  onChange={(e) => handleFilterChange('deliveryMethod', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">All</option>
                  <option value="EVENT">Event</option>
                  <option value="HOME">Home</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Event
                </label>
                <select
                  value={filters.eventId}
                  onChange={(e) => handleFilterChange('eventId', e.target.value)}
                  disabled={eventsLoading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">All</option>
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.title}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Orders List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Orders ({orders.length})
            </h2>
          </div>
          
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
              <p className="ml-3 text-gray-600">Loading orders...</p>
            </div>
          )}
          
          {!loading && error && (
            <div className="text-center py-12">
              <p className="text-red-600">{error}</p>
            </div>
          )}
          
          {!loading && !error && orders.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-600">No orders found</p>
            </div>
          )}
          
          {!loading && !error && orders.length > 0 && (
            <div className="max-h-[calc(100vh-400px)] overflow-y-auto p-4 space-y-4">
              {orders.map((order) => (
                <OrderCard 
                  key={order.id}
                  onDelete={refetchOrders}
                  order={order} 
                  onClick={(orderId) => router.push(`/${locale}/admin/orders/${orderId}`)}
                  showStripeLabel={true}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

