import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useCampaign, useCampaignSteps } from '@/hooks/useCampaigns'
import CampaignBuilder from '@/components/campaigns/CampaignBuilder'
import type { CampaignStep as StepEditorStep } from '@/components/campaigns/StepEditor'

export default function CampaignEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: campaign, isLoading: loadingCampaign } = useCampaign(id || '')
  const { data: steps, isLoading: loadingSteps } = useCampaignSteps(id || '')

  if (loadingCampaign || loadingSteps) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Campaign not found.</p>
        <button
          onClick={() => navigate('/campaigns')}
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Campaigns
        </button>
      </div>
    )
  }

  // Map API CampaignStep → StepEditor CampaignStep format
  const initialSteps: StepEditorStep[] = (steps ?? []).map((s) => ({
    id: s.id,
    channel: (s.channel === 'whatsapp' ? 'whatsapp' : 'email') as 'email' | 'whatsapp',
    subject: s.subject ?? '',
    body: s.body ?? '',
    delay_days: s.delay_days,
    order: s.step_number,
    variant_b_subject: s.variant_b_subject ?? undefined,
    variant_b_body: s.variant_b_body ?? undefined,
    ab_split_pct: s.ab_split_pct,
  }))

  // Extract description from segment_filter if stored there
  const segFilter = campaign.segment_filter as Record<string, unknown> | null
  const initialDescription = (segFilter?.description as string) ?? ''

  // Map channel value — backend stores 'multi', builder uses 'multi_channel'
  type Channel = 'email' | 'whatsapp' | 'multi_channel'
  const channelMap: Record<string, Channel> = {
    email: 'email',
    whatsapp: 'whatsapp',
    multi: 'multi_channel',
    sms: 'email',       // fallback
    linkedin: 'email',  // fallback
  }
  const initialChannel: Channel = channelMap[campaign.channel] ?? 'email'

  type Tone = 'professional' | 'friendly' | 'formal' | 'consultative' | 'urgent'
  const validTones: Tone[] = ['professional', 'friendly', 'formal', 'consultative', 'urgent']
  const initialTone: Tone = validTones.includes(campaign.ai_tone as Tone)
    ? (campaign.ai_tone as Tone)
    : 'professional'

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate(`/campaigns/${id}`)}
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground/80"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Campaign
      </button>

      <div>
        <h1 className="text-2xl font-bold text-foreground">Edit Campaign</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Update settings and steps for <span className="font-medium">{campaign.name}</span>
        </p>
      </div>

      <CampaignBuilder
        mode="edit"
        campaignId={campaign.id}
        initialName={campaign.name}
        initialDescription={initialDescription}
        initialChannel={initialChannel}
        initialTone={initialTone}
        initialSectors={campaign.sector_codes ?? []}
        initialSteps={initialSteps.length > 0 ? initialSteps : undefined}
        onComplete={() => navigate(`/campaigns/${id}`)}
        onCancel={() => navigate(`/campaigns/${id}`)}
      />
    </div>
  )
}
