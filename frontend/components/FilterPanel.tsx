'use client'

import { VoterFilters } from '@/lib/supabase'
import { ChangeEvent, FormEvent } from 'react'

interface FilterPanelProps {
  filters: VoterFilters
  onFilterChange: (filters: VoterFilters) => void
  onSearch: () => void
  onReset: () => void
  daerahOptions: string[]
  lokalitiOptions: string[]
}

export default function FilterPanel({
  filters,
  onFilterChange,
  onSearch,
  onReset,
  daerahOptions,
  lokalitiOptions,
}: FilterPanelProps) {
  const handleInputChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    onFilterChange({
      ...filters,
      [name]: value === '' ? undefined : value,
    })
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    onSearch()
  }

  return (
    <div className="card mb-6">
      <h2 className="text-xl font-bold mb-4 flex items-center">
        <span className="mr-2">🔍</span>
        Filters
      </h2>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          {/* Name Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search by Name
            </label>
            <input
              type="text"
              name="nameSearch"
              value={filters.nameSearch || ''}
              onChange={handleInputChange}
              placeholder="Enter name..."
              className="input-field"
            />
          </div>

          {/* Gender Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Gender
            </label>
            <select
              name="gender"
              value={filters.gender || ''}
              onChange={handleInputChange}
              className="input-field"
            >
              <option value="">All</option>
              <option value="L">Male (Lelaki)</option>
              <option value="P">Female (Perempuan)</option>
            </select>
          </div>

          {/* Age Group Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Age Group
            </label>
            <select
              name="ageGroup"
              value={filters.ageGroup || ''}
              onChange={handleInputChange}
              className="input-field"
            >
              <option value="">All</option>
              <option value="18-30">18-30 years</option>
              <option value="30-40">30-40 years</option>
              <option value="40-55">40-55 years</option>
              <option value="55+">Above 55 years</option>
            </select>
          </div>

          {/* Specific Age */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Specific Age
            </label>
            <input
              type="number"
              name="specificAge"
              value={filters.specificAge || ''}
              onChange={handleInputChange}
              placeholder="Enter age..."
              min="18"
              max="120"
              className="input-field"
            />
          </div>

          {/* Daerah Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Daerah Mengundi
            </label>
            <select
              name="daerah"
              value={filters.daerah || ''}
              onChange={handleInputChange}
              className="input-field"
            >
              <option value="">All</option>
              {daerahOptions.map((daerah) => (
                <option key={daerah} value={daerah}>
                  {daerah}
                </option>
              ))}
            </select>
          </div>

          {/* Lokaliti Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Lokaliti
            </label>
            <select
              name="lokaliti"
              value={filters.lokaliti || ''}
              onChange={handleInputChange}
              className="input-field"
            >
              <option value="">All</option>
              {lokalitiOptions.map((lokaliti) => (
                <option key={lokaliti} value={lokaliti}>
                  {lokaliti}
                </option>
              ))}
            </select>
          </div>

          {/* Tag Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tag Status
            </label>
            <select
              name="tag"
              value={filters.tag || ''}
              onChange={handleInputChange}
              className="input-field"
            >
              <option value="">All</option>
              <option value="Yes">Yes</option>
              <option value="Unsure">Unsure</option>
              <option value="No">No</option>
              <option value="untagged">Untagged</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" className="btn-primary">
            <span className="mr-2">🔍</span>
            Search
          </button>
          <button type="button" onClick={onReset} className="btn-secondary">
            <span className="mr-2">🔄</span>
            Reset
          </button>
        </div>
      </form>
    </div>
  )
}