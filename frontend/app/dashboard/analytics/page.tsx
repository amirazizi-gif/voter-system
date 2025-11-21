'use client'

import { useEffect, useState } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import DashboardLayout from '@/components/DashboardLayout'
import PredictiveAnalytics from '@/components/PredictiveAnalytics'
import { fetchVoters, Voter } from '@/lib/api'

export default function AnalyticsPage() {
  const [voters, setVoters] = useState<Voter[]>([])
  const [loading, setLoading] = useState(true)
  const [totalVoters, setTotalVoters] = useState(0)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const votersData = await fetchVoters()
      setVoters(votersData)
      setTotalVoters(votersData.length)
    } catch (error) {
      console.error('Error loading voters:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading analytics data...</p>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Page Header */}
          <div className="bg-white rounded-lg shadow p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">📈 Predictive Analytics Dashboard</h1>
            <p className="text-gray-600">
              Advanced insights and projections based on current voter sentiment data
            </p>
          </div>

          {/* Predictive Analytics Component */}
          <PredictiveAnalytics voters={voters} totalVoters={totalVoters} />
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}