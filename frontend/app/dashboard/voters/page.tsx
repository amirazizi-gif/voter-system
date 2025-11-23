'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import ProtectedRoute from '@/components/ProtectedRoute'
import DashboardLayout from '@/components/DashboardLayout'
import FilterPanel from '@/components/FilterPanel'
import VoterTable from '@/components/VoterTable'
import Statistics from '@/components/Statistics'
import { fetchVoters, getUniqueValues, VoterFilters, Voter, calculateAge } from '@/lib/api'
import * as XLSX from 'xlsx'

export default function VotersPage() {
  const { user } = useAuth()
  const [voters, setVoters] = useState<Voter[]>([])
  const [filteredVoters, setFilteredVoters] = useState<Voter[]>([])
  const [filters, setFilters] = useState<VoterFilters>({})
  const [loading, setLoading] = useState(true)
  const [dunOptions, setDunOptions] = useState<string[]>([])
  const [daerahOptions, setDaerahOptions] = useState<string[]>([])
  const [lokalitiOptions, setLokalitiOptions] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 50

  const canUpdateVoters = user?.role === 'candidate' || user?.role === 'pdm' || user?.role === 'super_admin'

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)

      const votersData = await fetchVoters()
      setVoters(votersData)
      setFilteredVoters(votersData)

      if (user?.role === 'super_admin') {
        const duns = await getUniqueValues('dun')
        setDunOptions(duns)
      }

      const daerahs = await getUniqueValues('daerah_mengundi')
      setDaerahOptions(daerahs)

      const lokalitis = await getUniqueValues('lokaliti')
      setLokalitiOptions(lokalitis)
    } catch (error) {
      console.error('Error loading data:', error)
      alert('Error loading voter data. Please check your connection.')
    } finally {
      setLoading(false)
    }
  }

  const handleTagUpdate = (voterId: number, newTag: 'Yes' | 'Unsure' | 'No' | null) => {
    setVoters(prevVoters =>
      prevVoters.map(v =>
        v.id === voterId ? { ...v, tag: newTag } : v
      )
    )

    setFilteredVoters(prevFiltered =>
      prevFiltered.map(v =>
        v.id === voterId ? { ...v, tag: newTag } : v
      )
    )
  }

  const applyFilters = () => {
    let filtered = [...voters]

    if (filters.nameSearch) {
      filtered = filtered.filter((v) =>
        v.nama_pemilih.toLowerCase().includes(filters.nameSearch!.toLowerCase())
      )
    }

    if (filters.gender) {
      filtered = filtered.filter((v) => v.jantina === filters.gender)
    }

    if (filters.specificAge) {
      filtered = filtered.filter((v) => calculateAge(v.tahun_lahir) === filters.specificAge)
    }

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

    if (filters.dun && filters.dun.length > 0) {
      filtered = filtered.filter((v) => v.dun && filters.dun!.includes(v.dun))
    }

    if (filters.daerah && filters.daerah.length > 0) {
      filtered = filtered.filter((v) => filters.daerah!.includes(v.daerah_mengundi))
    }

    if (filters.lokaliti && filters.lokaliti.length > 0) {
      filtered = filtered.filter((v) => filters.lokaliti!.includes(v.lokaliti))
    }

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

  const handleFilterChange = async (newFilters: VoterFilters) => {
    if (JSON.stringify(newFilters.daerah) !== JSON.stringify(filters.daerah)) {
      if (newFilters.daerah && newFilters.daerah.length > 0) {
        const lokalitiForDaerah = [
          ...new Set(
            voters
              .filter((v) => newFilters.daerah!.includes(v.daerah_mengundi))
              .map((v) => v.lokaliti)
          ),
        ].sort()
        setLokalitiOptions(lokalitiForDaerah)

        if (newFilters.lokaliti && newFilters.lokaliti.length > 0) {
          newFilters.lokaliti = newFilters.lokaliti.filter((l: string) => lokalitiForDaerah.includes(l))
          if (newFilters.lokaliti.length === 0) {
            newFilters.lokaliti = undefined
          }
        }
      } else {
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
    const allLokaliti = await getUniqueValues('lokaliti')
    setLokalitiOptions(allLokaliti)
  }

  // CSV Export with Summary
  const exportToCSVWithSummary = () => {
    if (filteredVoters.length === 0) {
      alert('No data to export')
      return
    }

    const maleCount = filteredVoters.filter(v => v.jantina === 'L').length
    const femaleCount = filteredVoters.filter(v => v.jantina === 'P').length
    const ages = filteredVoters.map(v => calculateAge(v.tahun_lahir))
    const minAge = Math.min(...ages)
    const maxAge = Math.max(...ages)
    const avgAge = (ages.reduce((sum, age) => sum + age, 0) / ages.length).toFixed(1)

    const csvLines: string[] = []
    csvLines.push('LAPORAN EKSPORT PANGKALAN DATA PENGUNDI / VOTER DATABASE EXPORT REPORT')
    csvLines.push('')
    csvLines.push(`Tarikh Eksport / Export Date:,${new Date().toLocaleString('ms-MY')}`)
    csvLines.push(`Jumlah Rekod / Total Records:,${filteredVoters.length}`)
    csvLines.push(`Dieksport Oleh / Exported By:,${user?.full_name} (${user?.username})`)
    csvLines.push('')

    // Headers
    csvLines.push('BIL,NO K/P,NO K/P ID LAIN,JANTINA,TAHUN LAHIR,UMUR,NAMA PEMILIH,KOD DAERAH,DAERAH MENGUNDI,KOD LOKALITI,LOKALITI,DUN,TAG')

    // Data
    filteredVoters.forEach(voter => {
      const age = calculateAge(voter.tahun_lahir)
      csvLines.push([
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
        voter.dun || '',
        voter.tag || ''
      ].join(','))
    })

    const csvContent = csvLines.join('\n')
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    const date = new Date().toISOString().slice(0, 10)
    link.setAttribute('href', url)
    link.setAttribute('download', `Laporan_Pengundi_${date}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Excel Export with Summary and Formatting
  const exportToExcelWithSummary = () => {
    if (filteredVoters.length === 0) {
      alert('No data to export')
      return
    }

    // Calculate statistics
    const maleCount = filteredVoters.filter(v => v.jantina === 'L').length
    const femaleCount = filteredVoters.filter(v => v.jantina === 'P').length
    const ages = filteredVoters.map(v => calculateAge(v.tahun_lahir))
    const minAge = Math.min(...ages)
    const maxAge = Math.max(...ages)
    const avgAge = (ages.reduce((sum, age) => sum + age, 0) / ages.length).toFixed(1)

    const ageRanges = {
      '18-30': filteredVoters.filter(v => {
        const age = calculateAge(v.tahun_lahir)
        return age >= 18 && age <= 30
      }).length,
      '31-40': filteredVoters.filter(v => {
        const age = calculateAge(v.tahun_lahir)
        return age >= 31 && age <= 40
      }).length,
      '41-55': filteredVoters.filter(v => {
        const age = calculateAge(v.tahun_lahir)
        return age >= 41 && age <= 55
      }).length,
      '56+': filteredVoters.filter(v => {
        const age = calculateAge(v.tahun_lahir)
        return age >= 56
      }).length
    }

    const dunBreakdown = filteredVoters.reduce((acc, v) => {
      const dun = v.dun || 'No DUN'
      acc[dun] = (acc[dun] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const daerahBreakdown = filteredVoters.reduce((acc, v) => {
      acc[v.daerah_mengundi] = (acc[v.daerah_mengundi] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const lokalitiBreakdown = filteredVoters.reduce((acc, v) => {
      acc[v.lokaliti] = (acc[v.lokaliti] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const tagStats = {
      yes: filteredVoters.filter(v => v.tag === 'Yes').length,
      unsure: filteredVoters.filter(v => v.tag === 'Unsure').length,
      no: filteredVoters.filter(v => v.tag === 'No').length,
      untagged: filteredVoters.filter(v => !v.tag).length
    }

    // Create workbook
    const wb = XLSX.utils.book_new()

    // SHEET 1: SUMMARY
    const summaryData: any[][] = []
    summaryData.push(['LAPORAN EKSPORT PANGKALAN DATA PENGUNDI'])
    summaryData.push(['VOTER DATABASE EXPORT REPORT'])
    summaryData.push([])
    summaryData.push(['MAKLUMAT EKSPORT / EXPORT DETAILS'])
    summaryData.push(['Tarikh Eksport / Export Date:', new Date().toLocaleString('ms-MY', { dateStyle: 'full', timeStyle: 'short' })])
    summaryData.push(['Jumlah Rekod / Total Records:', filteredVoters.length])
    summaryData.push(['Dieksport Oleh / Exported By:', `${user?.full_name} (${user?.username})`])
    summaryData.push(['Peranan / Role:', user?.role.replace('_', ' ').toUpperCase()])
    if (user?.dun) summaryData.push(['DUN:', user.dun])
    summaryData.push([])

    summaryData.push(['PECAHAN MENGIKUT DUN / DUN BREAKDOWN'])
    summaryData.push(['Kawasan DUN / DUN Area', 'Bilangan / Count', 'Peratusan / Percentage'])
    Object.entries(dunBreakdown).sort((a, b) => b[1] - a[1]).forEach(([dun, count]) => {
      summaryData.push([dun, count, `${((count / filteredVoters.length) * 100).toFixed(1)}%`])
    })
    summaryData.push(['JUMLAH / TOTAL', filteredVoters.length, '100.0%'])
    summaryData.push([])

    summaryData.push(['PECAHAN JANTINA / GENDER BREAKDOWN'])
    summaryData.push(['Jantina / Gender', 'Bilangan / Count', 'Peratusan / Percentage'])
    summaryData.push(['Lelaki / Male', maleCount, `${((maleCount / filteredVoters.length) * 100).toFixed(1)}%`])
    summaryData.push(['Perempuan / Female', femaleCount, `${((femaleCount / filteredVoters.length) * 100).toFixed(1)}%`])
    summaryData.push(['JUMLAH / TOTAL', filteredVoters.length, '100.0%'])
    summaryData.push(['Nisbah L:P / M:F Ratio', `${(maleCount / femaleCount).toFixed(2)}:1`, ''])
    summaryData.push([])

    summaryData.push(['STATISTIK UMUR / AGE STATISTICS'])
    summaryData.push(['Umur Minimum / Minimum Age:', `${minAge} tahun / years`])
    summaryData.push(['Umur Maksimum / Maximum Age:', `${maxAge} tahun / years`])
    summaryData.push(['Umur Purata / Average Age:', `${avgAge} tahun / years`])
    summaryData.push([])

    summaryData.push(['PECAHAN JULAT UMUR / AGE RANGE BREAKDOWN'])
    summaryData.push(['Julat Umur / Age Range', 'Bilangan / Count', 'Peratusan / Percentage'])
    Object.entries(ageRanges).forEach(([range, count]) => {
      summaryData.push([`${range} tahun / years`, count, `${((count / filteredVoters.length) * 100).toFixed(1)}%`])
    })
    summaryData.push(['JUMLAH / TOTAL', filteredVoters.length, '100.0%'])
    summaryData.push([])

    summaryData.push(['PECAHAN DAERAH MENGUNDI / POLLING DISTRICT BREAKDOWN'])
    summaryData.push(['Daerah Mengundi / Polling District', 'Bilangan / Count', 'Peratusan / Percentage'])
    Object.entries(daerahBreakdown).sort((a, b) => b[1] - a[1]).forEach(([daerah, count]) => {
      summaryData.push([daerah, count, `${((count / filteredVoters.length) * 100).toFixed(1)}%`])
    })
    summaryData.push(['JUMLAH / TOTAL', filteredVoters.length, '100.0%'])
    summaryData.push([])

    summaryData.push(['PECAHAN LOKALITI (20 TERATAS) / LOCALITY BREAKDOWN (TOP 20)'])
    summaryData.push(['Lokaliti / Locality', 'Bilangan / Count', 'Peratusan / Percentage'])
    const lokalitiEntries = Object.entries(lokalitiBreakdown).sort((a, b) => b[1] - a[1])
    lokalitiEntries.slice(0, 20).forEach(([lokaliti, count]) => {
      summaryData.push([lokaliti, count, `${((count / filteredVoters.length) * 100).toFixed(1)}%`])
    })
    if (lokalitiEntries.length > 20) {
      const remainingCount = lokalitiEntries.slice(20).reduce((sum, [_, count]) => sum + count, 0)
      summaryData.push([`Lain-lain / Others (${lokalitiEntries.length - 20} lokaliti)`, remainingCount, `${((remainingCount / filteredVoters.length) * 100).toFixed(1)}%`])
    }
    summaryData.push(['JUMLAH / TOTAL', filteredVoters.length, '100.0%'])
    summaryData.push([])

    summaryData.push(['STATISTIK TAG / TAG STATISTICS'])
    summaryData.push(['Status Tag / Tag Status', 'Bilangan / Count', 'Peratusan / Percentage'])
    summaryData.push(['Ya / Yes', tagStats.yes, `${((tagStats.yes / filteredVoters.length) * 100).toFixed(1)}%`])
    summaryData.push(['Tidak Pasti / Unsure', tagStats.unsure, `${((tagStats.unsure / filteredVoters.length) * 100).toFixed(1)}%`])
    summaryData.push(['Tidak / No', tagStats.no, `${((tagStats.no / filteredVoters.length) * 100).toFixed(1)}%`])
    summaryData.push(['Tidak Ditag / Untagged', tagStats.untagged, `${((tagStats.untagged / filteredVoters.length) * 100).toFixed(1)}%`])
    summaryData.push(['JUMLAH / TOTAL', filteredVoters.length, '100.0%'])
    summaryData.push([])

    summaryData.push(['RINGKASAN / SUMMARY'])
    summaryData.push(['Jumlah Pengundi / Total Voters:', filteredVoters.length])
    summaryData.push(['Bilangan DUN / Number of DUNs:', Object.keys(dunBreakdown).length])
    summaryData.push(['Bilangan Daerah / Number of Districts:', Object.keys(daerahBreakdown).length])
    summaryData.push(['Bilangan Lokaliti / Number of Localities:', Object.keys(lokalitiBreakdown).length])
    summaryData.push(['Nisbah L:P / M:F Ratio:', `${(maleCount / femaleCount).toFixed(2)}:1`])
    summaryData.push(['Umur Purata / Average Age:', `${avgAge} tahun / years`])

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData)
    wsSummary['!cols'] = [
      { wch: 50 },
      { wch: 20 },
      { wch: 20 }
    ]
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan Summary')

    // SHEET 2: VOTER DATA
    const voterData: any[][] = []
    voterData.push(['BIL', 'NO K/P', 'NO K/P ID LAIN', 'JANTINA', 'TAHUN LAHIR', 'UMUR', 'NAMA PEMILIH', 'KOD DAERAH', 'DAERAH MENGUNDI', 'KOD LOKALITI', 'LOKALITI', 'DUN', 'TAG'])
    
    filteredVoters.forEach(voter => {
      const age = calculateAge(voter.tahun_lahir)
      voterData.push([
        voter.bil,
        voter.no_kp,
        voter.no_kp_id_lain || '',
        voter.jantina,
        voter.tahun_lahir,
        age,
        voter.nama_pemilih,
        voter.kod_daerah_mengundi,
        voter.daerah_mengundi,
        voter.kod_lokaliti,
        voter.lokaliti,
        voter.dun || '',
        voter.tag || ''
      ])
    })

    const wsVoters = XLSX.utils.aoa_to_sheet(voterData)
    wsVoters['!cols'] = [
      { wch: 8 },   // BIL
      { wch: 15 },  // NO K/P
      { wch: 15 },  // NO K/P ID LAIN
      { wch: 8 },   // JANTINA
      { wch: 12 },  // TAHUN LAHIR
      { wch: 8 },   // UMUR
      { wch: 35 },  // NAMA PEMILIH
      { wch: 12 },  // KOD DAERAH
      { wch: 25 },  // DAERAH MENGUNDI
      { wch: 12 },  // KOD LOKALITI
      { wch: 25 },  // LOKALITI
      { wch: 20 },  // DUN
      { wch: 10 }   // TAG
    ]
    XLSX.utils.book_append_sheet(wb, wsVoters, 'Data Pengundi Voters')

    // Download
    const date = new Date().toISOString().slice(0, 10)
    const dunFilter = user?.dun ? `_${user.dun.replace(/[^a-zA-Z0-9]/g, '_')}` : ''
    const filename = `Laporan_Pengundi${dunFilter}_${date}.xlsx`
    
    XLSX.writeFile(wb, filename)
    
    alert(`✅ Eksport berjaya!\n\nJumlah rekod: ${filteredVoters.length.toLocaleString()}\nFail: ${filename}\n\nDibuka dalam 2 sheet:\n1. Ringkasan (Summary)\n2. Data Pengundi (Voters)`)
  }

  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentVoters = filteredVoters.slice(indexOfFirstItem, indexOfLastItem)
  const totalPages = Math.ceil(filteredVoters.length / itemsPerPage)

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading voter data...</p>
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
          <FilterPanel
            filters={filters}
            onFilterChange={handleFilterChange}
            onSearch={applyFilters}
            onReset={resetFilters}
            daerahOptions={daerahOptions}
            lokalitiOptions={lokalitiOptions}
            dunOptions={dunOptions}
          />

          <Statistics voters={filteredVoters} />

          {/* Export Buttons */}
          <div className="flex justify-end gap-3">
            <button 
              onClick={exportToCSVWithSummary} 
              className="btn-secondary flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>📥 Export CSV</span>
            </button>
            
            <button 
              onClick={exportToExcelWithSummary} 
              className="btn-primary flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>📊 Eksport ke Excel / Export to Excel</span>
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <VoterTable 
              voters={currentVoters} 
              onTagUpdate={handleTagUpdate}  
              canUpdate={canUpdateVoters} 
            />

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
                      Showing <span className="font-medium">{indexOfFirstItem + 1}</span> to{' '}
                      <span className="font-medium">{Math.min(indexOfLastItem, filteredVoters.length)}</span> of{' '}
                      <span className="font-medium">{filteredVoters.length}</span> results
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
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
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
      </DashboardLayout>
    </ProtectedRoute>
  )
}