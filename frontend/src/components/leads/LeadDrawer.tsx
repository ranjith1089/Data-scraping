import { useState } from 'react'
import {
  X,
  Globe,
  Mail,
  Phone,
  MapPin,
  Building2,
  Users,
  IndianRupee,
  Brain,
  Sparkles,
  Send,
  Plus,
  MessageSquare,
  Calendar,
  PhoneCall,
  FileText,
  Clock,
  ExternalLink,
  Tag,
  Loader2,
} from 'lucide-react'
import { useLead } from '@/hooks/useLeads'
import { useLeadScore, useEmailGen, type EmailGenRequest } from '@/hooks/useAI'
import {
  cn,
  SECTOR_COLORS,
  SECTOR_NAMES,
  STAGE_COLORS,
  STAGE_LABELS,
  getScoreBadge,
  getICPBadge,
  formatINR,
  timeAgo,
} from '@/lib/utils'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import api from '@/lib/api'

interface LeadDrawerProps {
  leadId: string
  onClose: () => void
}

type TabKey = 'overview' | 'activity' | 'ai' | 'campaigns' | 'deals'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'activity', label: 'Activity' },
  { key: 'ai', label: 'AI Actions' },
  { key: 'campaigns', label: 'Campaigns' },
  { key: 'deals', label: 'Deals' },
]

const STAGES_ORDER = ['new', 'contacted', 'engaged', 'demo', 'proposal', 'negotiation', 'won', 'lost']

const ACTIVITY_TYPES = [
  { value: 'call', label: 'Call', icon: PhoneCall },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'meeting', label: 'Meeting', icon: Calendar },
  { value: 'note', label: 'Note', icon: FileText },
]

interface Activity {
  id: string
  type: string
  note: string
  outcome?: string
  created_at: string
  created_by?: string
}

export default function LeadDrawer({ leadId, onClose }: LeadDrawerProps) {
  const { data: lead, isLoading, refetch } = useLead(leadId)
  const [activeTab, setActiveTab] = useState<TabKey>('overview')

  // AI Actions state
  const scoreLeadMutation = useLeadScore()
  const emailGenMutation = useEmailGen()
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [scoreResult, setScoreResult] = useState<{
    score: number
    icp_fit: string
    reasoning: string
    factors: { factor: string; impact: string; weight: number }[]
  } | null>(null)
  const [generatedEmail, setGeneratedEmail] = useState<{ subject: string; body: string } | null>(null)
  const [emailType, setEmailType] = useState<EmailGenRequest['email_type']>('cold_outreach')
  const [emailTone, setEmailTone] = useState<EmailGenRequest['tone']>('professional' as any)

  // Activity state
  const [activities, setActivities] = useState<Activity[]>([])
  const [newActivity, setNewActivity] = useState({ type: 'call', note: '', outcome: '' })
  const [showActivityForm, setShowActivityForm] = useState(false)

  async function handleScoreLead() {
    try {
      const results = await scoreLeadMutation.mutateAsync({ lead_ids: [leadId] })
      if (results.length > 0) {
        setScoreResult(results[0] as any)
        toast.success('Lead scored successfully')
        refetch()
      }
    } catch {
      toast.error('Failed to score lead')
    }
  }

  async function handleGenerateEmail() {
    try {
      const result = await emailGenMutation.mutateAsync({
        lead_id: leadId,
        email_type: emailType,
        tone: emailTone,
      })
      setGeneratedEmail({ subject: result.subject, body: result.body })
      toast.success('Email generated')
    } catch {
      toast.error('Failed to generate email')
    }
  }

  async function handleGetSummary() {
    setSummaryLoading(true)
    try {
      const { data } = await api.get(`/ai/lead-summary/${leadId}`)
      setAiSummary(data.summary)
      toast.success('Summary generated')
    } catch {
      toast.error('Failed to generate summary')
    } finally {
      setSummaryLoading(false)
    }
  }

  function handleAddActivity() {
    if (!newActivity.note.trim()) return
    const activity: Activity = {
      id: crypto.randomUUID(),
      type: newActivity.type,
      note: newActivity.note,
      outcome: newActivity.outcome || undefined,
      created_at: new Date().toISOString(),
    }
    setActivities((prev) => [activity, ...prev])
    setNewActivity({ type: 'call', note: '', outcome: '' })
    setShowActivityForm(false)
    toast.success('Activity added')
  }

  if (isLoading || !lead) {
    return (
      <>
        <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
        <div className="fixed right-0 top-0 z-50 flex h-full w-[600px] flex-col bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-gray-200 p-6">
            <div className="h-6 w-48 animate-pulse rounded bg-gray-200" />
            <button onClick={onClose} className="rounded p-1 hover:bg-gray-100">
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
          <div className="flex-1 space-y-4 p-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-4 animate-pulse rounded bg-gray-200" style={{ width: `${70 - i * 8}%` }} />
            ))}
          </div>
        </div>
      </>
    )
  }

  const scoreBadge = getScoreBadge(lead.ai_score)
  const icpBadge = lead.icp_fit ? getICPBadge(lead.icp_fit) : null
  const sectorColor = SECTOR_COLORS[lead.sector_code] || '#6B7280'
  const currentStageIdx = STAGES_ORDER.indexOf(lead.stage)

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30 transition-opacity" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[600px] flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-gray-200 p-6">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-lg font-semibold text-gray-900">{lead.company_name}</h2>
                <span
                  className="inline-flex flex-shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{ backgroundColor: `${sectorColor}15`, color: sectorColor }}
                >
                  {SECTOR_NAMES[lead.sector_code] || lead.sector_code}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold', scoreBadge.color)}>
                  Score: {lead.ai_score} ({scoreBadge.label})
                </span>
                {icpBadge && (
                  <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium', icpBadge.color)}>
                    ICP: {lead.icp_fit}
                  </span>
                )}
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{ backgroundColor: `${STAGE_COLORS[lead.stage]}15`, color: STAGE_COLORS[lead.stage] }}
                >
                  {STAGE_LABELS[lead.stage] || lead.stage}
                </span>
              </div>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-shrink-0 gap-0 border-b border-gray-200">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex-1 border-b-2 px-3 py-2.5 text-center text-sm font-medium transition-colors',
                activeTab === tab.key
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="space-y-6 p-6">
              {/* Stage Pipeline */}
              <div>
                <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-500">Pipeline Stage</h4>
                <div className="flex items-center gap-1">
                  {STAGES_ORDER.map((stage, idx) => {
                    const isActive = idx <= currentStageIdx && lead.stage !== 'lost'
                    const isLost = lead.stage === 'lost' && stage === 'lost'
                    return (
                      <div key={stage} className="flex flex-1 flex-col items-center">
                        <div
                          className={cn(
                            'h-2.5 w-full rounded-full',
                            isLost ? 'bg-red-400' : isActive ? 'bg-indigo-500' : 'bg-gray-200'
                          )}
                        />
                        <span className="mt-1 text-[10px] text-gray-400">{STAGE_LABELS[stage]}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Company Info */}
              <div>
                <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-500">Company Information</h4>
                <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4">
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <div>
                      <dt className="flex items-center gap-1.5 text-xs text-gray-500"><Building2 className="h-3.5 w-3.5" /> Company</dt>
                      <dd className="mt-0.5 text-sm font-medium text-gray-900">{lead.company_name}</dd>
                    </div>
                    {lead.website && (
                      <div>
                        <dt className="flex items-center gap-1.5 text-xs text-gray-500"><Globe className="h-3.5 w-3.5" /> Website</dt>
                        <dd className="mt-0.5">
                          <a
                            href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline"
                          >
                            {lead.website} <ExternalLink className="h-3 w-3" />
                          </a>
                        </dd>
                      </div>
                    )}
                    <div>
                      <dt className="flex items-center gap-1.5 text-xs text-gray-500"><Users className="h-3.5 w-3.5" /> Size</dt>
                      <dd className="mt-0.5 text-sm text-gray-900">{lead.company_size || 'N/A'}</dd>
                    </div>
                    {lead.annual_revenue && (
                      <div>
                        <dt className="flex items-center gap-1.5 text-xs text-gray-500"><IndianRupee className="h-3.5 w-3.5" /> Revenue</dt>
                        <dd className="mt-0.5 text-sm text-gray-900">{formatINR(lead.annual_revenue)}</dd>
                      </div>
                    )}
                    <div>
                      <dt className="flex items-center gap-1.5 text-xs text-gray-500"><MapPin className="h-3.5 w-3.5" /> Location</dt>
                      <dd className="mt-0.5 text-sm text-gray-900">{[lead.city, lead.district, lead.state].filter(Boolean).join(', ')}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500">Source</dt>
                      <dd className="mt-0.5 text-sm text-gray-900">{lead.lead_source || 'N/A'}</dd>
                    </div>
                  </dl>
                </div>
              </div>

              {/* Contact Info */}
              <div>
                <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-500">Contact Information</h4>
                <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4">
                  <dl className="space-y-3">
                    <div>
                      <dt className="text-xs text-gray-500">Name</dt>
                      <dd className="mt-0.5 text-sm font-medium text-gray-900">{lead.contact_name}</dd>
                    </div>
                    {lead.contact_email && (
                      <div>
                        <dt className="flex items-center gap-1.5 text-xs text-gray-500"><Mail className="h-3.5 w-3.5" /> Email</dt>
                        <dd className="mt-0.5">
                          <a href={`mailto:${lead.contact_email}`} className="text-sm text-indigo-600 hover:underline">
                            {lead.contact_email}
                          </a>
                        </dd>
                      </div>
                    )}
                    {lead.contact_phone && (
                      <div>
                        <dt className="flex items-center gap-1.5 text-xs text-gray-500"><Phone className="h-3.5 w-3.5" /> Phone</dt>
                        <dd className="mt-0.5">
                          <a href={`tel:${lead.contact_phone}`} className="text-sm text-indigo-600 hover:underline">
                            {lead.contact_phone}
                          </a>
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              </div>

              {/* AI Summary */}
              {aiSummary && (
                <div>
                  <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-500">AI Summary</h4>
                  <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-4">
                    <p className="text-sm leading-relaxed text-gray-700">{aiSummary}</p>
                  </div>
                </div>
              )}

              {/* Tags */}
              {lead.tags && lead.tags.length > 0 && (
                <div>
                  <h4 className="mb-3 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-gray-500">
                    <Tag className="h-3.5 w-3.5" /> Tags
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {lead.tags.map((tag) => (
                      <span key={tag} className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div className="border-t border-gray-200 pt-4">
                <dl className="flex gap-6 text-xs text-gray-400">
                  <div>
                    <dt>Created</dt>
                    <dd>{format(new Date(lead.created_at), 'dd MMM yyyy')}</dd>
                  </div>
                  <div>
                    <dt>Updated</dt>
                    <dd>{timeAgo(lead.updated_at)}</dd>
                  </div>
                </dl>
              </div>
            </div>
          )}

          {/* ACTIVITY TAB */}
          {activeTab === 'activity' && (
            <div className="p-6">
              {/* Add Activity */}
              <div className="mb-6">
                {!showActivityForm ? (
                  <button
                    onClick={() => setShowActivityForm(true)}
                    className="inline-flex items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 hover:border-indigo-300 hover:text-indigo-600"
                  >
                    <Plus className="h-4 w-4" /> Add Activity
                  </button>
                ) : (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <div className="mb-3 flex gap-2">
                      {ACTIVITY_TYPES.map((at) => (
                        <button
                          key={at.value}
                          onClick={() => setNewActivity((p) => ({ ...p, type: at.value }))}
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                            newActivity.type === at.value
                              ? 'bg-indigo-600 text-white'
                              : 'bg-white text-gray-600 hover:bg-gray-100'
                          )}
                        >
                          <at.icon className="h-3.5 w-3.5" /> {at.label}
                        </button>
                      ))}
                    </div>
                    <textarea
                      placeholder="Add a note about this activity..."
                      value={newActivity.note}
                      onChange={(e) => setNewActivity((p) => ({ ...p, note: e.target.value }))}
                      rows={3}
                      className="mb-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <input
                      type="text"
                      placeholder="Outcome (optional)"
                      value={newActivity.outcome}
                      onChange={(e) => setNewActivity((p) => ({ ...p, outcome: e.target.value }))}
                      className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddActivity}
                        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                      >
                        Save Activity
                      </button>
                      <button
                        onClick={() => setShowActivityForm(false)}
                        className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Timeline */}
              {activities.length === 0 ? (
                <div className="py-12 text-center">
                  <Clock className="mx-auto h-8 w-8 text-gray-300" />
                  <p className="mt-2 text-sm text-gray-500">No activities recorded yet</p>
                </div>
              ) : (
                <div className="space-y-0">
                  {activities.map((activity, idx) => {
                    const typeInfo = ACTIVITY_TYPES.find((t) => t.value === activity.type) || ACTIVITY_TYPES[3]
                    const Icon = typeInfo.icon
                    return (
                      <div key={activity.id} className="relative flex gap-4 pb-6">
                        {idx < activities.length - 1 && (
                          <div className="absolute left-[15px] top-8 h-full w-px bg-gray-200" />
                        )}
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100">
                          <Icon className="h-4 w-4 text-indigo-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-baseline justify-between">
                            <p className="text-sm font-medium capitalize text-gray-900">{activity.type}</p>
                            <span className="text-xs text-gray-400">{timeAgo(activity.created_at)}</span>
                          </div>
                          <p className="mt-0.5 text-sm text-gray-600">{activity.note}</p>
                          {activity.outcome && (
                            <p className="mt-1 text-xs text-gray-400">Outcome: {activity.outcome}</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* AI ACTIONS TAB */}
          {activeTab === 'ai' && (
            <div className="space-y-6 p-6">
              {/* Score Lead */}
              <div className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">AI Lead Scoring</h4>
                    <p className="mt-0.5 text-xs text-gray-500">Analyze lead quality with AI</p>
                  </div>
                  <button
                    onClick={handleScoreLead}
                    disabled={scoreLeadMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {scoreLeadMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Brain className="h-4 w-4" />
                    )}
                    Score Lead
                  </button>
                </div>
                {scoreResult && (
                  <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
                    <div className="flex items-center gap-4">
                      <div className={cn('rounded-lg px-3 py-1.5 text-lg font-bold', getScoreBadge(scoreResult.score).color)}>
                        {scoreResult.score}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">ICP: <span className="capitalize">{scoreResult.icp_fit}</span></p>
                        <p className="text-xs text-gray-500">{scoreResult.reasoning}</p>
                      </div>
                    </div>
                    {scoreResult.factors.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-gray-500">Score Factors</p>
                        {scoreResult.factors.map((f, i) => (
                          <div key={i} className="flex items-center justify-between rounded bg-gray-50 px-3 py-1.5 text-xs">
                            <span className="text-gray-700">{f.factor}</span>
                            <span className={cn(
                              'font-medium',
                              f.impact === 'positive' ? 'text-green-600' : f.impact === 'negative' ? 'text-red-600' : 'text-gray-500'
                            )}>
                              {f.impact === 'positive' ? '+' : f.impact === 'negative' ? '-' : '~'}{f.weight}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Generate Email */}
              <div className="rounded-lg border border-gray-200 p-4">
                <h4 className="text-sm font-medium text-gray-900">Generate Email</h4>
                <p className="mt-0.5 text-xs text-gray-500">AI-powered email generation for this lead</p>
                <div className="mt-3 flex gap-2">
                  <select
                    value={emailType}
                    onChange={(e) => setEmailType(e.target.value as EmailGenRequest['email_type'])}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="cold_outreach">Cold Outreach</option>
                    <option value="follow_up">Follow Up</option>
                    <option value="proposal">Proposal</option>
                    <option value="custom">Custom</option>
                  </select>
                  <select
                    value={emailTone}
                    onChange={(e) => setEmailTone(e.target.value as any)}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="formal">Formal</option>
                    <option value="friendly">Friendly</option>
                    <option value="persuasive">Persuasive</option>
                  </select>
                  <button
                    onClick={handleGenerateEmail}
                    disabled={emailGenMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {emailGenMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Generate
                  </button>
                </div>
                {generatedEmail && (
                  <div className="mt-4 space-y-2 rounded-lg border border-indigo-100 bg-indigo-50/50 p-4">
                    <p className="text-xs font-medium text-gray-500">Subject</p>
                    <p className="text-sm font-medium text-gray-900">{generatedEmail.subject}</p>
                    <p className="text-xs font-medium text-gray-500">Body</p>
                    <pre className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{generatedEmail.body}</pre>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`Subject: ${generatedEmail.subject}\n\n${generatedEmail.body}`)
                        toast.success('Copied to clipboard')
                      }}
                      className="mt-2 text-xs font-medium text-indigo-600 hover:text-indigo-700"
                    >
                      Copy to clipboard
                    </button>
                  </div>
                )}
              </div>

              {/* AI Summary */}
              <div className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">AI Summary</h4>
                    <p className="mt-0.5 text-xs text-gray-500">Generate an AI-powered lead summary</p>
                  </div>
                  <button
                    onClick={handleGetSummary}
                    disabled={summaryLoading}
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {summaryLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Summarise
                  </button>
                </div>
                {aiSummary && (
                  <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50/50 p-4">
                    <p className="text-sm leading-relaxed text-gray-700">{aiSummary}</p>
                  </div>
                )}
              </div>

              {/* ICP Display */}
              {lead.icp_fit && (
                <div className="rounded-lg border border-gray-200 p-4">
                  <h4 className="text-sm font-medium text-gray-900">ICP Match</h4>
                  <div className="mt-2 flex items-center gap-3">
                    <span className={cn('rounded-full border px-3 py-1 text-sm font-semibold capitalize', getICPBadge(lead.icp_fit).color)}>
                      {lead.icp_fit}
                    </span>
                    {scoreResult?.reasoning && (
                      <p className="text-xs text-gray-500">{scoreResult.reasoning}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CAMPAIGNS TAB */}
          {activeTab === 'campaigns' && (
            <div className="p-6">
              <div className="py-12 text-center">
                <MessageSquare className="mx-auto h-8 w-8 text-gray-300" />
                <p className="mt-2 text-sm font-medium text-gray-900">No campaigns yet</p>
                <p className="mt-1 text-xs text-gray-500">This lead is not enrolled in any campaigns.</p>
                <button className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                  <Plus className="h-4 w-4" /> Add to Campaign
                </button>
              </div>
            </div>
          )}

          {/* DEALS TAB */}
          {activeTab === 'deals' && (
            <div className="p-6">
              <div className="py-12 text-center">
                <IndianRupee className="mx-auto h-8 w-8 text-gray-300" />
                <p className="mt-2 text-sm font-medium text-gray-900">No deals yet</p>
                <p className="mt-1 text-xs text-gray-500">No deals are associated with this lead.</p>
                <button className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                  <Plus className="h-4 w-4" /> Create Deal
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
