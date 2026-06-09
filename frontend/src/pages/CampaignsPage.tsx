import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Plus, Play, Pause, CheckCircle2, FileEdit,
  MoreHorizontal, X, Megaphone, Mail, BarChart2, MessageSquare,
  GraduationCap, Loader2, BookOpen,
} from 'lucide-react'
import {
  useCampaigns, useStartCampaign, usePauseCampaign,
  useDeleteCampaign, useCreateCampaign, useBulkUpsertCampaignSteps,
  type Campaign, type CampaignStepPayload,
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

// ── Pre-built Admission Email Sequence ──────────────────────────────────────
const ADMISSION_STEPS: CampaignStepPayload[] = [
  {
    step_number: 1,
    channel: 'email',
    delay_days: 0,
    subject: '🎓 Thank you for your enquiry — {{company_name}}',
    body: `Hi {{contact_name}},

Thank you for showing interest in our institution! We received your enquiry about {{course_interested}} and are delighted to connect with you.

Our admissions counselor will reach out within 24 hours to schedule a free counseling session tailored to your goals.

In the meantime, feel free to explore:
→ Our campus facilities
→ Scholarship opportunities
→ Placement records

We look forward to guiding you on your academic journey. 🌟

Warm regards,
The Admissions Team`,
    ai_generated: false,
  },
  {
    step_number: 2,
    channel: 'email',
    delay_days: 2,
    subject: '📅 Schedule your free counseling session — spots filling fast',
    body: `Hi {{contact_name}},

We hope you're doing well! We wanted to follow up on your enquiry for {{course_interested}}.

We have a few counseling slots available this week — these sessions are:
✅ 100% free
✅ 30 minutes one-on-one
✅ Covers eligibility, fee structure & scholarship options

👉 Reply to this email with your preferred date/time, or call us directly to book your slot.

Don't miss out — seats are limited and admissions close soon!

Best regards,
Admissions Team`,
    ai_generated: false,
  },
  {
    step_number: 3,
    channel: 'email',
    delay_days: 5,
    subject: '📋 Your application for {{course_interested}} — next steps',
    body: `Hi {{contact_name}},

We noticed you haven't completed your application yet. Here's a quick summary of what you need:

📌 Documents Required:
  • 12th Marksheet / Transfer Certificate
  • ID Proof (Aadhaar / Passport)
  • 2 Passport-size photos

📌 Next Steps:
  1. Complete online application form
  2. Submit documents
  3. Appear for counseling
  4. Confirm seat with fee payment

The application window closes soon. Secure your seat in {{course_interested}} before it's too late!

Reach us anytime — we're here to help.

Admissions Team`,
    ai_generated: false,
  },
  {
    step_number: 4,
    channel: 'email',
    delay_days: 10,
    subject: '⏰ Last chance to secure your seat — {{course_interested}}',
    body: `Hi {{contact_name}},

This is our final reminder — the admission deadline for {{course_interested}} is approaching.

We've reserved a spot for you based on your enquiry, but we can only hold it for a few more days.

🎯 Why choose us?
  • Industry-experienced faculty
  • Strong placement record
  • NAAC-accredited institution
  • Scholarship available for merit students

Take action today. Reply to this email or call us to confirm your enrollment.

We hope to welcome you to our campus soon! 🎓

Warm regards,
Admissions Team`,
    ai_generated: false,
  },
]

export default function CampaignsPage() {
  const navigate = useNavigate()
  const { data, isLoading, refetch } = useCampaigns()
  const startCampaign = useStartCampaign()
  const pauseCampaign = usePauseCampaign()
  const deleteCampaign = useDeleteCampaign()
  const createCampaign = useCreateCampaign()
  const upsertSteps = useBulkUpsertCampaignSteps()

  const [showBuilder, setShowBuilder] = useState(false)
  const [showAdmissionModal, setShowAdmissionModal] = useState(false)
  const [admissionCreating, setAdmissionCreating] = useState(false)

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

  async function handleCreateAdmissionSequence() {
    setAdmissionCreating(true)
    try {
      const campaign = await createCampaign.mutateAsync({
        name: '🎓 Admission Email Sequence',
        channel: 'email',
        sector_codes: ['college'],
        ai_tone: 'friendly',
        daily_limit: 50,
      })
      await upsertSteps.mutateAsync({ campaignId: campaign.id, steps: ADMISSION_STEPS })
      toast.success('Admission sequence created — 4 steps ready!')
      setShowAdmissionModal(false)
      refetch()
      navigate(`/campaigns/${campaign.id}`)
    } catch {
      toast.error('Failed to create sequence. Please try again.')
    } finally {
      setAdmissionCreating(false)
    }
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Campaigns</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage your automated outreach campaigns.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowAdmissionModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-bold text-violet-700 hover:bg-violet-100 hover:-translate-y-px transition-all"
          >
            <GraduationCap className="h-4 w-4" />
            🎓 Admission Sequence
          </button>
          <button onClick={() => setShowBuilder(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-rose-200 hover:opacity-90 hover:-translate-y-px transition-all">
            <Plus className="h-4 w-4" />
            Create Campaign
          </button>
        </div>
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
              Create your first campaign or use the Admission Sequence template to get started instantly.
            </p>
            <div className="flex items-center justify-center gap-2 mt-5 flex-wrap">
              <button
                onClick={() => setShowAdmissionModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-bold text-violet-700 hover:bg-violet-100 transition-all"
              >
                <GraduationCap className="h-4 w-4" />
                Use Admission Template
              </button>
              <button onClick={() => setShowBuilder(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-rose-200 hover:opacity-90 transition-all">
                <Plus className="h-4 w-4" />
                Create From Scratch
              </button>
            </div>
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
              <div className={cn('h-0.5 w-full', campaign.status === 'active' ? 'bg-gradient-to-r from-emerald-400 to-teal-500' : campaign.status === 'paused' ? 'bg-gradient-to-r from-amber-400 to-orange-400' : campaign.status === 'completed' ? 'bg-gradient-to-r from-blue-400 to-violet-500' : 'bg-muted')} />

              <div className="flex flex-col md:flex-row items-start md:items-center p-4 gap-4">
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
                        <span className="hidden sm:inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          {sectorName}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Created {new Date(campaign.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>

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

      {/* Admission Sequence Modal */}
      {showAdmissionModal && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => !admissionCreating && setShowAdmissionModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="relative overflow-hidden px-6 py-5 border-b border-border/60 bg-gradient-to-br from-violet-50 to-purple-50">
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-violet-500 to-purple-600" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm">
                      <GraduationCap className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-foreground">Admission Email Sequence</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">4-step pre-built campaign for college admissions</p>
                    </div>
                  </div>
                  {!admissionCreating && (
                    <button onClick={() => setShowAdmissionModal(false)}
                      className="rounded-xl p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-all">
                      <X className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Steps preview */}
              <div className="p-6 space-y-3 max-h-[50vh] overflow-y-auto scrollbar-thin">
                <p className="text-xs text-muted-foreground mb-2">
                  These 4 emails will be created as draft steps — you can edit the copy before activating the campaign.
                  Template variables like <code className="bg-muted px-1 rounded text-[10px]">{'{{contact_name}}'}</code> are replaced at send time.
                </p>
                {ADMISSION_STEPS.map((step) => (
                  <div key={step.step_number}
                    className="rounded-xl border border-border/60 bg-muted/20 p-3.5 flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0 text-white text-xs font-bold shadow-sm">
                      {step.step_number}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-bold text-foreground truncate">{step.subject}</span>
                        <span className="shrink-0 rounded-full bg-violet-50 border border-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">
                          Day {step.delay_days}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-2">
                        {step.body?.split('\n').find(l => l.trim().length > 5) ?? ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <BookOpen className="h-3.5 w-3.5 text-violet-400" />
                      <span className="text-[10px] text-muted-foreground">Email</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between gap-3 border-t border-border/60 px-6 py-4 bg-muted/20">
                <p className="text-xs text-muted-foreground">
                  Created as <strong>Draft</strong> — activate when ready.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAdmissionModal(false)}
                    disabled={admissionCreating}
                    className="rounded-xl border border-border/60 px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted transition-all disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateAdmissionSequence}
                    disabled={admissionCreating}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-5 py-2 text-sm font-bold text-white shadow-md shadow-violet-200 hover:opacity-90 hover:-translate-y-px transition-all disabled:opacity-60"
                  >
                    {admissionCreating
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</>
                      : <><GraduationCap className="h-4 w-4" /> Create Sequence</>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
