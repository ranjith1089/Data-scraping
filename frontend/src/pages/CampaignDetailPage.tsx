import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Play,
  Pause,
  Pencil,
  Mail,
  Send,
  Calendar,
  Clock,
  Hash,
} from 'lucide-react'
import {
  useCampaign,
  useCampaignSteps,
  useStartCampaign,
  usePauseCampaign,
} from '@/hooks/useCampaigns'
import CampaignStats from '@/components/campaigns/CampaignStats'
import { cn, SECTOR_NAMES, SECTOR_COLORS, formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

type TabKey = 'overview' | 'steps' | 'performance'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'steps', label: 'Steps' },
  { key: 'performance', label: 'Performance' },
]

const STATUS_BADGE: Record<string, { color: string; label: string }> = {
  draft: { color: 'bg-muted text-foreground/80', label: 'Draft' },
  active: { color: 'bg-green-50 text-green-700', label: 'Active' },
  paused: { color: 'bg-yellow-50 text-yellow-700', label: 'Paused' },
  completed: { color: 'bg-blue-50 text-blue-700', label: 'Completed' },
}

const CHANNEL_LABELS: Record<string, string> = {
  email: 'Email',
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  linkedin: 'LinkedIn',
  multi: 'Multi-Channel',
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: campaign, isLoading } = useCampaign(id || '')
  const { data: steps = [] } = useCampaignSteps(id || '')
  const startCampaign = useStartCampaign()
  const pauseCampaign = usePauseCampaign()
  const [activeTab, setActiveTab] = useState<TabKey>('overview')

  function handleEdit() {
    if (!campaign) return
    navigate(`/campaigns/${campaign.id}/edit`)
  }

  function handleStartPause() {
    if (!campaign) return
    if (campaign.status === 'active') {
      pauseCampaign.mutate(campaign.id, {
        onSuccess: () => toast.success('Campaign paused'),
        onError: () => toast.error('Failed to pause campaign'),
      })
    } else {
      startCampaign.mutate(campaign.id, {
        onSuccess: () => toast.success('Campaign started'),
        onError: () => toast.error('Failed to start campaign'),
      })
    }
  }

  if (isLoading) {
    return <CampaignDetailSkeleton />
  }

  if (!campaign) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Campaign not found</p>
        <button
          onClick={() => navigate('/campaigns')}
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Campaigns
        </button>
      </div>
    )
  }

  const status = STATUS_BADGE[campaign.status] || STATUS_BADGE.draft
  const firstSector = campaign.sector_codes?.[0] ?? ''
  const sectorColor = SECTOR_COLORS[firstSector] || '#6B7280'
  const description =
    (campaign.segment_filter as Record<string, unknown> | null)?.description as
      | string
      | undefined

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={() => navigate('/campaigns')}
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground/80"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Campaigns
      </button>

      {/* Header */}
      <div className="flex items-start justify-between rounded-2xl border border-border/60 bg-white p-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{campaign.name}</h1>
            <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', status.color)}>
              {status.label}
            </span>
          </div>
          {description && (
            <p className="mt-2 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {(campaign.status === 'draft' || campaign.status === 'active' || campaign.status === 'paused') && (
            <button
              onClick={handleStartPause}
              disabled={startCampaign.isPending || pauseCampaign.isPending}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50',
                campaign.status === 'active'
                  ? 'border border-yellow-200 bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                  : 'bg-green-600 text-white hover:bg-green-700'
              )}
            >
              {campaign.status === 'active' ? (
                <><Pause className="h-4 w-4" /> Pause</>
              ) : (
                <><Play className="h-4 w-4" /> Start</>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={handleEdit}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted/40"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border/60">
        <nav className="flex gap-0">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'border-b-2 px-6 py-3 text-sm font-medium transition-colors',
                activeTab === tab.key
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-muted-foreground hover:border-gray-300 hover:text-foreground/80'
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Channel */}
          <InfoCard
            icon={Mail}
            label="Channel"
            value={CHANNEL_LABELS[campaign.channel] || campaign.channel}
          />

          {/* Sector(s) */}
          <div className="rounded-2xl border border-border/60 bg-white p-5">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Hash className="h-3.5 w-3.5" />
              {(campaign.sector_codes?.length ?? 0) > 1 ? 'Sectors' : 'Sector'}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(campaign.sector_codes ?? []).length === 0 ? (
                <span className="text-sm text-muted-foreground/70">No sector selected</span>
              ) : (
                campaign.sector_codes.map((code) => (
                  <span
                    key={code}
                    className="inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium"
                    style={{
                      backgroundColor: `${SECTOR_COLORS[code] || sectorColor}15`,
                      color: SECTOR_COLORS[code] || sectorColor,
                    }}
                  >
                    {SECTOR_NAMES[code] || code}
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Total leads */}
          <InfoCard
            icon={Send}
            label="Total Leads"
            value={(campaign.total_leads ?? 0).toLocaleString('en-IN')}
          />

          {/* Created */}
          <InfoCard
            icon={Calendar}
            label="Created"
            value={formatDate(campaign.created_at)}
          />

          {/* Started */}
          <InfoCard
            icon={Play}
            label="Started"
            value={campaign.started_at ? formatDate(campaign.started_at) : 'Not started'}
          />

          {/* Daily limit */}
          <InfoCard
            icon={Clock}
            label="Daily Send Limit"
            value={String(campaign.daily_limit ?? 0)}
          />
        </div>
      )}

      {activeTab === 'steps' && (
        <div className="rounded-2xl border border-border/60 bg-white p-6">
          <h3 className="mb-4 text-sm font-semibold text-foreground">
            Campaign Steps
            <span className="ml-2 text-xs font-normal text-muted-foreground/70">
              ({steps.length} step{steps.length !== 1 ? 's' : ''})
            </span>
          </h3>
          {steps.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/40 py-10 text-center">
              <p className="text-sm text-muted-foreground">No steps configured yet.</p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                Add steps when creating or editing a campaign.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {steps.map((step) => (
                <div
                  key={step.id}
                  className="rounded-lg border border-border/40 bg-muted/40 p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                        {step.step_number}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {CHANNEL_LABELS[step.channel] || step.channel}
                          {step.delay_days > 0 && (
                            <span className="ml-2 text-xs font-normal text-muted-foreground/70">
                              · Day {step.delay_days}
                            </span>
                          )}
                        </p>
                        {step.subject && (
                          <p className="mt-0.5 text-xs text-muted-foreground truncate max-w-xs">
                            {step.subject}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>
                        <span className="font-medium text-foreground/80">{step.sent_count}</span> sent
                      </span>
                      <span>
                        <span className="font-medium text-foreground/80">{step.open_count}</span> opened
                      </span>
                      <span>
                        <span className="font-medium text-foreground/80">{step.reply_count}</span> replied
                      </span>
                      {step.variant_b_subject || step.variant_b_body ? (
                        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-purple-700 font-medium">
                          A/B
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'performance' && (
        <CampaignStats campaignId={campaign.id} />
      )}
    </div>
  )
}

function InfoCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-white p-5">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-2 text-lg font-semibold text-foreground">{value}</p>
    </div>
  )
}

function CampaignDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-5 w-40 animate-pulse rounded bg-gray-200" />
      <div className="h-32 animate-pulse rounded-xl bg-muted" />
      <div className="h-10 animate-pulse rounded bg-muted" />
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  )
}
