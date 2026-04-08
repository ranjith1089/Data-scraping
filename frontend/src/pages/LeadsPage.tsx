import { useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Upload } from 'lucide-react'
import LeadTable from '@/components/leads/LeadTable'
import LeadFilters from '@/components/leads/LeadFilters'
import LeadDrawer from '@/components/leads/LeadDrawer'
import ImportCSVModal from '@/components/leads/ImportCSVModal'
import type { LeadFilterValues } from '@/components/leads/LeadFilters'
import { useLeads } from '@/hooks/useLeads'

export default function LeadsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [showImport, setShowImport] = useState(false)

  // Read basic counts from leads query
  const { data } = useLeads({
    search: searchParams.get('search') || undefined,
    sector_code: searchParams.get('sector_code') || undefined,
    stage: searchParams.get('stage') || undefined,
    page: 1,
    per_page: 1,
  })

  const handleFilterChange = useCallback(
    (filters: LeadFilterValues) => {
      const next = new URLSearchParams()

      if (filters.search) next.set('search', filters.search)
      if (filters.sectors && filters.sectors.length > 0) {
        next.set('sector_code', filters.sectors[0])
      }
      if (filters.stages && filters.stages.length > 0) {
        next.set('stage', filters.stages[0])
      }
      if (filters.min_score && filters.min_score > 0) {
        next.set('min_score', String(filters.min_score))
      }
      if (filters.max_score !== undefined && filters.max_score < 100) {
        next.set('max_score', String(filters.max_score))
      }
      if (filters.district) next.set('district', filters.district)
      if (filters.company_sizes && filters.company_sizes.length > 0) {
        next.set('company_size', filters.company_sizes[0])
      }

      // Preserve page size
      const perPage = searchParams.get('per_page')
      if (perPage) next.set('per_page', perPage)

      next.set('page', '1')
      setSearchParams(next)
    },
    [searchParams, setSearchParams]
  )

  const handleOpenDrawer = useCallback((id: string) => {
    setSelectedLeadId(id)
  }, [])

  const handleCloseDrawer = useCallback(() => {
    setSelectedLeadId(null)
  }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          {data?.total !== undefined && (
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-sm font-medium text-gray-600">
              {data.total.toLocaleString('en-IN')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <Upload className="h-4 w-4" />
            Import CSV
          </button>
          <button className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700">
            <Plus className="h-4 w-4" />
            Add Lead
          </button>
        </div>
      </div>

      {/* Filters */}
      <LeadFilters onFilterChange={handleFilterChange} />

      {/* Lead Table */}
      <LeadTable onOpenDrawer={handleOpenDrawer} />

      {/* Lead Drawer */}
      {selectedLeadId && (
        <LeadDrawer leadId={selectedLeadId} onClose={handleCloseDrawer} />
      )}

      {/* Import CSV Modal */}
      {showImport && <ImportCSVModal onClose={() => setShowImport(false)} />}
    </div>
  )
}
