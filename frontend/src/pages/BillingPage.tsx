import { useState } from 'react'
import { CheckCircle2, Loader2, Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  useBillingCurrent,
  useRequestUpgrade,
  type BillingCurrent,
} from '@/hooks/useBilling'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn, formatINR } from '@/lib/utils'

export default function BillingPage() {
  const { data, isLoading } = useBillingCurrent()

  if (isLoading || !data) {
    return (
      <div className="max-w-5xl mx-auto py-12 text-center text-muted-foreground">
        Loading…
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Billing & usage</h1>
        <p className="text-muted-foreground mt-1">
          Current plan, this month's usage, and upgrade options.
        </p>
      </div>

      <CurrentPlanCard data={data} />
      <UsageBars data={data} />
      <PlansGrid currentPlan={data.plan.code} />
    </div>
  )
}

function CurrentPlanCard({ data }: { data: BillingCurrent }) {
  const isFree = (data.plan.price_inr ?? 0) === 0
  return (
    <Card>
      <CardContent className="p-5 flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Current plan
          </p>
          <p className="text-2xl font-bold mt-1">
            {data.plan.name}
            {!isFree && (
              <span className="text-base font-normal text-muted-foreground ml-2">
                · {formatINR(data.plan.price_inr)}/month
              </span>
            )}
          </p>
          {data.next_reset_at && (
            <p className="text-xs text-muted-foreground mt-1">
              Usage resets {new Date(data.next_reset_at).toLocaleDateString()}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function UsageBars({ data }: { data: BillingCurrent }) {
  const rows = [
    {
      label: 'Users',
      used: data.usage.users,
      limit: data.limits.users,
      pct: data.percent_used.users,
    },
    {
      label: 'Leads',
      used: data.usage.leads,
      limit: data.limits.leads,
      pct: data.percent_used.leads,
    },
    {
      label: 'AI calls this month',
      used: data.usage.ai_calls_this_month,
      limit: data.limits.ai_calls_per_month,
      pct: data.percent_used.ai_calls,
    },
  ]

  return (
    <Card>
      <CardContent className="p-5 space-y-5">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium">{r.label}</span>
              <span className="text-sm text-muted-foreground">
                {r.used.toLocaleString()} / {r.limit.toLocaleString()}
              </span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full transition-all',
                  r.pct >= 95
                    ? 'bg-red-500'
                    : r.pct >= 80
                      ? 'bg-amber-500'
                      : 'bg-emerald-500',
                )}
                style={{ width: `${Math.min(r.pct, 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {r.pct.toFixed(1)}% used
            </p>
          </div>
        ))}
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            AI tokens this month:{' '}
            <span className="font-semibold text-foreground">
              {data.usage.ai_tokens_this_month.toLocaleString()}
            </span>
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

const PLANS = [
  {
    code: 'starter',
    name: 'Starter',
    price: 0,
    tagline: 'For small teams trying us out.',
    points: [
      '3 users',
      '1,000 leads',
      '500 AI calls/month',
      'Community support',
    ],
  },
  {
    code: 'growth',
    name: 'Growth',
    price: 4999,
    tagline: 'For growing sales teams.',
    points: [
      '10 users',
      '10,000 leads',
      '5,000 AI calls/month',
      'Email support',
      'Campaign A/B testing',
    ],
  },
  {
    code: 'enterprise',
    name: 'Enterprise',
    price: 14999,
    tagline: 'For scale-up operations.',
    points: [
      'Unlimited users',
      '100,000 leads',
      '50,000 AI calls/month',
      'Priority support',
      'Custom AI integrations',
    ],
  },
] as const

function PlansGrid({ currentPlan }: { currentPlan: string }) {
  const upgrade = useRequestUpgrade()
  const [pending, setPending] = useState<string | null>(null)

  async function handleRequest(code: 'starter' | 'growth' | 'enterprise') {
    if (code === currentPlan) return
    if (
      !window.confirm(
        `Request upgrade to ${code.charAt(0).toUpperCase() + code.slice(1)}? Our team will reach out to confirm.`,
      )
    )
      return
    setPending(code)
    try {
      const r = await upgrade.mutateAsync(code)
      toast.success(r.message)
    } catch {
      toast.error('Failed to request upgrade')
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {PLANS.map((p) => {
        const isCurrent = currentPlan === p.code
        return (
          <Card
            key={p.code}
            className={cn(
              'border-2',
              isCurrent && 'border-indigo-500',
            )}
          >
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-bold">{p.name}</h3>
                {isCurrent && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                    <Zap className="h-3 w-3" /> Current
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold">
                {p.price === 0 ? 'Free' : formatINR(p.price)}
                {p.price > 0 && (
                  <span className="text-sm font-normal text-muted-foreground">
                    /month
                  </span>
                )}
              </p>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                {p.tagline}
              </p>
              <ul className="space-y-1.5 mb-4">
                {p.points.map((pt) => (
                  <li key={pt} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
              <Button
                variant={isCurrent ? 'outline' : 'default'}
                disabled={isCurrent || pending === p.code}
                className="w-full"
                onClick={() => handleRequest(p.code)}
              >
                {pending === p.code && (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                )}
                {isCurrent ? 'Current plan' : `Upgrade to ${p.name}`}
              </Button>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
