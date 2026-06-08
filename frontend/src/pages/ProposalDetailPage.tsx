import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Loader2,
  FileSignature,
  Building2,
  Download,
  Globe,
  Check,
  Pencil,
  Save,
  X,
  FileText,
  ChevronDown,
} from 'lucide-react'
import {
  useProposal,
  useUpdateProposal,
  useDeleteProposal,
  openProposalHtmlExport,
  downloadProposalDocx,
  type ProposalSections,
} from '@/hooks/useProposals'
import { cn, formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: 'draft',    label: 'Draft',    color: 'bg-gray-100 text-gray-700' },
  { value: 'sent',     label: 'Sent',     color: 'bg-blue-50 text-blue-700' },
  { value: 'accepted', label: 'Accepted', color: 'bg-green-50 text-green-700' },
  { value: 'rejected', label: 'Rejected', color: 'bg-red-50 text-red-600' },
]

const TYPE_LABEL: Record<string, string> = {
  service_proposal: 'Service Proposal',
  project_quote:    'Project Quote',
  intro_letter:     'Introduction Letter',
}

const TONE_LABEL: Record<string, string> = {
  professional: 'Professional',
  friendly:     'Friendly',
  formal:       'Formal',
  consultative: 'Consultative',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProposalDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: proposal, isLoading } = useProposal(id || '')
  const updateProposal = useUpdateProposal(id || '')
  const deleteProposal = useDeleteProposal()

  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [activeTab, setActiveTab] = useState<'preview' | 'sections'>('preview')

  // ── Loading / not found ───────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (!proposal) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm text-gray-500">Proposal not found.</p>
        <button
          onClick={() => navigate('/proposals')}
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-indigo-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Proposals
        </button>
      </div>
    )
  }

  const currentStatus = STATUS_OPTIONS.find((s) => s.value === proposal.status) || STATUS_OPTIONS[0]
  const sections = proposal.sections || {}

  // ── Handlers ─────────────────────────────────────────────────────────────
  async function saveTitle() {
    if (!titleDraft.trim()) return
    try {
      await updateProposal.mutateAsync({ title: titleDraft.trim() })
      toast.success('Title updated')
    } catch {
      toast.error('Failed to update title')
    }
    setEditingTitle(false)
  }

  async function changeStatus(newStatus: string) {
    try {
      await updateProposal.mutateAsync({
        status: newStatus as 'draft' | 'sent' | 'accepted' | 'rejected',
      })
      toast.success(`Marked as ${newStatus}`)
    } catch {
      toast.error('Failed to update status')
    }
    setShowStatusMenu(false)
  }

  async function handleDelete() {
    if (!window.confirm('Delete this proposal? This cannot be undone.')) return
    try {
      await deleteProposal.mutateAsync(proposal!.id)
      toast.success('Proposal deleted')
      navigate('/proposals')
    } catch {
      toast.error('Failed to delete')
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Back */}
      <button
        onClick={() => navigate('/proposals')}
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Proposals
      </button>

      {/* Header card */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          {/* Left: icon + title */}
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-100">
              <FileSignature className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              {editingTitle ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveTitle()
                      if (e.key === 'Escape') setEditingTitle(false)
                    }}
                    className="rounded-lg border border-indigo-300 px-3 py-1.5 text-lg font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <button onClick={saveTitle} className="rounded-lg bg-indigo-600 p-1.5 text-white hover:bg-indigo-700">
                    <Save className="h-4 w-4" />
                  </button>
                  <button onClick={() => setEditingTitle(false)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-gray-900">{proposal.title}</h1>
                  <button
                    onClick={() => { setTitleDraft(proposal.title); setEditingTitle(true) }}
                    className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* Meta row */}
              <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                {proposal.lead_company && (
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5" />
                    {proposal.lead_company}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" />
                  {TYPE_LABEL[proposal.proposal_type] || proposal.proposal_type}
                </span>
                <span>Tone: {TONE_LABEL[proposal.ai_tone] || proposal.ai_tone}</span>
                <span>Created {formatDate(proposal.created_at)}</span>
              </div>
            </div>
          </div>

          {/* Right: status + actions */}
          <div className="flex items-center gap-2">
            {/* Status picker */}
            <div className="relative">
              <button
                onClick={() => setShowStatusMenu((v) => !v)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
                  currentStatus.color
                )}
              >
                {currentStatus.label}
                <ChevronDown className="h-3 w-3" />
              </button>
              {showStatusMenu && (
                <div className="absolute right-0 top-8 z-10 w-36 rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => changeStatus(opt.value)}
                      className={cn(
                        'flex w-full items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-gray-50',
                        opt.value === proposal.status ? 'text-indigo-700' : 'text-gray-700'
                      )}
                    >
                      {opt.value === proposal.status && <Check className="h-3 w-3" />}
                      <span className={opt.value === proposal.status ? '' : 'ml-5'}>
                        {opt.label}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Export: HTML (PDF via print) */}
            <button
              onClick={() => openProposalHtmlExport(proposal.id)}
              title="Open in browser → Ctrl+P to save as PDF"
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              <Globe className="h-3.5 w-3.5" />
              PDF (HTML)
            </button>

            {/* Export: Word */}
            <button
              onClick={() => downloadProposalDocx(proposal.id)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              <Download className="h-3.5 w-3.5" />
              Word (.docx)
            </button>

            {/* Delete */}
            <button
              onClick={handleDelete}
              className="rounded-lg border border-red-100 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-0">
          {(['preview', 'sections'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'border-b-2 px-6 py-3 text-sm font-medium capitalize transition-colors',
                activeTab === tab
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              )}
            >
              {tab === 'preview' ? 'Proposal Preview' : 'Edit Sections'}
            </button>
          ))}
        </nav>
      </div>

      {/* Preview tab — render the stored HTML in an iframe */}
      {activeTab === 'preview' && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {proposal.content_html ? (
            <iframe
              srcDoc={proposal.content_html}
              title="Proposal Preview"
              className="h-[calc(100vh-300px)] min-h-[600px] w-full"
              sandbox="allow-same-origin"
            />
          ) : (
            <div className="flex items-center justify-center py-24 text-sm text-gray-400">
              No preview available. The HTML may not have been generated yet.
            </div>
          )}
        </div>
      )}

      {/* Sections tab — editable text areas for each proposal block */}
      {activeTab === 'sections' && (
        <SectionsEditor proposalId={proposal.id} initialSections={sections} />
      )}
    </div>
  )
}

// ─── Sections editor ──────────────────────────────────────────────────────────

function SectionsEditor({
  proposalId,
  initialSections,
}: {
  proposalId: string
  initialSections: ProposalSections
}) {
  const updateProposal = useUpdateProposal(proposalId)

  // Use Record<string,unknown> internally so dynamic key access (secs[key]) is valid
  const [secs, setSecs] = useState<Record<string, unknown>>(
    initialSections as Record<string, unknown>
  )
  const [dirty, setDirty] = useState(false)

  function updateField(key: string, value: unknown) {
    setSecs((prev) => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  async function saveChanges() {
    try {
      await updateProposal.mutateAsync({ sections: secs as Partial<ProposalSections> })
      toast.success('Sections saved & HTML re-rendered')
      setDirty(false)
    } catch {
      toast.error('Failed to save changes')
    }
  }

  const SECTION_FIELDS: { key: string; label: string; multiline?: boolean }[] = [
    { key: 'executive_summary', label: 'Executive Summary', multiline: true },
    { key: 'scope_of_work', label: 'Scope of Work', multiline: true },
    { key: 'timeline', label: 'Timeline', multiline: true },
    { key: 'why_us', label: 'Why AveonApex', multiline: true },
    { key: 'next_steps', label: 'Next Steps', multiline: true },
    { key: 'terms', label: 'Terms & Conditions', multiline: true },
  ]

  return (
    <div className="space-y-5 rounded-xl border border-gray-200 bg-white p-6">
      {/* Save banner */}
      {dirty && (
        <div className="flex items-center justify-between rounded-lg bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-800">You have unsaved changes.</p>
          <button
            onClick={saveChanges}
            disabled={updateProposal.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {updateProposal.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </button>
        </div>
      )}

      {/* Deliverables */}
      <div>
        <label className="mb-1.5 block text-sm font-semibold text-gray-700">Key Deliverables</label>
        <p className="mb-2 text-xs text-gray-400">One deliverable per line</p>
        <textarea
          rows={4}
          value={((secs.key_deliverables as string[]) || []).join('\n')}
          onChange={(e) =>
            updateField('key_deliverables', e.target.value.split('\n').filter(Boolean))
          }
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {/* Pricing */}
      <div>
        <label className="mb-1.5 block text-sm font-semibold text-gray-700">Pricing</label>
        <p className="mb-2 text-xs text-gray-400">
          Edit as JSON: {`[{"item": "...", "description": "...", "price": "₹X,XXX"}]`}
        </p>
        <textarea
          rows={6}
          defaultValue={JSON.stringify(secs.pricing || [], null, 2)}
          onBlur={(e) => {
            try {
              updateField('pricing', JSON.parse(e.target.value))
            } catch {
              toast.error('Invalid JSON in pricing')
            }
          }}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {/* Text sections */}
      {SECTION_FIELDS.map(({ key, label }) => (
        <div key={key}>
          <label className="mb-1.5 block text-sm font-semibold text-gray-700">{label}</label>
          <textarea
            rows={5}
            value={(secs[key] as string) || ''}
            onChange={(e) => updateField(key, e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      ))}

      {dirty && (
        <div className="flex justify-end">
          <button
            onClick={saveChanges}
            disabled={updateProposal.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {updateProposal.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save & Re-render
          </button>
        </div>
      )}
    </div>
  )
}
