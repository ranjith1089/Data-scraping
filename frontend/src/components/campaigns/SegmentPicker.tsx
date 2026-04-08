import { useState, useEffect, useCallback, useRef } from 'react'
import { Users, Check, Search, X, Loader2 } from 'lucide-react'
import { cn, SECTOR_COLORS, SECTOR_NAMES, COMPANY_SIZE_OPTIONS } from '@/lib/utils'
import api from '@/lib/api'

export interface SegmentFilters {
  sectors: string[]
  company_sizes: string[]
  districts: string[]
  min_score: number
  max_score: number
}

interface SegmentPickerProps {
  value: SegmentFilters
  onChange: (filters: SegmentFilters) => void
}

const TN_DISTRICTS = [
  'Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem',
  'Tirunelveli', 'Tiruppur', 'Erode', 'Vellore', 'Thoothukudi',
  'Dindigul', 'Thanjavur', 'Ranipet', 'Sivaganga', 'Karur',
  'Kanyakumari', 'Theni', 'Krishnagiri', 'Namakkal', 'Cuddalore',
  'Nagapattinam', 'Virudhunagar', 'Villupuram', 'Tiruvannamalai',
  'Dharmapuri', 'Perambalur', 'Pudukkottai', 'Ramanathapuram',
  'Ariyalur', 'Nilgiris', 'Kallakurichi', 'Chengalpattu',
  'Kanchipuram', 'Tiruvallur', 'Tenkasi', 'Mayiladuthurai',
  'Tirupattur',
]

export default function SegmentPicker({ value, onChange }: SegmentPickerProps) {
  const [matchCount, setMatchCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [districtSearch, setDistrictSearch] = useState('')
  const [showDistrictDropdown, setShowDistrictDropdown] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  function update(patch: Partial<SegmentFilters>) {
    onChange({ ...value, ...patch })
  }

  function toggleSector(code: string) {
    const next = value.sectors.includes(code)
      ? value.sectors.filter((s) => s !== code)
      : [...value.sectors, code]
    update({ sectors: next })
  }

  function toggleSize(size: string) {
    const next = value.company_sizes.includes(size)
      ? value.company_sizes.filter((s) => s !== size)
      : [...value.company_sizes, size]
    update({ company_sizes: next })
  }

  function toggleDistrict(d: string) {
    const next = value.districts.includes(d)
      ? value.districts.filter((x) => x !== d)
      : [...value.districts, d]
    update({ districts: next })
  }

  const fetchCount = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (value.sectors.length) params.sector_code = value.sectors.join(',')
      if (value.company_sizes.length) params.company_size = value.company_sizes.join(',')
      if (value.districts.length) params.district = value.districts.join(',')
      if (value.min_score > 0) params.min_score = String(value.min_score)
      if (value.max_score < 100) params.max_score = String(value.max_score)
      const { data } = await api.get('/leads/', { params: { ...params, per_page: 1 } })
      setMatchCount(data.total)
    } catch {
      setMatchCount(null)
    } finally {
      setLoading(false)
    }
  }, [value])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(fetchCount, 500)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [fetchCount])

  const filteredDistricts = districtSearch
    ? TN_DISTRICTS.filter((d) =>
        d.toLowerCase().includes(districtSearch.toLowerCase())
      )
    : TN_DISTRICTS

  return (
    <div className="space-y-6">
      {/* Live Count Badge */}
      <div className="flex items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3">
        <Users className="h-5 w-5 text-indigo-600" />
        <div>
          <p className="text-sm font-semibold text-indigo-900">
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Counting...
              </span>
            ) : matchCount !== null ? (
              <>~{matchCount.toLocaleString('en-IN')} leads match</>
            ) : (
              'Select filters to see matching leads'
            )}
          </p>
          <p className="text-xs text-indigo-600">Based on current segment filters</p>
        </div>
      </div>

      {/* Sectors */}
      <div>
        <label className="mb-3 block text-sm font-semibold text-gray-900">
          Target Sectors
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {Object.entries(SECTOR_NAMES).map(([code, name]) => {
            const selected = value.sectors.includes(code)
            return (
              <button
                key={code}
                onClick={() => toggleSector(code)}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-all',
                  selected
                    ? 'border-indigo-300 bg-indigo-50 text-indigo-800 ring-1 ring-indigo-200'
                    : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                )}
              >
                <div
                  className={cn(
                    'flex h-4 w-4 items-center justify-center rounded border',
                    selected ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300'
                  )}
                >
                  {selected && <Check className="h-3 w-3 text-white" />}
                </div>
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: SECTOR_COLORS[code] }}
                />
                {name}
              </button>
            )
          })}
        </div>
      </div>

      {/* Company Size */}
      <div>
        <label className="mb-3 block text-sm font-semibold text-gray-900">
          Company Size
        </label>
        <div className="flex flex-wrap gap-2">
          {COMPANY_SIZE_OPTIONS.map((opt) => {
            const selected = value.company_sizes.includes(opt.value)
            return (
              <button
                key={opt.value}
                onClick={() => toggleSize(opt.value)}
                className={cn(
                  'rounded-lg border px-3 py-2 text-sm font-medium transition-all',
                  selected
                    ? 'border-indigo-300 bg-indigo-50 text-indigo-800'
                    : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                )}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Districts */}
      <div>
        <label className="mb-3 block text-sm font-semibold text-gray-900">
          Districts
        </label>
        {/* Selected districts */}
        {value.districts.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {value.districts.map((d) => (
              <span
                key={d}
                className="inline-flex items-center gap-1 rounded-full bg-indigo-50 py-1 pl-2.5 pr-1.5 text-xs font-medium text-indigo-700"
              >
                {d}
                <button
                  onClick={() => toggleDistrict(d)}
                  className="rounded-full p-0.5 hover:bg-indigo-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        {/* Search / dropdown */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search districts..."
            value={districtSearch}
            onChange={(e) => setDistrictSearch(e.target.value)}
            onFocus={() => setShowDistrictDropdown(true)}
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          {showDistrictDropdown && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowDistrictDropdown(false)}
              />
              <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                {filteredDistricts.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-gray-400">No districts found</p>
                ) : (
                  filteredDistricts.map((d) => (
                    <button
                      key={d}
                      onClick={() => {
                        toggleDistrict(d)
                        setDistrictSearch('')
                      }}
                      className={cn(
                        'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50',
                        value.districts.includes(d) && 'bg-indigo-50 text-indigo-700'
                      )}
                    >
                      <div
                        className={cn(
                          'flex h-4 w-4 items-center justify-center rounded border',
                          value.districts.includes(d)
                            ? 'border-indigo-600 bg-indigo-600'
                            : 'border-gray-300'
                        )}
                      >
                        {value.districts.includes(d) && (
                          <Check className="h-3 w-3 text-white" />
                        )}
                      </div>
                      {d}
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Score Range */}
      <div>
        <label className="mb-3 block text-sm font-semibold text-gray-900">
          AI Score Range
        </label>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700">
              {value.min_score} - {value.max_score}
            </span>
            <span className="text-xs text-gray-500">out of 100</span>
          </div>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-gray-500">Minimum Score</label>
              <input
                type="range"
                min={0}
                max={100}
                value={value.min_score}
                onChange={(e) =>
                  update({
                    min_score: Math.min(Number(e.target.value), value.max_score),
                  })
                }
                className="w-full accent-indigo-600"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Maximum Score</label>
              <input
                type="range"
                min={0}
                max={100}
                value={value.max_score}
                onChange={(e) =>
                  update({
                    max_score: Math.max(Number(e.target.value), value.min_score),
                  })
                }
                className="w-full accent-indigo-600"
              />
            </div>
          </div>
          {/* Visual score bar */}
          <div className="mt-3 h-2 w-full rounded-full bg-gray-200">
            <div
              className="h-2 rounded-full bg-indigo-500"
              style={{
                marginLeft: `${value.min_score}%`,
                width: `${value.max_score - value.min_score}%`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
