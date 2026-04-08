import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus,
  Play,
  Pause,
  Trash2,
  Eye,
  Send,
  Mail,
  MessageSquare,
  Inbox,
} from 'lucide-react'
import {
  useCampaigns,
  useStartCampaign,
  usePauseCampaign,
  useDeleteCampaign,
  type Campaign,
} from '@/hooks/useCampaigns'
import { cn, SECTOR_NAMES, SECTOR_COLORS, formatNumber } from '@/lib/utils'
import toast from 'react-hot-toast'

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
]

const STATUS_BADGE: Record<string, { color: string; label: string }> = {
  draft: { color: 'bg-gray-100 text-gray-700', label: 'Draft' },
  active: { color: 'bg-green-50 text-green-700', label: 'Active' },
  paused: { color: 'bg-yellow-50 text-yellow-700', label: 'Paused' },
  completed: { color: 'bg-blue-50 text-blue-700', label: 'Completed' },
}

const CHANNEL_BADGE: Record<string, { icon: React.ElementType; label: string }> = {
  email: { icon: Mail, label: 'Email' },
  whatsapp: { icon: MessageSquare, label: 'WhatsApp' },
  sms: { icon: MessageSquare, label: 'SMS' },
  multi_channel: { icon: Send, label: 'Mixed' },
}

export default function CampaignsPage() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState('')
  const { data, isLoading } = useCampaigns({
    status: statusFilter || undefined,
  })
  const startCampaign = useStartCampaign()
  const pauseCampaign = usePauseCampaign()
  const deleteCampaign = useDeleteCampaign()

  function handleStartPause(campaign: Campaign) {
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

  function handleDelete(id: string) {
    if (!window.confirm('Are you sure you want to delete this campaign?')) return
    deleteCampaign.mutate(id, {
      onSuccess: () => toast.success('Campaign deleted'),
      onError: () => toast.error('Failed to delete campaign'),
    })
  }

  const campaigns = data?.items || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
        <button className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700">
          <Plus className="h-4 w-4" />
          Create Campaign
        </button>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={cn(
              'border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
              statusFilter === tab.value
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-56 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-20">
          <Inbox className="h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-sm font-medium text-gray-900">No campaigns found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {statusFilter ? 'Try a different filter or create a new campaign.' : 'Create your first campaign to start reaching leads.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((campaign) => {
            const status = STATUS_BADGE[campaign.status] || STATUS_BADGE.draft
            const channel = CHANNEL_BADGE[campaign.campaign_type] || CHANNEL_BADGE.email
            const ChannelIcon = channel.icon
            const openRate = campaign.sent_count > 0
              ? ((campaign.opened_count / campaign.sent_count) * 100).toFixed(1)
              : '0.0'

            return (
              <div
                key={campaign.id}
                className="cursor-pointer rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md"
                onClick={() => navigate(`/campaigns/${campaign.id}`)}
              >
                {/* Name + Status */}
                <div className="flex items-start justify-between">
                  <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">
                    {campaign.name}
                  </h3>
                  <span className={cn('flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium', status.color)}>
                    {status.label}
                  </span>
                </div>

                {/* Description */}
                {campaign.description && (
                  <p className="mt-1.5 text-xs text-gray-500 line-clamp-2">
                    {campaign.description}
                  </p>
                )}

                {/* Sector + Channel badges */}
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {campaign.sector_code && (
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={{
                        backgroundColor: `${SECTOR_COLORS[campaign.sector_code] || '#6B7280'}15`,
                        color: SECTOR_COLORS[campaign.sector_code] || '#6B7280',
                      }}
                    >
                      {SECTOR_NAMES[campaign.sector_code] || campaign.sector_code}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                    <ChannelIcon className="h-2.5 w-2.5" />
                    {channel.label}
                  </span>
                </div>

                {/* Stats row */}
                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-gray-100 pt-3">
                  <div>
                    <p className="text-[10px] font-medium text-gray-500">Sent</p>
                    <p className="text-sm font-semibold text-gray-900">{formatNumber(campaign.sent_count)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-gray-500">Opened</p>
                    <p className="text-sm font-semibold text-gray-900">{formatNumber(campaign.opened_count)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-gray-500">Replied</p>
                    <p className="text-sm font-semibold text-gray-900">{formatNumber(campaign.replied_count)}</p>
                  </div>
                </div>

                {/* Open rate bar */}
                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">Open rate</span>
                    <span className="font-semibold text-gray-900">{openRate}%</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        Number(openRate) >= 50 ? 'bg-green-500' : Number(openRate) >= 25 ? 'bg-yellow-500' : 'bg-red-500'
                      )}
                      style={{ width: `${Math.min(Number(openRate), 100)}%` }}
                    />
                  </div>
                </div>

                {/* Action buttons */}
                <div className="mt-4 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => navigate(`/campaigns/${campaign.id}`)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    <Eye className="h-3 w-3" />
                    View
                  </button>
                  {(campaign.status === 'draft' || campaign.status === 'active' || campaign.status === 'paused') && (
                    <button
                      onClick={() => handleStartPause(campaign)}
                      disabled={startCampaign.isPending || pauseCampaign.isPending}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                        campaign.status === 'active'
                          ? 'border border-yellow-200 bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                          : 'border border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
                      )}
                    >
                      {campaign.status === 'active' ? (
                        <><Pause className="h-3 w-3" /> Pause</>
                      ) : (
                        <><Play className="h-3 w-3" /> Start</>
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(campaign.id)}
                    disabled={deleteCampaign.isPending}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
