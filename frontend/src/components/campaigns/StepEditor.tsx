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
} from 'lucide-react'
import { cn } from '@/lib/utils'
import api from '@/lib/api'
import toast from 'react-hot-toast'

export interface CampaignStep {
  id: string
  channel: 'email' | 'whatsapp'
  subject: string
  body: string
  delay_days: number
  order: number
}

interface StepEditorProps {
  step: CampaignStep
  onChange: (updated: CampaignStep) => void
  stepNumber: number
}

const TEMPLATE_VARS = [
  { token: '{{company_name}}', desc: 'Company name' },
  { token: '{{contact_name}}', desc: 'Contact full name' },
  { token: '{{sector}}', desc: 'Industry sector' },
  { token: '{{pain_point}}', desc: 'AI-detected pain point' },
]

export default function StepEditor({ step, onChange, stepNumber }: StepEditorProps) {
  const [showPreview, setShowPreview] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [showVars, setShowVars] = useState(false)

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

  async function handleGenerateAI() {
    setGenerating(true)
    try {
      const { data } = await api.post('/ai/generate-email', {
        lead_id: 'template',
        email_type: stepNumber === 1 ? 'cold_outreach' : 'follow_up',
        tone: 'persuasive',
        context: `Campaign step ${stepNumber}, channel: ${step.channel}`,
      })
      update({ subject: data.subject, body: data.body })
      toast.success('Content generated with AI')
    } catch {
      toast.error('Failed to generate content')
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

        {/* Actions */}
        <div className="flex items-center gap-2 border-t border-gray-100 pt-3">
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
