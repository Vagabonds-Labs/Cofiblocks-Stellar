'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useParams } from 'next/navigation'
import { useUser } from '@/lib/providers/UserProvider'
import { userService, type User } from '@/services/api/users'
import { 
  MagnifyingGlassIcon,
  FunnelIcon,
  XMarkIcon,
  TrashIcon,
  UserIcon,
  ShieldCheckIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline'

export default function AdminDashboardPage() {
  const t = useTranslations()
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const { user, loading: userLoading } = useUser()
  
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  
  // Filter state
  const [filters, setFilters] = useState({
    name: '',
    email: '',
    sellerType: '' as '' | 'PRODUCER' | 'ROASTER',
    walletAddress: '',
    walletProvider: '',
    isAdmin: '' as '' | 'true' | 'false',
  })
  
  const [showFilters, setShowFilters] = useState(false)

  // Check if user is admin and redirect if not
  useEffect(() => {
    if (!userLoading) {
      if (!user) {
        router.push(`/${locale}/login?redirect=admin/dashboard`)
        return
      }
      if (!user.isAdmin) {
        router.push(`/${locale}`)
        return
      }
    }
  }, [user, userLoading, router, locale])

  // Fetch users
  const fetchUsers = useCallback(async () => {
    if (!user?.isAdmin) return
    
    setLoading(true)
    setError(null)
    
    try {
      const filtersToSend: any = {
        limit: 100,
        offset: 0,
      }
      
      if (filters.name) {
        filtersToSend.name = filters.name
      }
      
      if (filters.email) {
        filtersToSend.email = filters.email
      }
      
      if (filters.sellerType) {
        filtersToSend.sellerType = filters.sellerType
      }
      
      if (filters.walletAddress) {
        filtersToSend.walletAddress = filters.walletAddress
      }
      
      if (filters.walletProvider) {
        filtersToSend.walletProvider = filters.walletProvider
      }
      
      if (filters.isAdmin) {
        filtersToSend.isAdmin = filters.isAdmin === 'true'
      }
      
      const response = await userService.getAllUsers(filtersToSend)
      setUsers(response.users)
      setTotal(response.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users')
    } finally {
      setLoading(false)
    }
  }, [user?.isAdmin, filters])

  useEffect(() => {
    if (user?.isAdmin) {
      fetchUsers()
    }
  }, [user?.isAdmin, fetchUsers])

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
    }))
  }

  const clearFilters = () => {
    setFilters({
      name: '',
      email: '',
      sellerType: '',
      walletAddress: '',
      walletProvider: '',
      isAdmin: '',
    })
  }

  const hasActiveFilters = Object.values(filters).some(v => v !== '')

  // Helper function to set message
  const setMessageWithType = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type })
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setMessage(null)
    }, 5000)
  }

  // Action handlers
  const handleDeleteUser = async () => {
    if (!selectedUser) return
    
    if (!confirm(`Are you sure you want to delete user "${selectedUser.name || selectedUser.email || selectedUser.id}"? This action cannot be undone.`)) {
      return
    }

    setActionLoading(true)
    setError(null)
    
    try {
      await userService.deleteUser(selectedUser.id)
      setSelectedUser(null)
      await fetchUsers()
      setMessageWithType('User deleted successfully', 'success')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete user'
      setError(errorMessage)
      setMessageWithType(errorMessage, 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleUpdateSellerType = async (sellerType: 'PRODUCER' | 'ROASTER' | null) => {
    if (!selectedUser) return

    setActionLoading(true)
    setError(null)
    
    try {
      const { tx_hash } = await userService.updateSellerType(selectedUser.id, sellerType)
      setSelectedUser(null)
      await fetchUsers()
      const sellerTypeText = sellerType || 'Buyer Only'
      setMessageWithType(`User type updated to ${sellerTypeText} successfully with tx: ${tx_hash}`, 'success')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update seller type'
      setError(errorMessage)
      setMessageWithType(errorMessage, 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleUpdateAdminStatus = async (isAdmin: boolean) => {
    if (!selectedUser) return

    setActionLoading(true)
    setError(null)
    
    try {
      await userService.updateAdminStatus(selectedUser.id, isAdmin)
      setSelectedUser(null)
      await fetchUsers()
      const statusText = isAdmin ? 'Admin' : 'Regular user'
      setMessageWithType(`User status updated to ${statusText} successfully`, 'success')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update admin status'
      setError(errorMessage)
      setMessageWithType(errorMessage, 'error')
    } finally {
      setActionLoading(false)
    }
  }

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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
          <p className="text-gray-600">Manage all users in the system</p>
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
                  Name
                </label>
                <input
                  type="text"
                  value={filters.name}
                  onChange={(e) => handleFilterChange('name', e.target.value)}
                  placeholder="Search by name..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="text"
                  value={filters.email}
                  onChange={(e) => handleFilterChange('email', e.target.value)}
                  placeholder="Search by email..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Seller Type
                </label>
                <select
                  value={filters.sellerType}
                  onChange={(e) => handleFilterChange('sellerType', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">All</option>
                  <option value="PRODUCER">Producer</option>
                  <option value="ROASTER">Roaster</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Wallet Address
                </label>
                <input
                  type="text"
                  value={filters.walletAddress}
                  onChange={(e) => handleFilterChange('walletAddress', e.target.value)}
                  placeholder="Search by wallet..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Wallet Provider
                </label>
                <input
                  type="text"
                  value={filters.walletProvider}
                  onChange={(e) => handleFilterChange('walletProvider', e.target.value)}
                  placeholder="starknet, cavos..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Is Admin
                </label>
                <select
                  value={filters.isAdmin}
                  onChange={(e) => handleFilterChange('isAdmin', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">All</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
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

        {/* Operation message */}
        {message && (
          <div className={`rounded-lg border px-4 py-3 mb-6 ${
            message.type === 'success' 
              ? 'bg-green-50 border-green-200 text-green-700' 
              : 'bg-red-50 border-red-200 text-red-700'
          }`}>
            <div className="flex items-center justify-between">
              <span>{message.text}</span>
              <button
                onClick={() => setMessage(null)}
                className="ml-4 text-current opacity-70 hover:opacity-100 transition-opacity"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Users table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Users ({total})
              </h2>
            </div>
            
            {/* Action buttons - shown when user is selected */}
            {selectedUser && (
              <div className="flex flex-wrap gap-2 mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 text-sm text-gray-700 mb-2 w-full">
                  <span className="font-medium">Selected:</span>
                  <span>{selectedUser.name || selectedUser.email || selectedUser.id}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleDeleteUser}
                    disabled={actionLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <TrashIcon className="w-4 h-4" />
                    Delete
                  </button>
                  
                  {selectedUser.sellerType === null && (
                    <>
                      <button
                        onClick={() => handleUpdateSellerType('PRODUCER')}
                        disabled={actionLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <UserIcon className="w-4 h-4" />
                        Assign Producer
                      </button>
                      <button
                        onClick={() => handleUpdateSellerType('ROASTER')}
                        disabled={actionLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <UserIcon className="w-4 h-4" />
                        Assign Roaster
                      </button>
                    </>
                  )}
                  
                  {selectedUser.sellerType !== null && (
                    <button
                      onClick={() => handleUpdateSellerType(null)}
                      disabled={actionLoading}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <CheckCircleIcon className="w-4 h-4" />
                      Assign Buyer Only
                    </button>
                  )}
                  
                  {!selectedUser.isAdmin && (
                    <button
                      onClick={() => handleUpdateAdminStatus(true)}
                      disabled={actionLoading}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <ShieldCheckIcon className="w-4 h-4" />
                      Assign Admin
                    </button>
                  )}
                  
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                  >
                    <XMarkIcon className="w-4 h-4" />
                    Clear Selection
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading users...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No users found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Seller Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Wallet Address
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Wallet Provider
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Admin
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created At
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr 
                      key={user.id} 
                      onClick={() => setSelectedUser(user)}
                      className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                        selectedUser?.id === user.id ? 'bg-green-50 border-l-4 border-l-green-500' : ''
                      }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {user.name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.email || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.sellerType || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                        {user.walletAddress ? (
                          <span className="text-xs">
                            {user.walletAddress.substring(0, 10)}...{user.walletAddress.substring(user.walletAddress.length - 8)}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.walletProvider || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {user.isAdmin ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Yes
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            No
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

