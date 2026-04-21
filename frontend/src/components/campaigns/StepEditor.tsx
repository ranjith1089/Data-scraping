import { useState } from 'react'
import {
  Sparkles,
  Mail,
  MessageSquare,
  Eye,
  EyeOff,
  Clock,
  Loader2,
  GripVertical,
  Info,
  Languages,
  SplitSquareVertical,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import api from '@/lib/api'
import toast from 'react-hot-toast'
import {
  useVernacularGenerate,
  type VernacularLanguage,
} from '@/hooks/useVernacular'

export interface CampaignStep {
  id: string
  channel: 'email' | 'whatsapp'
  subject: string
  body: string
  delay_days: number
  order: number
  // A/B testing (GAP 2) — both variant_b fields empty ⇒ no split.
  variant_b_subject?: string
  variant_b_body?: string
  ab_split_pct?: number
}

interface StepEditorProps {
  step: CampaignStep
  onChange: (updated: CampaignStep) => void
  stepNumber: number
  /** Campaign-level context — used by AI template generation. */
  context?: {
    sectorCode?: string
    tone?: string
    description?: string
    productDescription?: string
  }
}

const TEMPLATE_VARS = [
  { token: '{{company_name}}', desc: 'Company name' },
  { token: '{{contact_name}}', desc: 'Contact full name' },
  { token: '{{sector}}', desc: 'Industry sector' },
  { token: '{{pain_point}}', desc: 'AI-detected pain point' },
]

export default function StepEditor({
  step,
  onChange,
  stepNumber,
  context,
}: StepEditorProps) {
  const [showPreview, setShowPreview] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [showVars, setShowVars] = useState(false)
  const [showAB, setShowAB] = useState(
    Boolean(step.variant_b_subject || step.variant_b_body),
  )
  const [language, setLanguage] = useState<VernacularLanguage>('en')
  const vernacularGen = useVernacularGenerate()

  function update(patch: Partial<CampaignStep>) {
    onChange({ ...step, ...patch })
  }

  function renderPreview(text: string) {
    return text
      .replace(/\{\{company_name\}\}/g, 'Acme Corp')
      .replace(/\{\{contact_name\}\}/g, 'Priya Sharma')
      .replace(/\{\{sector\}\}/g, 'Technology & IT')
      .replace(/\{\{pain_point\}\}/g, 'scaling customer outreach')
  }

  async function handleGenerateVernacular() {
    try {
      const result = await vernacularGen.mutateAsync({
        business_type: context?.description || 'B2B services',
        audience: context?.sectorCode
          ? `Buyers in the ${context.sectorCode} sector in India`
          : 'Indian B2B decision makers',
        tone: context?.tone || 'warm, respectful',
        language,
        channel: step.channel === 'whatsapp' ? 'whatsapp' : 'email',
      })
      if (step.channel === 'whatsapp') {
        update({ body: result.whatsapp || '' })
      } else {
        update({
          subject: result.email_subject || '',
          body: result.email_body || '',
        })
      }
      toast.success(
        language === 'en'
          ? 'Content generated'
          : language === 'ta'
            ? 'Tamil content generated'
            : 'Hindi content generated',
      )
    } catch {
      toast.error('Vernacular generation failed')
    }
  }

  async function handleGenerateAI() {
    setGenerating(true)
    try {
      const { data } = await api.post<{
        subject: string
        body: string
        whatsapp_version?: string | null
      }>('/ai/generate-email-template', {
        sector_code: context?.sectorCode || undefined,
        step_number: stepNumber,
        tone: context?.tone || 'professional',
        channel: step.channel,
        campaign_description: context?.description || undefined,
        product_description: context?.productDescription || undefined,
      })
      if (step.channel === 'whatsapp') {
        update({ body: data.body || data.whatsapp_version || '' })
      } else {
        update({ subject: data.subject, body: data.body })
      }
      toast.success('Content generated with AI')
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: unknown } } }).response?.data
          ?.detail
      let msg = 'Failed to generate content'
      if (typeof detail === 'string') {
        msg = detail
      } else if (Array.isArray(detail)) {
        msg = detail
          .map((d: { msg?: string }) => d?.msg)
          .filter(Boolean)
          .join('; ') || msg
      }
      toast.error(msg)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      {/* Step Header */}
      <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
        <GripVertical className="h-4 w-4 cursor-grab text-gray-400" />
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
          {stepNumber}
        </div>
        <span className="text-sm font-semibold text-gray-900">Step {stepNumber}</span>

        {/* Channel Toggle */}
        <div className="ml-auto flex items-center gap-1 rounded-lg bg-gray-100 p-0.5">
          <button
            onClick={() => update({ channel: 'email' })}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              step.channel === 'email'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            <Mail className="h-3.5 w-3.5" /> Email
          </button>
          <button
            onClick={() => update({ channel: 'whatsapp' })}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              step.channel === 'whatsapp'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            <MessageSquare className="h-3.5 w-3.5" /> WhatsApp
          </button>
        </div>
      </div>

      <div className="space-y-4 p-4">
        {/* Delay */}
        <div className="flex items-center gap-3">
          <Clock className="h-4 w-4 text-gray-400" />
          <label className="text-sm font-medium text-gray-700">Wait</label>
          <input
            type="number"
            min={0}
            max={90}
            value={step.delay_days}
            onChange={(e) => update({ delay_days: Number(e.target.value) })}
            className="w-20 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <span className="text-sm text-gray-500">days after previous step</span>
        </div>

        {/* Subject (email only) */}
        {step.channel === 'email' && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Subject Line
            </label>
            {showPreview ? (
              <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 px-3 py-2 text-sm text-gray-800">
                {renderPreview(step.subject) || <span className="text-gray-400">No subject</span>}
              </div>
            ) : (
              <input
                type="text"
                value={step.subject}
                onChange={(e) => update({ subject: e.target.value })}
                placeholder="Enter subject line..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            )}
          </div>
        )}

        {/* Body */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            {step.channel === 'email' ? 'Email Body' : 'Message'}
          </label>
          {showPreview ? (
            <div className="min-h-[120px] whitespace-pre-wrap rounded-lg border border-indigo-100 bg-indigo-50/50 px-3 py-2 text-sm leading-relaxed text-gray-800">
              {renderPreview(step.body) || <span className="text-gray-400">No content</span>}
            </div>
          ) : (
            <textarea
              value={step.body}
              onChange={(e) => update({ body: e.target.value })}
              rows={6}
              placeholder={
                step.channel === 'email'
                  ? 'Write your email body here...'
                  : 'Write your WhatsApp message here...'
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm leading-relaxed focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          )}
        </div>

        {/* Template Variables */}
        <div>
          <button
            onClick={() => setShowVars(!showVars)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700"
          >
            <Info className="h-3.5 w-3.5" />
            Template Variables
          </button>
          {showVars && (
            <div className="mt-2 flex flex-wrap gap-2">
              {TEMPLATE_VARS.map((v) => (
                <button
                  key={v.token}
                  type="button"
                  onClick={() => {
                    if (!showPreview) {
                      update({ body: step.body + v.token })
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-mono text-gray-700 hover:bg-gray-100"
                  title={v.desc}
                >
                  {v.token}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Variant B (A/B testing, GAP 2) */}
        {showAB && (
          <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-violet-900">
              <SplitSquareVertical className="h-3.5 w-3.5" /> Variant B
            </div>
            {step.channel === 'email' && (
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Subject (Variant B)
                </label>
                <input
                  type="text"
                  value={step.variant_b_subject ?? ''}
                  onChange={(e) => update({ variant_b_subject: e.target.value })}
                  placeholder="A different subject line to test…"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Body (Variant B)
              </label>
              <textarea
                value={step.variant_b_body ?? ''}
                onChange={(e) => update({ variant_b_body: e.target.value })}
                rows={4}
                placeholder="Alternate body to test against the primary version…"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Split: {step.ab_split_pct ?? 50}% A vs {100 - (step.ab_split_pct ?? 50)}% B
              </label>
              <input
                type="range"
                min={1}
                max={99}
                value={step.ab_split_pct ?? 50}
                onChange={(e) => update({ ab_split_pct: Number(e.target.value) })}
                className="w-full"
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
          <button
            onClick={handleGenerateAI}
            disabled={generating}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white transition-all hover:shadow-md disabled:opacity-50"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Generate with AI
          </button>

          {/* Vernacular language picker + generate (GAP 5) */}
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-1.5 py-1">
            <Languages className="h-3.5 w-3.5 text-gray-400 ml-1" />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as VernacularLanguage)}
              className="text-xs font-medium bg-transparent focus:outline-none"
            >
              <option value="en">English</option>
              <option value="ta">தமிழ்</option>
              <option value="hi">हिन्दी</option>
            </select>
            <button
              onClick={handleGenerateVernacular}
              disabled={vernacularGen.isPending}
              className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {vernacularGen.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              Generate
            </button>
          </div>

          <button
            onClick={() => {
              const enabling = !showAB
              setShowAB(enabling)
              if (!enabling) {
                // Clearing variant_b when collapsed signals "no AB test" to the backend.
                update({ variant_b_subject: '', variant_b_body: '' })
              }
            }}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium',
              showAB
                ? 'border-violet-300 bg-violet-50 text-violet-700'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50',
            )}
          >
            <SplitSquareVertical className="h-4 w-4" />
            {showAB ? 'A/B on' : 'A/B test'}
          </button>

          <button
            onClick={() => setShowPreview(!showPreview)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {showPreview ? (
              <>
                <EyeOff className="h-4 w-4" /> Edit
              </>
            ) : (
              <>
                <Eye className="h-4 w-4" /> Preview
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
