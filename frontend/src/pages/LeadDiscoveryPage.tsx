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
  sector_code: 'it_ites',
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
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lead Discovery</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Find new B2B prospects in India using Apollo.io — search by sector, role and location
          </p>
        </div>
        {importDone && (
          <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-2.5">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-800">
              {importDone.imported} imported
              {importDone.skipped > 0 && `, ${importDone.skipped} duplicates skipped`}
            </span>
            <button onClick={() => navigate('/leads')} className="ml-2 text-xs text-green-700 underline">
              View Leads →
            </button>
          </div>
        )}
      </div>

      {/* Search form */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {/* Sector */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Sector
            </label>
            <select
              value={filters.sector_code}
              onChange={(e) =>
                setFilters((f) => ({ ...f, sector_code: e.target.value, target_roles: [] }))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {SECTOR_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Location — state */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              State
            </label>
            <select
              value={filters.location_state}
              onChange={(e) => setFilters((f) => ({ ...f, location_state: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">All India</option>
              {INDIAN_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Company size */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Company Size
            </label>
            <select
              value={filters.company_size}
              onChange={(e) => setFilters((f) => ({ ...f, company_size: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Any size</option>
              {COMPANY_SIZES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Results per page */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Results per page
            </label>
            <select
              value={filters.per_page}
              onChange={(e) => setFilters((f) => ({ ...f, per_page: Number(e.target.value) }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>

        {/* Target roles */}
        <div className="mt-5">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
            Target Roles{' '}
            <span className="font-normal text-gray-400">
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
                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    active
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600'
                  )}
                >
                  {active && <span className="mr-1">✓</span>}
                  {role}
                </button>
              )
            })}
          </div>
        </div>

        {/* Extra keywords */}
        <div className="mt-5">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
            Extra Keywords <span className="font-normal text-gray-400">(e.g. React, AWS, Shopify)</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKeyword() } }}
              placeholder="Type and press Enter"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="button"
              onClick={addKeyword}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Add
            </button>
            {filters.keywords.map((kw) => (
              <span
                key={kw}
                className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700"
              >
                {kw}
                <button onClick={() => removeKeyword(kw)} className="text-gray-400 hover:text-gray-700">
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
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            {discoverMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            {discoverMutation.isPending ? 'Searching Apollo…' : 'Search Prospects'}
          </button>
          {results && (
            <p className="text-sm text-gray-500">
              {results.total.toLocaleString('en-IN')} total matches found
            </p>
          )}
        </div>
      </div>

      {/* Warning / info banner */}
      {results?.warning && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-800">{results.warning}</p>
        </div>
      )}

      {/* Results */}
      {results && results.leads.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {/* Table header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
            <div className="flex items-center gap-3">
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-2 text-sm font-medium text-gray-700"
              >
                {allNewSelected ? (
                  <CheckSquare className="h-4 w-4 text-indigo-600" />
                ) : (
                  <Square className="h-4 w-4 text-gray-400" />
                )}
                {selected.size > 0 ? `${selected.size} selected` : 'Select all'}
              </button>
              <span className="text-xs text-gray-400">
                ({newLeads.length} new · {results.leads.filter((l) => l.already_exists).length} already in CRM)
              </span>
            </div>

            {selected.size > 0 && (
              <button
                onClick={handleImport}
                disabled={importMutation.isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
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
              <thead className="border-b border-gray-100 bg-gray-50">
                <tr>
                  <th className="w-10 px-4 py-3" />
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Company</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Contact</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Location</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Contact Info</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Size</th>
                  <th className="w-24 px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
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
                          ? 'cursor-default bg-gray-50/50 opacity-60'
                          : isSelected
                          ? 'cursor-pointer bg-indigo-50/60'
                          : 'cursor-pointer hover:bg-gray-50'
                      )}
                    >
                      {/* Checkbox */}
                      <td className="px-4 py-3">
                        {inCRM ? (
                          <span title="Already in CRM">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          </span>
                        ) : isSelected ? (
                          <CheckSquare className="h-4 w-4 text-indigo-600" />
                        ) : (
                          <Square className="h-4 w-4 text-gray-300" />
                        )}
                      </td>

                      {/* Company */}
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{lead.company_name}</p>
                        {lead.industry && (
                          <p className="text-xs text-gray-400 capitalize">{lead.industry}</p>
                        )}
                        {lead.website && (
                          <a
                            href={lead.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="mt-0.5 flex items-center gap-1 text-xs text-indigo-500 hover:underline"
                          >
                            <Globe className="h-3 w-3" />
                            {lead.website.replace(/https?:\/\/(www\.)?/, '')}
                          </a>
                        )}
                      </td>

                      {/* Contact */}
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{lead.contact_name}</p>
                        {lead.designation && (
                          <p className="text-xs text-gray-500">{lead.designation}</p>
                        )}
                      </td>

                      {/* Location */}
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {[lead.city, lead.state].filter(Boolean).join(', ') || '—'}
                      </td>

                      {/* Contact info */}
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          {lead.email && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-600">
                              <Mail className="h-3 w-3 shrink-0 text-gray-400" />
                              <span className={cn('truncate max-w-[140px]', lead.email.includes('*') && 'font-mono text-gray-400')}>
                                {lead.email}
                              </span>
                            </div>
                          )}
                          {lead.phone && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-500">
                              <Phone className="h-3 w-3 shrink-0 text-gray-400" />
                              {lead.phone}
                            </div>
                          )}
                          {lead.linkedin_url && (
                            <a
                              href={lead.linkedin_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-1.5 text-xs text-blue-500 hover:underline"
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
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Users className="h-3 w-3" />
                            {lead.company_size}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 text-right">
                        {inCRM ? (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            In CRM
                          </span>
                        ) : (
                          <span className={cn(
                            'rounded-full px-2 py-0.5 text-xs font-medium',
                            isSelected
                              ? 'bg-indigo-100 text-indigo-700'
                              : 'bg-gray-100 text-gray-500'
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
            <div className="flex items-center justify-between border-t border-gray-200 px-5 py-4">
              <p className="text-xs text-gray-500">
                Page {results.page} of {results.total_pages} · {results.total.toLocaleString('en-IN')} total
              </p>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1 || discoverMutation.isPending}
                  onClick={() => handleSearch(page - 1)}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Prev
                </button>
                <button
                  disabled={page >= results.total_pages || discoverMutation.isPending}
                  onClick={() => handleSearch(page + 1)}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
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
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 py-20">
          <Compass className="h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm font-medium text-gray-600">No prospects found</p>
          <p className="mt-1 text-xs text-gray-400">Try a different sector, role or location</p>
        </div>
      )}

      {/* Sticky import bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2">
          <div className="flex items-center gap-4 rounded-2xl bg-gray-900 px-6 py-3.5 shadow-2xl">
            <p className="text-sm font-medium text-white">
              {selected.size} lead{selected.size !== 1 ? 's' : ''} selected
            </p>
            <button
              onClick={handleImport}
              disabled={importMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-green-500 px-4 py-2 text-sm font-semibold text-white hover:bg-green-400 disabled:opacity-50"
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
              className="text-gray-400 hover:text-white"
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
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100">
        <Compass className="h-6 w-6 text-indigo-600" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-gray-900">Find new prospects</h3>
      <p className="mt-1.5 max-w-sm text-sm text-gray-500">
        Select a sector, target roles, and location above — then click{' '}
        <strong>Search Prospects</strong> to discover matching leads from Apollo.io&apos;s database of 275M+ contacts.
      </p>
      <div className="mt-6 grid grid-cols-3 gap-3 text-xs text-gray-500">
        <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
          <p className="font-semibold text-gray-700">IT & Software</p>
          <p className="mt-0.5">CTOs, VPs, Founders</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
          <p className="font-semibold text-gray-700">Education</p>
          <p className="mt-0.5">Principals, Directors</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
          <p className="font-semibold text-gray-700">Agencies</p>
          <p className="mt-0.5">Founders, CMOs</p>
        </div>
      </div>
    </div>
  )
}
