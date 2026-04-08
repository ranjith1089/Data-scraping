import { useState, useMemo, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  ExternalLink,
  MoreHorizontal,
  Eye,
  Pencil,
  Brain,
  Mail,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Inbox,
} from 'lucide-react'
import { useLeads, type Lead, type LeadSearchParams } from '@/hooks/useLeads'
import { useDeleteLead } from '@/hooks/useLeads'
import {
  cn,
  SECTOR_COLORS,
  SECTOR_NAMES,
  STAGE_COLORS,
  STAGE_LABELS,
  getScoreBadge,
  getICPBadge,
  timeAgo,
  truncate,
} from '@/lib/utils'
import toast from 'react-hot-toast'
import BulkActionsBar from './BulkActionsBar'

type SortField = 'company_name' | 'contact_name' | 'ai_score' | 'stage' | 'created_at' | 'updated_at'
type SortDir = 'asc' | 'desc'

interface LeadTableProps {
  onOpenDrawer?: (id: string) => void
  onOpenEdit?: (id: string) => void
  onOpenAIScore?: (ids: string[]) => void
  onOpenEmailGen?: (id: string) => void
}

export default function LeadTable({
  onOpenDrawer,
  onOpenEdit,
  onOpenAIScore,
  onOpenEmailGen,
}: LeadTableProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const params: LeadSearchParams = useMemo(() => ({
    search: searchParams.get('search') || undefined,
    sector_code: searchParams.get('sector_code') || undefined,
    stage: searchParams.get('stage') || undefined,
    min_score: searchParams.get('min_score') ? Number(searchParams.get('min_score')) : undefined,
    max_score: searchParams.get('max_score') ? Number(searchParams.get('max_score')) : undefined,
    district: searchParams.get('district') || undefined,
    company_size: searchParams.get('company_size') || undefined,
    page: Number(searchParams.get('page') || 1),
    per_page: Number(searchParams.get('per_page') || 25),
  }), [searchParams])

  const { data, isLoading, isError } = useLeads(params)
  const deleteLead = useDeleteLead()

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const allIds = useMemo(() => data?.items.map((l) => l.id) || [], [data])
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.includes(id))

  const toggleAll = useCallback(() => {
    setSelectedIds(allSelected ? [] : [...allIds])
  }, [allSelected, allIds])

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }, [])

  const sortedItems = useMemo(() => {
    if (!data?.items) return []
    const items = [...data.items]
    items.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'company_name':
          cmp = a.company_name.localeCompare(b.company_name)
          break
        case 'contact_name':
          cmp = a.contact_name.localeCompare(b.contact_name)
          break
        case 'ai_score':
          cmp = a.ai_score - b.ai_score
          break
        case 'stage':
          cmp = a.stage.localeCompare(b.stage)
          break
        case 'created_at':
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          break
        case 'updated_at':
          cmp = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
          break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return items
  }, [data?.items, sortField, sortDir])

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  function setPage(page: number) {
    const next = new URLSearchParams(searchParams)
    next.set('page', String(page))
    setSearchParams(next)
  }

  function setPerPage(pp: number) {
    const next = new URLSearchParams(searchParams)
    next.set('per_page', String(pp))
    next.set('page', '1')
    setSearchParams(next)
  }

  function handleDelete(id: string) {
    if (!window.confirm('Are you sure you want to delete this lead?')) return
    deleteLead.mutate(id, {
      onSuccess: () => {
        toast.success('Lead deleted')
        setSelectedIds((p) => p.filter((x) => x !== id))
      },
      onError: () => toast.error('Failed to delete lead'),
    })
  }

  function handleRowClick(id: string) {
    if (onOpenDrawer) {
      onOpenDrawer(id)
    } else {
      navigate(`/leads/${id}`)
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="ml-1 h-3.5 w-3.5 text-gray-400" />
    return sortDir === 'asc'
      ? <ArrowUp className="ml-1 h-3.5 w-3.5 text-indigo-600" />
      : <ArrowDown className="ml-1 h-3.5 w-3.5 text-indigo-600" />
  }

  // Skeleton loader
  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {['', 'Company', 'Contact', 'Sector', 'Score', 'Stage', 'Location', 'Last Activity', ''].map((h, i) => (
                <th key={i} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i} className="animate-pulse">
                <td className="px-4 py-3"><div className="h-4 w-4 rounded bg-gray-200" /></td>
                <td className="px-4 py-3"><div className="h-4 w-32 rounded bg-gray-200" /></td>
                <td className="px-4 py-3"><div className="h-4 w-28 rounded bg-gray-200" /></td>
                <td className="px-4 py-3"><div className="h-5 w-20 rounded-full bg-gray-200" /></td>
                <td className="px-4 py-3"><div className="h-5 w-14 rounded-full bg-gray-200" /></td>
                <td className="px-4 py-3"><div className="h-5 w-20 rounded-full bg-gray-200" /></td>
                <td className="px-4 py-3"><div className="h-4 w-24 rounded bg-gray-200" /></td>
                <td className="px-4 py-3"><div className="h-4 w-16 rounded bg-gray-200" /></td>
                <td className="px-4 py-3"><div className="h-4 w-6 rounded bg-gray-200" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-red-200 bg-red-50 py-16">
        <p className="text-sm text-red-600">Failed to load leads. Please try again.</p>
      </div>
    )
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-white py-20">
        <Inbox className="h-12 w-12 text-gray-300" />
        <h3 className="mt-4 text-sm font-medium text-gray-900">No leads found</h3>
        <p className="mt-1 text-sm text-gray-500">
          Try adjusting your filters or import new leads.
        </p>
      </div>
    )
  }

  const { total, page, per_page, pages } = data

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hover:text-gray-700"
                  onClick={() => handleSort('company_name')}
                >
                  <span className="inline-flex items-center">Company <SortIcon field="company_name" /></span>
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hover:text-gray-700"
                  onClick={() => handleSort('contact_name')}
                >
                  <span className="inline-flex items-center">Contact <SortIcon field="contact_name" /></span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Sector
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hover:text-gray-700"
                  onClick={() => handleSort('ai_score')}
                >
                  <span className="inline-flex items-center">Score <SortIcon field="ai_score" /></span>
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hover:text-gray-700"
                  onClick={() => handleSort('stage')}
                >
                  <span className="inline-flex items-center">Stage <SortIcon field="stage" /></span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Location
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hover:text-gray-700"
                  onClick={() => handleSort('updated_at')}
                >
                  <span className="inline-flex items-center">Last Activity <SortIcon field="updated_at" /></span>
                </th>
                <th className="w-12 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {sortedItems.map((lead) => {
                const scoreBadge = getScoreBadge(lead.ai_score)
                const icpBadge = lead.icp_fit ? getICPBadge(lead.icp_fit) : null
                const sectorColor = SECTOR_COLORS[lead.sector_code] || '#6B7280'
                const stageColor = STAGE_COLORS[lead.stage] || '#6B7280'

                return (
                  <tr
                    key={lead.id}
                    className={cn(
                      'cursor-pointer transition-colors hover:bg-gray-50',
                      selectedIds.includes(lead.id) && 'bg-indigo-50/40'
                    )}
                    onClick={() => handleRowClick(lead.id)}
                  >
                    {/* Checkbox */}
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(lead.id)}
                        onChange={() => toggleOne(lead.id)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>

                    {/* Company */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {truncate(lead.company_name, 30)}
                          </p>
                          {lead.website && (
                            <a
                              href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="h-3 w-3" />
                              Website
                            </a>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Contact */}
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-900">{lead.contact_name}</p>
                      {lead.contact_email && (
                        <p className="text-xs text-gray-500">{truncate(lead.contact_email, 28)}</p>
                      )}
                    </td>

                    {/* Sector */}
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                        style={{
                          backgroundColor: `${sectorColor}15`,
                          color: sectorColor,
                        }}
                      >
                        {SECTOR_NAMES[lead.sector_code] || lead.sector_code}
                      </span>
                    </td>

                    {/* Score + ICP */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className={cn('inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-semibold', scoreBadge.color)}>
                          {lead.ai_score} - {scoreBadge.label}
                        </span>
                        {icpBadge && (
                          <span className={cn('inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[10px] font-medium', icpBadge.color)}>
                            ICP: {lead.icp_fit}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Stage */}
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                        style={{
                          backgroundColor: `${stageColor}15`,
                          color: stageColor,
                        }}
                      >
                        {STAGE_LABELS[lead.stage] || lead.stage}
                      </span>
                    </td>

                    {/* Location */}
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-700">{lead.city}</p>
                      <p className="text-xs text-gray-400">{lead.district}</p>
                    </td>

                    {/* Last Activity */}
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-500">{timeAgo(lead.updated_at)}</p>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="relative">
                        <button
                          onClick={() => setOpenMenuId(openMenuId === lead.id ? null : lead.id)}
                          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>

                        {openMenuId === lead.id && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              onClick={() => setOpenMenuId(null)}
                            />
                            <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                              <button
                                onClick={() => { onOpenDrawer?.(lead.id); setOpenMenuId(null) }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                              >
                                <Eye className="h-4 w-4" /> View Details
                              </button>
                              <button
                                onClick={() => { onOpenEdit?.(lead.id); setOpenMenuId(null) }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                              >
                                <Pencil className="h-4 w-4" /> Edit
                              </button>
                              <button
                                onClick={() => { onOpenAIScore?.([lead.id]); setOpenMenuId(null) }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-indigo-600 hover:bg-indigo-50"
                              >
                                <Brain className="h-4 w-4" /> Score with AI
                              </button>
                              <button
                                onClick={() => { onOpenEmailGen?.(lead.id); setOpenMenuId(null) }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-indigo-600 hover:bg-indigo-50"
                              >
                                <Mail className="h-4 w-4" /> Generate Email
                              </button>
                              <div className="my-1 border-t border-gray-100" />
                              <button
                                onClick={() => { handleDelete(lead.id); setOpenMenuId(null) }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" /> Delete
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Showing {(page - 1) * per_page + 1}-{Math.min(page * per_page, total)} of {total}</span>
            <select
              value={per_page}
              onChange={(e) => setPerPage(Number(e.target.value))}
              className="rounded border border-gray-300 bg-white px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>{n} per page</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
              className="rounded p-1.5 text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
              let pageNum: number
              if (pages <= 7) {
                pageNum = i + 1
              } else if (page <= 4) {
                pageNum = i + 1
              } else if (page >= pages - 3) {
                pageNum = pages - 6 + i
              } else {
                pageNum = page - 3 + i
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={cn(
                    'min-w-[32px] rounded px-2 py-1 text-sm font-medium',
                    page === pageNum
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  )}
                >
                  {pageNum}
                </button>
              )
            })}
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= pages}
              className="rounded p-1.5 text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <BulkActionsBar
          selectedIds={selectedIds}
          onClear={() => setSelectedIds([])}
          onOpenAIScore={onOpenAIScore}
        />
      )}
    </>
  )
}
