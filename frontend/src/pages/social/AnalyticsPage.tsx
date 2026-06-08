import { useState } from 'react'
import {
  Send,
  Users,
  TrendingUp,
  MessageSquare,
} from 'lucide-react'
import {
  useSocialByRule,
  useSocialFunnel,
  useSocialOverview,
} from '@/hooks/social/useSocialMisc'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export default function AnalyticsPage() {
  const [period, setPeriod] = useState(30)
  const { data: overview, isLoading } = useSocialOverview(period)
  const { data: byRule } = useSocialByRule(period)
  const { data: funnel } = useSocialFunnel(period)

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Social analytics</h1>
          <p className="text-muted-foreground mt-1">
            How your Instagram automations are performing.
          </p>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(Number(e.target.value))}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          icon={Send}
          label="DMs sent"
          value={overview?.dms_sent ?? 0}
          loading={isLoading}
        />
        <MetricCard
          icon={Users}
          label="Leads created"
          value={overview?.leads_created ?? 0}
          loading={isLoading}
        />
        <MetricCard
          icon={TrendingUp}
          label="Conversion %"
          value={`${(overview?.conversion_rate ?? 0).toFixed(1)}%`}
          loading={isLoading}
        />
        <MetricCard
          icon={MessageSquare}
          label="Open conversations"
          value={overview?.open_conversations ?? 0}
          loading={isLoading}
        />
      </div>

      {/* Funnel */}
      <Card>
        <CardContent className="p-5">
          <h3 className="font-semibold mb-3">Funnel</h3>
          <div className="space-y-2">
            {(funnel?.stages ?? []).map((s, i, arr) => {
              const max = Math.max(...arr.map((x) => x.count), 1)
              const pct = (s.count / max) * 100
              return (
                <div key={s.stage}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="capitalize">{s.stage.replace(/_/g, ' ')}</span>
                    <span className="font-semibold">{s.count.toLocaleString()}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        i === 0
                          ? 'bg-blue-500'
                          : i === arr.length - 1
                            ? 'bg-emerald-500'
                            : 'bg-indigo-500',
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* By rule */}
      <Card>
        <CardContent className="p-0">
          <div className="px-5 py-3 border-b">
            <h3 className="font-semibold">By rule</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-5 py-2 text-xs font-medium text-muted-foreground">Rule</th>
                <th className="text-right px-5 py-2 text-xs font-medium text-muted-foreground">Fired</th>
                <th className="text-right px-5 py-2 text-xs font-medium text-muted-foreground">Leads</th>
                <th className="text-right px-5 py-2 text-xs font-medium text-muted-foreground">Success %</th>
              </tr>
            </thead>
            <tbody>
              {(byRule?.rules ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-6 text-center text-muted-foreground">
                    No rules have fired in this period.
                  </td>
                </tr>
              ) : (
                byRule?.rules.map((r) => (
                  <tr key={r.rule_id} className="border-t">
                    <td className="px-5 py-2">{r.rule_name}</td>
                    <td className="px-5 py-2 text-right">{r.fired_count}</td>
                    <td className="px-5 py-2 text-right">{r.leads_created}</td>
                    <td className="px-5 py-2 text-right">{r.success_rate.toFixed(1)}%</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  loading: boolean
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <Icon className="h-4 w-4 text-indigo-500 mb-1" />
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        {loading ? (
          <Skeleton className="h-7 w-16 mt-1" />
        ) : (
          <p className="text-2xl font-bold mt-0.5">{value}</p>
        )}
      </CardContent>
    </Card>
  )
}
