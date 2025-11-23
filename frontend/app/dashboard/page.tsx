'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import ProtectedRoute from '@/components/ProtectedRoute'
import DashboardLayout from '@/components/DashboardLayout'
import ChangePasswordModal from '@/components/ChangePasswordModal'
import { getStatistics } from '@/lib/api'
import Link from 'next/link'

interface Statistics {
  dun: string
  total: number
  yes: number
  yes_percentage: number
  unsure: number
  unsure_percentage: number
  no: number
  no_percentage: number
  untagged: number
  untagged_percentage: number
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState<Statistics | null>(null)
  const [loading, setLoading] = useState(true)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [mustChangePassword, setMustChangePassword] = useState(false)

  useEffect(() => {
    loadStatistics()
    checkPasswordChange()
  }, [])

  const checkPasswordChange = async () => {
    try {
      // IMPORTANT: Check localStorage FIRST for immediate feedback
      const storedMustChange = localStorage.getItem('must_change_password')
      console.log('🔍 Dashboard - Checking password requirement:', storedMustChange)
      
      if (storedMustChange === 'true') {
        console.log('⚠️ localStorage says must change password - showing modal immediately')
        setMustChangePassword(true)
        setShowPasswordModal(true)
      }

      // Then verify with backend
      const token = localStorage.getItem('token')
      if (!token) {
        console.log('❌ No token found')
        return
      }

      console.log('📡 Fetching user data from backend...')
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const userData = await response.json()
        console.log('👤 User data from backend:', userData)
        console.log('🔒 must_change_password from backend:', userData.must_change_password)
        
        if (userData.must_change_password) {
          console.log('✅ Backend confirms: must change password - FORCING MODAL OPEN')
          setMustChangePassword(true)
          setShowPasswordModal(true)
          localStorage.setItem('must_change_password', 'true')
        } else {
          console.log('✅ Backend says no password change needed')
          // Backend says no need to change, clear localStorage
          localStorage.removeItem('must_change_password')
          setMustChangePassword(false)
        }
      } else {
        console.error('❌ Failed to fetch user data:', response.status)
      }
    } catch (error) {
      console.error('❌ Error checking password status:', error)
    }
  }

  const loadStatistics = async () => {
    try {
      const data = await getStatistics()
      setStats(data)
    } catch (error) {
      console.error('Error loading statistics:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordChanged = () => {
    console.log('✅ Password changed successfully - closing modal')
    setShowPasswordModal(false)
    setMustChangePassword(false)
    localStorage.removeItem('must_change_password')
  }

  const handleModalClose = () => {
    // Don't allow closing if first login
    if (mustChangePassword) {
      console.log('⛔ Cannot close modal - password change required')
      return
    }
    console.log('👋 Closing modal (not first login)')
    setShowPasswordModal(false)
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        {/* Change Password Modal - ALWAYS RENDER if mustChangePassword is true */}
        {(showPasswordModal || mustChangePassword) && (
          <ChangePasswordModal
            isOpen={true}
            onClose={handleModalClose}
            onSuccess={handlePasswordChanged}
            isFirstLogin={mustChangePassword}
          />
        )}

        <div className="space-y-6">
          {/* Welcome Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6 rounded-lg shadow-lg">
            <h1 className="text-3xl font-bold mb-2">Welcome back, {user?.full_name || user?.username}!</h1>
            <p className="text-blue-100">
              {user?.dun ? `Managing ${user.dun} constituency` : 'System Administrator'}
            </p>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
                  <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Voters</dt>
                    <dd className="text-3xl font-bold text-gray-900">{stats?.total.toLocaleString()}</dd>
                  </dl>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-green-100 rounded-md p-3">
                  <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Yes Votes</dt>
                    <dd className="flex items-baseline">
                      <div className="text-3xl font-bold text-gray-900">{stats?.yes.toLocaleString()}</div>
                      <div className="ml-2 text-sm font-medium text-green-600">{stats?.yes_percentage.toFixed(1)}%</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-yellow-100 rounded-md p-3">
                  <svg className="h-6 w-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Unsure</dt>
                    <dd className="flex items-baseline">
                      <div className="text-3xl font-bold text-gray-900">{stats?.unsure.toLocaleString()}</div>
                      <div className="ml-2 text-sm font-medium text-yellow-600">
                        {stats?.unsure_percentage.toFixed(1)}%
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-red-100 rounded-md p-3">
                  <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">No Votes</dt>
                    <dd className="flex items-baseline">
                      <div className="text-3xl font-bold text-gray-900">{stats?.no.toLocaleString()}</div>
                      <div className="ml-2 text-sm font-medium text-red-600">{stats?.no_percentage.toFixed(1)}%</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* Visual Progress Bar */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Vote Distribution</h3>
            <div className="relative pt-1">
              <div className="flex mb-2 items-center justify-between">
                <div>
                  <span className="text-xs font-semibold inline-block text-gray-600">
                    Progress: {((stats?.total! - stats?.untagged!) / stats?.total! * 100).toFixed(1)}% Tagged
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold inline-block text-gray-600">
                    {stats?.untagged.toLocaleString()} Untagged
                  </span>
                </div>
              </div>
              <div className="overflow-hidden h-6 text-xs flex rounded-lg bg-gray-200">
                <div
                  style={{ width: `${stats?.yes_percentage}%` }}
                  className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-green-500"
                >
                  {stats?.yes_percentage! > 5 && <span className="font-semibold">Yes</span>}
                </div>
                <div
                  style={{ width: `${stats?.unsure_percentage}%` }}
                  className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-yellow-500"
                >
                  {stats?.unsure_percentage! > 5 && <span className="font-semibold">Unsure</span>}
                </div>
                <div
                  style={{ width: `${stats?.no_percentage}%` }}
                  className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-red-500"
                >
                  {stats?.no_percentage! > 5 && <span className="font-semibold">No</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Link
              href="/dashboard/voters"
              className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer"
            >
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
                  <svg className="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                </div>
                <div className="ml-4">
                  <h4 className="text-lg font-semibold text-gray-900">View Voters</h4>
                  <p className="text-sm text-gray-500">Browse and manage voter database</p>
                </div>
              </div>
            </Link>

            <Link
              href="/dashboard/analytics"
              className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer"
            >
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-purple-100 rounded-md p-3">
                  <svg className="h-8 w-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                </div>
                <div className="ml-4">
                  <h4 className="text-lg font-semibold text-gray-900">Analytics</h4>
                  <p className="text-sm text-gray-500">View predictive analytics & insights</p>
                </div>
              </div>
            </Link>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-gray-100 rounded-md p-3">
                  <svg className="h-8 w-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div className="ml-4">
                  <h4 className="text-lg font-semibold text-gray-900">Your Access</h4>
                  <p className="text-sm text-gray-500">
                    Role: {user?.role.replace('_', ' ').toUpperCase()}
                  </p>
                  {user?.dun && <p className="text-sm text-gray-500">DUN: {user.dun}</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}