import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  Search,
  SlidersHorizontal,
  X,
  ChevronDown,
  Check,
} from 'lucide-react'
import {
  cn,
  SECTOR_COLORS,
  SECTOR_NAMES,
  STAGE_COLORS,
  STAGE_LABELS,
} from '@/lib/utils'

export interface LeadFilterValues {
  search?: string
  sectors?: string[]
  stages?: string[]
  min_score?: number
  max_score?: number
  district?: string
  company_sizes?: string[]
  icp_fits?: string[]
}

interface LeadFiltersProps {
  onFilterChange: (filters: LeadFilterValues) => void
  districts?: string[]
}

const COMPANY_SIZES = [
  { value: '1-10', label: 'Micro (1-10)' },
  { value: '11-50', label: 'Small (11-50)' },
  { value: '51-200', label: 'Medium (51-200)' },
  { value: '201-500', label: 'Large (201-500)' },
  { value: '501+', label: 'Enterprise (501+)' },
]

const ICP_OPTIONS = [
  { value: 'excellent', label: 'Excellent' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Poor' },
]

export default function LeadFilters({ onFilterChange, districts = [] }: LeadFiltersProps) {
  const [filters, setFilters] = useState<LeadFilterValues>({
    search: '',
    sectors: [],
    stages: [],
    min_score: 0,
    max_score: 100,
    district: '',
    company_sizes: [],
    icp_fits: [],
  })
  const [districtSearch, setDistrictSearch] = useState('')
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced search
  const handleSearchChange = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, search: value }))
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onFilterChange({ ...filters, search: value })
    }, 300)
  }, [filters, onFilterChange])

  // Apply filters immediately for non-search changes
  const updateFilter = useCallback(<K extends keyof LeadFilterValues>(
    key: K,
    value: LeadFilterValues[K]
  ) => {
    const next = { ...filters, [key]: value }
    setFilters(next)
    onFilterChange(next)
  }, [filters, onFilterChange])

  function toggleArrayItem(key: 'sectors' | 'stages' | 'company_sizes' | 'icp_fits', value: string) {
    const arr = filters[key] || []
    const next = arr.includes(value)
      ? arr.filter((v) => v !== value)
      : [...arr, value]
    updateFilter(key, next)
  }

  function clearAll() {
    const cleared: LeadFilterValues = {
      search: '',
      sectors: [],
      stages: [],
      min_score: 0,
      max_score: 100,
      district: '',
      company_sizes: [],
      icp_fits: [],
    }
    setFilters(cleared)
    onFilterChange(cleared)
  }

  const appliedPills = useMemo(() => {
    const pills: { key: string; label: string; onRemove: () => void }[] = []

    if (filters.search) {
      pills.push({
        key: 'search',
        label: `Search: "${filters.search}"`,
        onRemove: () => { handleSearchChange('') },
      })
    }
    for (const s of filters.sectors || []) {
      pills.push({
        key: `sector-${s}`,
        label: SECTOR_NAMES[s] || s,
        onRemove: () => toggleArrayItem('sectors', s),
      })
    }
    for (const s of filters.stages || []) {
      pills.push({
        key: `stage-${s}`,
        label: STAGE_LABELS[s] || s,
        onRemove: () => toggleArrayItem('stages', s),
      })
    }
    if (filters.min_score && filters.min_score > 0) {
      pills.push({
        key: 'min_score',
        label: `Score >= ${filters.min_score}`,
        onRemove: () => updateFilter('min_score', 0),
      })
    }
    if (filters.max_score !== undefined && filters.max_score < 100) {
      pills.push({
        key: 'max_score',
        label: `Score <= ${filters.max_score}`,
        onRemove: () => updateFilter('max_score', 100),
      })
    }
    if (filters.district) {
      pills.push({
        key: 'district',
        label: `District: ${filters.district}`,
        onRemove: () => updateFilter('district', ''),
      })
    }
    for (const s of filters.company_sizes || []) {
      pills.push({
        key: `size-${s}`,
        label: `Size: ${s}`,
        onRemove: () => toggleArrayItem('company_sizes', s),
      })
    }
    for (const f of filters.icp_fits || []) {
      pills.push({
        key: `icp-${f}`,
        label: `ICP: ${f}`,
        onRemove: () => toggleArrayItem('icp_fits', f),
      })
    }
    return pills
  }, [filters])

  const filteredDistricts = useMemo(() => {
    if (!districtSearch) return districts
    return districts.filter((d) =>
      d.toLowerCase().includes(districtSearch.toLowerCase())
    )
  }, [districts, districtSearch])

  const hasFilters = appliedPills.length > 0

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!openDropdown) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-dropdown]')) {
        setOpenDropdown(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [openDropdown])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search leads..."
            value={filters.search || ''}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          {filters.search && (
            <button
              onClick={() => handleSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Sector Dropdown */}
        <div className="relative" data-dropdown>
          <button
            onClick={() => setOpenDropdown(openDropdown === 'sector' ? null : 'sector')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
              (filters.sectors?.length || 0) > 0
                ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            )}
          >
            Sector {(filters.sectors?.length || 0) > 0 && <span className="rounded-full bg-indigo-600 px-1.5 text-xs text-white">{filters.sectors!.length}</span>}
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {openDropdown === 'sector' && (
            <div className="absolute left-0 z-30 mt-1 w-64 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              {Object.entries(SECTOR_NAMES).map(([code, name]) => (
                <button
                  key={code}
                  onClick={() => toggleArrayItem('sectors', code)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-gray-50"
                >
                  <div
                    className={cn(
                      'flex h-4 w-4 items-center justify-center rounded border',
                      filters.sectors?.includes(code)
                        ? 'border-indigo-600 bg-indigo-600'
                        : 'border-gray-300'
                    )}
                  >
                    {filters.sectors?.includes(code) && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: SECTOR_COLORS[code] }}
                  />
                  <span className="text-gray-700">{name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Stage Dropdown */}
        <div className="relative" data-dropdown>
          <button
            onClick={() => setOpenDropdown(openDropdown === 'stage' ? null : 'stage')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
              (filters.stages?.length || 0) > 0
                ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            )}
          >
            Stage {(filters.stages?.length || 0) > 0 && <span className="rounded-full bg-indigo-600 px-1.5 text-xs text-white">{filters.stages!.length}</span>}
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {openDropdown === 'stage' && (
            <div className="absolute left-0 z-30 mt-1 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              {Object.entries(STAGE_LABELS).map(([code, name]) => (
                <button
                  key={code}
                  onClick={() => toggleArrayItem('stages', code)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-gray-50"
                >
                  <div
                    className={cn(
                      'flex h-4 w-4 items-center justify-center rounded border',
                      filters.stages?.includes(code)
                        ? 'border-indigo-600 bg-indigo-600'
                        : 'border-gray-300'
                    )}
                  >
                    {filters.stages?.includes(code) && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: STAGE_COLORS[code] }}
                  />
                  <span className="text-gray-700">{name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Score Range */}
        <div className="relative" data-dropdown>
          <button
            onClick={() => setOpenDropdown(openDropdown === 'score' ? null : 'score')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
              (filters.min_score && filters.min_score > 0) || (filters.max_score !== undefined && filters.max_score < 100)
                ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            )}
          >
            Score
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {openDropdown === 'score' && (
            <div className="absolute left-0 z-30 mt-1 w-72 rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
              <p className="mb-3 text-xs font-medium text-gray-500">Score Range: {filters.min_score} - {filters.max_score}</p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500">Min Score</label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={filters.min_score || 0}
                    onChange={(e) => updateFilter('min_score', Number(e.target.value))}
                    className="mt-1 w-full accent-indigo-600"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Max Score</label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={filters.max_score ?? 100}
                    onChange={(e) => updateFilter('max_score', Number(e.target.value))}
                    className="mt-1 w-full accent-indigo-600"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* District */}
        <div className="relative" data-dropdown>
          <button
            onClick={() => setOpenDropdown(openDropdown === 'district' ? null : 'district')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
              filters.district
                ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            )}
          >
            District
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {openDropdown === 'district' && (
            <div className="absolute left-0 z-30 mt-1 w-60 rounded-lg border border-gray-200 bg-white shadow-lg">
              <div className="border-b border-gray-100 p-2">
                <input
                  type="text"
                  placeholder="Search districts..."
                  value={districtSearch}
                  onChange={(e) => setDistrictSearch(e.target.value)}
                  className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div className="max-h-48 overflow-y-auto py-1">
                {filteredDistricts.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-gray-400">No districts found</p>
                ) : (
                  filteredDistricts.map((d) => (
                    <button
                      key={d}
                      onClick={() => { updateFilter('district', d); setOpenDropdown(null) }}
                      className={cn(
                        'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50',
                        filters.district === d && 'bg-indigo-50 text-indigo-700'
                      )}
                    >
                      {filters.district === d && <Check className="h-3.5 w-3.5" />}
                      {d}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Company Size */}
        <div className="relative" data-dropdown>
          <button
            onClick={() => setOpenDropdown(openDropdown === 'size' ? null : 'size')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
              (filters.company_sizes?.length || 0) > 0
                ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            )}
          >
            Size {(filters.company_sizes?.length || 0) > 0 && <span className="rounded-full bg-indigo-600 px-1.5 text-xs text-white">{filters.company_sizes!.length}</span>}
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {openDropdown === 'size' && (
            <div className="absolute left-0 z-30 mt-1 w-52 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              {COMPANY_SIZES.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => toggleArrayItem('company_sizes', opt.value)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-gray-50"
                >
                  <div
                    className={cn(
                      'flex h-4 w-4 items-center justify-center rounded border',
                      filters.company_sizes?.includes(opt.value)
                        ? 'border-indigo-600 bg-indigo-600'
                        : 'border-gray-300'
                    )}
                  >
                    {filters.company_sizes?.includes(opt.value) && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <span className="text-gray-700">{opt.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ICP Match */}
        <div className="relative" data-dropdown>
          <button
            onClick={() => setOpenDropdown(openDropdown === 'icp' ? null : 'icp')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
              (filters.icp_fits?.length || 0) > 0
                ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            )}
          >
            ICP {(filters.icp_fits?.length || 0) > 0 && <span className="rounded-full bg-indigo-600 px-1.5 text-xs text-white">{filters.icp_fits!.length}</span>}
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {openDropdown === 'icp' && (
            <div className="absolute left-0 z-30 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              {ICP_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => toggleArrayItem('icp_fits', opt.value)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-gray-50"
                >
                  <div
                    className={cn(
                      'flex h-4 w-4 items-center justify-center rounded border',
                      filters.icp_fits?.includes(opt.value)
                        ? 'border-indigo-600 bg-indigo-600'
                        : 'border-gray-300'
                    )}
                  >
                    {filters.icp_fits?.includes(opt.value) && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <span className="capitalize text-gray-700">{opt.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Clear All */}
        {hasFilters && (
          <button
            onClick={clearAll}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-3.5 w-3.5" />
            Clear All
          </button>
        )}
      </div>

      {/* Applied Filter Pills */}
      {appliedPills.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {appliedPills.map((pill) => (
            <span
              key={pill.key}
              className="inline-flex items-center gap-1 rounded-full bg-indigo-50 py-1 pl-3 pr-1.5 text-xs font-medium text-indigo-700"
            >
              {pill.label}
              <button
                onClick={pill.onRemove}
                className="rounded-full p-0.5 hover:bg-indigo-100"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
