import { useState, useMemo } from 'react'
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
} from 'lucide-react'
import { useLeads, useDeleteLead, type Lead } from '@/hooks/useLeads'
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
import { cn, SECTOR_NAMES, STAGE_LABELS } from '@/lib/utils'
import LeadDrawer from '@/components/leads/LeadDrawer'
import ImportCSVModal from '@/components/leads/ImportCSVModal'

// Reference-style stage-to-"status" mapping — maps backend stage codes to
// the warm/hot/cold/won/lost status visual language used by the reference.
function getStatusForStage(stage: string): 'hot' | 'warm' | 'cold' | 'won' | 'lost' {
  if (stage === 'won') return 'won'
  if (stage === 'lost') return 'lost'
  if (['demo', 'proposal', 'negotiation'].includes(stage)) return 'hot'
  if (['contacted', 'engaged'].includes(stage)) return 'warm'
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

export default function LeadsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [showImport, setShowImport] = useState(false)
  const searchTerm = searchParams.get('search') ?? ''

  const { data, isLoading, refetch } = useLeads({
    search: searchTerm || undefined,
    page: 1,
    per_page: 50,
  })
  const deleteLead = useDeleteLead()

  const leads = useMemo<Lead[]>(() => data?.items ?? [], [data])

  function updateSearch(value: string) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set('search', value)
    else next.delete('search')
    setSearchParams(next, { replace: true })
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
          <Button variant="outline" size="icon" className="shrink-0" title="Filter">
            <Filter className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="shrink-0"
            onClick={() => setShowImport(true)}
          >
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button className="shrink-0">
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
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center">
                      <Users className="h-12 w-12 mb-4 opacity-20" />
                      <p className="text-lg font-medium text-foreground">No leads found</p>
                      <p className="text-sm">
                        Try adjusting your search or add a new lead.
                      </p>
                      {searchTerm && (
                        <Button
                          className="mt-4"
                          variant="outline"
                          onClick={() => updateSearch('')}
                        >
                          Clear Search
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
                        {lead.contact_email && (
                          <div className="flex items-center gap-1.5 text-foreground">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            <span
                              className="truncate max-w-[150px]"
                              title={lead.contact_email}
                            >
                              {lead.contact_email}
                            </span>
                          </div>
                        )}
                        {lead.contact_phone && (
                          <div className="flex items-center gap-1.5 text-muted-foreground text-xs mt-1">
                            <Phone className="h-3 w-3" />
                            <span>{lead.contact_phone}</span>
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
                            getScoreColor(lead.ai_score ?? 0),
                          )}
                        >
                          <Zap className="h-3 w-3" />
                          {lead.ai_score ?? 0}
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
        <div className="p-4 border-t border-border flex items-center justify-between text-sm text-muted-foreground bg-card">
          <div>
            Showing {leads.length} of {data?.total ?? 0} leads
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled>
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

      {/* Keep STAGE_LABELS reference alive (for future filter use) */}
      {false && <span>{Object.keys(STAGE_LABELS).length}</span>}
    </div>
  )
}
