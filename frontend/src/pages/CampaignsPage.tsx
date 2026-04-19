import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Plus,
  Play,
  Pause,
  CheckCircle2,
  FileEdit,
  MoreHorizontal,
  X,
} from 'lucide-react'
import {
  useCampaigns,
  useStartCampaign,
  usePauseCampaign,
  useDeleteCampaign,
  type Campaign,
} from '@/hooks/useCampaigns'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn, SECTOR_NAMES, formatNumber } from '@/lib/utils'
import CampaignBuilder from '@/components/campaigns/CampaignBuilder'

function getStatusIcon(status: string) {
  switch (status) {
    case 'active':
      return <Play className="w-3 h-3 mr-1" />
    case 'paused':
      return <Pause className="w-3 h-3 mr-1" />
    case 'completed':
      return <CheckCircle2 className="w-3 h-3 mr-1" />
    case 'draft':
      return <FileEdit className="w-3 h-3 mr-1" />
    default:
      return null
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case 'active':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:border-emerald-500/30 dark:text-emerald-400'
    case 'paused':
      return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:border-amber-500/30 dark:text-amber-400'
    case 'completed':
      return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:border-blue-500/30 dark:text-blue-400'
    case 'draft':
      return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/20 dark:border-slate-500/30 dark:text-slate-400'
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200'
  }
}

function rate(numerator: number, denominator: number) {
  if (!denominator) return 0
  return Math.round((numerator / denominator) * 100)
}

export default function CampaignsPage() {
  const navigate = useNavigate()
  const { data, isLoading, refetch } = useCampaigns()
  const startCampaign = useStartCampaign()
  const pauseCampaign = usePauseCampaign()
  const deleteCampaign = useDeleteCampaign()
  const [showBuilder, setShowBuilder] = useState(false)

  const campaigns: Campaign[] = data?.items ?? []

  async function handleStart(id: string) {
    try {
      await startCampaign.mutateAsync(id)
      toast.success('Campaign started')
    } catch {
      toast.error('Failed to start campaign')
    }
  }

  async function handlePause(id: string) {
    try {
      await pauseCampaign.mutateAsync(id)
      toast.success('Campaign paused')
    } catch {
      toast.error('Failed to pause campaign')
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Are you sure you want to delete this campaign?')) return
    try {
      await deleteCampaign.mutateAsync(id)
      toast.success('Campaign deleted')
    } catch {
      toast.error('Failed to delete campaign')
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Campaigns
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your automated outreach campaigns.
          </p>
        </div>
        <Button onClick={() => setShowBuilder(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Campaign
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {isLoading ? (
          Array(4)
            .fill(0)
            .map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <CardContent className="p-0">
                  <Skeleton className="h-24 w-full" />
                </CardContent>
              </Card>
            ))
        ) : campaigns.length === 0 ? (
          <Card className="py-12 border-dashed">
            <CardContent className="flex flex-col items-center justify-center text-center">
              <div className="bg-muted p-4 rounded-full mb-4">
                <Play className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-foreground">No campaigns yet</h3>
              <p className="text-muted-foreground mt-1 max-w-md mx-auto">
                Create your first AI-powered outreach campaign to start engaging with
                leads automatically.
              </p>
              <Button className="mt-6" onClick={() => setShowBuilder(true)}>
                Create First Campaign
              </Button>
            </CardContent>
          </Card>
        ) : (
          campaigns.map((campaign) => {
            const openRate = rate(campaign.open_count, campaign.sent_count)
            const replyRate = rate(campaign.reply_count, campaign.sent_count)
            const firstSector = campaign.sector_codes?.[0] ?? ''
            const sectorName = firstSector
              ? (SECTOR_NAMES[firstSector] ?? firstSector)
              : ''

            return (
              <Card
                key={campaign.id}
                className="overflow-hidden group hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => navigate(`/campaigns/${campaign.id}`)}
              >
                <CardContent className="p-0">
                  <div className="flex flex-col md:flex-row items-start md:items-center p-5 gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1 flex-wrap">
                        <h3 className="font-semibold text-lg truncate text-foreground">
                          {campaign.name}
                        </h3>
                        <Badge
                          className={cn(
                            'capitalize flex items-center border',
                            getStatusColor(campaign.status),
                          )}
                          variant="outline"
                        >
                          {getStatusIcon(campaign.status)}
                          {campaign.status}
                        </Badge>
                        {sectorName && (
                          <Badge
                            variant="secondary"
                            className="font-normal hidden sm:inline-flex"
                          >
                            {sectorName}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Created on{' '}
                        {new Date(campaign.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </div>
                    </div>

                    <div className="flex flex-wrap md:flex-nowrap items-center gap-6 w-full md:w-auto shrink-0 bg-muted/30 md:bg-transparent p-4 md:p-0 rounded-lg md:rounded-none">
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-medium">
                          Sent
                        </span>
                        <span className="font-semibold text-foreground">
                          {formatNumber(campaign.sent_count)}
                        </span>
                      </div>
                      <div className="h-8 w-px bg-border hidden md:block" />
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-medium">
                          Opened
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">
                            {formatNumber(campaign.open_count)}
                          </span>
                          <span className="text-xs text-emerald-500 font-medium bg-emerald-500/10 px-1.5 py-0.5 rounded">
                            {openRate}%
                          </span>
                        </div>
                      </div>
                      <div className="h-8 w-px bg-border hidden md:block" />
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-medium">
                          Replied
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">
                            {formatNumber(campaign.reply_count)}
                          </span>
                          <span className="text-xs text-blue-500 font-medium bg-blue-500/10 px-1.5 py-0.5 rounded">
                            {replyRate}%
                          </span>
                        </div>
                      </div>

                      <div
                        className="md:ml-4 ml-auto"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => navigate(`/campaigns/${campaign.id}`)}
                            >
                              View Analytics
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => navigate(`/campaigns/${campaign.id}`)}
                            >
                              Edit Campaign
                            </DropdownMenuItem>
                            {campaign.status === 'active' ? (
                              <DropdownMenuItem
                                onClick={() => handlePause(campaign.id)}
                              >
                                Pause Campaign
                              </DropdownMenuItem>
                            ) : campaign.status === 'draft' ||
                              campaign.status === 'paused' ? (
                              <DropdownMenuItem
                                onClick={() => handleStart(campaign.id)}
                              >
                                {campaign.status === 'draft'
                                  ? 'Start Campaign'
                                  : 'Resume Campaign'}
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleDelete(campaign.id)}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* Campaign Builder Modal */}
      {showBuilder && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm"
          onClick={(e) => {
            // Only close when clicking the backdrop itself, not the modal
            if (e.target === e.currentTarget) setShowBuilder(false)
          }}
        >
          <div className="relative my-8 w-full max-w-5xl rounded-xl bg-card shadow-2xl">
            <button
              type="button"
              onClick={() => setShowBuilder(false)}
              className="absolute right-4 top-4 z-10 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            <CampaignBuilder
              onComplete={(_campaignId) => {
                setShowBuilder(false)
                refetch()
                toast.success('Campaign created successfully')
              }}
              onCancel={() => setShowBuilder(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
