'use client'

import { useEffect, useState } from 'react'
import {
  Voter,
  VoterFilters,
  fetchVoters,
  getUniqueValues,
  calculateAge,
  getLokalitiByDaerah,
} from '@/lib/supabase'
import FilterPanel from '@/components/FilterPanel'
import Statistics from '@/components/Statistics'
import VoterTable from '@/components/VoterTable'

export default function Home() {
  const [voters, setVoters] = useState<Voter[]>([])
  const [filteredVoters, setFilteredVoters] = useState<Voter[]>([])
  const [filters, setFilters] = useState<VoterFilters>({})
  const [loading, setLoading] = useState(true)
  const [daerahOptions, setDaerahOptions] = useState<string[]>([])
  const [lokalitiOptions, setLokalitiOptions] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 50

  // Load initial data
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      
      console.log('🔄 Starting to load data...')
      
      // Load voters data
      console.log('📊 Fetching voters...')
      const votersData = await fetchVoters()
      console.log(`✅ Loaded ${votersData.length} voters`)
      setVoters(votersData)
      setFilteredVoters(votersData)
      
      // Load filter options
      console.log('📋 Loading Daerah options...')
      const daerahs = await getUniqueValues('daerah_mengundi')
      console.log('✅ Daerah options:', daerahs)
      setDaerahOptions(daerahs)
      
      console.log('📋 Loading Lokaliti options...')
      const lokalitis = await getUniqueValues('lokaliti')
      console.log(`✅ Loaded ${lokalitis.length} lokaliti options`)
      setLokalitiOptions(lokalitis)
      
      console.log('📊 Summary:', {
        voters: votersData.length,
        daerahs: daerahs.length,
        lokalitis: lokalitis.length
      })
    } catch (error) {
      console.error('❌ Error loading data:', error)
      alert('Error loading voter data. Please check your Supabase configuration and browser console.')
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...voters]

    // Name filter
    if (filters.nameSearch) {
      filtered = filtered.filter((v) =>
        v.nama_pemilih.toLowerCase().includes(filters.nameSearch!.toLowerCase())
      )
    }

    // Gender filter
    if (filters.gender) {
      filtered = filtered.filter((v) => v.jantina === filters.gender)
    }

    // Specific age filter
    if (filters.specificAge) {
      filtered = filtered.filter(
        (v) => calculateAge(v.tahun_lahir) === filters.specificAge
      )
    }

    // Age group filter
    if (filters.ageGroup) {
      filtered = filtered.filter((v) => {
        const age = calculateAge(v.tahun_lahir)
        switch (filters.ageGroup) {
          case '18-30':
            return age >= 18 && age <= 30
          case '30-40':
            return age > 30 && age <= 40
          case '40-55':
            return age > 40 && age <= 55
          case '55+':
            return age > 55
          default:
            return true
        }
      })
    }

    // Daerah filter - Multiple selection
    if (filters.daerah && filters.daerah.length > 0) {
      filtered = filtered.filter((v) => filters.daerah!.includes(v.daerah_mengundi))
    }

    // Lokaliti filter - Multiple selection
    if (filters.lokaliti && filters.lokaliti.length > 0) {
      filtered = filtered.filter((v) => filters.lokaliti!.includes(v.lokaliti))
    }

    // Tag filter
    if (filters.tag) {
      if (filters.tag === 'untagged') {
        filtered = filtered.filter((v) => !v.tag)
      } else {
        filtered = filtered.filter((v) => v.tag === filters.tag)
      }
    }

    setFilteredVoters(filtered)
    setCurrentPage(1)
  }

  // Update lokaliti options when daerah changes
  const handleFilterChange = async (newFilters: VoterFilters) => {
    // If daerah changed, update lokaliti options
    if (JSON.stringify(newFilters.daerah) !== JSON.stringify(filters.daerah)) {
      if (newFilters.daerah && newFilters.daerah.length > 0) {
        // Filter lokaliti based on selected daerahs
        const lokalitiForDaerah = [...new Set(
          voters
            .filter(v => newFilters.daerah!.includes(v.daerah_mengundi))
            .map(v => v.lokaliti)
        )].sort()
        setLokalitiOptions(lokalitiForDaerah)
        
        // Clear lokaliti selections that are not in the new filtered list
        if (newFilters.lokaliti && newFilters.lokaliti.length > 0) {
          newFilters.lokaliti = newFilters.lokaliti.filter(l => 
            lokalitiForDaerah.includes(l)
          )
          if (newFilters.lokaliti.length === 0) {
            newFilters.lokaliti = undefined
          }
        }
      } else {
        // Reset to all lokaliti if no daerah selected
        const allLokaliti = await getUniqueValues('lokaliti')
        setLokalitiOptions(allLokaliti)
      }
    }
    
    setFilters(newFilters)
  }

  const resetFilters = async () => {
    setFilters({})
    setFilteredVoters(voters)
    setCurrentPage(1)
    // Reset lokaliti to show all
    const allLokaliti = await getUniqueValues('lokaliti')
    setLokalitiOptions(allLokaliti)
  }

  const exportToCSV = () => {
    if (filteredVoters.length === 0) {
      alert('No data to export')
      return
    }

    const headers = [
      'BIL',
      'NO K/P',
      'NO K/P ID LAIN',
      'JANTINA',
      'TAHUN LAHIR',
      'AGE',
      'NAMA PEMILIH',
      'KOD DAERAH MENGUNDI',
      'DAERAH MENGUNDI',
      'KOD LOKALITI',
      'LOKALITI',
      'TAG',
    ]

    const csvContent = [
      headers.join(','),
      ...filteredVoters.map((voter) => {
        const age = calculateAge(voter.tahun_lahir)
        return [
          voter.bil,
          voter.no_kp,
          voter.no_kp_id_lain || '',
          voter.jantina,
          voter.tahun_lahir,
          age,
          `"${voter.nama_pemilih}"`,
          voter.kod_daerah_mengundi,
          `"${voter.daerah_mengundi}"`,
          voter.kod_lokaliti,
          `"${voter.lokaliti}"`,
          voter.tag || '',
        ].join(',')
      }),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)

    link.setAttribute('href', url)
    link.setAttribute(
      'download',
      `voters_export_${new Date().toISOString().slice(0, 10)}.csv`
    )
    link.style.visibility = 'hidden'

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentVoters = filteredVoters.slice(indexOfFirstItem, indexOfLastItem)
  const totalPages = Math.ceil(filteredVoters.length / itemsPerPage)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading voter data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6 rounded-lg shadow-lg mb-8">
          <h1 className="text-3xl font-bold mb-2">📊 Voter Database</h1>
          <p className="text-blue-100">P.175 PAPAR - Daftar Pemilih</p>
        </div>

        {/* Debug Info - Remove after testing */}
        {process.env.NODE_ENV === 'development' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <h3 className="font-bold text-yellow-800 mb-2">🔍 Debug Info:</h3>
            <div className="text-sm text-yellow-700 space-y-1">
              <div>Total Voters: {voters.length}</div>
              <div>Daerah Options: {daerahOptions.length} ({daerahOptions.slice(0, 3).join(', ')}{daerahOptions.length > 3 ? '...' : ''})</div>
              <div>Lokaliti Options: {lokalitiOptions.length}</div>
              <div>Selected Daerah: {filters.daerah?.length || 0}</div>
              <div>Selected Lokaliti: {filters.lokaliti?.length || 0}</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <FilterPanel
          filters={filters}
          onFilterChange={handleFilterChange}
          onSearch={applyFilters}
          onReset={resetFilters}
          daerahOptions={daerahOptions}
          lokalitiOptions={lokalitiOptions}
        />

        {/* Statistics */}
        <Statistics voters={filteredVoters} />

        {/* Export Button */}
        <div className="mb-4 flex justify-end">
          <button onClick={exportToCSV} className="btn-primary">
            <span className="mr-2">📥</span>
            Export Results
          </button>
        </div>

        {/* Results Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <VoterTable voters={currentVoters} onTagUpdate={loadData} />

          {/* Pagination */}
          {filteredVoters.length > 0 && (
            <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-t border-gray-200">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="btn-secondary disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="btn-secondary disabled:opacity-50"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing{' '}
                    <span className="font-medium">{indexOfFirstItem + 1}</span> to{' '}
                    <span className="font-medium">
                      {Math.min(indexOfLastItem, filteredVoters.length)}
                    </span>{' '}
                    of <span className="font-medium">{filteredVoters.length}</span>{' '}
                    results
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}