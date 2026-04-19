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
  useStartCampaign,
  usePauseCampaign,
  useUpdateCampaign,
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
  draft: { color: 'bg-gray-100 text-gray-700', label: 'Draft' },
  active: { color: 'bg-green-50 text-green-700', label: 'Active' },
  paused: { color: 'bg-yellow-50 text-yellow-700', label: 'Paused' },
  completed: { color: 'bg-blue-50 text-blue-700', label: 'Completed' },
}

const CHANNEL_LABELS: Record<string, string> = {
  email: 'Email',
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  multi_channel: 'Multi-Channel',
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: campaign, isLoading } = useCampaign(id || '')
  const startCampaign = useStartCampaign()
  const pauseCampaign = usePauseCampaign()
  const updateCampaign = useUpdateCampaign()
  const [activeTab, setActiveTab] = useState<TabKey>('overview')

  function handleRename() {
    if (!campaign) return
    const next = window.prompt('Rename campaign', campaign.name)
    if (!next || next.trim() === '' || next.trim() === campaign.name) return
    updateCampaign.mutate(
      { id: campaign.id, name: next.trim() },
      {
        onSuccess: () => toast.success('Campaign renamed'),
        onError: (err: unknown) => {
          const detail =
            (err as { response?: { data?: { detail?: unknown } } }).response
              ?.data?.detail
          toast.error(
            typeof detail === 'string' ? detail : 'Failed to rename campaign',
          )
        },
      },
    )
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
        <p className="text-sm text-gray-500">Campaign not found</p>
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
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Campaigns
      </button>

      {/* Header */}
      <div className="flex items-start justify-between rounded-xl border border-gray-200 bg-white p-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{campaign.name}</h1>
            <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', status.color)}>
              {status.label}
            </span>
          </div>
          {description && (
            <p className="mt-2 text-sm text-gray-500">{description}</p>
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
            onClick={handleRename}
            disabled={updateCampaign.isPending}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-0">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'border-b-2 px-6 py-3 text-sm font-medium transition-colors',
                activeTab === tab.key
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
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
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
              <Hash className="h-3.5 w-3.5" />
              {(campaign.sector_codes?.length ?? 0) > 1 ? 'Sectors' : 'Sector'}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(campaign.sector_codes ?? []).length === 0 ? (
                <span className="text-sm text-gray-400">No sector selected</span>
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
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">Campaign Steps</h3>
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 py-10 text-center">
            <p className="text-sm text-gray-500">
              Steps are configured at campaign creation time.
            </p>
            <p className="mt-1 text-xs text-gray-400">
              In-place step editing will land in a follow-up phase.
            </p>
          </div>
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
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-2 text-lg font-semibold text-gray-900">{value}</p>
    </div>
  )
}

function CampaignDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-5 w-40 animate-pulse rounded bg-gray-200" />
      <div className="h-32 animate-pulse rounded-xl bg-gray-100" />
      <div className="h-10 animate-pulse rounded bg-gray-100" />
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100" />
        ))}
      </div>
    </div>
  )
}
