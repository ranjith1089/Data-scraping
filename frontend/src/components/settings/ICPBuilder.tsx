import React, { useState, useEffect, useCallback, KeyboardEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { cn, SECTOR_NAMES, formatINR } from '@/lib/utils'
import { Target, Save, Loader2, X, CheckCircle2 } from 'lucide-react'

const SECTORS = Object.entries(SECTOR_NAMES)

const COMPANY_SIZES = [
  { value: 'micro', label: 'Micro (1-10)' },
  { value: 'small', label: 'Small (11-50)' },
  { value: 'medium', label: 'Medium (51-200)' },
  { value: 'large', label: 'Large (201-1000)' },
  { value: 'enterprise', label: 'Enterprise (1000+)' },
]

const TN_DISTRICTS = [
  'Chennai',
  'Coimbatore',
  'Madurai',
  'Salem',
  'Trichy',
  'Tirunelveli',
  'Erode',
  'Vellore',
  'Thanjavur',
  'Tiruppur',
]

interface ICPData {
  company_sizes: string[]
  target_districts: string[]
  target_designations: string[]
  revenue_min: number | ''
  revenue_max: number | ''
  description: string
}

const emptyICP: ICPData = {
  company_sizes: [],
  target_districts: [],
  target_designations: [],
  revenue_min: '',
  revenue_max: '',
  description: '',
}

export default function ICPBuilder() {
  const queryClient = useQueryClient()
  const [activeSector, setActiveSector] = useState(SECTORS[0][0])
  const [icpMap, setIcpMap] = useState<Record<string, ICPData>>({})
  const [designationInput, setDesignationInput] = useState('')
  const [saved, setSaved] = useState(false)

  const { data: tenant, isLoading } = useQuery({
    queryKey: ['tenant-current'],
    queryFn: async () => {
      const { data } = await api.get('/tenants/current')
      return data
    },
  })

  // Load existing ICP settings from tenant
  useEffect(() => {
    if (tenant?.settings?.icp) {
      const existing: Record<string, ICPData> = {}
      for (const [sector, val] of Object.entries(tenant.settings.icp)) {
        existing[sector] = { ...emptyICP, ...(val as Partial<ICPData>) }
      }
      setIcpMap(existing)
    }
  }, [tenant])

  const currentICP = icpMap[activeSector] || { ...emptyICP }

  const updateField = useCallback(
    <K extends keyof ICPData>(field: K, value: ICPData[K]) => {
      setIcpMap((prev) => ({
        ...prev,
        [activeSector]: { ...(prev[activeSector] || { ...emptyICP }), [field]: value },
      }))
      setSaved(false)
    },
    [activeSector]
  )

  const toggleArrayItem = useCallback(
    (field: 'company_sizes' | 'target_districts', item: string) => {
      const current = icpMap[activeSector]?.[field] || []
      const next = current.includes(item)
        ? current.filter((v) => v !== item)
        : [...current, item]
      updateField(field, next)
    },
    [activeSector, icpMap, updateField]
  )

  const addDesignation = useCallback(
    (val: string) => {
      const trimmed = val.trim()
      if (!trimmed) return
      const current = currentICP.target_designations
      if (!current.includes(trimmed)) {
        updateField('target_designations', [...current, trimmed])
      }
      setDesignationInput('')
    },
    [currentICP.target_designations, updateField]
  )

  const removeDesignation = useCallback(
    (val: string) => {
      updateField(
        'target_designations',
        currentICP.target_designations.filter((d) => d !== val)
      )
    },
    [currentICP.target_designations, updateField]
  )

  const handleDesignationKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addDesignation(designationInput)
    }
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      await api.patch('/tenants/current', {
        settings: { icp: { [activeSector]: icpMap[activeSector] || emptyICP } },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-current'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <Target className="h-5 w-5 text-gray-400" />
        <h2 className="text-lg font-semibold text-gray-900">
          Ideal Customer Profile
        </h2>
      </div>

      {/* Sector Tabs */}
      <div className="overflow-x-auto">
        <div className="flex gap-1 border-b border-gray-200 pb-px">
          {SECTORS.map(([code, name]) => (
            <button
              key={code}
              onClick={() => {
                setActiveSector(code)
                setDesignationInput('')
              }}
              className={cn(
                'whitespace-nowrap rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors',
                activeSector === code
                  ? 'border-b-2 border-indigo-600 bg-indigo-50/50 text-indigo-700'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              )}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-6">
          {/* Company Size */}
          <div>
            <label className="mb-2.5 block text-sm font-medium text-gray-900">
              Company Size
            </label>
            <div className="flex flex-wrap gap-2">
              {COMPANY_SIZES.map((size) => {
                const active = currentICP.company_sizes.includes(size.value)
                return (
                  <button
                    key={size.value}
                    onClick={() => toggleArrayItem('company_sizes', size.value)}
                    className={cn(
                      'rounded-lg border px-3.5 py-2 text-sm font-medium transition-all',
                      active
                        ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    )}
                  >
                    {size.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Target Districts */}
          <div>
            <label className="mb-2.5 block text-sm font-medium text-gray-900">
              Target Districts
            </label>
            <div className="flex flex-wrap gap-2">
              {TN_DISTRICTS.map((district) => {
                const active = currentICP.target_districts.includes(district)
                return (
                  <button
                    key={district}
                    onClick={() => toggleArrayItem('target_districts', district)}
                    className={cn(
                      'rounded-lg border px-3.5 py-2 text-sm font-medium transition-all',
                      active
                        ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    )}
                  >
                    {district}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Target Designations */}
          <div>
            <label className="mb-2.5 block text-sm font-medium text-gray-900">
              Target Designations
            </label>
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-300 p-2 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20">
              {currentICP.target_designations.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700"
                >
                  {tag}
                  <button
                    onClick={() => removeDesignation(tag)}
                    className="ml-0.5 rounded p-0.5 hover:bg-indigo-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={designationInput}
                onChange={(e) => setDesignationInput(e.target.value)}
                onKeyDown={handleDesignationKeyDown}
                placeholder="Type designation + Enter"
                className="min-w-[180px] flex-1 border-none bg-transparent py-1 text-sm outline-none placeholder:text-gray-400"
              />
            </div>
          </div>

          {/* Revenue Range */}
          <div>
            <label className="mb-2.5 block text-sm font-medium text-gray-900">
              Revenue Range (INR)
            </label>
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-gray-400">
                  ₹
                </span>
                <input
                  type="number"
                  value={currentICP.revenue_min}
                  onChange={(e) =>
                    updateField(
                      'revenue_min',
                      e.target.value === '' ? '' : Number(e.target.value)
                    )
                  }
                  placeholder="Min revenue"
                  className="w-full rounded-lg border border-gray-300 py-2 pl-7 pr-3 text-sm outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <span className="text-sm text-gray-400">to</span>
              <div className="relative flex-1">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-gray-400">
                  ₹
                </span>
                <input
                  type="number"
                  value={currentICP.revenue_max}
                  onChange={(e) =>
                    updateField(
                      'revenue_max',
                      e.target.value === '' ? '' : Number(e.target.value)
                    )
                  }
                  placeholder="Max revenue"
                  className="w-full rounded-lg border border-gray-300 py-2 pl-7 pr-3 text-sm outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="mb-2.5 block text-sm font-medium text-gray-900">
              Description
            </label>
            <textarea
              value={currentICP.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="Describe your ideal customer for this sector..."
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 resize-none"
            />
          </div>

          {/* Save */}
          <div className="flex items-center gap-3 border-t border-gray-100 pt-5">
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save ICP
            </button>
            {saved && (
              <span className="inline-flex items-center gap-1 text-sm font-medium text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                Saved successfully
              </span>
            )}
            {saveMutation.isError && (
              <span className="text-sm text-red-600">
                Failed to save. Please try again.
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
