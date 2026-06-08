import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Globe,
  Mail,
  Phone,
  Building2,
  Users,
  IndianRupee,
  MapPin,
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
  FileSignature,
  Download,
  Wand2,
  CheckCircle2,
  AlertCircle,
  Linkedin,
  Copy,
  Check,
  UserCheck,
  Trash2,
  MessageCircle,
} from 'lucide-react'
import { useLead } from '@/hooks/useLeads'
import { useLeadScore, useEmailGen, type EmailGenRequest } from '@/hooks/useAI'
import { useProposals, useGenerateProposal, openProposalHtmlExport, downloadProposalDocx } from '@/hooks/useProposals'
import { useEnrichLead, useEnrichmentLogs, FIELD_LABELS, type EnrichmentResult } from '@/hooks/useEnrichment'
import {
  useLeadLinkedInMessages,
  useGenerateLinkedInMessage,
  useUpdateLinkedInMessage,
  useDeleteLinkedInMessage,
  useEnrichLinkedInProfile,
  LINKEDIN_STATUSES,
  TONE_OPTIONS,
  type LinkedInMessage,
} from '@/hooks/useLinkedIn'
import {
  useWhatsAppThread,
  useGenerateWhatsAppMessage,
  useSendWhatsAppMessage,
  useDeleteWhatsAppMessage,
  WA_TONE_OPTIONS,
  WA_STATUSES,
} from '@/hooks/useWhatsApp'
import {
  useEmailSequences,
  ENROLLMENT_STATUSES,
  type SequenceEnrollment,
} from '@/hooks/useEmailSequences'
import {
  useLeadDeals,
  useCreateDeal,
  useMarkWon,
  useMarkLost,
  DEAL_STATUS_META,
  type Deal,
} from '@/hooks/usePipelineDeals'
import {
  useLeadTasks,
  useCreateTask,
  useCompleteTask,
  useReopenTask,
  useDeleteTask,
  PRIORITY_META,
  TASK_TYPE_META,
  type Task,
} from '@/hooks/useTasks'
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
  formatDate,
} from '@/lib/utils'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import api from '@/lib/api'

type TabKey = 'overview' | 'activity' | 'ai' | 'campaigns' | 'deals' | 'proposals' | 'linkedin' | 'whatsapp' | 'sequences' | 'tasks'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview',   label: 'Overview' },
  { key: 'activity',   label: 'Activity' },
  { key: 'tasks',      label: 'Tasks' },
  { key: 'deals',      label: 'Deals' },
  { key: 'ai',         label: 'AI Actions' },
  { key: 'proposals',  label: 'Proposals' },
  { key: 'linkedin',   label: 'LinkedIn' },
  { key: 'whatsapp',   label: 'WhatsApp' },
  { key: 'sequences',  label: 'Sequences' },
  { key: 'campaigns',  label: 'Campaigns' },
]

// Must mirror backend/schemas/lead.py::LeadStage. See STAGE_LABELS.
const STAGES_ORDER = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'nurture', 'lost']

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

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: lead, isLoading, refetch } = useLead(id || '')
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
  const [emailTone, setEmailTone] = useState<EmailGenRequest['tone']>('formal')

  // Activity state
  const [activities, setActivities] = useState<Activity[]>([])
  const [newActivity, setNewActivity] = useState({ type: 'call', note: '', outcome: '' })
  const [showActivityForm, setShowActivityForm] = useState(false)

  // Enrichment state
  const enrichLeadMutation = useEnrichLead()
  const [enrichResult, setEnrichResult] = useState<EnrichmentResult | null>(null)

  async function handleEnrichLead() {
    if (!id) return
    try {
      const result = await enrichLeadMutation.mutateAsync({ leadId: id })
      setEnrichResult(result)
      if (result.fields_updated.length > 0) {
        toast.success(`Enriched: ${result.fields_updated.map(f => FIELD_LABELS[f] || f).join(', ')}`)
        refetch()
      } else {
        toast(result.message, { icon: 'ℹ️' })
      }
    } catch {
      toast.error('Enrichment failed. Check your API keys on Railway.')
    }
  }

  // Proposals state
  const { data: proposals = [], isLoading: proposalsLoading } = useProposals(id)
  const generateProposalMutation = useGenerateProposal()
  const [proposalType, setProposalType] = useState<'service_proposal' | 'project_quote' | 'intro_letter'>('service_proposal')
  const [proposalTone, setProposalTone] = useState<'professional' | 'friendly' | 'formal' | 'consultative'>('professional')

  // LinkedIn state
  const { data: linkedInMessages = [], isLoading: liLoading } = useLeadLinkedInMessages(id || '')
  const generateLiMutation = useGenerateLinkedInMessage(id || '')
  const updateLiMutation = useUpdateLinkedInMessage()
  const deleteLiMutation = useDeleteLinkedInMessage()
  const enrichLiMutation = useEnrichLinkedInProfile(id || '')
  const [liTone, setLiTone] = useState<'professional' | 'friendly' | 'value-first' | 'curiosity'>('professional')
  const [liContext, setLiContext] = useState('')
  const [liEnrichResult, setLiEnrichResult] = useState<{ source: string; headline: string | null; summary: string | null; warning: string | null } | null>(null)
  const [liCopied, setLiCopied] = useState<string | null>(null)

  // WhatsApp state
  const { data: waMessages = [], isLoading: waLoading } = useWhatsAppThread(id || '')
  const generateWaMutation = useGenerateWhatsAppMessage(id || '')
  const sendWaMutation = useSendWhatsAppMessage(id || '')
  const deleteWaMutation = useDeleteWhatsAppMessage()
  const [waTone, setWaTone] = useState<'friendly' | 'professional' | 'value-first' | 'curiosity'>('friendly')
  const [waContext, setWaContext] = useState('')
  const [waCopied, setWaCopied] = useState<string | null>(null)
  const [waSendingId, setWaSendingId] = useState<string | null>(null)

  // Sequences state
  const { data: allSequences = [] } = useEmailSequences()
  const [enrollingSeqId, setEnrollingSeqId] = useState<string | null>(null)
  const [seqEnrollments, setSeqEnrollments] = useState<SequenceEnrollment[]>([])
  const [seqEnrollmentsLoaded, setSeqEnrollmentsLoaded] = useState(false)

  // Deals state
  const { data: leadDeals = [], isLoading: dealsLoading } = useLeadDeals(id || '')
  const createDealMutation = useCreateDeal()
  const markWonMutation = useMarkWon()
  const markLostMutation = useMarkLost()
  const [showCreateDeal, setShowCreateDeal] = useState(false)
  const [dealStages, setDealStages] = useState<{ id: string; name: string }[]>([])
  const [dealForm, setDealForm] = useState({ title: '', stage_id: '', value_inr: '', probability: '20', close_date: '' })
  const [dealStagesLoaded, setDealStagesLoaded] = useState(false)

  async function loadDealStages() {
    if (dealStagesLoaded) return
    try {
      const { data } = await api.get<{ id: string; name: string }[]>('/pipeline/stages')
      setDealStages(data)
      if (data.length > 0) setDealForm((f) => ({ ...f, stage_id: data[0].id }))
      setDealStagesLoaded(true)
    } catch { /* ignore */ }
  }

  async function handleCreateDeal(e: React.FormEvent) {
    e.preventDefault()
    if (!id || !dealForm.stage_id) return
    try {
      await createDealMutation.mutateAsync({
        lead_id: id,
        stage_id: dealForm.stage_id,
        title: dealForm.title,
        value_inr: dealForm.value_inr ? Number(dealForm.value_inr) : undefined,
        probability: dealForm.probability ? Number(dealForm.probability) : undefined,
        close_date: dealForm.close_date || undefined,
      })
      toast.success('Deal created!')
      setShowCreateDeal(false)
      setDealForm({ title: '', stage_id: dealStages[0]?.id ?? '', value_inr: '', probability: '20', close_date: '' })
    } catch {
      toast.error('Failed to create deal')
    }
  }

  async function loadLeadEnrollments() {
    if (!id || seqEnrollmentsLoaded) return
    try {
      // Fetch enrollments for this lead across all sequences
      const results: SequenceEnrollment[] = []
      for (const seq of allSequences) {
        try {
          const res = await import('@/lib/api').then(({ default: a }) =>
            a.get<SequenceEnrollment[]>(`/email-sequences/${seq.id}/enrollments`)
          )
          const forThisLead = res.data.filter((e) => e.lead_id === id)
          results.push(...forThisLead)
        } catch {
          // skip
        }
      }
      setSeqEnrollments(results)
      setSeqEnrollmentsLoaded(true)
    } catch {
      // ignore
    }
  }

  async function handleGenerateWaMessage() {
    if (!id) return
    try {
      await generateWaMutation.mutateAsync({ tone: waTone, context: waContext.trim() || undefined })
      toast.success('WhatsApp message generated!')
    } catch {
      toast.error('Failed to generate. Check AI quota.')
    }
  }

  async function handleSendWaMessage(msgId: string, content: string) {
    if (!id) return
    setWaSendingId(msgId)
    try {
      const result = await sendWaMutation.mutateAsync({ content, message_type: 'ai_generated', ai_tone: waTone })
      if (result.success) {
        toast.success('Sent via WhatsApp!')
      } else {
        toast.error(result.warning ?? 'Send failed — check WA_API_KEY on Railway.')
      }
    } catch {
      toast.error('Failed to send message')
    } finally {
      setWaSendingId(null)
    }
  }

  function copyWa(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setWaCopied(key)
    toast.success('Copied!')
    setTimeout(() => setWaCopied(null), 2000)
  }

  async function handleGenerateLiMessage() {
    if (!id) return
    try {
      await generateLiMutation.mutateAsync({
        tone: liTone,
        context: liContext.trim() || undefined,
        include_followup: true,
      })
      toast.success('LinkedIn messages generated!')
    } catch {
      toast.error('Failed to generate. Check AI quota.')
    }
  }

  async function handleLiEnrich() {
    if (!id) return
    try {
      const result = await enrichLiMutation.mutateAsync()
      setLiEnrichResult(result)
      if (result.source === 'proxycurl') {
        toast.success('LinkedIn profile enriched!')
      } else {
        toast(result.warning || 'Could not enrich profile', { icon: 'ℹ️' })
      }
    } catch {
      toast.error('LinkedIn enrichment failed')
    }
  }

  function copyLi(text: string, id: string) {
    navigator.clipboard.writeText(text)
    setLiCopied(id)
    toast.success('Copied!')
    setTimeout(() => setLiCopied(null), 2000)
  }

  async function handleLiStatusChange(msg: LinkedInMessage, newStatus: LinkedInMessage['status']) {
    const now = new Date().toISOString()
    const extra: Record<string, string> = {}
    if (newStatus === 'sent' && !msg.sent_at) extra.sent_at = now
    if (newStatus === 'connected' && !msg.connected_at) extra.connected_at = now
    if (newStatus === 'replied' && !msg.replied_at) extra.replied_at = now
    try {
      await updateLiMutation.mutateAsync({ id: msg.id, updates: { status: newStatus, ...extra } })
    } catch {
      toast.error('Failed to update status')
    }
  }

  async function handleScoreLead() {
    if (!id) return
    try {
      const results = await scoreLeadMutation.mutateAsync({ lead_ids: [id] })
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
    if (!id) return
    try {
      const result = await emailGenMutation.mutateAsync({
        lead_id: id,
        email_type: emailType,
        tone: emailTone,
      })
      setGeneratedEmail({ subject: result.subject, body: result.body })
      toast.success('Email generated')
    } catch {
      toast.error('Failed to generate email')
    }
  }

  async function handleGenerateProposal() {
    if (!id) return
    try {
      await generateProposalMutation.mutateAsync({
        lead_id: id,
        proposal_type: proposalType,
        tone: proposalTone,
      })
      toast.success('Proposal generated!')
      setActiveTab('proposals')
    } catch {
      toast.error('Failed to generate proposal. Check AI quota.')
    }
  }

  async function handleGetSummary() {
    if (!id) return
    setSummaryLoading(true)
    try {
      const { data } = await api.get(`/ai/lead-summary/${id}`)
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

  if (isLoading) {
    return <LeadDetailSkeleton />
  }

  if (!lead) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm text-gray-500">Lead not found</p>
        <button
          onClick={() => navigate('/leads')}
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Leads
        </button>
      </div>
    )
  }

  const scoreBadge = getScoreBadge(lead.lead_score ?? 0)
  const icpBadge = lead.icp_match ? getICPBadge(lead.icp_match) : null
  const sectorColor = SECTOR_COLORS[lead.sector_code] || '#6B7280'
  const currentStageIdx = STAGES_ORDER.indexOf(lead.stage)

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={() => navigate('/leads')}
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Leads
      </button>

      {/* Header */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{lead.company_name}</h1>
              <span
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={{ backgroundColor: `${sectorColor}15`, color: sectorColor }}
              >
                {SECTOR_NAMES[lead.sector_code] || lead.sector_code}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', scoreBadge.color)}>
                Score: {lead.lead_score ?? 0} ({scoreBadge.label})
              </span>
              {icpBadge && (
                <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium', icpBadge.color)}>
                  ICP: {lead.icp_match}
                </span>
              )}
              <span
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={{ backgroundColor: `${STAGE_COLORS[lead.stage]}15`, color: STAGE_COLORS[lead.stage] }}
              >
                {STAGE_LABELS[lead.stage] || lead.stage}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-sm text-gray-500">Contact: {lead.contact_name}</p>
            <button
              onClick={handleEnrichLead}
              disabled={enrichLeadMutation.isPending}
              title="Auto-fill missing fields using Apollo.io + Hunter.io"
              className="inline-flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-50"
            >
              {enrichLeadMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Wand2 className="h-3.5 w-3.5" />
              )}
              Enrich Lead
            </button>
          </div>
        </div>
      </div>

      {/* Enrichment result banner */}
      {enrichResult && (
        <EnrichmentBanner result={enrichResult} onDismiss={() => setEnrichResult(null)} />
      )}

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
      <div className="rounded-xl border border-gray-200 bg-white">
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

            {/* Two-column info grid */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
                    {lead.annual_revenue_inr && (
                      <div>
                        <dt className="flex items-center gap-1.5 text-xs text-gray-500"><IndianRupee className="h-3.5 w-3.5" /> Revenue</dt>
                        <dd className="mt-0.5 text-sm text-gray-900">{formatINR(lead.annual_revenue_inr)}</dd>
                      </div>
                    )}
                    <div>
                      <dt className="flex items-center gap-1.5 text-xs text-gray-500"><MapPin className="h-3.5 w-3.5" /> Location</dt>
                      <dd className="mt-0.5 text-sm text-gray-900">{[lead.city, lead.district, lead.state].filter(Boolean).join(', ')}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500">Source</dt>
                      <dd className="mt-0.5 text-sm text-gray-900">{lead.source || 'N/A'}</dd>
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
                    {lead.email && (
                      <div>
                        <dt className="flex items-center gap-1.5 text-xs text-gray-500"><Mail className="h-3.5 w-3.5" /> Email</dt>
                        <dd className="mt-0.5">
                          <a href={`mailto:${lead.email}`} className="text-sm text-indigo-600 hover:underline">
                            {lead.email}
                          </a>
                        </dd>
                      </div>
                    )}
                    {lead.phone && (
                      <div>
                        <dt className="flex items-center gap-1.5 text-xs text-gray-500"><Phone className="h-3.5 w-3.5" /> Phone</dt>
                        <dd className="mt-0.5">
                          <a href={`tel:${lead.phone}`} className="text-sm text-indigo-600 hover:underline">
                            {lead.phone}
                          </a>
                        </dd>
                      </div>
                    )}
                    {lead.linkedin_url && (
                      <div>
                        <dt className="text-xs text-gray-500">LinkedIn</dt>
                        <dd className="mt-0.5">
                          <a
                            href={lead.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-indigo-600 hover:underline"
                          >
                            {lead.linkedin_url}
                          </a>
                        </dd>
                      </div>
                    )}
                    {lead.designation && (
                      <div>
                        <dt className="text-xs text-gray-500">Designation</dt>
                        <dd className="mt-0.5 text-sm text-gray-900">{lead.designation}</dd>
                      </div>
                    )}
                  </dl>
                </div>
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
                  <dd>{lead.updated_at ? timeAgo(lead.updated_at) : '—'}</dd>
                </div>
              </dl>
            </div>
          </div>
        )}

        {/* ACTIVITY TAB */}
        {activeTab === 'activity' && (
          <div className="p-6">
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
            {/* Enrichment card */}
            <EnrichmentCard leadId={id || ''} onEnrich={handleEnrichLead} isPending={enrichLeadMutation.isPending} />
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
                  onChange={(e) => setEmailTone(e.target.value as EmailGenRequest['tone'])}
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
          </div>
        )}

        {/* PROPOSALS TAB */}
        {activeTab === 'proposals' && (
          <div className="space-y-5 p-6">
            {/* Generate panel */}
            <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-gray-900">Generate AI Proposal</h4>
                  <p className="mt-0.5 text-xs text-gray-500">
                    AI writes a full sector-specific sales proposal for this lead
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <select
                  value={proposalType}
                  onChange={(e) => setProposalType(e.target.value as typeof proposalType)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                >
                  <option value="service_proposal">Service Proposal</option>
                  <option value="project_quote">Project Quote</option>
                  <option value="intro_letter">Introduction Letter</option>
                </select>
                <select
                  value={proposalTone}
                  onChange={(e) => setProposalTone(e.target.value as typeof proposalTone)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                >
                  <option value="professional">Professional</option>
                  <option value="consultative">Consultative</option>
                  <option value="friendly">Friendly</option>
                  <option value="formal">Formal</option>
                </select>
                <button
                  onClick={handleGenerateProposal}
                  disabled={generateProposalMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {generateProposalMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileSignature className="h-4 w-4" />
                  )}
                  Generate
                </button>
              </div>
            </div>

            {/* List of existing proposals */}
            {proposalsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
              </div>
            ) : proposals.length === 0 ? (
              <div className="py-10 text-center">
                <FileSignature className="mx-auto h-8 w-8 text-gray-300" />
                <p className="mt-2 text-sm text-gray-500">No proposals generated yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {proposals.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900 truncate max-w-xs">{p.title}</p>
                      <p className="mt-0.5 text-xs text-gray-400">
                        {p.proposal_type.replace(/_/g, ' ')} · {p.status} · {formatDate(p.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openProposalHtmlExport(p.id)}
                        title="View / Print as PDF"
                        className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50"
                      >
                        <FileText className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => downloadProposalDocx(p.id)}
                        title="Download Word"
                        className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => navigate(`/proposals/${p.id}`)}
                        className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                      >
                        Open
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* LINKEDIN TAB */}
        {activeTab === 'linkedin' && (
          <div className="space-y-5 p-6">
            {/* Header row */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-600">
                    <Linkedin className="h-3.5 w-3.5 text-white" />
                  </div>
                  LinkedIn Outreach
                </h3>
                {lead.linkedin_url ? (
                  <a
                    href={lead.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 flex items-center gap-1 text-xs text-blue-600 hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {lead.linkedin_url.replace(/https?:\/\/(www\.)?linkedin\.com\/in\//, '').replace(/\/$/, '')}
                  </a>
                ) : (
                  <p className="mt-0.5 text-xs text-gray-400">No LinkedIn URL on this lead</p>
                )}
              </div>
              {lead.linkedin_url && (
                <button
                  onClick={handleLiEnrich}
                  disabled={enrichLiMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                >
                  {enrichLiMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <UserCheck className="h-3.5 w-3.5" />
                  )}
                  Enrich from LinkedIn
                </button>
              )}
            </div>

            {/* Enrichment result */}
            {liEnrichResult && liEnrichResult.source === 'proxycurl' && (
              <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-4">
                {liEnrichResult.headline && (
                  <p className="text-sm font-medium text-gray-900">{liEnrichResult.headline}</p>
                )}
                {liEnrichResult.summary && (
                  <p className="mt-1 line-clamp-3 text-xs text-gray-600">{liEnrichResult.summary}</p>
                )}
              </div>
            )}
            {liEnrichResult?.warning && liEnrichResult.source !== 'proxycurl' && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                <p className="text-xs text-amber-800">{liEnrichResult.warning}</p>
              </div>
            )}

            {/* Generate panel */}
            <div className="rounded-lg border border-blue-100 bg-blue-50/30 p-4">
              <h4 className="mb-3 text-sm font-semibold text-gray-900">Generate AI Messages</h4>
              {/* Tone chips */}
              <div className="mb-3 flex flex-wrap gap-2">
                {TONE_OPTIONS.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setLiTone(t.value)}
                    title={t.description}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                      liTone === t.value
                        ? 'border-blue-500 bg-blue-100 text-blue-700'
                        : 'border-gray-200 text-gray-600 hover:border-blue-300'
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              {/* Context input */}
              <textarea
                rows={2}
                value={liContext}
                onChange={(e) => setLiContext(e.target.value)}
                placeholder="Optional: what you offer (e.g. 'We help IT firms hire remote engineers at 40% lower cost')"
                className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-700 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                onClick={handleGenerateLiMessage}
                disabled={generateLiMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {generateLiMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {generateLiMutation.isPending ? 'Generating…' : 'Generate Messages'}
              </button>
            </div>

            {/* Messages list */}
            {liLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            ) : linkedInMessages.length === 0 ? (
              <div className="py-8 text-center">
                <Linkedin className="mx-auto h-8 w-8 text-gray-300" />
                <p className="mt-2 text-sm text-gray-500">No messages generated yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {linkedInMessages.map((msg) => {
                  const statusMeta = LINKEDIN_STATUSES.find((s) => s.value === msg.status) || LINKEDIN_STATUSES[0]
                  return (
                    <div key={msg.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                      {/* Status + actions row */}
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium', statusMeta.color)}>
                            {statusMeta.label}
                          </span>
                          <span className="text-xs text-gray-400">{msg.ai_tone} · {formatDate(msg.created_at)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {/* Status change */}
                          {LINKEDIN_STATUSES.filter((s) => s.value !== msg.status).slice(0, 3).map((s) => (
                            <button
                              key={s.value}
                              onClick={() => handleLiStatusChange(msg, s.value)}
                              disabled={updateLiMutation.isPending}
                              className={cn('rounded-full px-2 py-0.5 text-xs font-medium transition-colors', s.color, 'opacity-60 hover:opacity-100')}
                            >
                              → {s.label}
                            </button>
                          ))}
                          <button
                            onClick={async () => {
                              if (window.confirm('Delete this message?')) {
                                await deleteLiMutation.mutateAsync(msg.id)
                              }
                            }}
                            className="ml-1 rounded-lg p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Connection note */}
                      <div className="mb-3">
                        <div className="mb-1 flex items-center justify-between">
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Connection Note ({msg.connection_note.length}/300)
                          </p>
                          <button
                            onClick={() => copyLi(msg.connection_note, `note-${msg.id}`)}
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                          >
                            {liCopied === `note-${msg.id}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                            Copy
                          </button>
                        </div>
                        <p className="rounded-lg bg-blue-50/60 px-3 py-2.5 text-sm text-gray-800 leading-relaxed">
                          {msg.connection_note}
                        </p>
                      </div>

                      {/* Follow-up */}
                      {msg.followup_message && (
                        <div>
                          <div className="mb-1 flex items-center justify-between">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Follow-up Message</p>
                            <button
                              onClick={() => copyLi(msg.followup_message!, `followup-${msg.id}`)}
                              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                            >
                              {liCopied === `followup-${msg.id}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                              Copy
                            </button>
                          </div>
                          <p className="rounded-lg bg-gray-50 px-3 py-2.5 text-sm text-gray-700 leading-relaxed">
                            {msg.followup_message}
                          </p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* WHATSAPP TAB */}
        {activeTab === 'whatsapp' && (
          <div className="space-y-5 p-6">
            {/* Header row */}
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <div className="flex h-6 w-6 items-center justify-center rounded bg-green-500">
                  <MessageCircle className="h-3.5 w-3.5 text-white" />
                </div>
                WhatsApp Outreach
              </h3>
              {lead.phone ? (
                <span className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Phone className="h-3.5 w-3.5" />
                  {lead.phone}
                </span>
              ) : (
                <span className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs text-amber-700">
                  <AlertCircle className="h-3.5 w-3.5" />
                  No phone number — add one before sending
                </span>
              )}
            </div>

            {/* Generate panel */}
            <div className="rounded-lg border border-green-100 bg-green-50/30 p-4">
              <h4 className="mb-3 text-sm font-semibold text-gray-900">Generate AI Message</h4>

              {/* Tone chips */}
              <div className="mb-3 flex flex-wrap gap-2">
                {WA_TONE_OPTIONS.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setWaTone(t.value)}
                    title={t.description}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                      waTone === t.value
                        ? 'border-green-500 bg-green-100 text-green-700'
                        : 'border-gray-200 text-gray-600 hover:border-green-300'
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Context input */}
              <textarea
                rows={2}
                value={waContext}
                onChange={(e) => setWaContext(e.target.value)}
                placeholder="Optional: what you offer (e.g. 'We help IT firms cut hiring costs by 40%')"
                className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-700 placeholder-gray-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              />

              <button
                onClick={handleGenerateWaMessage}
                disabled={generateWaMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {generateWaMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {generateWaMutation.isPending ? 'Generating…' : 'Generate Message'}
              </button>
            </div>

            {/* Chat thread */}
            {waLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-green-600" />
              </div>
            ) : waMessages.length === 0 ? (
              <div className="py-8 text-center">
                <MessageCircle className="mx-auto h-8 w-8 text-gray-300" />
                <p className="mt-2 text-sm text-gray-500">No messages yet</p>
                <p className="mt-1 text-xs text-gray-400">Generate a message above to get started.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {waMessages.map((msg) => {
                  const isOutbound = msg.direction === 'outbound'
                  const statusMeta = WA_STATUSES.find((s) => s.value === msg.status)
                  const isPending = msg.status === 'pending'
                  const isSending = waSendingId === msg.id

                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        'flex',
                        isOutbound ? 'justify-end' : 'justify-start'
                      )}
                    >
                      <div
                        className={cn(
                          'relative max-w-[80%] rounded-2xl px-4 py-3 shadow-sm',
                          isOutbound
                            ? 'rounded-tr-sm bg-green-50 border border-green-200'
                            : 'rounded-tl-sm bg-white border border-gray-200'
                        )}
                      >
                        {/* Message content */}
                        <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                          {msg.content}
                        </p>

                        {/* Footer row */}
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-1.5">
                            {statusMeta && (
                              <span className={cn('inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium', statusMeta.color)}>
                                {msg.status}
                              </span>
                            )}
                            {msg.ai_tone && (
                              <span className="text-xs text-gray-400 capitalize">{msg.ai_tone}</span>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            {/* Copy */}
                            <button
                              onClick={() => copyWa(msg.content, msg.id)}
                              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                              title="Copy message"
                            >
                              {waCopied === msg.id ? (
                                <Check className="h-3.5 w-3.5 text-green-500" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>

                            {/* Send (only for pending outbound) */}
                            {isOutbound && isPending && (
                              <button
                                onClick={() => handleSendWaMessage(msg.id, msg.content)}
                                disabled={isSending || sendWaMutation.isPending}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                                title="Send via WhatsApp"
                              >
                                {isSending ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Send className="h-3 w-3" />
                                )}
                                Send
                              </button>
                            )}

                            {/* Delete */}
                            <button
                              onClick={async () => {
                                if (window.confirm('Delete this message?')) {
                                  await deleteWaMutation.mutateAsync(msg.id)
                                }
                              }}
                              className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Error */}
                        {msg.error_message && (
                          <p className="mt-1 text-xs text-red-500">⚠ {msg.error_message}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* SEQUENCES TAB */}
        {activeTab === 'sequences' && (
          <div className="space-y-5 p-6">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <Mail className="h-4 w-4 text-indigo-500" />
                Email Sequences
              </h3>
              <button
                onClick={loadLeadEnrollments}
                className="text-xs text-indigo-600 hover:text-indigo-800"
              >
                {seqEnrollmentsLoaded ? 'Refresh' : 'Load enrollments'}
              </button>
            </div>

            {/* Current enrollments */}
            {seqEnrollmentsLoaded && seqEnrollments.length > 0 && (
              <div className="rounded-lg border border-gray-100 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Sequence</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Status</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Step</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Next send</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {seqEnrollments.map((e) => {
                      const statusMeta = ENROLLMENT_STATUSES.find((s) => s.value === e.status)
                      return (
                        <tr key={e.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-sm font-medium text-gray-800">
                            {e.sequence_name ?? 'Sequence'}
                          </td>
                          <td className="px-3 py-2">
                            <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', statusMeta?.color ?? 'bg-gray-100 text-gray-500')}>
                              {statusMeta?.label ?? e.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-600">{e.current_step}</td>
                          <td className="px-3 py-2 text-xs text-gray-400">
                            {e.next_step_at
                              ? new Date(e.next_step_at).toLocaleString('en-IN')
                              : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {seqEnrollmentsLoaded && seqEnrollments.length === 0 && (
              <p className="text-xs text-gray-400">This lead is not enrolled in any sequences.</p>
            )}

            {/* Enroll in a sequence */}
            <div className="rounded-lg border border-indigo-100 bg-indigo-50/30 p-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Enroll in a Sequence</h4>
              {allSequences.filter((s) => s.status === 'active').length === 0 ? (
                <p className="text-xs text-gray-500">
                  No active sequences yet.{' '}
                  <a href="/email-sequences" className="text-indigo-600 hover:underline">
                    Create one first →
                  </a>
                </p>
              ) : (
                <div className="space-y-2">
                  {allSequences
                    .filter((s) => s.status === 'active')
                    .map((seq) => {
                      const alreadyEnrolled = seqEnrollments.some(
                        (e) => e.sequence_id === seq.id && e.status === 'active'
                      )
                      return (
                        <div
                          key={seq.id}
                          className="flex items-center justify-between rounded-lg bg-white border border-gray-200 px-3 py-2"
                        >
                          <div>
                            <p className="text-sm font-medium text-gray-800">{seq.name}</p>
                            <p className="text-xs text-gray-400">{seq.step_count} steps · {seq.enrolled_count} enrolled</p>
                          </div>
                          <button
                            disabled={alreadyEnrolled || enrollingSeqId === seq.id || !id}
                            onClick={async () => {
                              if (!id) return
                              setEnrollingSeqId(seq.id)
                              try {
                                const { data } = await api.post<SequenceEnrollment>(
                                  `/email-sequences/${seq.id}/enroll`,
                                  { lead_id: id }
                                )
                                setSeqEnrollments((prev) => [...prev, data])
                                toast.success(`Enrolled in "${seq.name}"!`)
                              } catch {
                                toast.error('Enrollment failed (already enrolled?)')
                              } finally {
                                setEnrollingSeqId(null)
                              }
                            }}
                            className={cn(
                              'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                              alreadyEnrolled
                                ? 'bg-green-50 text-green-600 cursor-default'
                                : 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50'
                            )}
                          >
                            {alreadyEnrolled ? (
                              <span className="flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Enrolled
                              </span>
                            ) : enrollingSeqId === seq.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              'Enroll'
                            )}
                          </button>
                        </div>
                      )
                    })}
                </div>
              )}
            </div>
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
          <div className="p-6 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Deals</h3>
              <button
                onClick={() => {
                  loadDealStages()
                  setShowCreateDeal((v) => !v)
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
              >
                <Plus className="h-3.5 w-3.5" /> New Deal
              </button>
            </div>

            {/* Create form */}
            {showCreateDeal && (
              <form onSubmit={handleCreateDeal} className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Deal title *</label>
                    <input
                      required
                      type="text"
                      value={dealForm.title}
                      onChange={(e) => setDealForm((f) => ({ ...f, title: e.target.value }))}
                      placeholder="e.g. Enterprise SaaS — Q3"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Stage *</label>
                    <select
                      value={dealForm.stage_id}
                      onChange={(e) => setDealForm((f) => ({ ...f, stage_id: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    >
                      {dealStages.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Value (₹)</label>
                    <input
                      type="number" min={0}
                      value={dealForm.value_inr}
                      onChange={(e) => setDealForm((f) => ({ ...f, value_inr: e.target.value }))}
                      placeholder="0"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Probability (%)</label>
                    <input
                      type="number" min={0} max={100}
                      value={dealForm.probability}
                      onChange={(e) => setDealForm((f) => ({ ...f, probability: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Close date</label>
                    <input
                      type="date"
                      value={dealForm.close_date}
                      onChange={(e) => setDealForm((f) => ({ ...f, close_date: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={createDealMutation.isPending || !dealForm.title || !dealForm.stage_id}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {createDealMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Create
                  </button>
                  <button type="button" onClick={() => setShowCreateDeal(false)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* Deal list */}
            {dealsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-indigo-400" /></div>
            ) : leadDeals.length === 0 ? (
              <div className="py-10 text-center">
                <IndianRupee className="mx-auto h-7 w-7 text-gray-300" />
                <p className="mt-2 text-sm font-medium text-gray-500">No deals yet</p>
                <p className="text-xs text-gray-400 mt-1">Click "New Deal" to track a revenue opportunity.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {(leadDeals as Deal[]).map((deal) => {
                  const statusMeta = DEAL_STATUS_META[deal.status] ?? DEAL_STATUS_META.open
                  const weighted = ((deal.value_inr ?? 0) * (deal.probability ?? 0)) / 100
                  return (
                    <div key={deal.id} className="rounded-xl border border-gray-200 bg-white p-4 hover:border-indigo-200 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Link
                              to={`/deals/${deal.id}`}
                              className="text-sm font-semibold text-gray-900 hover:text-indigo-600 truncate"
                            >
                              {deal.title}
                            </Link>
                            <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium', statusMeta.color)}>
                              {statusMeta.label}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500">
                            {deal.value_inr != null && (
                              <span className="flex items-center gap-0.5">
                                <IndianRupee className="w-3 h-3" />
                                {formatINR(deal.value_inr)}
                              </span>
                            )}
                            {deal.probability != null && (
                              <span>{deal.probability}% → {formatINR(weighted)} weighted</span>
                            )}
                            {deal.stage_name && <span className="text-gray-400">{deal.stage_name}</span>}
                            {deal.close_date && (
                              <span className={cn(
                                'flex items-center gap-0.5',
                                new Date(deal.close_date) < new Date() && deal.status === 'open' ? 'text-red-400' : ''
                              )}>
                                <Calendar className="w-3 h-3" />
                                {new Date(deal.close_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          {deal.status === 'open' && (
                            <>
                              <button
                                onClick={async () => {
                                  await markWonMutation.mutateAsync(deal.id)
                                  toast.success('🎉 Won!')
                                }}
                                title="Mark Won"
                                className="rounded-lg bg-green-50 border border-green-200 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100"
                              >
                                Won
                              </button>
                              <button
                                onClick={async () => {
                                  await markLostMutation.mutateAsync({ id: deal.id })
                                  toast.success('Deal marked lost')
                                }}
                                title="Mark Lost"
                                className="rounded-lg bg-red-50 border border-red-100 px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-100"
                              >
                                Lost
                              </button>
                            </>
                          )}
                          <Link
                            to={`/deals/${deal.id}`}
                            className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-50"
                          >
                            View →
                          </Link>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* TASKS TAB */}
        {activeTab === 'tasks' && (
          <LeadTasksPanel leadId={id ?? ''} />
        )}
      </div>
    </div>
  )
}

// ─── Lead tasks panel ─────────────────────────────────────────────────────────

function LeadTasksPanel({ leadId }: { leadId: string }) {
  const { data: tasks = [], isLoading } = useLeadTasks(leadId)
  const createMutation   = useCreateTask()
  const completeMutation = useCompleteTask()
  const reopenMutation   = useReopenTask()
  const deleteMutation   = useDeleteTask()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<{ title: string; task_type: Task['task_type']; priority: Task['priority']; due_date: string }>({
    title: '', task_type: 'follow_up', priority: 'medium', due_date: '',
  })

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    try {
      await createMutation.mutateAsync({
        title: form.title,
        task_type: form.task_type,
        priority: form.priority,
        due_date: form.due_date || undefined,
        lead_id: leadId,
      })
      toast.success('Task created')
      setShowForm(false)
      setForm({ title: '', task_type: 'follow_up', priority: 'medium', due_date: '' })
    } catch {
      toast.error('Failed to create task')
    }
  }

  const open = tasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled')
  const done = tasks.filter((t) => t.status === 'done')

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">
          Tasks
          {open.length > 0 && (
            <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
              {open.length} open
            </span>
          )}
        </h3>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
        >
          <Plus className="w-3.5 h-3.5" /> Add Task
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-4 space-y-3">
          <input
            autoFocus required
            type="text"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Task title..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
          <div className="grid grid-cols-3 gap-2">
            <select value={form.task_type} onChange={(e) => setForm((f) => ({ ...f, task_type: e.target.value as Task['task_type'] }))}
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs">
              {Object.entries(TASK_TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as Task['priority'] }))}
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs">
              {Object.entries(PRIORITY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <input type="datetime-local" value={form.due_date}
              onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs" />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={!form.title.trim() || createMutation.isPending}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
              {createMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : 'Add'}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-indigo-400" /></div>
      ) : tasks.length === 0 && !showForm ? (
        <div className="py-10 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-gray-200" />
          <p className="mt-2 text-sm text-gray-400">No tasks yet for this lead.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {[...open, ...done].map((t) => {
            const isDone = t.status === 'done'
            const pm = PRIORITY_META[t.priority] ?? PRIORITY_META.medium
            const tm = TASK_TYPE_META[t.task_type] ?? TASK_TYPE_META.other
            const dueDate = t.due_date ? new Date(t.due_date) : null
            return (
              <div key={t.id} className={cn(
                'group flex items-center gap-3 rounded-xl border p-3 transition-colors',
                isDone ? 'border-gray-100 bg-gray-50/50 opacity-60'
                  : t.is_overdue ? 'border-red-200 bg-red-50/30'
                  : 'border-gray-200 hover:border-indigo-200'
              )}>
                <button
                  onClick={async () => {
                    if (isDone) { await reopenMutation.mutateAsync(t.id) }
                    else { await completeMutation.mutateAsync(t.id); toast.success('✓ Done!') }
                  }}
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors',
                    isDone ? 'border-green-500 bg-green-500 text-white' : 'border-gray-300 hover:border-indigo-500'
                  )}>
                  {isDone && <Check className="w-3 h-3" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm', isDone && 'line-through text-gray-400')}>{t.title}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-gray-400">{tm.icon} {tm.label}</span>
                    <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-medium', pm.color)}>{pm.label}</span>
                    {t.is_overdue && !isDone && (
                      <span className="text-[9px] text-red-500 font-medium">⚠ Overdue</span>
                    )}
                    {dueDate && (
                      <span className="text-[9px] text-gray-400">
                        {formatDate(dueDate.toISOString())}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={async () => { await deleteMutation.mutateAsync(t.id) }}
                  className="opacity-0 group-hover:opacity-100 rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-400 transition-opacity"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Enrichment card (AI Actions tab) ────────────────────────────────────────

function EnrichmentCard({
  leadId,
  onEnrich,
  isPending,
}: {
  leadId: string
  onEnrich: () => void
  isPending: boolean
}) {
  const { data: logs = [] } = useEnrichmentLogs(leadId)
  const latestLog = logs[0]

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium text-gray-900">Lead Enrichment</h4>
          <p className="mt-0.5 text-xs text-gray-500">
            Auto-fill missing contact &amp; company data via Apollo.io + Hunter.io
          </p>
        </div>
        <button
          onClick={onEnrich}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Wand2 className="h-4 w-4" />
          )}
          Enrich Now
        </button>
      </div>

      {latestLog && (
        <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 p-3">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>
              Last enrichment via <strong>{latestLog.source}</strong> · {latestLog.status}
            </span>
            <span>{new Date(latestLog.created_at).toLocaleDateString()}</span>
          </div>
          {latestLog.fields_updated && latestLog.fields_updated.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {latestLog.fields_updated.map((f) => (
                <span key={f} className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                  {FIELD_LABELS[f] || f}
                </span>
              ))}
            </div>
          )}
          {latestLog.error && (
            <p className="mt-1.5 text-xs text-red-500">{latestLog.error}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Enrichment result banner ─────────────────────────────────────────────────

function EnrichmentBanner({
  result,
  onDismiss,
}: {
  result: EnrichmentResult
  onDismiss: () => void
}) {
  const isSuccess = result.fields_updated.length > 0
  const isNoKey = result.status === 'no_api_key'

  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 rounded-xl border p-4',
        isNoKey
          ? 'border-amber-200 bg-amber-50'
          : isSuccess
          ? 'border-green-200 bg-green-50'
          : 'border-gray-200 bg-gray-50'
      )}
    >
      <div className="flex items-start gap-3">
        {isNoKey ? (
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        ) : isSuccess ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
        ) : (
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" />
        )}
        <div>
          <p
            className={cn(
              'text-sm font-medium',
              isNoKey ? 'text-amber-800' : isSuccess ? 'text-green-800' : 'text-gray-700'
            )}
          >
            {result.message}
          </p>

          {result.fields_updated.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {result.fields_updated.map((f) => (
                <span
                  key={f}
                  className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  {FIELD_LABELS[f] || f}:{' '}
                  <span className="font-normal">{String(result.fields_found[f] ?? '')}</span>
                </span>
              ))}
            </div>
          )}

          {result.skipped_fields.length > 0 && (
            <p className="mt-1.5 text-xs text-gray-500">
              Already had data (not overwritten):{' '}
              {result.skipped_fields.map((f) => FIELD_LABELS[f] || f).join(', ')}
            </p>
          )}

          {isNoKey && (
            <p className="mt-1.5 text-xs text-amber-700">
              Set <code className="rounded bg-amber-100 px-1 font-mono">APOLLO_API_KEY</code> or{' '}
              <code className="rounded bg-amber-100 px-1 font-mono">HUNTER_API_KEY</code> in
              Railway environment variables.
            </p>
          )}
        </div>
      </div>
      <button
        onClick={onDismiss}
        className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-200"
      >
        ×
      </button>
    </div>
  )
}

function LeadDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-5 w-32 animate-pulse rounded bg-gray-200" />
      <div className="h-32 animate-pulse rounded-xl bg-gray-100" />
      <div className="h-10 animate-pulse rounded bg-gray-100" />
      <div className="h-96 animate-pulse rounded-xl bg-gray-100" />
    </div>
  )
}
