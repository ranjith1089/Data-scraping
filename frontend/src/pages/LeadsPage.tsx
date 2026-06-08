import { useMemo, useRef, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Search, Filter, MoreHorizontal, Mail, Phone,
  ExternalLink, Plus, Edit, Trash2, Zap, Users,
  Upload, Wand2, ChevronLeft, ChevronRight as ChevronRightIcon,
} from 'lucide-react'
import { useLeads, useDeleteLead, type Lead } from '@/hooks/useLeads'
import { useEnrichLead } from '@/hooks/useEnrichment'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn, SECTOR_NAMES } from '@/lib/utils'
import LeadDrawer from '@/components/leads/LeadDrawer'
import ImportCSVModal from '@/components/leads/ImportCSVModal'
import AddLeadModal from '@/components/leads/AddLeadModal'
import LeadFilterPanel from '@/components/leads/LeadFilterPanel'

function getStatusForStage(stage: string): 'hot' | 'warm' | 'cold' | 'won' | 'lost' {
  if (stage === 'won') return 'won'
  if (stage === 'lost') return 'lost'
  if (['proposal', 'negotiation'].includes(stage)) return 'hot'
  if (['contacted', 'qualified', 'nurture'].includes(stage)) return 'warm'
  return 'cold'
}

const STATUS_CONFIG: Record<string, { label: string; cls: string; dot: string }> = {
  hot:  { label: 'Hot',  cls: 'bg-orange-50 text-orange-700 ring-orange-200', dot: 'bg-orange-500' },
  warm: { label: 'Warm', cls: 'bg-amber-50 text-amber-700 ring-amber-200',   dot: 'bg-amber-500' },
  cold: { label: 'Cold', cls: 'bg-slate-50 text-slate-600 ring-slate-200',   dot: 'bg-slate-400' },
  won:  { label: 'Won',  cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
  lost: { label: 'Lost', cls: 'bg-rose-50 text-rose-700 ring-rose-200',      dot: 'bg-rose-500' },
}

function getInitialsColor(name: string) {
  const colors = [
    'from-indigo-400 to-violet-500', 'from-sky-400 to-cyan-500',
    'from-emerald-400 to-teal-500', 'from-rose-400 to-pink-500',
    'from-amber-400 to-orange-500', 'from-purple-400 to-fuchsia-500',
  ]
  const code = name.charCodeAt(0) + (name.charCodeAt(1) ?? 0)
  return colors[code % colors.length]
}

function CompanyAvatar({ name }: { name: string }) {
  const initials = name.slice(0, 2).toUpperCase()
  return (
    <div className={cn(
      'w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold text-white shrink-0 bg-gradient-to-br shadow-sm',
      getInitialsColor(name),
    )}>
      {initials}
    </div>
  )
}

function ScoreBadge({ score }: { score: number }) {
  const cls = score >= 80
    ? 'bg-orange-100 text-orange-700'
    : score >= 60 ? 'bg-amber-100 text-amber-700'
    : score >= 40 ? 'bg-blue-50 text-blue-600'
    : 'bg-muted text-muted-foreground'
  return (
    <div className="flex items-center gap-1.5">
      <div className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold', cls)}>
        <Zap className="h-2.5 w-2.5" />
        {score}
      </div>
    </div>
  )
}

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

  const pageParam = Number(searchParams.get('page'))
  const perPageParam = Number(searchParams.get('per_page'))
  const page = Number.isFinite(pageParam) && pageParam >= 1 ? Math.floor(pageParam) : 1
  const perPage = (PAGE_SIZE_OPTIONS as readonly number[]).includes(perPageParam)
    ? perPageParam : DEFAULT_PAGE_SIZE

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

  const errorMessage = isError
    ? (() => {
        const e = error as { response?: { status?: number; data?: { detail?: unknown } }; message?: string }
        const d = e?.response?.data?.detail
        if (typeof d === 'string') return d
        if (Array.isArray(d)) return d.map((x: { loc?: unknown[]; msg?: string }) => {
          const field = Array.isArray(x?.loc) ? x.loc.slice(1).join('.') : ''
          return field ? `${field}: ${x?.msg ?? ''}` : x?.msg ?? ''
        }).filter(Boolean).join('; ') || 'Failed to load leads.'
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
      if (result.fields_updated.length > 0) toast.success(`Enriched ${result.fields_updated.length} field(s)`)
      else toast(result.message, { icon: 'ℹ️' })
    } catch { toast.error('Enrichment failed') }
    finally { setEnrichingId(null) }
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
    if (value) { next.set('search', value) } else { next.delete('search') }
    next.delete('page')
    setSearchParams(next, { replace: true })
  }
  function goToPage(nextPage: number) {
    const clamped = Math.min(Math.max(1, nextPage), Math.max(1, totalPages))
    const next = new URLSearchParams(searchParams)
    if (clamped <= 1) { next.delete('page') } else { next.set('page', String(clamped)) }
    setSearchParams(next, { replace: false })
  }
  function changePerPage(value: number) {
    const next = new URLSearchParams(searchParams)
    if (value === DEFAULT_PAGE_SIZE) { next.delete('per_page') } else { next.set('per_page', String(value)) }
    next.delete('page')
    setSearchParams(next, { replace: true })
  }
  function applyFilters(next: typeof filterValues) {
    const params = new URLSearchParams(searchParams)
    params.delete('page')
    for (const [key, value] of Object.entries(next)) {
      if (value) { params.set(key, value) } else { params.delete(key) }
    }
    setSearchParams(params, { replace: true })
  }
  function clearFilters() {
    const params = new URLSearchParams(searchParams)
    params.delete('page')
    for (const key of Object.keys(filterValues)) params.delete(key)
    setSearchParams(params, { replace: true })
  }
  async function handleDelete(id: string) {
    if (!window.confirm('Are you sure you want to delete this lead?')) return
    try {
      await deleteLead.mutateAsync(id)
      toast.success('Lead deleted successfully')
      refetch()
    } catch { toast.error('Failed to delete lead') }
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto h-[calc(100vh-6rem)] flex flex-col">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Leads</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {total > 0 ? `${total.toLocaleString()} prospects in your database` : 'Manage and track your prospects'}
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Search */}
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 pointer-events-none" />
            <input
              placeholder="Search leads..."
              className="w-full h-9 rounded-xl border border-border/60 bg-white pl-9 pr-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
              value={searchTerm}
              onChange={(e) => updateSearch(e.target.value)}
            />
          </div>

          {/* Filter */}
          <div className="relative">
            <button
              ref={filterButtonRef}
              title="Filter"
              onClick={() => setShowFilters((v) => !v)}
              className={cn(
                'relative h-9 px-3 rounded-xl border text-sm font-medium flex items-center gap-1.5 transition-all',
                activeFilterCount > 0
                  ? 'border-primary/40 bg-primary/5 text-primary'
                  : 'border-border/60 bg-white text-muted-foreground hover:text-foreground hover:bg-muted',
              )}>
              <Filter className="h-4 w-4" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
              Filters
            </button>
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

          <button
            onClick={() => setShowImport(true)}
            className="h-9 px-3 rounded-xl border border-border/60 bg-white text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted flex items-center gap-1.5 transition-all">
            <Upload className="h-3.5 w-3.5" />
            Import
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="h-9 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-sm font-bold text-white shadow-md shadow-indigo-200 hover:opacity-90 hover:-translate-y-px flex items-center gap-1.5 transition-all">
            <Plus className="h-4 w-4" />
            Add Lead
          </button>
        </div>
      </div>

      {/* ── Table card ──────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 rounded-2xl bg-white border border-border/60 shadow-sm flex flex-col overflow-hidden">
        <div className="overflow-auto flex-1 scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-muted/40 backdrop-blur-sm border-b border-border/60">
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Company / Contact</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Contact Info</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Sector</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Score</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Added</th>
                <th className="px-4 py-3 w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {isLoading ? (
                Array(12).fill(0).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
                        <div className="space-y-1.5"><Skeleton className="h-3.5 w-36" /><Skeleton className="h-3 w-24" /></div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5"><Skeleton className="h-3.5 w-36" /></td>
                    <td className="px-4 py-3.5"><Skeleton className="h-6 w-20 rounded-full" /></td>
                    <td className="px-4 py-3.5"><Skeleton className="h-6 w-16 rounded-full" /></td>
                    <td className="px-4 py-3.5"><Skeleton className="h-6 w-12 rounded-full" /></td>
                    <td className="px-4 py-3.5"><Skeleton className="h-3.5 w-20" /></td>
                    <td className="px-4 py-3.5"><Skeleton className="h-7 w-7 rounded-lg" /></td>
                  </tr>
                ))
              ) : isError ? (
                <tr><td colSpan={7}>
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center">
                      <Users className="h-7 w-7 text-rose-400" />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-foreground">Couldn't load leads</p>
                      <p className="text-sm text-muted-foreground mt-1 max-w-sm">{errorMessage}</p>
                    </div>
                    <button onClick={() => refetch()}
                      className="mt-1 h-9 px-4 rounded-xl border border-border/60 bg-white text-sm font-medium hover:bg-muted transition-all">
                      Try again
                    </button>
                  </div>
                </td></tr>
              ) : leads.length === 0 ? (
                <tr><td colSpan={7}>
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center">
                      <Users className="h-7 w-7 text-indigo-400" />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-foreground">No leads found</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {total > 0 ? `${total.toLocaleString()} leads exist but none match the current filters.` : 'Add your first lead or adjust your search.'}
                      </p>
                    </div>
                    {(searchTerm || activeFilterCount > 0) && (
                      <button onClick={() => { updateSearch(''); clearFilters() }}
                        className="h-9 px-4 rounded-xl border border-border/60 bg-white text-sm font-medium hover:bg-muted transition-all">
                        Clear search &amp; filters
                      </button>
                    )}
                  </div>
                </td></tr>
              ) : leads.map((lead) => {
                const status = getStatusForStage(lead.stage)
                const statusCfg = STATUS_CONFIG[status]
                const sectorName = SECTOR_NAMES[lead.sector_code] ?? lead.sector_code
                return (
                  <tr key={lead.id}
                    className="hover:bg-muted/30 transition-colors group cursor-pointer"
                    onClick={() => setSelectedLeadId(lead.id)}>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <CompanyAvatar name={lead.company_name} />
                        <div>
                          <p className="font-semibold text-foreground leading-tight">{lead.company_name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{lead.contact_name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      {lead.email && (
                        <div className="flex items-center gap-1.5 text-foreground text-xs">
                          <Mail className="h-3 w-3 text-muted-foreground/70 shrink-0" />
                          <span className="truncate max-w-[150px]">{lead.email}</span>
                        </div>
                      )}
                      {lead.phone && (
                        <div className="flex items-center gap-1.5 text-muted-foreground text-xs mt-1">
                          <Phone className="h-3 w-3 shrink-0" />
                          <span>{lead.phone}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center rounded-full bg-muted/70 px-2.5 py-0.5 text-xs font-medium text-foreground">
                        {sectorName}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
                        statusCfg.cls,
                      )}>
                        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', statusCfg.dot)} />
                        {statusCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <ScoreBadge score={lead.lead_score ?? 0} />
                    </td>
                    <td className="px-4 py-3.5 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(lead.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground opacity-0 group-hover:opacity-100 transition-all">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44 rounded-xl border-border/50 shadow-lg p-1">
                          <DropdownMenuLabel className="text-xs px-2 py-1.5">Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => navigate(`/leads/${lead.id}`)} className="rounded-lg text-sm">
                            <ExternalLink className="h-4 w-4 mr-2 text-muted-foreground" />View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setSelectedLeadId(lead.id)} className="rounded-lg text-sm">
                            <Edit className="h-4 w-4 mr-2 text-muted-foreground" />Edit Lead
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEnrich(lead.id)} disabled={enrichingId === lead.id} className="rounded-lg text-sm">
                            <Wand2 className="h-4 w-4 mr-2 text-violet-500" />
                            {enrichingId === lead.id ? 'Enriching…' : 'Enrich Lead'}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleDelete(lead.id)}
                            className="rounded-lg text-sm text-destructive focus:text-destructive focus:bg-destructive/5">
                            <Trash2 className="h-4 w-4 mr-2" />Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <div className="px-4 py-3 border-t border-border/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-muted/20 shrink-0">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>
              {total === 0 ? 'No leads' : `Showing ${rangeStart}–${rangeEnd} of ${total.toLocaleString()} leads`}
            </span>
            <div className="flex items-center gap-2">
              <label className="text-[11px]">Per page</label>
              <select
                value={perPage}
                onChange={(e) => changePerPage(Number(e.target.value))}
                className="h-7 rounded-lg border border-border/60 bg-white px-2 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary/20">
                {PAGE_SIZE_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">
              Page {Math.min(page, totalPages)} of {totalPages}
            </span>
            <button
              disabled={!hasPrev || isLoading}
              onClick={() => goToPage(page - 1)}
              className="h-7 w-7 flex items-center justify-center rounded-lg border border-border/60 bg-white text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-all">
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              disabled={!hasNext || isLoading}
              onClick={() => goToPage(page + 1)}
              className="h-7 w-7 flex items-center justify-center rounded-lg border border-border/60 bg-white text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-all">
              <ChevronRightIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {selectedLeadId && <LeadDrawer leadId={selectedLeadId} onClose={() => setSelectedLeadId(null)} />}
      {showImport && <ImportCSVModal onClose={() => { setShowImport(false); refetch() }} />}
      {showAdd && <AddLeadModal onClose={() => setShowAdd(false)} onCreated={(id) => { refetch(); setSelectedLeadId(id) }} />}
    </div>
  )
}
