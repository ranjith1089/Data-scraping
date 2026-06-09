import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Compass,
  Search,
  Loader2,
  CheckSquare,
  Square,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Linkedin,
  Mail,
  Phone,
  Globe,
  Users,
  X,
  CheckCircle2,
  Plus,
} from 'lucide-react'
import {
  useDiscoverLeads,
  useImportDiscoveredLeads,
  SECTOR_ROLES,
  DEFAULT_ROLES,
  INDIAN_STATES,
  COMPANY_SIZES,
  SECTOR_OPTIONS,
  type DiscoveredLead,
  type DiscoverRequest,
} from '@/hooks/useLeadDiscovery'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

// ─── Filter state ─────────────────────────────────────────────────────────────

interface FilterState {
  sector_code: string
  target_roles: string[]
  location_state: string
  location_city: string
  company_size: string
  keywords: string[]
  per_page: number
}

const DEFAULT_FILTERS: FilterState = {
  sector_code: 'college',
  target_roles: [],
  location_state: '',
  location_city: '',
  company_size: '',
  keywords: [],
  per_page: 25,
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LeadDiscoveryPage() {
  const navigate = useNavigate()
  const discoverMutation = useDiscoverLeads()
  const importMutation = useImportDiscoveredLeads()

  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)
  const [page, setPage] = useState(1)
  const [results, setResults] = useState<ReturnType<typeof useDiscoverLeads>['data'] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [keywordInput, setKeywordInput] = useState('')
  const [importDone, setImportDone] = useState<{ imported: number; skipped: number } | null>(null)

  // Available roles for the current sector
  const availableRoles = SECTOR_ROLES[filters.sector_code] || []
  const defaultRoles = DEFAULT_ROLES[filters.sector_code] || []

  async function handleSearch(pageNum = 1) {
    setPage(pageNum)
    setSelected(new Set())
    setImportDone(null)

    const req: DiscoverRequest = {
      sector_code: filters.sector_code,
      target_roles: filters.target_roles.length > 0 ? filters.target_roles : defaultRoles,
      location_state: filters.location_state || undefined,
      location_city: filters.location_city || undefined,
      company_size: filters.company_size || undefined,
      keywords: filters.keywords,
      page: pageNum,
      per_page: filters.per_page,
    }

    try {
      const data = await discoverMutation.mutateAsync(req)
      setResults(data)
      if (data.leads.length === 0 && !data.warning) {
        toast('No results found. Try broader filters.', { icon: 'ℹ️' })
      }
    } catch {
      toast.error('Discovery search failed. Check your API key.')
    }
  }

  function toggleSelect(key: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleSelectAll() {
    if (!results) return
    const newLeads = results.leads.filter((l) => !l.already_exists)
    if (selected.size === newLeads.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(newLeads.map((l) => leadKey(l))))
    }
  }

  function leadKey(l: DiscoveredLead) {
    return l.apollo_id || `${l.company_name}|${l.contact_name}`
  }

  async function handleImport() {
    if (!results || selected.size === 0) return
    const toImport = results.leads.filter((l) => selected.has(leadKey(l)))
    try {
      const result = await importMutation.mutateAsync({
        sector_code: filters.sector_code,
        leads: toImport,
        skip_duplicates: true,
      })
      setImportDone({ imported: result.imported, skipped: result.skipped_duplicates })
      setSelected(new Set())
      toast.success(`${result.imported} lead${result.imported !== 1 ? 's' : ''} imported!`)
    } catch {
      toast.error('Import failed. Please try again.')
    }
  }

  function addKeyword() {
    const kw = keywordInput.trim()
    if (!kw || filters.keywords.includes(kw)) return
    setFilters((f) => ({ ...f, keywords: [...f.keywords, kw] }))
    setKeywordInput('')
  }

  function removeKeyword(kw: string) {
    setFilters((f) => ({ ...f, keywords: f.keywords.filter((k) => k !== kw) }))
  }

  function toggleRole(role: string) {
    setFilters((f) => ({
      ...f,
      target_roles: f.target_roles.includes(role)
        ? f.target_roles.filter((r) => r !== role)
        : [...f.target_roles, role],
    }))
  }

  const newLeads = results?.leads.filter((l) => !l.already_exists) ?? []
  const allNewSelected = newLeads.length > 0 && selected.size === newLeads.length

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm">
              <Compass className="h-4 w-4 text-white" />
            </div>
            Lead Discovery
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground ml-10">
            Find new B2B prospects in India using Apollo.io — search by sector, role and location
          </p>
        </div>
        {importDone && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 ring-1 ring-inset ring-emerald-200">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span className="text-sm font-semibold text-emerald-800">
              {importDone.imported} imported
              {importDone.skipped > 0 && `, ${importDone.skipped} duplicates skipped`}
            </span>
            <button onClick={() => navigate('/leads')} className="ml-2 text-xs font-bold text-emerald-700 hover:underline">
              View Leads →
            </button>
          </div>
        )}
      </div>

      {/* Search form */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-white p-6 shadow-sm">
        <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-indigo-500 to-violet-600" />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {/* Sector */}
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Sector
            </label>
            <select
              value={filters.sector_code}
              onChange={(e) =>
                setFilters((f) => ({ ...f, sector_code: e.target.value, target_roles: [] }))
              }
              className="w-full rounded-xl border border-border px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
            >
              {SECTOR_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Location — state */}
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              State
            </label>
            <select
              value={filters.location_state}
              onChange={(e) => setFilters((f) => ({ ...f, location_state: e.target.value }))}
              className="w-full rounded-xl border border-border px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
            >
              <option value="">All India</option>
              {INDIAN_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Company size */}
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Company Size
            </label>
            <select
              value={filters.company_size}
              onChange={(e) => setFilters((f) => ({ ...f, company_size: e.target.value }))}
              className="w-full rounded-xl border border-border px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
            >
              <option value="">Any size</option>
              {COMPANY_SIZES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Results per page */}
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Results per page
            </label>
            <select
              value={filters.per_page}
              onChange={(e) => setFilters((f) => ({ ...f, per_page: Number(e.target.value) }))}
              className="w-full rounded-xl border border-border px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>

        {/* Target roles */}
        <div className="mt-5">
          <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Target Roles{' '}
            <span className="font-normal text-muted-foreground/70">
              (defaults: {(DEFAULT_ROLES[filters.sector_code] || []).slice(0, 3).join(', ')}…)
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            {availableRoles.map((role) => {
              const active = filters.target_roles.includes(role)
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => toggleRole(role)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs font-semibold transition-all',
                    active
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white border-transparent shadow-sm'
                      : 'bg-white border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                >
                  {role}
                </button>
              )
            })}
          </div>
        </div>

        {/* Extra keywords */}
        <div className="mt-5">
          <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Extra Keywords <span className="font-normal text-muted-foreground/70">(e.g. React, AWS, Shopify)</span>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKeyword() } }}
              placeholder="Type and press Enter"
              className="rounded-xl border border-border px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
            />
            <button
              type="button"
              onClick={addKeyword}
              className="rounded-xl border border-border/60 px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
            >
              Add
            </button>
            {filters.keywords.map((kw) => (
              <span
                key={kw}
                className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200"
              >
                {kw}
                <button onClick={() => removeKeyword(kw)} className="text-indigo-400 hover:text-indigo-700 transition-colors">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Search button */}
        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={() => handleSearch(1)}
            disabled={discoverMutation.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-indigo-200 hover:opacity-90 hover:-translate-y-px transition-all disabled:opacity-50"
          >
            {discoverMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            {discoverMutation.isPending ? 'Searching Apollo…' : 'Search Prospects'}
          </button>
          {results && (
            <p className="text-sm font-medium text-muted-foreground">
              <span className="text-foreground font-bold">{results.total.toLocaleString('en-IN')}</span> total matches found
            </p>
          )}
        </div>
      </div>

      {/* Warning / info banner */}
      {results?.warning && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 ring-1 ring-inset ring-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-sm font-medium text-amber-800">{results.warning}</p>
        </div>
      )}

      {/* Results */}
      {results && results.leads.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-white shadow-sm">
          {/* Table header */}
          <div className="flex items-center justify-between border-b border-border/60 px-5 py-4 bg-muted/30">
            <div className="flex items-center gap-3">
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-2 text-sm font-semibold text-foreground"
              >
                {allNewSelected ? (
                  <CheckSquare className="h-4 w-4 text-indigo-600" />
                ) : (
                  <Square className="h-4 w-4 text-muted-foreground" />
                )}
                {selected.size > 0 ? `${selected.size} selected` : 'Select all'}
              </button>
              <span className="text-xs text-muted-foreground">
                ({newLeads.length} new · {results.leads.filter((l) => l.already_exists).length} already in CRM)
              </span>
            </div>

            {selected.size > 0 && (
              <button
                onClick={handleImport}
                disabled={importMutation.isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:opacity-90 disabled:opacity-50 transition-all"
              >
                {importMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Import {selected.size} Lead{selected.size !== 1 ? 's' : ''}
              </button>
            )}
          </div>

          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 bg-muted/40">
                <tr>
                  <th className="w-10 px-4 py-3" />
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Company</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Contact</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Location</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Contact Info</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Size</th>
                  <th className="w-24 px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {results.leads.map((lead) => {
                  const key = leadKey(lead)
                  const isSelected = selected.has(key)
                  const inCRM = lead.already_exists

                  return (
                    <tr
                      key={key}
                      onClick={() => !inCRM && toggleSelect(key)}
                      className={cn(
                        'transition-colors',
                        inCRM
                          ? 'cursor-default bg-muted/20 opacity-60'
                          : isSelected
                          ? 'cursor-pointer bg-indigo-50/60'
                          : 'cursor-pointer hover:bg-muted/30'
                      )}
                    >
                      {/* Checkbox */}
                      <td className="px-4 py-3">
                        {inCRM ? (
                          <span title="Already in CRM">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          </span>
                        ) : isSelected ? (
                          <CheckSquare className="h-4 w-4 text-indigo-600" />
                        ) : (
                          <Square className="h-4 w-4 text-muted-foreground/40" />
                        )}
                      </td>

                      {/* Company */}
                      <td className="px-4 py-3">
                        <p className="font-semibold text-foreground">{lead.company_name}</p>
                        {lead.industry && (
                          <p className="text-xs text-muted-foreground capitalize">{lead.industry}</p>
                        )}
                        {lead.website && (
                          <a
                            href={lead.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="mt-0.5 flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 hover:underline transition-colors"
                          >
                            <Globe className="h-3 w-3" />
                            {lead.website.replace(/https?:\/\/(www\.)?/, '')}
                          </a>
                        )}
                      </td>

                      {/* Contact */}
                      <td className="px-4 py-3">
                        <p className="font-semibold text-foreground">{lead.contact_name}</p>
                        {lead.designation && (
                          <p className="text-xs text-muted-foreground">{lead.designation}</p>
                        )}
                      </td>

                      {/* Location */}
                      <td className="px-4 py-3 text-sm text-foreground/70">
                        {[lead.city, lead.state].filter(Boolean).join(', ') || '—'}
                      </td>

                      {/* Contact info */}
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          {lead.email && (
                            <div className="flex items-center gap-1.5 text-xs text-foreground/70">
                              <Mail className="h-3 w-3 shrink-0 text-muted-foreground" />
                              <span className={cn('truncate max-w-[140px]', lead.email.includes('*') && 'font-mono text-muted-foreground')}>
                                {lead.email}
                              </span>
                            </div>
                          )}
                          {lead.phone && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Phone className="h-3 w-3 shrink-0 text-muted-foreground" />
                              {lead.phone}
                            </div>
                          )}
                          {lead.linkedin_url && (
                            <a
                              href={lead.linkedin_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                            >
                              <Linkedin className="h-3 w-3 shrink-0" />
                              LinkedIn
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Size */}
                      <td className="px-4 py-3">
                        {lead.company_size ? (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Users className="h-3 w-3" />
                            {lead.company_size}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground/40">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 text-right">
                        {inCRM ? (
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                            In CRM
                          </span>
                        ) : (
                          <span className={cn(
                            'rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
                            isSelected
                              ? 'bg-indigo-50 text-indigo-700 ring-indigo-200'
                              : 'bg-muted text-muted-foreground ring-border/40'
                          )}>
                            {isSelected ? 'Selected' : 'New'}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {results.total_pages > 1 && (
            <div className="flex items-center justify-between border-t border-border/60 px-5 py-4">
              <p className="text-xs text-muted-foreground">
                Page {results.page} of {results.total_pages} · {results.total.toLocaleString('en-IN')} total
              </p>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1 || discoverMutation.isPending}
                  onClick={() => handleSearch(page - 1)}
                  className="inline-flex items-center gap-1 rounded-xl border border-border/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 transition-all"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Prev
                </button>
                <button
                  disabled={page >= results.total_pages || discoverMutation.isPending}
                  onClick={() => handleSearch(page + 1)}
                  className="inline-flex items-center gap-1 rounded-xl border border-border/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 transition-all"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state — first load */}
      {!results && !discoverMutation.isPending && (
        <EmptyState />
      )}

      {/* No results */}
      {results && results.leads.length === 0 && !discoverMutation.isPending && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/30 py-20">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md mb-4">
            <Compass className="h-6 w-6 text-white" />
          </div>
          <p className="text-sm font-bold text-foreground">No prospects found</p>
          <p className="mt-1 text-xs text-muted-foreground">Try a different sector, role or location</p>
        </div>
      )}

      {/* Sticky import bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2">
          <div className="flex items-center gap-4 rounded-2xl bg-slate-900/95 backdrop-blur-sm px-6 py-3.5 shadow-2xl ring-1 ring-white/10">
            <p className="text-sm font-semibold text-white">
              {selected.size} lead{selected.size !== 1 ? 's' : ''} selected
            </p>
            <button
              onClick={handleImport}
              disabled={importMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50 transition-all shadow-sm"
            >
              {importMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Import to CRM
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/30 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md mb-4">
        <Compass className="h-6 w-6 text-white" />
      </div>
      <h3 className="text-base font-bold text-foreground">Find new prospects</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
        Select a sector, target roles, and location above — then click{' '}
        <strong className="text-foreground">Search Prospects</strong> to discover matching leads from Apollo.io's database of 275M+ contacts.
      </p>
      <div className="mt-6 grid grid-cols-3 gap-3 text-xs">
        {[
          { title: 'IT & Software', sub: 'CTOs, VPs, Founders', gradient: 'from-indigo-500 to-violet-500' },
          { title: 'Education', sub: 'Principals, Directors', gradient: 'from-blue-500 to-sky-500' },
          { title: 'Agencies', sub: 'Founders, CMOs', gradient: 'from-violet-500 to-purple-500' },
        ].map(({ title, sub, gradient }) => (
          <div key={title} className="relative overflow-hidden rounded-xl border border-border/60 bg-white p-3 text-center shadow-sm">
            <div className={`absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r ${gradient}`} />
            <p className="font-bold text-foreground mt-1">{title}</p>
            <p className="mt-0.5 text-muted-foreground">{sub}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
