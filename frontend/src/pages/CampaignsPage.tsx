import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Plus, Play, Pause, CheckCircle2, FileEdit,
  MoreHorizontal, X, Megaphone, Mail, BarChart2, MessageSquare,
} from 'lucide-react'
import {
  useCampaigns, useStartCampaign, usePauseCampaign,
  useDeleteCampaign, type Campaign,
} from '@/hooks/useCampaigns'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn, SECTOR_NAMES, formatNumber } from '@/lib/utils'
import CampaignBuilder from '@/components/campaigns/CampaignBuilder'

const STATUS_CONFIG: Record<string, { label: string; dot: string; cls: string; icon: React.ReactNode }> = {
  active:    { label: 'Active',    dot: 'bg-emerald-500', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', icon: <Play className="w-3 h-3" /> },
  paused:    { label: 'Paused',    dot: 'bg-amber-500',   cls: 'bg-amber-50 text-amber-700 ring-amber-200',       icon: <Pause className="w-3 h-3" /> },
  completed: { label: 'Completed', dot: 'bg-blue-500',    cls: 'bg-blue-50 text-blue-700 ring-blue-200',          icon: <CheckCircle2 className="w-3 h-3" /> },
  draft:     { label: 'Draft',     dot: 'bg-slate-400',   cls: 'bg-slate-50 text-slate-600 ring-slate-200',       icon: <FileEdit className="w-3 h-3" /> },
}

function rate(n: number, d: number) { return d ? Math.round((n / d) * 100) : 0 }

export default function CampaignsPage() {
  const navigate = useNavigate()
  const { data, isLoading, refetch } = useCampaigns()
  const startCampaign = useStartCampaign()
  const pauseCampaign = usePauseCampaign()
  const deleteCampaign = useDeleteCampaign()
  const [showBuilder, setShowBuilder] = useState(false)

  const campaigns: Campaign[] = data?.items ?? []

  async function handleStart(id: string) {
    try { await startCampaign.mutateAsync(id); toast.success('Campaign started') }
    catch { toast.error('Failed to start campaign') }
  }
  async function handlePause(id: string) {
    try { await pauseCampaign.mutateAsync(id); toast.success('Campaign paused') }
    catch { toast.error('Failed to pause campaign') }
  }
  async function handleDelete(id: string) {
    if (!window.confirm('Delete this campaign?')) return
    try { await deleteCampaign.mutateAsync(id); toast.success('Campaign deleted') }
    catch { toast.error('Failed to delete campaign') }
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Campaigns</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage your automated outreach campaigns.</p>
        </div>
        <button onClick={() => setShowBuilder(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-rose-200 hover:opacity-90 hover:-translate-y-px transition-all">
          <Plus className="h-4 w-4" />
          Create Campaign
        </button>
      </div>

      {/* Campaign list */}
      <div className="space-y-3">
        {isLoading ? (
          Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)
        ) : campaigns.length === 0 ? (
          <div className="rounded-2xl bg-white border border-dashed border-border shadow-sm py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center mx-auto mb-4">
              <Megaphone className="h-7 w-7 text-rose-400" />
            </div>
            <h3 className="text-base font-bold text-foreground">No campaigns yet</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              Create your first AI-powered outreach campaign to start engaging with leads automatically.
            </p>
            <button onClick={() => setShowBuilder(true)}
              className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-rose-200 hover:opacity-90 transition-all">
              <Plus className="h-4 w-4" />
              Create First Campaign
            </button>
          </div>
        ) : campaigns.map((campaign) => {
          const openRate = rate(campaign.open_count, campaign.sent_count)
          const replyRate = rate(campaign.reply_count, campaign.sent_count)
          const firstSector = campaign.sector_codes?.[0] ?? ''
          const sectorName = firstSector ? (SECTOR_NAMES[firstSector] ?? firstSector) : ''
          const statusCfg = STATUS_CONFIG[campaign.status] ?? STATUS_CONFIG.draft

          return (
            <div key={campaign.id}
              className="group rounded-2xl bg-white border border-border/60 shadow-sm hover:shadow-md hover:border-primary/30 transition-all cursor-pointer overflow-hidden"
              onClick={() => navigate(`/campaigns/${campaign.id}`)}>
              {/* Top accent */}
              <div className={cn('h-0.5 w-full', campaign.status === 'active' ? 'bg-gradient-to-r from-emerald-400 to-teal-500' : campaign.status === 'paused' ? 'bg-gradient-to-r from-amber-400 to-orange-400' : campaign.status === 'completed' ? 'bg-gradient-to-r from-blue-400 to-violet-500' : 'bg-muted')} />

              <div className="flex flex-col md:flex-row items-start md:items-center p-4 gap-4">
                {/* Icon + info */}
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm',
                    campaign.status === 'active' ? 'bg-gradient-to-br from-emerald-400 to-teal-500'
                    : campaign.status === 'paused' ? 'bg-gradient-to-br from-amber-400 to-orange-400'
                    : campaign.status === 'completed' ? 'bg-gradient-to-br from-blue-400 to-violet-500'
                    : 'bg-gradient-to-br from-slate-300 to-slate-400',
                  )}>
                    <Megaphone className="h-5 w-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="font-bold text-foreground truncate">{campaign.name}</h3>
                      <span className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset capitalize',
                        statusCfg.cls,
                      )}>
                        <span className={cn('w-1.5 h-1.5 rounded-full', statusCfg.dot)} />
                        {statusCfg.label}
                      </span>
                      {sectorName && (
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground hidden sm:inline-flex">
                          {sectorName}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Created {new Date(campaign.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-5 bg-muted/30 md:bg-transparent rounded-xl p-3 md:p-0 w-full md:w-auto shrink-0">
                  <div className="flex flex-col items-center min-w-[50px]">
                    <div className="flex items-center gap-1 text-muted-foreground mb-0.5">
                      <Mail className="h-3 w-3" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Sent</span>
                    </div>
                    <span className="text-base font-bold text-foreground">{formatNumber(campaign.sent_count)}</span>
                  </div>
                  <div className="w-px h-8 bg-border" />
                  <div className="flex flex-col items-center min-w-[60px]">
                    <div className="flex items-center gap-1 text-muted-foreground mb-0.5">
                      <BarChart2 className="h-3 w-3" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Opened</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-base font-bold text-foreground">{formatNumber(campaign.open_count)}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">{openRate}%</span>
                    </div>
                  </div>
                  <div className="w-px h-8 bg-border" />
                  <div className="flex flex-col items-center min-w-[60px]">
                    <div className="flex items-center gap-1 text-muted-foreground mb-0.5">
                      <MessageSquare className="h-3 w-3" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Replied</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-base font-bold text-foreground">{formatNumber(campaign.reply_count)}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700">{replyRate}%</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="ml-auto md:ml-4" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-all opacity-0 group-hover:opacity-100">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44 rounded-xl border-border/50 shadow-lg p-1">
                        <DropdownMenuItem onClick={() => navigate(`/campaigns/${campaign.id}`)} className="rounded-lg text-sm">
                          View Analytics
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/campaigns/${campaign.id}`)} className="rounded-lg text-sm">
                          Edit Campaign
                        </DropdownMenuItem>
                        {campaign.status === 'active' ? (
                          <DropdownMenuItem onClick={() => handlePause(campaign.id)} className="rounded-lg text-sm">
                            Pause Campaign
                          </DropdownMenuItem>
                        ) : campaign.status === 'draft' || campaign.status === 'paused' ? (
                          <DropdownMenuItem onClick={() => handleStart(campaign.id)} className="rounded-lg text-sm">
                            {campaign.status === 'draft' ? 'Start Campaign' : 'Resume Campaign'}
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuItem onClick={() => handleDelete(campaign.id)}
                          className="rounded-lg text-sm text-destructive focus:text-destructive focus:bg-destructive/5">
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Campaign Builder Modal */}
      {showBuilder && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowBuilder(false) }}>
          <div className="relative my-8 w-full max-w-5xl rounded-2xl bg-card shadow-2xl border border-border/60">
            <button type="button" onClick={() => setShowBuilder(false)}
              className="absolute right-4 top-4 z-10 h-8 w-8 flex items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
            <CampaignBuilder
              onComplete={(_campaignId) => { setShowBuilder(false); refetch(); toast.success('Campaign created successfully') }}
              onCancel={() => setShowBuilder(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
