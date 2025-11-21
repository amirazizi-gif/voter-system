'use client'

import { Voter } from '@/lib/supabase'

interface StatisticsProps {
  voters: Voter[]
}

export default function Statistics({ voters }: StatisticsProps) {
  const totalCount = voters.length
  const yesCount = voters.filter((v) => v.tag === 'Yes').length
  const unsureCount = voters.filter((v) => v.tag === 'Unsure').length
  const noCount = voters.filter((v) => v.tag === 'No').length

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="text-2xl font-bold text-blue-600">{totalCount.toLocaleString()}</div>
        <div className="text-sm text-gray-600">Total Voters</div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="text-2xl font-bold text-green-600">{yesCount.toLocaleString()}</div>
        <div className="text-sm text-gray-600">Tagged: Yes</div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="text-2xl font-bold text-yellow-600">{unsureCount.toLocaleString()}</div>
        <div className="text-sm text-gray-600">Tagged: Unsure</div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="text-2xl font-bold text-red-600">{noCount.toLocaleString()}</div>
        <div className="text-sm text-gray-600">Tagged: No</div>
      </div>
    </div>
  )
}