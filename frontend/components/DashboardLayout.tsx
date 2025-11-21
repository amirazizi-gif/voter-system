'use client'

import { ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface DashboardLayoutProps {
  children: ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, logout } = useAuth()
  const pathname = usePathname()

  const canUpdateVoters = user?.role === 'candidate' || user?.role === 'pdm' || user?.role === 'super_admin'

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: '📊', roles: ['all'] },
    { name: 'Voters', href: '/dashboard/voters', icon: '👥', roles: ['all'] },
    {
      name: 'Analytics',
      href: '/dashboard/analytics',
      icon: '📈',
      roles: ['candidate', 'super_admin', 'pdm', 'candidate_assistant', 'super_user'],
    },
    { name: 'Audit Logs', href: '/dashboard/audit', icon: '📋', roles: ['super_admin'] },
  ]

  const filteredNav = navigation.filter(
    (item) => item.roles.includes('all') || item.roles.includes(user?.role || '')
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation Bar */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold">V</span>
                </div>
                <span className="ml-2 text-xl font-bold text-gray-800">Voter System</span>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* User Info */}
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900">{user?.full_name || user?.username}</div>
                <div className="text-xs text-gray-500">
                  {user?.role.replace('_', ' ').toUpperCase()}
                  {user?.dun && ` • ${user.dun}`}
                </div>
              </div>

              {/* Logout Button */}
              <button
                onClick={logout}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Secondary Navigation */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {filteredNav.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`
                      whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                      ${
                        isActive
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }
                    `}
                  >
                    <span className="mr-2">{item.icon}</span>
                    {item.name}
                  </Link>
                )
              })}
            </nav>
          </div>
        </div>

        {/* Page Content */}
        <main>{children}</main>
      </div>
    </div>
  )
}