import { useState } from 'react'
import {
  X,
  Sparkles,
  Loader2,
  Copy,
  Mail,
  Send,
  MessageSquare,
} from 'lucide-react'
import { useEmailGen, type EmailGenRequest } from '@/hooks/useAI'
import { cn } from '@/lib/utils'

interface EmailGenModalProps {
  leadId: string
  onClose: () => void
  onInsert?: (subject: string, body: string) => void
}

type Tone = 'professional' | 'friendly' | 'formal' | 'consultative' | 'urgent'
type Tab = 'email' | 'whatsapp'

const TONE_OPTIONS: { value: Tone; label: string }[] = [
  { value: 'professional', label: 'Professional' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'formal', label: 'Formal' },
  { value: 'consultative', label: 'Consultative' },
  { value: 'urgent', label: 'Urgent' },
]

export default function EmailGenModal({
  leadId,
  onClose,
  onInsert,
}: EmailGenModalProps) {
  const emailGen = useEmailGen()

  // Form state
  const [tone, setTone] = useState<Tone>('professional')
  const [step, setStep] = useState(1)
  const [productDesc, setProductDesc] = useState('')
  const [campaignCtx, setCampaignCtx] = useState('')

  // Result state
  const [activeTab, setActiveTab] = useState<Tab>('email')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [whatsappMsg, setWhatsappMsg] = useState('')
  const [keyHook, setKeyHook] = useState('')
  const [personalNote, setPersonalNote] = useState('')
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null)

  const hasResult = subject || body

  const handleGenerate = async () => {
    if (!productDesc.trim()) return

    const toneMap: Record<Tone, EmailGenRequest['tone']> = {
      professional: 'formal',
      friendly: 'friendly',
      formal: 'formal',
      consultative: 'persuasive',
      urgent: 'persuasive',
    }

    try {
      const result = await emailGen.mutateAsync({
        lead_id: leadId,
        email_type: step === 1 ? 'cold_outreach' : 'follow_up',
        context: [
          `Tone: ${tone}`,
          `Step: ${step}`,
          `Product: ${productDesc}`,
          campaignCtx ? `Campaign context: ${campaignCtx}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
        tone: toneMap[tone],
      })

      setSubject(result.subject)
      setBody(result.body)

      // Generate a WhatsApp-friendly version (truncated)
      const plainBody = result.body.replace(/<[^>]+>/g, '').replace(/\n{3,}/g, '\n\n')
      setWhatsappMsg(plainBody.slice(0, 500))

      // Extract hook and personal note from the body
      const firstLine = result.body.split('\n').find((l) => l.trim()) || ''
      setKeyHook(firstLine.replace(/<[^>]+>/g, '').slice(0, 120))
      setPersonalNote(`Tailored for lead ${leadId} using ${tone} tone at step ${step}`)
    } catch {
      // Error handled by react-query
    }
  }

  const handleCopy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text)
    setCopyFeedback(label)
    setTimeout(() => setCopyFeedback(null), 2000)
  }

  const handleInsert = () => {
    if (onInsert && subject && body) {
      onInsert(subject, body)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative mx-4 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600">
              <Mail className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                AI Email Generator
              </h2>
              <p className="text-xs text-gray-500">
                Powered by LeadForge AI
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Form */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Tone selector */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Tone
                </label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value as Tone)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
                >
                  {TONE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Step number */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Sequence Step
                </label>
                <select
                  value={step}
                  onChange={(e) => setStep(Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
                >
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      Step {n}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Product description */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Product / Service Description{' '}
                <span className="text-red-500">*</span>
              </label>
              <textarea
                value={productDesc}
                onChange={(e) => setProductDesc(e.target.value)}
                rows={3}
                placeholder="Describe your product or service offering..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
              />
            </div>

            {/* Campaign context */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Campaign Context{' '}
                <span className="text-xs text-gray-400">(optional)</span>
              </label>
              <textarea
                value={campaignCtx}
                onChange={(e) => setCampaignCtx(e.target.value)}
                rows={2}
                placeholder="Any additional campaign context..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
              />
            </div>

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={!productDesc.trim() || emailGen.isPending}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white',
                'bg-gradient-to-r from-purple-600 to-indigo-600 transition-all',
                'hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50'
              )}
            >
              {emailGen.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate with AI
                </>
              )}
            </button>

            {/* Error */}
            {emailGen.isError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                Failed to generate email. Please try again.
              </div>
            )}
          </div>

          {/* Results */}
          {hasResult && (
            <div className="mt-6 space-y-4">
              {/* Tabs */}
              <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
                {(['email', 'whatsapp'] as Tab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium transition-colors',
                      activeTab === tab
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    )}
                  >
                    {tab === 'email' ? (
                      <Mail className="h-3.5 w-3.5" />
                    ) : (
                      <MessageSquare className="h-3.5 w-3.5" />
                    )}
                    {tab === 'email' ? 'Email' : 'WhatsApp'}
                  </button>
                ))}
              </div>

              {activeTab === 'email' ? (
                <div className="space-y-3">
                  {/* Subject */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">
                      Subject Line
                    </label>
                    <input
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
                    />
                  </div>

                  {/* Body */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">
                      Email Body
                    </label>
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      rows={8}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm leading-relaxed focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="text-xs font-medium text-gray-500">
                        WhatsApp Message
                      </label>
                      <span
                        className={cn(
                          'text-xs',
                          whatsappMsg.length > 500
                            ? 'text-red-500'
                            : 'text-gray-400'
                        )}
                      >
                        {whatsappMsg.length}/500
                      </span>
                    </div>
                    <textarea
                      value={whatsappMsg}
                      onChange={(e) =>
                        setWhatsappMsg(e.target.value.slice(0, 500))
                      }
                      rows={8}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm leading-relaxed focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
                    />
                  </div>
                </div>
              )}

              {/* Tooltips: key hook + personalisation note */}
              {(keyHook || personalNote) && (
                <div className="flex flex-wrap gap-2">
                  {keyHook && (
                    <div className="group relative">
                      <span className="inline-flex cursor-help items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 border border-amber-200">
                        <Sparkles className="h-3 w-3" />
                        Key Hook
                      </span>
                      <div className="absolute bottom-full left-0 z-10 mb-2 hidden w-64 rounded-lg bg-gray-900 p-3 text-xs text-white shadow-lg group-hover:block">
                        {keyHook}
                      </div>
                    </div>
                  )}
                  {personalNote && (
                    <div className="group relative">
                      <span className="inline-flex cursor-help items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 border border-blue-200">
                        <Sparkles className="h-3 w-3" />
                        Personalisation
                      </span>
                      <div className="absolute bottom-full left-0 z-10 mb-2 hidden w-64 rounded-lg bg-gray-900 p-3 text-xs text-white shadow-lg group-hover:block">
                        {personalNote}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() =>
                    handleCopy(
                      activeTab === 'email'
                        ? `Subject: ${subject}\n\n${body}`
                        : whatsappMsg,
                      'Copied!'
                    )
                  }
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  <Copy className="h-4 w-4" />
                  {copyFeedback || 'Copy'}
                </button>
                {onInsert && (
                  <button
                    onClick={handleInsert}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-purple-300 bg-purple-50 py-2.5 text-sm font-medium text-purple-700 transition-colors hover:bg-purple-100"
                  >
                    <Mail className="h-4 w-4" />
                    Insert into Campaign
                  </button>
                )}
                <button className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700">
                  <Send className="h-4 w-4" />
                  Send Now
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
