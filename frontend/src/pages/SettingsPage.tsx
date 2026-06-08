import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Settings,
  Users,
  Target,
  Cpu,
  Key,
  Plug,
  Sliders,
  Save,
  Loader2,
  CheckCircle2,
} from 'lucide-react'
import TeamMembers from '@/components/settings/TeamMembers'
import ICPBuilder from '@/components/settings/ICPBuilder'
import AIUsage from '@/components/settings/AIUsage'
import APIKeys from '@/components/settings/APIKeys'
import IntegrationsSummary from '@/components/settings/IntegrationsSummary'
import api from '@/lib/api'
import { cn } from '@/lib/utils'

type TabKey =
  | 'team'
  | 'icp'
  | 'ai_usage'
  | 'api_keys'
  | 'integrations'
  | 'general'

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'team', label: 'Team', icon: Users },
  { key: 'icp', label: 'ICP Builder', icon: Target },
  { key: 'ai_usage', label: 'AI Usage', icon: Cpu },
  { key: 'api_keys', label: 'API Keys', icon: Key },
  { key: 'integrations', label: 'Integrations', icon: Plug },
  { key: 'general', label: 'General', icon: Sliders },
]

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('team')

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center shadow-sm">
          <Settings className="h-4 w-4 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Settings</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Manage your workspace, team, and integrations.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 rounded-2xl border border-border/60 bg-white p-1.5 shadow-sm w-fit">
        {TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-all',
                activeTab === tab.key
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'team' && <TeamMembers />}
        {activeTab === 'icp' && <ICPBuilder />}
        {activeTab === 'ai_usage' && <AIUsage />}
        {activeTab === 'api_keys' && <APIKeys />}
        {activeTab === 'integrations' && <IntegrationsSummary />}
        {activeTab === 'general' && <GeneralSettings />}
      </div>
    </div>
  )
}

function GeneralSettings() {
  const queryClient = useQueryClient()

  const { data: tenant, isLoading } = useQuery({
    queryKey: ['tenant-current'],
    queryFn: async () => {
      const { data } = await api.get('/tenants/current')
      return data
    },
  })

  const [description, setDescription] = useState('')
  const [saved, setSaved] = useState(false)

  // Initialize description from tenant data
  useEffect(() => {
    if (tenant?.settings?.product_description) {
      setDescription(tenant.settings.product_description)
    }
  }, [tenant])

  const saveMutation = useMutation({
    mutationFn: async () => {
      await api.patch('/tenants/current', {
        settings: { product_description: description },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-current'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center">
          <Sliders className="h-4 w-4 text-white" />
        </div>
        <h2 className="text-base font-bold text-foreground">General Settings</h2>
      </div>

      <div className="rounded-2xl border border-border/60 bg-white shadow-sm p-6 space-y-6">
        {/* Tenant Name (read-only) */}
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-foreground">Organization Name</label>
          <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-2.5 text-sm text-foreground">
            {tenant?.name || 'N/A'}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Contact support to change your organization name.</p>
        </div>

        {/* Slug (read-only) */}
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-foreground">Workspace URL</label>
          <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-2.5 text-sm text-foreground font-mono">
            aveonapex.ai/{tenant?.slug || 'N/A'}
          </div>
        </div>

        {/* Product Description */}
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-foreground">Product / Service Description</label>
          <textarea
            value={description}
            onChange={(e) => { setDescription(e.target.value); setSaved(false) }}
            placeholder="Describe your product or service. This helps the AI generate more relevant outreach messages and lead analysis."
            rows={4}
            className="w-full rounded-xl border border-border/60 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-primary/40 focus:ring-2 focus:ring-primary/10 resize-none"
          />
          <p className="mt-1 text-xs text-muted-foreground">Used by AI to personalize emails, sector briefs, and lead scoring.</p>
        </div>

        {/* Save */}
        <div className="flex items-center gap-3 border-t border-border/60 pt-5">
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm disabled:opacity-50 hover:opacity-90 transition-all">
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </button>
          {saved && (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              Saved successfully
            </span>
          )}
          {saveMutation.isError && <span className="text-sm text-destructive">Failed to save. Please try again.</span>}
        </div>
      </div>
    </div>
  )
}
