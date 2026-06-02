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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Settings className="h-6 w-6 text-gray-400" />
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-0">
          {TABS.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'inline-flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-medium transition-colors',
                  activeTab === tab.key
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </nav>
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
    <div className="space-y-6">
      <div className="flex items-center gap-2.5">
        <Sliders className="h-5 w-5 text-gray-400" />
        <h2 className="text-lg font-semibold text-gray-900">General Settings</h2>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-6">
        {/* Tenant Name (read-only) */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-900">
            Organization Name
          </label>
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-700">
            {tenant?.name || 'N/A'}
          </div>
          <p className="mt-1 text-xs text-gray-400">
            Contact support to change your organization name.
          </p>
        </div>

        {/* Slug (read-only) */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-900">
            Workspace URL
          </label>
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-700">
            aveonapex.ai/{tenant?.slug || 'N/A'}
          </div>
        </div>

        {/* Product Description */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-900">
            Product / Service Description
          </label>
          <textarea
            value={description}
            onChange={(e) => {
              setDescription(e.target.value)
              setSaved(false)
            }}
            placeholder="Describe your product or service. This helps the AI generate more relevant outreach messages and lead analysis."
            rows={4}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 resize-none"
          />
          <p className="mt-1 text-xs text-gray-400">
            Used by AI to personalize emails, sector briefs, and lead scoring.
          </p>
        </div>

        {/* Save */}
        <div className="flex items-center gap-3 border-t border-gray-100 pt-5">
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Changes
          </button>
          {saved && (
            <span className="inline-flex items-center gap-1 text-sm font-medium text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              Saved successfully
            </span>
          )}
          {saveMutation.isError && (
            <span className="text-sm text-red-600">
              Failed to save. Please try again.
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
