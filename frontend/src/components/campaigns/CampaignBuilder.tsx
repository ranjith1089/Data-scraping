import { useState, useCallback } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Plus,
  Trash2,
  Rocket,
  Save,
  Mail,
  MessageSquare,
  Shuffle,
  Loader2,
  Sparkles,
} from 'lucide-react'
import { cn, SECTOR_COLORS, SECTOR_NAMES } from '@/lib/utils'
import { useCreateCampaign, useStartCampaign } from '@/hooks/useCampaigns'
import StepEditor, { type CampaignStep } from './StepEditor'
import SegmentPicker, { type SegmentFilters } from './SegmentPicker'
import toast from 'react-hot-toast'

interface CampaignBuilderProps {
  onComplete?: (campaignId: string) => void
  onCancel?: () => void
}

type Channel = 'email' | 'whatsapp' | 'multi_channel'
type Tone = 'professional' | 'friendly' | 'formal' | 'consultative' | 'urgent'

const CHANNEL_OPTIONS: { value: Channel; label: string; icon: React.ElementType }[] = [
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
  { value: 'multi_channel', label: 'Mixed', icon: Shuffle },
]

const TONE_OPTIONS: { value: Tone; label: string; desc: string }[] = [
  { value: 'professional', label: 'Professional', desc: 'Business-appropriate and polished' },
  { value: 'friendly', label: 'Friendly', desc: 'Warm and approachable' },
  { value: 'formal', label: 'Formal', desc: 'Traditional and respectful' },
  { value: 'consultative', label: 'Consultative', desc: 'Advisory and value-focused' },
  { value: 'urgent', label: 'Urgent', desc: 'Time-sensitive and action-oriented' },
]

const WIZARD_STEPS = [
  { num: 1, label: 'Basics' },
  { num: 2, label: 'Sectors' },
  { num: 3, label: 'Segment' },
  { num: 4, label: 'Steps' },
  { num: 5, label: 'Review' },
]

function createStep(order: number): CampaignStep {
  return {
    id: crypto.randomUUID(),
    channel: 'email',
    subject: '',
    body: '',
    delay_days: order === 1 ? 0 : 3,
    order,
  }
}

export default function CampaignBuilder({ onComplete, onCancel }: CampaignBuilderProps) {
  const [currentStep, setCurrentStep] = useState(1)

  // Step 1: Basics
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [channel, setChannel] = useState<Channel>('email')
  const [tone, setTone] = useState<Tone>('professional')

  // Step 2: Sectors
  const [selectedSectors, setSelectedSectors] = useState<string[]>([])

  // Step 3: Segment
  const [segment, setSegment] = useState<SegmentFilters>({
    sectors: [],
    company_sizes: [],
    districts: [],
    min_score: 0,
    max_score: 100,
  })

  // Step 4: Campaign Steps
  const [campaignSteps, setCampaignSteps] = useState<CampaignStep[]>([
    createStep(1),
  ])

  const createCampaign = useCreateCampaign()
  const startCampaign = useStartCampaign()

  // Keep segment sectors in sync
  const handleSectorToggle = useCallback(
    (code: string) => {
      setSelectedSectors((prev) => {
        const next = prev.includes(code)
          ? prev.filter((s) => s !== code)
          : [...prev, code]
        setSegment((seg) => ({ ...seg, sectors: next }))
        return next
      })
    },
    []
  )

  function addStep() {
    setCampaignSteps((prev) => [...prev, createStep(prev.length + 1)])
  }

  function removeStep(id: string) {
    setCampaignSteps((prev) =>
      prev.filter((s) => s.id !== id).map((s, i) => ({ ...s, order: i + 1 }))
    )
  }

  function updateStep(updated: CampaignStep) {
    setCampaignSteps((prev) =>
      prev.map((s) => (s.id === updated.id ? updated : s))
    )
  }

  function canProceed(): boolean {
    switch (currentStep) {
      case 1:
        return name.trim().length > 0
      case 2:
        return selectedSectors.length > 0
      case 3:
        return true
      case 4:
        return campaignSteps.length > 0 && campaignSteps.every((s) => s.body.trim().length > 0)
      default:
        return true
    }
  }

  async function handleSaveDraft() {
    try {
      const campaign = await createCampaign.mutateAsync({
        name,
        description,
        campaign_type: channel === 'multi_channel' ? 'multi_channel' : channel,
        sector_code: selectedSectors[0] || '',
        target_filters: {
          sectors: segment.sectors,
          company_sizes: segment.company_sizes,
          districts: segment.districts,
          min_score: segment.min_score,
          max_score: segment.max_score,
          tone,
          steps: campaignSteps,
        },
        status: 'draft',
      })
      toast.success('Campaign saved as draft')
      onComplete?.(campaign.id)
    } catch {
      toast.error('Failed to save campaign')
    }
  }

  async function handleLaunch() {
    try {
      const campaign = await createCampaign.mutateAsync({
        name,
        description,
        campaign_type: channel === 'multi_channel' ? 'multi_channel' : channel,
        sector_code: selectedSectors[0] || '',
        target_filters: {
          sectors: segment.sectors,
          company_sizes: segment.company_sizes,
          districts: segment.districts,
          min_score: segment.min_score,
          max_score: segment.max_score,
          tone,
          steps: campaignSteps,
        },
        status: 'draft',
      })
      await startCampaign.mutateAsync(campaign.id)
      toast.success('Campaign launched!')
      onComplete?.(campaign.id)
    } catch {
      toast.error('Failed to launch campaign')
    }
  }

  const isSaving = createCampaign.isPending || startCampaign.isPending

  return (
    <div className="mx-auto max-w-3xl">
      {/* Step Indicator */}
      <nav className="mb-8">
        <ol className="flex items-center">
          {WIZARD_STEPS.map((ws, idx) => {
            const isCompleted = currentStep > ws.num
            const isCurrent = currentStep === ws.num
            return (
              <li key={ws.num} className="flex flex-1 items-center">
                <button
                  onClick={() => {
                    if (isCompleted) setCurrentStep(ws.num)
                  }}
                  className="flex items-center gap-2"
                  disabled={!isCompleted && !isCurrent}
                >
                  <span
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors',
                      isCompleted
                        ? 'bg-indigo-600 text-white'
                        : isCurrent
                          ? 'border-2 border-indigo-600 bg-white text-indigo-600'
                          : 'border-2 border-gray-200 bg-white text-gray-400'
                    )}
                  >
                    {isCompleted ? <Check className="h-4 w-4" /> : ws.num}
                  </span>
                  <span
                    className={cn(
                      'hidden text-sm font-medium sm:inline',
                      isCurrent ? 'text-indigo-600' : isCompleted ? 'text-gray-900' : 'text-gray-400'
                    )}
                  >
                    {ws.label}
                  </span>
                </button>
                {idx < WIZARD_STEPS.length - 1 && (
                  <div
                    className={cn(
                      'mx-2 h-px flex-1',
                      isCompleted ? 'bg-indigo-600' : 'bg-gray-200'
                    )}
                  />
                )}
              </li>
            )
          })}
        </ol>
      </nav>

      {/* Step Content */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        {/* STEP 1: Basics */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Campaign Basics</h2>
              <p className="text-sm text-gray-500">Set up the fundamentals of your campaign</p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Campaign Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Q1 IT Sector Outreach"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Brief description of this campaign..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Channel */}
            <div>
              <label className="mb-3 block text-sm font-medium text-gray-700">Channel</label>
              <div className="grid grid-cols-3 gap-3">
                {CHANNEL_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setChannel(opt.value)}
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all',
                      channel === opt.value
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    )}
                  >
                    <opt.icon className="h-6 w-6" />
                    <span className="text-sm font-medium">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* AI Tone */}
            <div>
              <label className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-700">
                <Sparkles className="h-4 w-4 text-purple-500" />
                AI Tone
              </label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {TONE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setTone(opt.value)}
                    className={cn(
                      'rounded-lg border p-3 text-left transition-all',
                      tone === opt.value
                        ? 'border-purple-300 bg-purple-50 ring-1 ring-purple-200'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    )}
                  >
                    <p className={cn(
                      'text-sm font-medium',
                      tone === opt.value ? 'text-purple-800' : 'text-gray-800'
                    )}>
                      {opt.label}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Sector Selection */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Target Sectors</h2>
              <p className="text-sm text-gray-500">Select the industry sectors for this campaign</p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Object.entries(SECTOR_NAMES).map(([code, sectorName]) => {
                const selected = selectedSectors.includes(code)
                return (
                  <button
                    key={code}
                    onClick={() => handleSectorToggle(code)}
                    className={cn(
                      'flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all',
                      selected
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-5 w-5 items-center justify-center rounded border-2',
                        selected ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300'
                      )}
                    >
                      {selected && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: SECTOR_COLORS[code] }}
                      />
                      <span className={cn(
                        'text-sm font-medium',
                        selected ? 'text-indigo-800' : 'text-gray-700'
                      )}>
                        {sectorName}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>

            {selectedSectors.length > 0 && (
              <p className="text-sm text-gray-600">
                {selectedSectors.length} sector{selectedSectors.length > 1 ? 's' : ''} selected
              </p>
            )}
          </div>
        )}

        {/* STEP 3: Segment Filters */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Audience Segment</h2>
              <p className="text-sm text-gray-500">Fine-tune your target audience with filters</p>
            </div>
            <SegmentPicker value={segment} onChange={setSegment} />
          </div>
        )}

        {/* STEP 4: Campaign Steps */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Campaign Steps</h2>
                <p className="text-sm text-gray-500">Define the sequence of messages</p>
              </div>
              <button
                onClick={addStep}
                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
              >
                <Plus className="h-4 w-4" /> Add Step
              </button>
            </div>

            <div className="space-y-4">
              {campaignSteps.map((step, idx) => (
                <div key={step.id} className="relative">
                  <StepEditor
                    step={step}
                    stepNumber={idx + 1}
                    onChange={updateStep}
                    context={{
                      sectorCode: selectedSectors[0],
                      tone,
                      description,
                    }}
                  />
                  {campaignSteps.length > 1 && (
                    <button
                      onClick={() => removeStep(step.id)}
                      className="absolute -right-2 -top-2 rounded-full border border-gray-200 bg-white p-1.5 text-gray-400 shadow-sm hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 5: Review & Launch */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Review & Launch</h2>
              <p className="text-sm text-gray-500">Review your campaign before launching</p>
            </div>

            {/* Summary */}
            <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50/50 p-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Name</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">{name}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Channel</p>
                  <p className="mt-1 text-sm font-medium capitalize text-gray-900">
                    {channel === 'multi_channel' ? 'Mixed' : channel}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500">AI Tone</p>
                  <p className="mt-1 text-sm font-medium capitalize text-gray-900">{tone}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Steps</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">
                    {campaignSteps.length} step{campaignSteps.length > 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {description && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Description</p>
                  <p className="mt-1 text-sm text-gray-700">{description}</p>
                </div>
              )}

              {/* Sectors */}
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Sectors</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {selectedSectors.map((code) => (
                    <span
                      key={code}
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                      style={{
                        backgroundColor: `${SECTOR_COLORS[code]}15`,
                        color: SECTOR_COLORS[code],
                      }}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: SECTOR_COLORS[code] }}
                      />
                      {SECTOR_NAMES[code]}
                    </span>
                  ))}
                </div>
              </div>

              {/* Segment summary */}
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Segment</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                  {segment.company_sizes.length > 0 && (
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-700">
                      Size: {segment.company_sizes.join(', ')}
                    </span>
                  )}
                  {segment.districts.length > 0 && (
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-700">
                      {segment.districts.length} district{segment.districts.length > 1 ? 's' : ''}
                    </span>
                  )}
                  <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-700">
                    Score: {segment.min_score}-{segment.max_score}
                  </span>
                </div>
              </div>

              {/* Steps preview */}
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">Steps Preview</p>
                <div className="space-y-2">
                  {campaignSteps.map((s, i) => (
                    <div
                      key={s.id}
                      className="flex items-start gap-3 rounded-lg bg-white p-3"
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {s.channel === 'email' ? (
                            <Mail className="h-3.5 w-3.5 text-gray-400" />
                          ) : (
                            <MessageSquare className="h-3.5 w-3.5 text-gray-400" />
                          )}
                          <span className="truncate text-sm font-medium text-gray-900">
                            {s.subject || s.body.slice(0, 60) || 'Untitled step'}
                          </span>
                        </div>
                        {s.delay_days > 0 && (
                          <p className="mt-0.5 text-xs text-gray-500">
                            {s.delay_days} day{s.delay_days > 1 ? 's' : ''} delay
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between">
        <div className="flex gap-2">
          {currentStep > 1 && (
            <button
              onClick={() => setCurrentStep((s) => s - 1)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
          )}
          {onCancel && currentStep === 1 && (
            <button
              onClick={onCancel}
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          )}
        </div>

        <div className="flex gap-2">
          {currentStep >= 2 && (
            <button
              onClick={handleSaveDraft}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {createCampaign.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save as Draft
            </button>
          )}

          {currentStep < 5 ? (
            <button
              onClick={() => setCurrentStep((s) => s + 1)}
              disabled={!canProceed()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleLaunch}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-2.5 text-sm font-semibold text-white hover:shadow-lg disabled:opacity-50"
            >
              {startCampaign.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Rocket className="h-4 w-4" />
              )}
              Launch Campaign
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
