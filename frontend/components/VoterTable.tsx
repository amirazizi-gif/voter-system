'use client'

import { Voter, calculateAge, updateVoterTag } from '@/lib/api'
import { useState } from 'react'

interface VoterTableProps {
  voters: Voter[]
  onTagUpdate: () => void
  canUpdate?: boolean
}

export default function VoterTable({ voters, onTagUpdate, canUpdate = true }: VoterTableProps) {
  const [updatingId, setUpdatingId] = useState<number | null>(null)

  const handleTagChange = async (voterId: number, newTag: string) => {
    if (!canUpdate) {
      alert('You do not have permission to update voter tags')
      return
    }

    setUpdatingId(voterId)
    try {
      const tagValue = newTag === '' ? null : (newTag as 'Yes' | 'Unsure' | 'No')
      await updateVoterTag(voterId, tagValue)
      onTagUpdate()
    } catch (error) {
      console.error('Error updating tag:', error)
      alert('Failed to update tag. Please try again.')
    } finally {
      setUpdatingId(null)
    }
  }

  const getTagColor = (tag?: string | null) => {
    switch (tag) {
      case 'Yes':
        return 'bg-green-100 border-green-300 text-green-800'
      case 'Unsure':
        return 'bg-yellow-100 border-yellow-300 text-yellow-800'
      case 'No':
        return 'bg-red-100 border-red-300 text-red-800'
      default:
        return 'bg-gray-100 border-gray-300 text-gray-800'
    }
  }

  if (voters.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">No voters found</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              No.
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              IC Number
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Name
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Gender
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Age
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Daerah
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Lokaliti
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Tag
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {voters.map((voter) => {
            const age = calculateAge(voter.tahun_lahir)
            const genderDisplay = voter.jantina === 'L' ? 'M' : 'F'
            const isUpdating = updatingId === voter.id

            return (
              <tr key={voter.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{voter.bil}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{voter.no_kp}</td>
                <td className="px-4 py-3 text-sm text-gray-900">{voter.nama_pemilih}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{genderDisplay}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{age}</td>
                <td className="px-4 py-3 text-sm text-gray-900">{voter.daerah_mengundi}</td>
                <td className="px-4 py-3 text-sm text-gray-900">{voter.lokaliti}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm">
                  <select
                    value={voter.tag || ''}
                    onChange={(e) => handleTagChange(voter.id, e.target.value)}
                    disabled={isUpdating || !canUpdate}
                    className={`px-2 py-1 border rounded text-sm ${getTagColor(voter.tag)} ${
                      isUpdating || !canUpdate ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                    }`}
                  >
                    <option value="">--</option>
                    <option value="Yes">Yes</option>
                    <option value="Unsure">Unsure</option>
                    <option value="No">No</option>
                  </select>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}