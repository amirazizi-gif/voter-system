"use client";

import { VoterFilters } from "@/lib/supabase";
import { ChangeEvent, FormEvent, useState } from "react";

interface FilterPanelProps {
  filters: VoterFilters;
  onFilterChange: (filters: VoterFilters) => void;
  onSearch: () => void;
  onReset: () => void;
  daerahOptions: string[];
  lokalitiOptions: string[];
  dunOptions: string[];
}

export default function FilterPanel({
  filters,
  onFilterChange,
  onSearch,
  onReset,
  daerahOptions,
  lokalitiOptions,
  dunOptions,
}: FilterPanelProps) {
  const [showDaerahDropdown, setShowDaerahDropdown] = useState(false);
  const [showLokalitiDropdown, setShowLokalitiDropdown] = useState(false);
  const [showDunDropdown, setShowDunDropdown] = useState(false);

  const handleInputChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    onFilterChange({
      ...filters,
      [name]: value === "" ? undefined : value,
    });
  };

  const handleDaerahToggle = (daerah: string) => {
    const currentDaerahs = filters.daerah || [];
    const newDaerahs = currentDaerahs.includes(daerah)
      ? currentDaerahs.filter((d) => d !== daerah)
      : [...currentDaerahs, daerah];

    onFilterChange({
      ...filters,
      daerah: newDaerahs.length > 0 ? newDaerahs : undefined,
    });
  };

  const handleLokalitiToggle = (lokaliti: string) => {
    const currentLokalitis = filters.lokaliti || [];
    const newLokalitis = currentLokalitis.includes(lokaliti)
      ? currentLokalitis.filter((l) => l !== lokaliti)
      : [...currentLokalitis, lokaliti];

    onFilterChange({
      ...filters,
      lokaliti: newLokalitis.length > 0 ? newLokalitis : undefined,
    });
  };

  const handleDunToggle = (dun: string) => {
    const currentDuns = filters.dun || [];
    const newDuns = currentDuns.includes(dun)
      ? currentDuns.filter((d) => d !== dun)
      : [...currentDuns, dun];

    onFilterChange({
      ...filters,
      dun: newDuns.length > 0 ? newDuns : undefined,
    });
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSearch();
  };

  const selectedDaerahCount = filters.daerah?.length || 0;
  const selectedLokalitiCount = filters.lokaliti?.length || 0;
  const selectedDunCount = filters.dun?.length || 0;

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
              value={filters.nameSearch || ""}
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
              value={filters.gender || ""}
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
              value={filters.ageGroup || ""}
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
              value={filters.specificAge || ""}
              onChange={handleInputChange}
              placeholder="Enter age..."
              min="18"
              max="120"
              className="input-field"
            />
          </div>

          {/* DUN Filter - Multi-select (NEW - HIGHLIGHTED) */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <span className="bg-yellow-200 px-2 py-1 rounded">
                🏛️ DUN Area
              </span>{" "}
              {selectedDunCount > 0 && `(${selectedDunCount})`}
            </label>
            <button
              type="button"
              onClick={() => setShowDunDropdown(!showDunDropdown)}
              className="input-field text-left flex justify-between items-center border-2 border-yellow-400"
            >
              <span className="truncate font-medium">
                {selectedDunCount === 0
                  ? "Select DUN area..."
                  : selectedDunCount === 1
                  ? filters.dun![0]
                  : `${selectedDunCount} areas selected`}
              </span>
              <span>▼</span>
            </button>
            {showDunDropdown && (
              <div className="absolute z-10 w-full mt-1 bg-white border-2 border-yellow-400 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                <div className="p-2 bg-yellow-50">
                  <div className="text-xs text-yellow-800 font-medium mb-2 px-2">
                    📍 DUN (Dewan Undangan Negeri)
                  </div>
                  {dunOptions.length === 0 ? (
                    <div className="text-sm text-gray-500 p-2">
                      No DUN data available. Please add DUN column to database.
                    </div>
                  ) : (
                    dunOptions.map((dun) => (
                      <label
                        key={dun}
                        className="flex items-center p-2 hover:bg-yellow-100 cursor-pointer rounded"
                      >
                        <input
                          type="checkbox"
                          checked={filters.dun?.includes(dun) || false}
                          onChange={() => handleDunToggle(dun)}
                          className="mr-2 h-4 w-4 text-yellow-600 rounded"
                        />
                        <span className="text-sm font-medium">{dun}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Daerah Filter - Multi-select */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Daerah Mengundi{" "}
              {selectedDaerahCount > 0 && `(${selectedDaerahCount})`}
            </label>
            <button
              type="button"
              onClick={() => setShowDaerahDropdown(!showDaerahDropdown)}
              className="input-field text-left flex justify-between items-center"
            >
              <span className="truncate">
                {selectedDaerahCount === 0
                  ? "Select daerah..."
                  : `${selectedDaerahCount} selected`}
              </span>
              <span>▼</span>
            </button>
            {showDaerahDropdown && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                <div className="p-2">
                  {daerahOptions.map((daerah) => (
                    <label
                      key={daerah}
                      className="flex items-center p-2 hover:bg-gray-50 cursor-pointer rounded"
                    >
                      <input
                        type="checkbox"
                        checked={filters.daerah?.includes(daerah) || false}
                        onChange={() => handleDaerahToggle(daerah)}
                        className="mr-2 h-4 w-4 text-blue-600 rounded"
                      />
                      <span className="text-sm">{daerah}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Lokaliti Filter - Multi-select */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Lokaliti{" "}
              {selectedLokalitiCount > 0 && `(${selectedLokalitiCount})`}
            </label>
            <button
              type="button"
              onClick={() => setShowLokalitiDropdown(!showLokalitiDropdown)}
              className="input-field text-left flex justify-between items-center"
            >
              <span className="truncate">
                {selectedLokalitiCount === 0
                  ? "Select lokaliti..."
                  : `${selectedLokalitiCount} selected`}
              </span>
              <span>▼</span>
            </button>
            {showLokalitiDropdown && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                <div className="p-2">
                  {lokalitiOptions.map((lokaliti) => (
                    <label
                      key={lokaliti}
                      className="flex items-center p-2 hover:bg-gray-50 cursor-pointer rounded"
                    >
                      <input
                        type="checkbox"
                        checked={filters.lokaliti?.includes(lokaliti) || false}
                        onChange={() => handleLokalitiToggle(lokaliti)}
                        className="mr-2 h-4 w-4 text-blue-600 rounded"
                      />
                      <span className="text-sm">{lokaliti}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Tag Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tag Status
            </label>
            <select
              name="tag"
              value={filters.tag || ""}
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
  );
}
