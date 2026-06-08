import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileSignature,
  Plus,
  Loader2,
  FileText,
  Building2,
  Clock,
  ChevronRight,
  Sparkles,
  X,
} from 'lucide-react'
import {
  useProposals,
  useGenerateProposal,
  useDeleteProposal,
  type GenerateProposalRequest,
  type Proposal,
} from '@/hooks/useProposals'
import { useLeads } from '@/hooks/useLeads'
import { cn, formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

// ─── Status badge map ─────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, { color: string; label: string }> = {
  draft:    { color: 'bg-gray-100 text-gray-600',   label: 'Draft' },
  sent:     { color: 'bg-blue-50 text-blue-700',    label: 'Sent' },
  accepted: { color: 'bg-green-50 text-green-700',  label: 'Accepted' },
  rejected: { color: 'bg-red-50 text-red-600',      label: 'Rejected' },
}

const TYPE_LABEL: Record<string, string> = {
  service_proposal: 'Service Proposal',
  project_quote:    'Project Quote',
  intro_letter:     'Introduction Letter',
}

// ─── Generate modal ───────────────────────────────────────────────────────────

interface GenerateModalProps {
  onClose: () => void
  onGenerated: (id: string) => void
}

function GenerateModal({ onClose, onGenerated }: GenerateModalProps) {
  const generateMutation = useGenerateProposal()
  const { data: leadsData } = useLeads()
  const leads = leadsData?.items ?? []

  const [leadId, setLeadId] = useState('')
  const [proposalType, setProposalType] = useState<GenerateProposalRequest['proposal_type']>('service_proposal')
  const [tone, setTone] = useState<GenerateProposalRequest['tone']>('professional')
  const [product, setProduct] = useState('')

  async function handleGenerate() {
    if (!leadId) {
      toast.error('Please select a lead')
      return
    }
    try {
      const result = await generateMutation.mutateAsync({
        lead_id: leadId,
        proposal_type: proposalType,
        tone,
        product_description: product.trim() || undefined,
      })
      toast.success('Proposal generated!')
      onGenerated(result.id)
    } catch {
      toast.error('Failed to generate proposal. Check your AI quota.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100">
              <Sparkles className="h-4 w-4 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Generate AI Proposal</h2>
              <p className="text-xs text-gray-500">AI writes a full sector-specific sales proposal</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 p-6">
          {/* Lead */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Lead / Company</label>
            <select
              value={leadId}
              onChange={(e) => setLeadId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Select a lead…</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.company_name} {l.contact_name ? `— ${l.contact_name}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Type */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Proposal Type</label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { value: 'service_proposal', label: 'Service Proposal' },
                  { value: 'project_quote', label: 'Project Quote' },
                  { value: 'intro_letter', label: 'Intro Letter' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setProposalType(opt.value)}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
                    proposalType === opt.value
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tone */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Writing Tone</label>
            <div className="grid grid-cols-4 gap-2">
              {(
                [
                  { value: 'professional', label: 'Professional' },
                  { value: 'consultative', label: 'Consultative' },
                  { value: 'friendly', label: 'Friendly' },
                  { value: 'formal', label: 'Formal' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTone(opt.value)}
                  className={cn(
                    'rounded-lg border px-2 py-2 text-xs font-medium transition-colors',
                    tone === opt.value
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Product description */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              What are you selling?{' '}
              <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              placeholder="e.g. Custom CRM development, AI chatbot, EdTech LMS…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t border-gray-100 p-6 pt-4">
          <button
            onClick={handleGenerate}
            disabled={generateMutation.isPending || !leadId}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {generateMutation.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
            ) : (
              <><Sparkles className="h-4 w-4" /> Generate Proposal</>
            )}
          </button>
          <button
            onClick={onClose}
            className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ProposalsPage() {
  const navigate = useNavigate()
  const { data: proposals = [], isLoading } = useProposals()
  const deleteProposal = useDeleteProposal()
  const [showModal, setShowModal] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const filtered =
    statusFilter === 'all'
      ? proposals
      : proposals.filter((p) => p.status === statusFilter)

  function handleGenerated(id: string) {
    setShowModal(false)
    navigate(`/proposals/${id}`)
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!window.confirm('Delete this proposal? This cannot be undone.')) return
    try {
      await deleteProposal.mutateAsync(id)
      toast.success('Proposal deleted')
    } catch {
      toast.error('Failed to delete')
    }
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Proposals</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            AI-generated sales proposals for your leads
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          Generate Proposal
        </button>
      </div>

      {/* Status filter */}
      <div className="flex gap-2">
        {['all', 'draft', 'sent', 'accepted', 'rejected'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors',
              statusFilter === s
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            {s === 'all' ? 'All' : STATUS_BADGE[s]?.label ?? s}
            {s !== 'all' && (
              <span className="ml-1.5 opacity-70">
                ({proposals.filter((p) => p.status === s).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState onGenerate={() => setShowModal(true)} hasFilter={statusFilter !== 'all'} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <ProposalCard
              key={p.id}
              proposal={p}
              onClick={() => navigate(`/proposals/${p.id}`)}
              onDelete={(e) => handleDelete(p.id, e)}
            />
          ))}
        </div>
      )}

      {showModal && (
        <GenerateModal
          onClose={() => setShowModal(false)}
          onGenerated={handleGenerated}
        />
      )}
    </div>
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function ProposalCard({
  proposal,
  onClick,
  onDelete,
}: {
  proposal: Proposal
  onClick: () => void
  onDelete: (e: React.MouseEvent) => void
}) {
  const badge = STATUS_BADGE[proposal.status] || STATUS_BADGE.draft

  return (
    <div
      onClick={onClick}
      className="group cursor-pointer rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-indigo-200 hover:shadow-md"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50">
          <FileSignature className="h-4 w-4 text-indigo-600" />
        </div>
        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-medium', badge.color)}>
          {badge.label}
        </span>
      </div>

      {/* Title */}
      <h3 className="mt-3 line-clamp-2 text-sm font-semibold leading-snug text-gray-900 group-hover:text-indigo-700">
        {proposal.title}
      </h3>

      {/* Meta */}
      <div className="mt-3 space-y-1.5">
        {proposal.lead_company && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{proposal.lead_company}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <FileText className="h-3.5 w-3.5 shrink-0" />
          <span>{TYPE_LABEL[proposal.proposal_type] || proposal.proposal_type}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span>{formatDate(proposal.created_at)}</span>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
        <button
          onClick={onDelete}
          className="text-xs text-gray-400 hover:text-red-500"
        >
          Delete
        </button>
        <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-indigo-500" />
      </div>
    </div>
  )
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState({
  onGenerate,
  hasFilter,
}: {
  onGenerate: () => void
  hasFilter: boolean
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100">
        <FileSignature className="h-6 w-6 text-indigo-600" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-gray-900">
        {hasFilter ? 'No proposals with this status' : 'No proposals yet'}
      </h3>
      <p className="mt-1.5 max-w-xs text-sm text-gray-500">
        {hasFilter
          ? 'Try a different status filter or generate a new proposal.'
          : 'Generate a compelling sales proposal for any lead in seconds using AI.'}
      </p>
      {!hasFilter && (
        <button
          onClick={onGenerate}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          <Sparkles className="h-4 w-4" />
          Generate Your First Proposal
        </button>
      )}
    </div>
  )
}
