import { useMemo, useRef, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Search,
  Filter,
  MoreHorizontal,
  Mail,
  Phone,
  ExternalLink,
  Plus,
  Edit,
  Trash2,
  Zap,
  Users,
  Upload,
  Wand2,
} from 'lucide-react'
import { useLeads, useDeleteLead, type Lead } from '@/hooks/useLeads'
import { useEnrichLead } from '@/hooks/useEnrichment'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn, SECTOR_NAMES } from '@/lib/utils'
import LeadDrawer from '@/components/leads/LeadDrawer'
import ImportCSVModal from '@/components/leads/ImportCSVModal'
import AddLeadModal from '@/components/leads/AddLeadModal'
import LeadFilterPanel from '@/components/leads/LeadFilterPanel'

// Reference-style stage-to-"status" mapping — maps backend stage codes to
// the warm/hot/cold/won/lost status visual language used by the reference.
function getStatusForStage(stage: string): 'hot' | 'warm' | 'cold' | 'won' | 'lost' {
  if (stage === 'won') return 'won'
  if (stage === 'lost') return 'lost'
  if (['proposal', 'negotiation'].includes(stage)) return 'hot'
  if (['contacted', 'qualified', 'nurture'].includes(stage)) return 'warm'
  return 'cold'
}

function getStatusColor(status: string) {
  switch (status) {
    case 'hot':
      return 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/20 dark:border-orange-500/30 dark:text-orange-400'
    case 'warm':
      return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:border-amber-500/30 dark:text-amber-400'
    case 'cold':
      return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/20 dark:border-slate-500/30 dark:text-slate-400'
    case 'won':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:border-emerald-500/30 dark:text-emerald-400'
    case 'lost':
      return 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/20 dark:border-rose-500/30 dark:text-rose-400'
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200'
  }
}

function getScoreColor(score: number) {
  if (score >= 80) return 'text-orange-500 font-bold'
  if (score >= 60) return 'text-amber-500 font-medium'
  if (score >= 40) return 'text-slate-600'
  return 'text-muted-foreground'
}

// Allowed page sizes for the per-page selector. The backend caps
// per_page at 200, so any value here must stay <= 200.
const PAGE_SIZE_OPTIONS = [20, 50, 100] as const
const DEFAULT_PAGE_SIZE = 20

export default function LeadsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const filterButtonRef = useRef<HTMLButtonElement>(null)
  const searchTerm = searchParams.get('search') ?? ''

  // Every filter is URL-driven so deep-links and back/forward work.
  const filterValues = {
    sector_code: searchParams.get('sector_code') ?? '',
    stage: searchParams.get('stage') ?? '',
    company_size: searchParams.get('company_size') ?? '',
    min_score: searchParams.get('min_score') ?? '',
    max_score: searchParams.get('max_score') ?? '',
    city: searchParams.get('city') ?? '',
    district: searchParams.get('district') ?? '',
  }
  const activeFilterCount = Object.values(filterValues).filter(Boolean).length

  // Pagination is URL-driven so deep links and back/forward navigation
  // restore the same view. Falls back to page 1 / DEFAULT_PAGE_SIZE if
  // the params are missing or invalid.
  const pageParam = Number(searchParams.get('page'))
  const perPageParam = Number(searchParams.get('per_page'))
  const page =
    Number.isFinite(pageParam) && pageParam >= 1 ? Math.floor(pageParam) : 1
  const perPage = (PAGE_SIZE_OPTIONS as readonly number[]).includes(perPageParam)
    ? perPageParam
    : DEFAULT_PAGE_SIZE

  const { data, isLoading, isError, error, refetch } = useLeads({
    search: searchTerm || undefined,
    sector_code: filterValues.sector_code || undefined,
    stage: filterValues.stage || undefined,
    company_size: filterValues.company_size || undefined,
    min_score: filterValues.min_score ? Number(filterValues.min_score) : undefined,
    max_score: filterValues.max_score ? Number(filterValues.max_score) : undefined,
    city: filterValues.city || undefined,
    district: filterValues.district || undefined,
    page,
    per_page: perPage,
  })

  // Pull a readable message out of whatever axios / FastAPI returned so
  // we can surface the real cause instead of silently falling back to
  // "No leads found" when the query actually errored.
  const errorMessage = isError
    ? (() => {
        const e = error as {
          response?: { status?: number; data?: { detail?: unknown } }
          message?: string
        }
        const d = e?.response?.data?.detail
        if (typeof d === 'string') return d
        if (Array.isArray(d)) {
          return d
            .map((x: { loc?: unknown[]; msg?: string }) => {
              const field = Array.isArray(x?.loc) ? x.loc.slice(1).join('.') : ''
              return field ? `${field}: ${x?.msg ?? ''}` : x?.msg ?? ''
            })
            .filter(Boolean)
            .join('; ') || 'Failed to load leads.'
        }
        if (e?.response?.status) return `Failed to load leads (HTTP ${e.response.status}).`
        return e?.message || 'Failed to load leads.'
      })()
    : null
  const deleteLead = useDeleteLead()
  const enrichLead = useEnrichLead()
  const [enrichingId, setEnrichingId] = useState<string | null>(null)

  async function handleEnrich(leadId: string) {
    setEnrichingId(leadId)
    try {
      const result = await enrichLead.mutateAsync({ leadId })
      if (result.fields_updated.length > 0) {
        toast.success(`Enriched ${result.fields_updated.length} field(s)`)
      } else {
        toast(result.message, { icon: 'ℹ️' })
      }
    } catch {
      toast.error('Enrichment failed')
    } finally {
      setEnrichingId(null)
    }
  }

  const leads = useMemo<Lead[]>(() => data?.items ?? [], [data])
  const total = data?.total ?? 0
  const totalPages = data?.pages ?? Math.max(1, Math.ceil(total / perPage))
  const hasPrev = page > 1
  const hasNext = page < totalPages
  const rangeStart = total === 0 ? 0 : (page - 1) * perPage + 1
  const rangeEnd = total === 0 ? 0 : Math.min(page * perPage, total)

  function updateSearch(value: string) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set('search', value)
    else next.delete('search')
    // Reset to page 1 whenever the search term changes — otherwise we'd
    // ask for page 5 of a 1-page result set and render an empty table.
    next.delete('page')
    setSearchParams(next, { replace: true })
  }

  function goToPage(nextPage: number) {
    const clamped = Math.min(Math.max(1, nextPage), Math.max(1, totalPages))
    const next = new URLSearchParams(searchParams)
    if (clamped <= 1) next.delete('page')
    else next.set('page', String(clamped))
    setSearchParams(next, { replace: false })
  }

  function changePerPage(value: number) {
    const next = new URLSearchParams(searchParams)
    if (value === DEFAULT_PAGE_SIZE) next.delete('per_page')
    else next.set('per_page', String(value))
    // Page-size changes always reset to page 1 — keeping the old page
    // index would land the user past the new last page.
    next.delete('page')
    setSearchParams(next, { replace: true })
  }

  function applyFilters(next: typeof filterValues) {
    const params = new URLSearchParams(searchParams)
    // Preserve search + per_page; reset page because filter changes
    // almost always reshape the result set.
    params.delete('page')
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    setSearchParams(params, { replace: true })
  }

  function clearFilters() {
    const params = new URLSearchParams(searchParams)
    params.delete('page')
    for (const key of Object.keys(filterValues)) {
      params.delete(key)
    }
    setSearchParams(params, { replace: true })
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Are you sure you want to delete this lead?')) return
    try {
      await deleteLead.mutateAsync(id)
      toast.success('Lead deleted successfully')
      refetch()
    } catch {
      toast.error('Failed to delete lead')
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto h-[calc(100vh-6rem)] flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Leads</h1>
          <p className="text-muted-foreground mt-1">Manage and track your prospects.</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search leads..."
              className="pl-9 bg-background"
              value={searchTerm}
              onChange={(e) => updateSearch(e.target.value)}
            />
          </div>
          <div className="relative">
            <Button
              ref={filterButtonRef}
              variant="outline"
              size="icon"
              className="shrink-0 relative"
              title="Filter"
              onClick={() => setShowFilters((v) => !v)}
            >
              <Filter className="h-4 w-4" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-semibold text-white">
                  {activeFilterCount}
                </span>
              )}
            </Button>
            {showFilters && (
              <LeadFilterPanel
                current={filterValues}
                onApply={applyFilters}
                onClear={clearFilters}
                onClose={() => setShowFilters(false)}
                anchorRef={filterButtonRef}
              />
            )}
          </div>
          <Button
            variant="outline"
            className="shrink-0"
            onClick={() => setShowImport(true)}
          >
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button className="shrink-0" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Lead
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card className="flex-1 flex flex-col min-h-0">
        <div className="overflow-auto flex-1 scrollbar-thin">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 sticky top-0 z-10 backdrop-blur-sm border-b border-border">
              <tr>
                <th className="px-4 py-3 font-medium text-muted-foreground">Lead</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Contact</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Sector</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Score</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Added</th>
                <th className="px-4 py-3 font-medium text-muted-foreground w-[50px]" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array(10)
                  .fill(0)
                  .map((_, i) => (
                    <tr key={i}>
                      <td className="px-4 py-4">
                        <Skeleton className="h-10 w-48" />
                      </td>
                      <td className="px-4 py-4">
                        <Skeleton className="h-10 w-40" />
                      </td>
                      <td className="px-4 py-4">
                        <Skeleton className="h-6 w-24 rounded-full" />
                      </td>
                      <td className="px-4 py-4">
                        <Skeleton className="h-6 w-16 rounded-full" />
                      </td>
                      <td className="px-4 py-4">
                        <Skeleton className="h-6 w-8" />
                      </td>
                      <td className="px-4 py-4">
                        <Skeleton className="h-6 w-20" />
                      </td>
                      <td className="px-4 py-4">
                        <Skeleton className="h-8 w-8 rounded-md" />
                      </td>
                    </tr>
                  ))
              ) : isError ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <Users className="h-12 w-12 mb-4 opacity-20 text-red-400" />
                      <p className="text-lg font-medium text-red-700">
                        Couldn&apos;t load leads
                      </p>
                      <p className="mt-1 max-w-md text-sm text-muted-foreground">
                        {errorMessage}
                      </p>
                      <Button
                        className="mt-4"
                        variant="outline"
                        onClick={() => refetch()}
                      >
                        Retry
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center">
                      <Users className="h-12 w-12 mb-4 opacity-20" />
                      <p className="text-lg font-medium text-foreground">No leads found</p>
                      <p className="text-sm">
                        {total > 0
                          ? `You have ${total.toLocaleString()} leads but none match the current filters.`
                          : 'Try adjusting your search or add a new lead.'}
                      </p>
                      {(searchTerm || activeFilterCount > 0) && (
                        <Button
                          className="mt-4"
                          variant="outline"
                          onClick={() => {
                            updateSearch('')
                            clearFilters()
                          }}
                        >
                          Clear search &amp; filters
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                leads.map((lead) => {
                  const status = getStatusForStage(lead.stage)
                  const sectorName = SECTOR_NAMES[lead.sector_code] ?? lead.sector_code
                  return (
                    <tr
                      key={lead.id}
                      className="hover:bg-muted/30 transition-colors group cursor-pointer"
                      onClick={() => setSelectedLeadId(lead.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">
                          {lead.company_name}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {lead.contact_name}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {lead.email && (
                          <div className="flex items-center gap-1.5 text-foreground">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            <span
                              className="truncate max-w-[150px]"
                              title={lead.email}
                            >
                              {lead.email}
                            </span>
                          </div>
                        )}
                        {lead.phone && (
                          <div className="flex items-center gap-1.5 text-muted-foreground text-xs mt-1">
                            <Phone className="h-3 w-3" />
                            <span>{lead.phone}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="font-normal">
                          {sectorName}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className={cn('font-medium border capitalize', getStatusColor(status))}
                          variant="outline"
                        >
                          {status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div
                          className={cn(
                            'flex items-center gap-1',
                            getScoreColor(lead.lead_score ?? 0),
                          )}
                        >
                          <Zap className="h-3 w-3" />
                          {lead.lead_score ?? 0}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {new Date(lead.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-[160px]">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => navigate(`/leads/${lead.id}`)}>
                              <ExternalLink className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setSelectedLeadId(lead.id)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Lead
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleEnrich(lead.id)}
                              disabled={enrichingId === lead.id}
                            >
                              <Wand2 className="h-4 w-4 mr-2 text-violet-500" />
                              {enrichingId === lead.id ? 'Enriching…' : 'Enrich Lead'}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleDelete(lead.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm text-muted-foreground bg-card">
          <div className="flex items-center gap-4">
            <div>
              {total === 0
                ? 'No leads'
                : `Showing ${rangeStart}–${rangeEnd} of ${total} leads`}
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="leads-per-page" className="text-xs">
                Rows per page
              </label>
              <select
                id="leads-per-page"
                value={perPage}
                onChange={(e) => changePerPage(Number(e.target.value))}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {PAGE_SIZE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs">
              Page {Math.min(page, totalPages)} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasPrev || isLoading}
              onClick={() => goToPage(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasNext || isLoading}
              onClick={() => goToPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>

      {/* Drawer */}
      {selectedLeadId && (
        <LeadDrawer
          leadId={selectedLeadId}
          onClose={() => setSelectedLeadId(null)}
        />
      )}

      {/* Import modal */}
      {showImport && (
        <ImportCSVModal
          onClose={() => {
            setShowImport(false)
            refetch()
          }}
        />
      )}

      {/* Add Lead modal */}
      {showAdd && (
        <AddLeadModal
          onClose={() => setShowAdd(false)}
          onCreated={(id) => {
            refetch()
            // Open the drawer on the freshly-created lead so the user
            // can immediately enrich it without an extra click.
            setSelectedLeadId(id)
          }}
        />
      )}
    </div>
  )
}
