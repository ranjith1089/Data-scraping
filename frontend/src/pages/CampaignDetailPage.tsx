import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Play,
  Pause,
  Pencil,
  Mail,
  MessageSquare,
  Send,
  Calendar,
  Clock,
  Hash,
} from 'lucide-react'
import {
  useCampaign,
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
  const [activeTab, setActiveTab] = useState<TabKey>('overview')

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
  const sectorColor = SECTOR_COLORS[campaign.sector_code] || '#6B7280'

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
          {campaign.description && (
            <p className="mt-2 text-sm text-gray-500">{campaign.description}</p>
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
          <button className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
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
            value={CHANNEL_LABELS[campaign.campaign_type] || campaign.campaign_type}
          />

          {/* Sector */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
              <Hash className="h-3.5 w-3.5" />
              Sector
            </div>
            <div className="mt-2">
              <span
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium"
                style={{
                  backgroundColor: `${sectorColor}15`,
                  color: sectorColor,
                }}
              >
                {SECTOR_NAMES[campaign.sector_code] || campaign.sector_code}
              </span>
            </div>
          </div>

          {/* Recipients */}
          <InfoCard
            icon={Send}
            label="Total Recipients"
            value={campaign.total_recipients.toLocaleString('en-IN')}
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

          {/* Completed */}
          <InfoCard
            icon={Clock}
            label="Completed"
            value={campaign.completed_at ? formatDate(campaign.completed_at) : 'In progress'}
          />
        </div>
      )}

      {activeTab === 'steps' && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">Campaign Steps</h3>
          <div className="space-y-4">
            {/* Placeholder steps - in real app would come from campaign.steps */}
            <StepCard
              stepNumber={1}
              subject="Initial Outreach"
              bodyPreview="Hi {name}, I noticed your company {company_name} in the {sector} space..."
              delayDays={0}
              channel={campaign.campaign_type}
            />
            <StepCard
              stepNumber={2}
              subject="Follow Up"
              bodyPreview="Hi {name}, I wanted to follow up on my previous message about..."
              delayDays={3}
              channel={campaign.campaign_type}
            />
            <StepCard
              stepNumber={3}
              subject="Final Touch"
              bodyPreview="Hi {name}, I understand you might be busy. Just wanted to share a quick..."
              delayDays={7}
              channel={campaign.campaign_type}
            />
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

function StepCard({
  stepNumber,
  subject,
  bodyPreview,
  delayDays,
  channel,
}: {
  stepNumber: number
  subject: string
  bodyPreview: string
  delayDays: number
  channel: string
}) {
  const ChannelIcon = channel === 'whatsapp' ? MessageSquare : Mail

  return (
    <div className="flex gap-4 rounded-lg border border-gray-200 p-4">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
        {stepNumber}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium text-gray-900">{subject}</h4>
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
            <ChannelIcon className="h-2.5 w-2.5" />
            {CHANNEL_LABELS[channel] || channel}
          </span>
        </div>
        <p className="mt-1 text-xs text-gray-500 line-clamp-2">{bodyPreview}</p>
        <div className="mt-2 flex items-center gap-1 text-xs text-gray-400">
          <Clock className="h-3 w-3" />
          {delayDays === 0 ? 'Immediate' : `${delayDays} day${delayDays > 1 ? 's' : ''} delay`}
        </div>
      </div>
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
